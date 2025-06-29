/*
  # Add INSERT policy for profiles table

  1. Security
    - Add RLS policy to allow users to insert their own profile data during signup
    - Policy ensures users can only create profiles for their own user ID

  2. Changes
    - Add INSERT policy for authenticated users on profiles table
    - Users can only insert records where the ID matches their auth.uid()
*/

-- Add INSERT policy for profiles table
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);