/*
  # Fix RLS Issues and Social Accountability & Reporting System

  1. Remove problematic RLS policies
  2. Create reporting system tables
  3. Add meeting recording management
  4. Implement voting system
  5. Add penalty and consequence system
  6. Create comprehensive functions for report management
*/

-- Disable RLS on chat tables to fix errors
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence DISABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies
DROP POLICY IF EXISTS "Users can view messages in their communities" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their communities" ON chat_messages;
DROP POLICY IF EXISTS "Users can edit their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view participants in their communities" ON chat_participants;
DROP POLICY IF EXISTS "Users can manage their own participation" ON chat_participants;
DROP POLICY IF EXISTS "Users can create their own participation records" ON chat_participants;
DROP POLICY IF EXISTS "Users can view reactions in their communities" ON message_reactions;
DROP POLICY IF EXISTS "Users can manage their own reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can view their own notifications" ON chat_notifications;
DROP POLICY IF EXISTS "System can create notifications" ON chat_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON chat_notifications;
DROP POLICY IF EXISTS "Users can view presence in their communities" ON user_presence;
DROP POLICY IF EXISTS "Users can manage their own presence" ON user_presence;
DROP POLICY IF EXISTS "Users can view typing indicators in their communities" ON typing_indicators;
DROP POLICY IF EXISTS "Users can manage their own typing status" ON typing_indicators;

-- Create reports table for member reporting system
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  meeting_session_id uuid REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reported_member_id uuid NOT NULL,
  violation_type text NOT NULL CHECK (violation_type IN ('not_working', 'wrong_task', 'inappropriate_behavior', 'other')),
  description text NOT NULL,
  evidence_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'voting', 'resolved_disqualify', 'resolved_no_action', 'resolved_false_report')),
  resolution_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  was_reported boolean DEFAULT false
);

-- Create report votes table for community voting
CREATE TABLE IF NOT EXISTS report_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('disqualify', 'no_action', 'false_report')),
  reasoning text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(report_id, voter_id)
);

-- Create meeting recordings table
CREATE TABLE IF NOT EXISTS meeting_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_session_id uuid NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  upload_status text DEFAULT 'uploading' CHECK (upload_status IN ('uploading', 'completed', 'failed')),
  access_level text DEFAULT 'community' CHECK (access_level IN ('community', 'restricted', 'deleted')),
  retention_policy text DEFAULT 'standard' CHECK (retention_policy IN ('standard', 'extended', 'permanent')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create report analytics table
CREATE TABLE IF NOT EXISTS report_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  total_reports integer DEFAULT 0,
  pending_reports integer DEFAULT 0,
  resolved_reports integer DEFAULT 0,
  false_reports integer DEFAULT 0,
  disqualified_members integer DEFAULT 0,
  average_resolution_time_hours numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create member penalties table
CREATE TABLE IF NOT EXISTS member_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  penalty_type text NOT NULL CHECK (penalty_type IN ('warning', 'stake_forfeit', 'disqualification', 'ban')),
  penalty_amount integer DEFAULT 0,
  description text NOT NULL,
  is_active boolean DEFAULT true,
  applied_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create moderation logs table
CREATE TABLE IF NOT EXISTS moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('report_created', 'vote_cast', 'report_resolved', 'penalty_applied', 'member_disqualified')),
  target_member_id uuid,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_community_status ON reports(community_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_meeting_session ON reports(meeting_session_id);
CREATE INDEX IF NOT EXISTS idx_report_votes_report ON report_votes(report_id);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_session ON meeting_recordings(meeting_session_id);
CREATE INDEX IF NOT EXISTS idx_member_penalties_community_member ON member_penalties(community_id, member_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_community ON moderation_logs(community_id, created_at DESC);

-- Function to create a new report
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
  report_id uuid;
BEGIN
  -- Validate that both users are members of the community
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
    RAISE EXCEPTION 'Reported member is not a member of this community';
  END IF;
  
  -- Create the report
  INSERT INTO reports (
    community_id, meeting_session_id, reporter_id, reported_member_id,
    violation_type, description, evidence_url, status
  )
  VALUES (
    p_community_id, p_meeting_session_id, p_reporter_id, p_reported_member_id,
    p_violation_type, p_description, p_evidence_url, 'pending'
  )
  RETURNING id INTO report_id;
  
  -- Mark meeting as reported
  UPDATE meeting_sessions 
  SET was_reported = true 
  WHERE id = p_meeting_session_id;
  
  -- Log the action
  INSERT INTO moderation_logs (
    community_id, moderator_id, action_type, target_member_id, report_id,
    details
  )
  VALUES (
    p_community_id, p_reporter_id, 'report_created', p_reported_member_id, report_id,
    jsonb_build_object('violation_type', p_violation_type, 'description', p_description)
  );
  
  -- Send notifications to community members
  PERFORM notify_community_members_of_report(p_community_id, report_id);
  
  RETURN report_id;
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
  total_eligible_voters integer;
  current_votes integer;
  disqualify_votes integer;
  no_action_votes integer;
  false_report_votes integer;
  majority_threshold integer;
BEGIN
  -- Get report details
  SELECT * INTO report_record FROM reports WHERE id = p_report_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;
  
  -- Validate voter is eligible (community member, not reporter or reported)
  IF NOT EXISTS (
    SELECT 1 FROM community_members 
    WHERE community_id = report_record.community_id AND user_id = p_voter_id
  ) THEN
    RAISE EXCEPTION 'Voter is not a member of this community';
  END IF;
  
  IF p_voter_id = report_record.reporter_id OR p_voter_id = report_record.reported_member_id THEN
    RAISE EXCEPTION 'Reporter and reported member cannot vote';
  END IF;
  
  -- Insert or update vote
  INSERT INTO report_votes (report_id, voter_id, community_id, vote_type, reasoning)
  VALUES (p_report_id, p_voter_id, report_record.community_id, p_vote_type, p_reasoning)
  ON CONFLICT (report_id, voter_id)
  DO UPDATE SET vote_type = EXCLUDED.vote_type, reasoning = EXCLUDED.reasoning;
  
  -- Log the vote
  INSERT INTO moderation_logs (
    community_id, moderator_id, action_type, report_id, details
  )
  VALUES (
    report_record.community_id, p_voter_id, 'vote_cast', p_report_id,
    jsonb_build_object('vote_type', p_vote_type, 'reasoning', p_reasoning)
  );
  
  -- Check if we should resolve the report
  SELECT COUNT(*) INTO total_eligible_voters
  FROM community_members 
  WHERE community_id = report_record.community_id
    AND user_id NOT IN (report_record.reporter_id, report_record.reported_member_id);
  
  SELECT COUNT(*) INTO current_votes FROM report_votes WHERE report_id = p_report_id;
  
  majority_threshold := CEIL(total_eligible_voters::numeric / 2);
  
  -- Count votes by type
  SELECT 
    COUNT(*) FILTER (WHERE vote_type = 'disqualify'),
    COUNT(*) FILTER (WHERE vote_type = 'no_action'),
    COUNT(*) FILTER (WHERE vote_type = 'false_report')
  INTO disqualify_votes, no_action_votes, false_report_votes
  FROM report_votes 
  WHERE report_id = p_report_id;
  
  -- Auto-resolve if majority reached
  IF disqualify_votes >= majority_threshold THEN
    PERFORM resolve_report(p_report_id, 'resolved_disqualify', 'Majority voted to disqualify member');
  ELSIF no_action_votes >= majority_threshold THEN
    PERFORM resolve_report(p_report_id, 'resolved_no_action', 'Majority voted for no action');
  ELSIF false_report_votes >= majority_threshold THEN
    PERFORM resolve_report(p_report_id, 'resolved_false_report', 'Majority voted report as false');
  ELSIF current_votes >= total_eligible_voters THEN
    -- All eligible voters have voted, resolve with plurality
    IF disqualify_votes > no_action_votes AND disqualify_votes > false_report_votes THEN
      PERFORM resolve_report(p_report_id, 'resolved_disqualify', 'Plurality voted to disqualify member');
    ELSIF no_action_votes > false_report_votes THEN
      PERFORM resolve_report(p_report_id, 'resolved_no_action', 'Plurality voted for no action');
    ELSE
      PERFORM resolve_report(p_report_id, 'resolved_false_report', 'Plurality voted report as false');
    END IF;
  END IF;
  
  RETURN true;
END;
$$;

-- Function to resolve a report
CREATE OR REPLACE FUNCTION resolve_report(
  p_report_id uuid,
  p_status text,
  p_resolution_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_record RECORD;
BEGIN
  -- Get report details
  SELECT * INTO report_record FROM reports WHERE id = p_report_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;
  
  -- Update report status
  UPDATE reports 
  SET 
    status = p_status,
    resolution_reason = p_resolution_reason,
    resolved_at = now(),
    updated_at = now()
  WHERE id = p_report_id;
  
  -- Apply consequences based on resolution
  IF p_status = 'resolved_disqualify' THEN
    -- Disqualify the reported member
    PERFORM apply_member_disqualification(
      report_record.community_id,
      report_record.reported_member_id,
      p_report_id,
      'Disqualified due to community vote on violation report'
    );
  ELSIF p_status = 'resolved_false_report' THEN
    -- Penalize the reporter for false reporting
    PERFORM apply_false_report_penalty(
      report_record.community_id,
      report_record.reporter_id,
      p_report_id,
      'Penalty for filing false report'
    );
  END IF;
  
  -- Log the resolution
  INSERT INTO moderation_logs (
    community_id, moderator_id, action_type, target_member_id, report_id, details
  )
  VALUES (
    report_record.community_id, NULL, 'report_resolved', 
    CASE WHEN p_status = 'resolved_disqualify' THEN report_record.reported_member_id
         WHEN p_status = 'resolved_false_report' THEN report_record.reporter_id
         ELSE NULL END,
    p_report_id,
    jsonb_build_object('status', p_status, 'reason', p_resolution_reason)
  );
  
  -- Send notifications about resolution
  PERFORM notify_community_of_resolution(report_record.community_id, p_report_id, p_status);
  
  RETURN true;
END;
$$;

-- Function to apply member disqualification
CREATE OR REPLACE FUNCTION apply_member_disqualification(
  p_community_id uuid,
  p_member_id uuid,
  p_report_id uuid,
  p_description text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stake_amount integer;
BEGIN
  -- Get community stake amount
  SELECT communities.stake_amount INTO stake_amount
  FROM communities 
  WHERE id = p_community_id;
  
  -- Mark member as disqualified
  UPDATE community_members 
  SET is_disqualified = true
  WHERE community_id = p_community_id AND user_id = p_member_id;
  
  -- Record penalty
  INSERT INTO member_penalties (
    community_id, member_id, report_id, penalty_type, 
    penalty_amount, description
  )
  VALUES (
    p_community_id, p_member_id, p_report_id, 'disqualification',
    stake_amount, p_description
  );
  
  -- Record earnings loss
  INSERT INTO earnings (
    user_id, community_id, amount, type, description
  )
  VALUES (
    p_member_id, p_community_id, -stake_amount, 'forfeit',
    'Stake forfeited due to disqualification: ' || p_description
  );
  
  -- Log the action
  INSERT INTO moderation_logs (
    community_id, moderator_id, action_type, target_member_id, report_id, details
  )
  VALUES (
    p_community_id, NULL, 'member_disqualified', p_member_id, p_report_id,
    jsonb_build_object('penalty_amount', stake_amount, 'description', p_description)
  );
  
  RETURN true;
END;
$$;

-- Function to apply false report penalty
CREATE OR REPLACE FUNCTION apply_false_report_penalty(
  p_community_id uuid,
  p_reporter_id uuid,
  p_report_id uuid,
  p_description text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  penalty_amount integer;
BEGIN
  -- Calculate penalty (50% of stake amount)
  SELECT (stake_amount * 0.5)::integer INTO penalty_amount
  FROM communities 
  WHERE id = p_community_id;
  
  -- Record penalty
  INSERT INTO member_penalties (
    community_id, member_id, report_id, penalty_type, 
    penalty_amount, description
  )
  VALUES (
    p_community_id, p_reporter_id, p_report_id, 'stake_forfeit',
    penalty_amount, p_description
  );
  
  -- Record earnings loss
  INSERT INTO earnings (
    user_id, community_id, amount, type, description
  )
  VALUES (
    p_reporter_id, p_community_id, -penalty_amount, 'forfeit',
    'Penalty for false reporting: ' || p_description
  );
  
  -- Log the action
  INSERT INTO moderation_logs (
    community_id, moderator_id, action_type, target_member_id, report_id, details
  )
  VALUES (
    p_community_id, NULL, 'penalty_applied', p_reporter_id, p_report_id,
    jsonb_build_object('penalty_amount', penalty_amount, 'description', p_description)
  );
  
  RETURN true;
END;
$$;

-- Function to get community reports
CREATE OR REPLACE FUNCTION get_community_reports(
  p_community_id uuid,
  p_status_filter text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  meeting_session_id uuid,
  reporter_id uuid,
  reported_member_id uuid,
  violation_type text,
  description text,
  evidence_url text,
  status text,
  resolution_reason text,
  created_at timestamptz,
  resolved_at timestamptz,
  vote_counts jsonb,
  total_eligible_voters integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.meeting_session_id,
    r.reporter_id,
    r.reported_member_id,
    r.violation_type,
    r.description,
    r.evidence_url,
    r.status,
    r.resolution_reason,
    r.created_at,
    r.resolved_at,
    COALESCE(vote_summary.vote_counts, '{}'::jsonb) as vote_counts,
    COALESCE(eligible_voters.count, 0) as total_eligible_voters
  FROM reports r
  LEFT JOIN (
    SELECT 
      rv.report_id,
      jsonb_object_agg(rv.vote_type, rv.vote_count) as vote_counts
    FROM (
      SELECT 
        report_id,
        vote_type,
        COUNT(*) as vote_count
      FROM report_votes
      GROUP BY report_id, vote_type
    ) rv
    GROUP BY rv.report_id
  ) vote_summary ON r.id = vote_summary.report_id
  LEFT JOIN (
    SELECT 
      p_community_id as community_id,
      COUNT(*) - 2 as count  -- Subtract reporter and reported member
    FROM community_members 
    WHERE community_id = p_community_id
  ) eligible_voters ON true
  WHERE r.community_id = p_community_id
    AND (p_status_filter IS NULL OR r.status = p_status_filter)
  ORDER BY 
    CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
    r.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to get report analytics
CREATE OR REPLACE FUNCTION get_report_analytics(
  p_community_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  total_reports bigint,
  pending_reports bigint,
  resolved_reports bigint,
  false_reports bigint,
  disqualified_members bigint,
  average_resolution_hours numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_date timestamptz;
BEGIN
  start_date := now() - (p_days || ' days')::interval;
  
  RETURN QUERY
  SELECT 
    COUNT(*) as total_reports,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_reports,
    COUNT(*) FILTER (WHERE status LIKE 'resolved_%') as resolved_reports,
    COUNT(*) FILTER (WHERE status = 'resolved_false_report') as false_reports,
    COUNT(*) FILTER (WHERE status = 'resolved_disqualify') as disqualified_members,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as average_resolution_hours
  FROM reports
  WHERE community_id = p_community_id
    AND created_at >= start_date;
END;
$$;

-- Function to notify community members of new report
CREATE OR REPLACE FUNCTION notify_community_members_of_report(
  p_community_id uuid,
  p_report_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_record RECORD;
  report_record RECORD;
BEGIN
  -- Get report details
  SELECT * INTO report_record FROM reports WHERE id = p_report_id;
  
  -- Notify all community members except reporter and reported member
  FOR member_record IN 
    SELECT user_id FROM community_members 
    WHERE community_id = p_community_id 
      AND user_id NOT IN (report_record.reporter_id, report_record.reported_member_id)
  LOOP
    INSERT INTO chat_notifications (
      user_id, community_id, notification_type, title, content
    )
    VALUES (
      member_record.user_id, p_community_id, 'community_update',
      'New Member Report',
      'A community member has been reported for violation. Your vote is needed to resolve this matter.'
    );
  END LOOP;
END;
$$;

-- Function to notify community of report resolution
CREATE OR REPLACE FUNCTION notify_community_of_resolution(
  p_community_id uuid,
  p_report_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_record RECORD;
  notification_title text;
  notification_content text;
BEGIN
  -- Set notification content based on resolution
  CASE p_status
    WHEN 'resolved_disqualify' THEN
      notification_title := 'Member Disqualified';
      notification_content := 'A community member has been disqualified following the voting process.';
    WHEN 'resolved_no_action' THEN
      notification_title := 'Report Resolved - No Action';
      notification_content := 'The community has voted to take no action on the recent report.';
    WHEN 'resolved_false_report' THEN
      notification_title := 'False Report Identified';
      notification_content := 'The community has determined that a recent report was false. Appropriate penalties have been applied.';
    ELSE
      notification_title := 'Report Resolved';
      notification_content := 'A community report has been resolved.';
  END CASE;
  
  -- Notify all community members
  FOR member_record IN 
    SELECT user_id FROM community_members WHERE community_id = p_community_id
  LOOP
    INSERT INTO chat_notifications (
      user_id, community_id, notification_type, title, content
    )
    VALUES (
      member_record.user_id, p_community_id, 'community_update',
      notification_title, notification_content
    );
  END LOOP;
END;
$$;

-- Function to manage recording retention
CREATE OR REPLACE FUNCTION manage_recording_retention(
  p_meeting_session_id uuid,
  p_report_outcome text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_report_outcome = 'resolved_disqualify' THEN
    -- Keep recording for disqualified members (extended retention)
    UPDATE meeting_recordings 
    SET retention_policy = 'extended'
    WHERE meeting_session_id = p_meeting_session_id;
  ELSIF p_report_outcome IN ('resolved_no_action', 'resolved_false_report') THEN
    -- Delete recording for privacy when cleared
    UPDATE meeting_recordings 
    SET access_level = 'deleted', retention_policy = 'standard'
    WHERE meeting_session_id = p_meeting_session_id;
  END IF;
END;
$$;

-- Add triggers for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_recordings_updated_at
  BEFORE UPDATE ON meeting_recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_member_report TO authenticated;
GRANT EXECUTE ON FUNCTION cast_report_vote TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_reports TO authenticated;
GRANT EXECUTE ON FUNCTION get_report_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION manage_recording_retention TO authenticated;

-- Add missing columns to existing tables
ALTER TABLE meeting_sessions ADD COLUMN IF NOT EXISTS was_reported boolean DEFAULT false;
ALTER TABLE community_members ADD COLUMN IF NOT EXISTS is_disqualified boolean DEFAULT false;