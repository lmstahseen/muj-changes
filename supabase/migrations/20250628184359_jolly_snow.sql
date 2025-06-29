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