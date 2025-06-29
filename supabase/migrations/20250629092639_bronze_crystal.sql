/*
  # Fix profiles table and add RLS policies
  
  1. Changes
    - Add email column to profiles table
    - Create trigger to handle new user creation
    - Enable RLS on profiles table
    - Add RLS policies for profiles
    - Create function to update profiles updated_at
    - Create user statistics table
    - Create trigger for initializing user statistics
*/

-- Fix profiles table and add RLS policies
ALTER TABLE IF EXISTS profiles
ADD COLUMN IF NOT EXISTS email text;

-- Create trigger to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    name = COALESCE(EXCLUDED.name, profiles.name),
    email = COALESCE(EXCLUDED.email, profiles.email);
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS on profiles table if not already enabled
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
DO $$
BEGIN
  -- Check if the policy exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
      ON profiles FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
  
  -- Check if the policy exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON profiles FOR UPDATE
      TO authenticated
      USING (id = auth.uid());
  END IF;
END
$$;

-- Create function to update profiles updated_at
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles updated_at if not exists
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Create user statistics table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_hours_logged numeric(10,2) DEFAULT 0,
  communities_joined integer DEFAULT 0,
  communities_won integer DEFAULT 0,
  communities_lost integer DEFAULT 0,
  total_earnings integer DEFAULT 0,
  total_losses integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  meetings_attended integer DEFAULT 0,
  goals_completed integer DEFAULT 0,
  success_rate numeric(5,2) DEFAULT 0,
  platform_tenure_days integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to initialize user statistics
CREATE OR REPLACE FUNCTION initialize_user_statistics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_statistics (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for initializing user statistics
DROP TRIGGER IF EXISTS on_auth_user_created_stats ON auth.users;

CREATE TRIGGER on_auth_user_created_stats
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_statistics();