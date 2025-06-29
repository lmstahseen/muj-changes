/*
  # Fix Profile Creation During Signup

  1. New Functions
    - Improved `handle_new_user` function to properly create profiles for new users
    - Ensures proper data is copied from auth.users to public.profiles

  2. Security
    - Uses SECURITY DEFINER to bypass RLS during profile creation
    - Adds proper RLS policy to allow public signup

  3. Changes
    - Drops existing trigger if it exists
    - Creates new trigger on auth.users
    - Adds public policy for profile creation during signup
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
    '👤'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;

-- Allow insert during signup (public access)
CREATE POLICY "Allow profile creation during signup"
  ON profiles
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Ensure authenticated users can still insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;