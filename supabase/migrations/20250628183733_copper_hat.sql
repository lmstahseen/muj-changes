/*
  # Fix moderation logs action type constraint

  1. Problem
    - The `moderation_logs_action_type_check` constraint is missing the `community_status_change` action type
    - This causes errors when the `update_community_status` RPC function tries to log community status changes

  2. Solution
    - Drop the existing constraint
    - Create a new constraint that includes `community_status_change` as a valid action type

  3. Changes
    - Add `community_status_change` to the allowed action types in the check constraint
*/

-- Drop the existing constraint
ALTER TABLE moderation_logs DROP CONSTRAINT IF EXISTS moderation_logs_action_type_check;

-- Create the updated constraint with the missing action type
ALTER TABLE moderation_logs ADD CONSTRAINT moderation_logs_action_type_check 
  CHECK ((action_type = ANY (ARRAY[
    'report_created'::text, 
    'vote_cast'::text, 
    'report_resolved'::text, 
    'penalty_applied'::text, 
    'member_disqualified'::text,
    'community_status_change'::text
  ])));