/*
  # Fix signup profile creation

  1. Database Functions
    - Create function to handle new user profile creation
    - Update existing trigger or create new one for auth.users

  2. Security
    - Add RLS policy to allow profile creation during signup
    - Ensure proper permissions for the trigger function

  3. Changes
    - Add handle_new_user function if it doesn't exist properly
    - Update RLS policies to allow profile creation
    - Ensure trigger is properly configured
*/

-- Create or replace the function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    null
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for profiles table to allow profile creation during signup
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Allow users to insert their own profile (this covers both authenticated and during signup)
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow the trigger function to insert profiles (using SECURITY DEFINER)
-- This policy allows inserts when there's no current user (during signup)
CREATE POLICY "Allow profile creation during signup" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Ensure the handle_new_user function has proper permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;