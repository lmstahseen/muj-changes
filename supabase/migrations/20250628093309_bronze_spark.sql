/*
  # Fix Communities Insert Policy

  1. Security Updates
    - Drop existing insert policy that's not working correctly
    - Create new insert policy that properly validates creator_id
    - Ensure authenticated users can only create communities with their own user ID as creator_id

  2. Changes
    - Replace the existing insert policy with a more specific one
    - Use auth.uid() to validate the creator_id matches the authenticated user
*/

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Authenticated users can create communities" ON communities;

-- Create a new, more specific insert policy
CREATE POLICY "Authenticated users can create communities"
  ON communities
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);