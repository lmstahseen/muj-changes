-- Function to update community status based on dates
CREATE OR REPLACE FUNCTION update_community_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  community_record RECORD;
  now_timestamp timestamptz := now();
BEGIN
  -- Update communities from 'waiting' to 'active' if start_date has passed
  FOR community_record IN
    SELECT id, title, start_date
    FROM communities
    WHERE status = 'waiting' AND start_date <= now_timestamp
  LOOP
    UPDATE communities
    SET status = 'active', updated_at = now_timestamp
    WHERE id = community_record.id;
    
    -- Create notification for community members
    INSERT INTO chat_notifications (
      user_id,
      community_id,
      notification_type,
      title,
      content,
      is_read
    )
    SELECT 
      user_id,
      community_record.id,
      'community_update',
      'Community Now Active',
      'The community "' || community_record.title || '" is now active! You can start attending meetings and logging progress.',
      false
    FROM community_members
    WHERE community_id = community_record.id;
    
    -- Log the status change
    INSERT INTO moderation_logs (
      community_id,
      moderator_id,
      action_type,
      details
    ) VALUES (
      community_record.id,
      '00000000-0000-0000-0000-000000000000', -- System
      'community_status_change',
      jsonb_build_object(
        'old_status', 'waiting',
        'new_status', 'active',
        'reason', 'Start date reached',
        'start_date', community_record.start_date
      )
    );
  END LOOP;
  
  -- Update communities from 'active' to 'ended' if end_date has passed
  FOR community_record IN
    SELECT id, title, end_date
    FROM communities
    WHERE status = 'active' AND end_date <= now_timestamp
  LOOP
    UPDATE communities
    SET status = 'ended', updated_at = now_timestamp
    WHERE id = community_record.id;
    
    -- Create notification for community members
    INSERT INTO chat_notifications (
      user_id,
      community_id,
      notification_type,
      title,
      content,
      is_read
    )
    SELECT 
      user_id,
      community_record.id,
      'community_update',
      'Community Has Ended',
      'The community "' || community_record.title || '" has ended. Earnings distribution will be processed soon.',
      false
    FROM community_members
    WHERE community_id = community_record.id;
    
    -- Log the status change
    INSERT INTO moderation_logs (
      community_id,
      moderator_id,
      action_type,
      details
    ) VALUES (
      community_record.id,
      '00000000-0000-0000-0000-000000000000', -- System
      'community_status_change',
      jsonb_build_object(
        'old_status', 'active',
        'new_status', 'ended',
        'reason', 'End date reached',
        'end_date', community_record.end_date
      )
    );
  END LOOP;
END;
$$;

-- Function to log member progress
CREATE OR REPLACE FUNCTION log_member_progress(
  p_community_id uuid,
  p_user_id uuid,
  p_hours_logged numeric,
  p_goals_completed integer,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today date := CURRENT_DATE;
  community_record RECORD;
  daily_goal_threshold numeric;
  daily_goal_met boolean;
BEGIN
  -- Validate inputs
  IF p_hours_logged < 0 THEN
    RAISE EXCEPTION 'Hours logged cannot be negative';
  END IF;
  
  IF p_goals_completed < 0 THEN
    RAISE EXCEPTION 'Goals completed cannot be negative';
  END IF;
  
  -- Check if user is a member of the community
  IF NOT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this community';
  END IF;
  
  -- Get community details to check if it's active
  SELECT * INTO community_record
  FROM communities
  WHERE id = p_community_id;
  
  IF NOT FOUND OR community_record.status != 'active' THEN
    RAISE EXCEPTION 'Progress can only be logged for active communities';
  END IF;
  
  -- Calculate daily goal threshold (total_minimum_hours / 30 days)
  daily_goal_threshold := community_record.total_minimum_hours / 30;
  daily_goal_met := p_hours_logged >= daily_goal_threshold;
  
  -- Insert or update progress
  INSERT INTO member_progress (
    community_id,
    user_id,
    date,
    hours_logged,
    goals_completed,
    daily_goal_met,
    notes
  )
  VALUES (
    p_community_id,
    p_user_id,
    today,
    p_hours_logged,
    p_goals_completed,
    daily_goal_met,
    p_notes
  )
  ON CONFLICT (community_id, user_id, date)
  DO UPDATE SET
    hours_logged = member_progress.hours_logged + p_hours_logged,
    goals_completed = member_progress.goals_completed + p_goals_completed,
    daily_goal_met = member_progress.daily_goal_met OR daily_goal_met,
    notes = CASE 
      WHEN p_notes IS NULL THEN member_progress.notes
      WHEN member_progress.notes IS NULL THEN p_notes
      ELSE member_progress.notes || E'\n\n' || p_notes
    END,
    updated_at = now();
  
  -- Update community analytics
  PERFORM update_community_analytics(p_community_id);
  
  -- Recalculate member progress
  PERFORM calculate_member_progress_fallback(p_community_id, p_user_id);
  
  RETURN true;
END;
$$;

-- Function to update community analytics
CREATE OR REPLACE FUNCTION update_community_analytics(
  p_community_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today date := CURRENT_DATE;
  total_members integer;
  active_members integer;
  total_meetings_held integer;
  average_attendance_rate numeric;
  total_hours_logged numeric;
  completion_rate numeric;
  unique_attendees integer;
BEGIN
  -- Get member counts
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT is_disqualified)
  INTO total_members, active_members
  FROM community_members
  WHERE community_id = p_community_id;
  
  -- Get meeting stats
  SELECT COUNT(*) INTO total_meetings_held
  FROM meeting_sessions
  WHERE community_id = p_community_id
    AND status = 'completed';
  
  -- Calculate attendance rate
  SELECT COUNT(DISTINCT user_id) INTO unique_attendees
  FROM meeting_attendance
  WHERE community_id = p_community_id;
  
  average_attendance_rate := CASE 
    WHEN total_members > 0 AND total_meetings_held > 0 
    THEN (unique_attendees::numeric / total_members) * 100
    ELSE 0 
  END;
  
  -- Calculate total hours logged
  SELECT COALESCE(SUM(duration_seconds) / 3600.0, 0) INTO total_hours_logged
  FROM meeting_attendance
  WHERE community_id = p_community_id;
  
  -- Calculate completion rate
  SELECT COALESCE(AVG(progress_percentage), 0) INTO completion_rate
  FROM community_members
  WHERE community_id = p_community_id;
  
  -- Update analytics
  INSERT INTO community_analytics (
    community_id,
    date,
    total_members,
    active_members,
    total_meetings_held,
    average_attendance_rate,
    total_hours_logged,
    completion_rate
  )
  VALUES (
    p_community_id,
    today,
    total_members,
    active_members,
    total_meetings_held,
    average_attendance_rate,
    total_hours_logged,
    completion_rate
  )
  ON CONFLICT (community_id, date)
  DO UPDATE SET
    total_members = EXCLUDED.total_members,
    active_members = EXCLUDED.active_members,
    total_meetings_held = EXCLUDED.total_meetings_held,
    average_attendance_rate = EXCLUDED.average_attendance_rate,
    total_hours_logged = EXCLUDED.total_hours_logged,
    completion_rate = EXCLUDED.completion_rate;
END;
$$;

-- Function to get member progress history
CREATE OR REPLACE FUNCTION get_member_progress_history(
  p_community_id uuid,
  p_user_id uuid,
  p_limit integer DEFAULT 30
)
RETURNS SETOF member_progress
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM member_progress
  WHERE community_id = p_community_id
    AND user_id = p_user_id
  ORDER BY date DESC
  LIMIT p_limit;
END;
$$;

-- Function to get community leaderboard
CREATE OR REPLACE FUNCTION get_community_leaderboard(
  p_community_id uuid
)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  is_creator boolean,
  progress_percentage numeric,
  total_meeting_hours numeric,
  total_meeting_count bigint,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY cm.progress_percentage DESC) as rank,
    cm.user_id,
    cm.is_creator,
    cm.progress_percentage,
    cm.total_meeting_seconds / 3600.0 as total_meeting_hours,
    COUNT(DISTINCT ma.meeting_session_id) as total_meeting_count,
    cm.joined_at
  FROM community_members cm
  LEFT JOIN meeting_attendance ma ON cm.user_id = ma.user_id AND cm.community_id = ma.community_id
  WHERE cm.community_id = p_community_id
  GROUP BY cm.user_id, cm.is_creator, cm.progress_percentage, cm.total_meeting_seconds, cm.joined_at
  ORDER BY cm.progress_percentage DESC;
END;
$$;

-- Create trigger for community status changes
CREATE OR REPLACE FUNCTION trigger_create_meetings()
RETURNS TRIGGER AS $$
BEGIN
  -- If community status changed to 'active', create scheduled meetings
  IF OLD.status = 'waiting' AND NEW.status = 'active' THEN
    -- Create scheduled meetings for the next 7 days
    INSERT INTO meeting_sessions (
      community_id,
      session_date,
      start_time,
      status
    )
    SELECT 
      NEW.id,
      date_trunc('day', now()) + (n || ' days')::interval,
      date_trunc('day', now()) + (n || ' days')::interval + (NEW.preferred_time::time)::interval,
      'scheduled'
    FROM generate_series(0, 7) n
    WHERE EXTRACT(DOW FROM (date_trunc('day', now()) + (n || ' days')::interval)) IN (
      SELECT CASE day
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
        WHEN 'Sunday' THEN 0
      END
      FROM unnest(NEW.weekly_meeting_days) as day
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for community status changes
DROP TRIGGER IF EXISTS community_status_change ON communities;
CREATE TRIGGER community_status_change
  AFTER UPDATE OF status ON communities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_meetings();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_community_status TO service_role;
GRANT EXECUTE ON FUNCTION log_member_progress TO authenticated;
GRANT EXECUTE ON FUNCTION update_community_analytics TO service_role;
GRANT EXECUTE ON FUNCTION get_member_progress_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_leaderboard TO authenticated;