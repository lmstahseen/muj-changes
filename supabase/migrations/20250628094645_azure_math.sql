/*
  # Fix Communities INSERT Policy

  1. Security Policy Updates
    - Drop the existing INSERT policy for communities table
    - Create a new INSERT policy that properly uses auth.uid()
    - Ensure authenticated users can create communities when they are the creator

  2. Changes Made
    - Replace uid() with auth.uid() in the INSERT policy
    - Maintain the same security logic but with correct function reference
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create communities" ON communities;

-- Create the corrected INSERT policy
CREATE POLICY "Authenticated users can create communities"
  ON communities
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);