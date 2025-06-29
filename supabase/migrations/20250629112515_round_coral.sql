/*
  # Disable RLS temporarily for auth troubleshooting
  
  1. Changes
    - Temporarily disable RLS on profiles table to fix auth issues
    - This is a temporary measure to ensure authentication works properly
    - Once auth is stable, RLS should be re-enabled with proper policies
*/

-- Temporarily disable RLS on profiles table
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;

-- Ensure public access to profiles for authentication
DO $$
BEGIN
  -- Check if the policy exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Allow profile creation during signup'
  ) THEN
    CREATE POLICY "Allow profile creation during signup"
      ON profiles FOR INSERT
      TO public;
  END IF;
END
$$;

-- Ensure the trigger for new users is working correctly
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

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();