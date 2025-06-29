/*
  # Fix Reporting System Migration

  1. New Columns
    - Add `was_reported` boolean column to `meeting_sessions` table
    - Add `is_disqualified` boolean column to `community_members` table
  
  2. Indexes
    - Create indexes for meeting participants to improve query performance
    - Create unique index for active participants
  
  3. Functions
    - Create functions for participant tracking and meeting management
    - Create functions for report creation and voting
    - Create functions for meeting statistics
  
  4. Security
    - Grant appropriate permissions to functions
*/

-- Add was_reported column to meeting_sessions
ALTER TABLE meeting_sessions ADD COLUMN IF NOT EXISTS was_reported boolean DEFAULT false;

-- Add is_disqualified column to community_members
ALTER TABLE community_members ADD COLUMN IF NOT EXISTS is_disqualified boolean DEFAULT false;

-- Create index for meeting participants last seen
CREATE INDEX IF NOT EXISTS idx_meeting_participants_last_seen ON meeting_participants(last_seen);

-- Create index for active participants
CREATE INDEX IF NOT EXISTS idx_meeting_participants_active ON meeting_participants(meeting_session_id, is_active);

-- Create unique index for active participants (one active stream per user per meeting)
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_participants_unique_active 
ON meeting_participants(meeting_session_id, user_id) 
WHERE is_active = true;

-- Function to update participant last seen
CREATE OR REPLACE FUNCTION update_participant_last_seen(
  p_meeting_session_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE meeting_participants
  SET last_seen = now()
  WHERE meeting_session_id = p_meeting_session_id
    AND user_id = p_user_id
    AND is_active = true;
END;
$$;

-- Function to check for inactive meetings and auto-end them
CREATE OR REPLACE FUNCTION cleanup_inactive_meetings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inactive_meeting RECORD;
BEGIN
  -- Find meetings with no active participants for more than 2 minutes
  FOR inactive_meeting IN
    SELECT ms.id, ms.community_id
    FROM meeting_sessions ms
    WHERE ms.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM meeting_participants mp
        WHERE mp.meeting_session_id = ms.id
          AND mp.is_active = true
          AND mp.last_seen > now() - interval '2 minutes'
      )
  LOOP
    -- End the meeting
    UPDATE meeting_sessions
    SET 
      status = 'completed',
      end_time = now(),
      notes = COALESCE(notes, '') || ' Auto-ended due to inactivity.'
    WHERE id = inactive_meeting.id;
    
    -- Mark all participants as inactive
    UPDATE meeting_participants
    SET 
      is_active = false,
      left_at = now()
    WHERE meeting_session_id = inactive_meeting.id
      AND is_active = true;
    
    -- Update all active attendances
    UPDATE meeting_attendance
    SET left_at = now()
    WHERE meeting_session_id = inactive_meeting.id
      AND left_at IS NULL;
    
    -- Send notification
    INSERT INTO meeting_notifications (
      community_id,
      notification_type,
      message,
      sent_at
    ) VALUES (
      inactive_meeting.community_id,
      'meeting_ended',
      'Meeting automatically ended due to inactivity',
      now()
    );
  END LOOP;
END;
$$;

-- Function to update meeting attendance when participant leaves
CREATE OR REPLACE FUNCTION update_meeting_attendance_on_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  duration_sec integer;
BEGIN
  -- Only process when a participant becomes inactive
  IF OLD.is_active = true AND NEW.is_active = false THEN
    -- Calculate duration
    duration_sec := EXTRACT(EPOCH FROM (NEW.left_at - NEW.joined_at))::integer;
    
    -- Update attendance record
    UPDATE meeting_attendance
    SET 
      left_at = NEW.left_at,
      duration_seconds = duration_sec,
      screen_shared = NEW.stream_type = 'screen'
    WHERE meeting_session_id = NEW.meeting_session_id
      AND user_id = NEW.user_id
      AND left_at IS NULL;
    
    -- Update member's total meeting seconds
    UPDATE community_members
    SET total_meeting_seconds = COALESCE(total_meeting_seconds, 0) + duration_sec
    WHERE community_id = NEW.community_id
      AND user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for updating attendance on leave
DROP TRIGGER IF EXISTS trigger_update_attendance_on_leave ON meeting_participants;
CREATE TRIGGER trigger_update_attendance_on_leave
  AFTER UPDATE ON meeting_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_attendance_on_leave();

-- Function to create a member report
CREATE OR REPLACE FUNCTION create_member_report(
  p_community_id uuid,
  p_meeting_session_id uuid,
  p_reporter_id uuid,
  p_reported_member_id uuid,
  p_violation_type text,
  p_description text,
  p_evidence_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_report_id uuid;
BEGIN
  -- Validate inputs
  IF p_reporter_id = p_reported_member_id THEN
    RAISE EXCEPTION 'Cannot report yourself';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM community_members 
    WHERE community_id = p_community_id AND user_id = p_reporter_id
  ) THEN
    RAISE EXCEPTION 'Reporter is not a member of this community';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM community_members 
    WHERE community_id = p_community_id AND user_id = p_reported_member_id
  ) THEN
    RAISE EXCEPTION 'Reported user is not a member of this community';
  END IF;
  
  -- Create report
  INSERT INTO reports (
    community_id,
    meeting_session_id,
    reporter_id,
    reported_member_id,
    violation_type,
    description,
    evidence_url,
    status
  ) VALUES (
    p_community_id,
    p_meeting_session_id,
    p_reporter_id,
    p_reported_member_id,
    p_violation_type,
    p_description,
    p_evidence_url,
    'pending'
  ) RETURNING id INTO new_report_id;
  
  -- Mark meeting as reported
  IF p_meeting_session_id IS NOT NULL THEN
    UPDATE meeting_sessions
    SET was_reported = true
    WHERE id = p_meeting_session_id;
  END IF;
  
  -- Create moderation log
  INSERT INTO moderation_logs (
    community_id,
    moderator_id,
    action_type,
    target_member_id,
    report_id,
    details
  ) VALUES (
    p_community_id,
    p_reporter_id,
    'report_created',
    p_reported_member_id,
    new_report_id,
    jsonb_build_object(
      'violation_type', p_violation_type,
      'meeting_session_id', p_meeting_session_id
    )
  );
  
  RETURN new_report_id;
END;
$$;

-- Function to cast a vote on a report
CREATE OR REPLACE FUNCTION cast_report_vote(
  p_report_id uuid,
  p_voter_id uuid,
  p_vote_type text,
  p_reasoning text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_record RECORD;
  community_id uuid;
  reported_member_id uuid;
  total_eligible_voters integer;
  vote_counts jsonb;
  resolution text;
  resolution_reason text;
BEGIN
  -- Get report details
  SELECT r.community_id, r.reported_member_id, r.reporter_id, r.status
  INTO report_record
  FROM reports r
  WHERE r.id = p_report_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;
  
  community_id := report_record.community_id;
  reported_member_id := report_record.reported_member_id;
  
  -- Check if report is still pending
  IF report_record.status != 'pending' THEN
    RAISE EXCEPTION 'This report has already been resolved';
  END IF;
  
  -- Check if voter is eligible (not the reporter or reported member)
  IF p_voter_id = report_record.reporter_id OR p_voter_id = report_record.reported_member_id THEN
    RAISE EXCEPTION 'You cannot vote on this report';
  END IF;
  
  -- Check if voter is a member of the community
  IF NOT EXISTS (
    SELECT 1 FROM community_members 
    WHERE community_id = community_id AND user_id = p_voter_id
  ) THEN
    RAISE EXCEPTION 'Voter is not a member of this community';
  END IF;
  
  -- Check if voter has already voted
  IF EXISTS (
    SELECT 1 FROM report_votes
    WHERE report_id = p_report_id AND voter_id = p_voter_id
  ) THEN
    RAISE EXCEPTION 'You have already voted on this report';
  END IF;
  
  -- Cast vote
  INSERT INTO report_votes (
    report_id,
    voter_id,
    community_id,
    vote_type,
    reasoning
  ) VALUES (
    p_report_id,
    p_voter_id,
    community_id,
    p_vote_type,
    p_reasoning
  );
  
  -- Create moderation log
  INSERT INTO moderation_logs (
    community_id,
    moderator_id,
    action_type,
    target_member_id,
    report_id,
    details
  ) VALUES (
    community_id,
    p_voter_id,
    'vote_cast',
    reported_member_id,
    p_report_id,
    jsonb_build_object(
      'vote_type', p_vote_type,
      'reasoning', p_reasoning
    )
  );
  
  -- Check if we have enough votes to resolve the report
  -- Get total eligible voters (all community members except reported member and reporter)
  SELECT COUNT(*) INTO total_eligible_voters
  FROM community_members
  WHERE community_id = community_id
    AND user_id NOT IN (report_record.reported_member_id, report_record.reporter_id);
  
  -- Get vote counts
  SELECT 
    jsonb_build_object(
      'disqualify', COUNT(*) FILTER (WHERE vote_type = 'disqualify'),
      'no_action', COUNT(*) FILTER (WHERE vote_type = 'no_action'),
      'false_report', COUNT(*) FILTER (WHERE vote_type = 'false_report')
    ) INTO vote_counts
  FROM report_votes
  WHERE report_id = p_report_id;
  
  -- Calculate voting threshold (at least 3 votes or 50% of eligible voters)
  DECLARE
    voting_threshold integer := GREATEST(3, CEIL(total_eligible_voters * 0.5));
    total_votes integer := (
      (vote_counts->>'disqualify')::integer + 
      (vote_counts->>'no_action')::integer + 
      (vote_counts->>'false_report')::integer
    );
  BEGIN
    -- Check if we have enough votes
    IF total_votes >= voting_threshold THEN
      -- Determine outcome based on majority vote
      IF (vote_counts->>'disqualify')::integer > (vote_counts->>'no_action')::integer 
         AND (vote_counts->>'disqualify')::integer > (vote_counts->>'false_report')::integer THEN
        resolution := 'resolved_disqualify';
        resolution_reason := 'Member disqualified based on community vote (' || 
                            (vote_counts->>'disqualify')::integer || '/' || total_votes || ' votes)';
        
        -- Apply penalty to reported member
        INSERT INTO member_penalties (
          community_id,
          member_id,
          report_id,
          penalty_type,
          penalty_amount,
          description,
          is_active
        ) VALUES (
          community_id,
          reported_member_id,
          p_report_id,
          'disqualification',
          0, -- Will be updated with stake amount
          'Disqualified from community due to violation',
          true
        );
        
        -- Mark member as disqualified
        UPDATE community_members
        SET is_disqualified = true
        WHERE community_id = community_id AND user_id = reported_member_id;
        
      ELSIF (vote_counts->>'false_report')::integer > (vote_counts->>'no_action')::integer 
            AND (vote_counts->>'false_report')::integer > (vote_counts->>'disqualify')::integer THEN
        resolution := 'resolved_false_report';
        resolution_reason := 'Report deemed false based on community vote (' || 
                            (vote_counts->>'false_report')::integer || '/' || total_votes || ' votes)';
        
        -- Apply warning to reporter for false report
        INSERT INTO member_penalties (
          community_id,
          member_id,
          report_id,
          penalty_type,
          penalty_amount,
          description,
          is_active
        ) VALUES (
          community_id,
          report_record.reporter_id,
          p_report_id,
          'warning',
          0,
          'Warning for submitting a false report',
          true
        );
        
      ELSE
        resolution := 'resolved_no_action';
        resolution_reason := 'No action taken based on community vote (' || 
                            (vote_counts->>'no_action')::integer || '/' || total_votes || ' votes)';
      END IF;
      
      -- Update report status
      UPDATE reports
      SET 
        status = resolution,
        resolution_reason = resolution_reason,
        resolved_at = now()
      WHERE id = p_report_id;
      
      -- Create moderation log
      INSERT INTO moderation_logs (
        community_id,
        moderator_id,
        action_type,
        target_member_id,
        report_id,
        details
      ) VALUES (
        community_id,
        '00000000-0000-0000-0000-000000000000', -- System
        'report_resolved',
        reported_member_id,
        p_report_id,
        jsonb_build_object(
          'resolution', resolution,
          'vote_counts', vote_counts,
          'total_votes', total_votes,
          'resolution_reason', resolution_reason
        )
      );
    END IF;
  END;
  
  RETURN true;
END;
$$;

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS get_meeting_statistics(uuid, uuid);
DROP FUNCTION IF EXISTS get_community_reports(uuid, text, integer, integer);

-- Function to get meeting statistics
CREATE FUNCTION get_meeting_statistics(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  total_meetings bigint,
  total_duration_seconds bigint,
  average_duration_seconds numeric,
  screen_share_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ma.meeting_session_id) as total_meetings,
    COALESCE(SUM(ma.duration_seconds), 0) as total_duration_seconds,
    CASE 
      WHEN COUNT(DISTINCT ma.meeting_session_id) > 0 
      THEN ROUND(COALESCE(SUM(ma.duration_seconds), 0) / COUNT(DISTINCT ma.meeting_session_id), 2)
      ELSE 0 
    END as average_duration_seconds,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND(COUNT(*) FILTER (WHERE ma.screen_shared = true) * 100.0 / COUNT(*), 2)
      ELSE 0 
    END as screen_share_percentage
  FROM meeting_attendance ma
  WHERE ma.user_id = p_user_id
    AND (p_community_id IS NULL OR ma.community_id = p_community_id);
END;
$$;

-- Function to get community reports with vote counts
CREATE FUNCTION get_community_reports(
  p_community_id uuid,
  p_status_filter text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_record RECORD;
  vote_counts jsonb;
  total_eligible_voters integer;
  result_json json;
  results_array json[];
BEGIN
  -- Get reports for the community
  FOR report_record IN
    SELECT r.*
    FROM reports r
    WHERE r.community_id = p_community_id
      AND (p_status_filter IS NULL OR r.status = p_status_filter)
    ORDER BY 
      CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
      r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  LOOP
    -- Get vote counts for this report
    SELECT 
      jsonb_build_object(
        'disqualify', COUNT(*) FILTER (WHERE vote_type = 'disqualify'),
        'no_action', COUNT(*) FILTER (WHERE vote_type = 'no_action'),
        'false_report', COUNT(*) FILTER (WHERE vote_type = 'false_report')
      ) INTO vote_counts
    FROM report_votes
    WHERE report_id = report_record.id;
    
    -- Get total eligible voters (all community members except reported member and reporter)
    SELECT COUNT(*) INTO total_eligible_voters
    FROM community_members
    WHERE community_id = p_community_id
      AND user_id NOT IN (report_record.reported_member_id, report_record.reporter_id);
    
    -- Build result JSON with vote counts and eligible voters
    SELECT row_to_json(r) INTO result_json
    FROM (
      SELECT 
        report_record.*,
        vote_counts as vote_counts,
        total_eligible_voters as total_eligible_voters
    ) r;
    
    -- Add to results array
    results_array := array_append(results_array, result_json);
  END LOOP;
  
  -- Return results
  RETURN QUERY SELECT json_array_elements(coalesce(array_to_json(results_array), '[]'::json));
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_participant_last_seen TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_inactive_meetings TO service_role;
GRANT EXECUTE ON FUNCTION create_member_report TO authenticated;
GRANT EXECUTE ON FUNCTION cast_report_vote TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_reports TO authenticated;
GRANT EXECUTE ON FUNCTION get_meeting_statistics TO authenticated;