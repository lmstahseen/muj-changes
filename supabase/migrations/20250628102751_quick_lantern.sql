-- Enhanced meeting system with comprehensive WebRTC support

-- Update meeting_participants table with additional fields
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS peer_id text;
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS connection_quality text DEFAULT 'good' CHECK (connection_quality IN ('good', 'fair', 'poor'));
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

-- Create meeting_recordings table for storing recording metadata
CREATE TABLE IF NOT EXISTS meeting_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_session_id uuid NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  upload_status text DEFAULT 'uploading' CHECK (upload_status IN ('uploading', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create meeting_chat table for in-meeting chat
CREATE TABLE IF NOT EXISTS meeting_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_session_id uuid NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file')),
  created_at timestamptz DEFAULT now()
);

-- Create meeting_notifications table for automated notifications
CREATE TABLE IF NOT EXISTS meeting_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('meeting_started', 'meeting_ended', 'member_joined', 'member_left', 'inactivity_warning')),
  message text NOT NULL,
  sent_to uuid[], -- Array of user IDs
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_session ON meeting_recordings(meeting_session_id);
CREATE INDEX IF NOT EXISTS idx_meeting_chat_session ON meeting_chat(meeting_session_id);
CREATE INDEX IF NOT EXISTS idx_meeting_chat_user ON meeting_chat(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notifications_community ON meeting_notifications(community_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_last_seen ON meeting_participants(last_seen);

-- Function to update participant last seen timestamp
CREATE OR REPLACE FUNCTION update_participant_last_seen(
  p_meeting_session_id uuid,
  p_user_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE meeting_participants
  SET last_seen = now()
  WHERE meeting_session_id = p_meeting_session_id 
    AND user_id = p_user_id 
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle meeting cleanup (orphaned meetings, inactive participants)
CREATE OR REPLACE FUNCTION cleanup_inactive_meetings() RETURNS void AS $$
DECLARE
  meeting_record record;
  participant_record record;
BEGIN
  -- End meetings with no active participants for more than 5 minutes
  FOR meeting_record IN 
    SELECT ms.id, ms.community_id
    FROM meeting_sessions ms
    WHERE ms.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM meeting_participants mp
        WHERE mp.meeting_session_id = ms.id 
          AND mp.is_active = true
          AND mp.last_seen > now() - INTERVAL '5 minutes'
      )
      AND ms.start_time < now() - INTERVAL '5 minutes'
  LOOP
    -- End the meeting
    UPDATE meeting_sessions
    SET status = 'completed', end_time = now()
    WHERE id = meeting_record.id;
    
    -- Create notification
    INSERT INTO meeting_notifications (
      community_id, notification_type, message, sent_to
    ) VALUES (
      meeting_record.community_id,
      'meeting_ended',
      'Meeting ended due to inactivity',
      ARRAY[]::uuid[]
    );
  END LOOP;
  
  -- Mark participants as inactive if they haven't been seen for 2 minutes
  UPDATE meeting_participants
  SET is_active = false, left_at = now()
  WHERE is_active = true
    AND last_seen < now() - INTERVAL '2 minutes';
    
  -- Clean up old meeting recordings (older than 30 days)
  DELETE FROM meeting_recordings
  WHERE created_at < now() - INTERVAL '30 days'
    AND upload_status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send meeting notifications
CREATE OR REPLACE FUNCTION send_meeting_notification(
  p_community_id uuid,
  p_notification_type text,
  p_message text,
  p_user_ids uuid[] DEFAULT NULL
) RETURNS void AS $$
DECLARE
  target_users uuid[];
BEGIN
  -- If no specific users provided, send to all community members
  IF p_user_ids IS NULL THEN
    SELECT array_agg(user_id) INTO target_users
    FROM community_members
    WHERE community_id = p_community_id;
  ELSE
    target_users := p_user_ids;
  END IF;
  
  -- Insert notification
  INSERT INTO meeting_notifications (
    community_id, notification_type, message, sent_to
  ) VALUES (
    p_community_id, p_notification_type, p_message, target_users
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate meeting statistics
CREATE OR REPLACE FUNCTION get_meeting_statistics(
  p_community_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
) RETURNS TABLE (
  total_meetings bigint,
  total_duration_seconds bigint,
  average_duration_seconds numeric,
  total_participants bigint,
  average_participants numeric,
  screen_share_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ms.id)::bigint as total_meetings,
    COALESCE(SUM(EXTRACT(EPOCH FROM (ms.end_time - ms.start_time))), 0)::bigint as total_duration_seconds,
    COALESCE(AVG(EXTRACT(EPOCH FROM (ms.end_time - ms.start_time))), 0) as average_duration_seconds,
    COUNT(DISTINCT ma.user_id)::bigint as total_participants,
    COALESCE(AVG(participant_counts.participant_count), 0) as average_participants,
    COALESCE(
      (COUNT(CASE WHEN ma.screen_shared THEN 1 END)::numeric / NULLIF(COUNT(ma.id), 0)) * 100,
      0
    ) as screen_share_percentage
  FROM meeting_sessions ms
  LEFT JOIN meeting_attendance ma ON ms.id = ma.meeting_session_id
  LEFT JOIN (
    SELECT 
      meeting_session_id,
      COUNT(DISTINCT user_id) as participant_count
    FROM meeting_attendance
    GROUP BY meeting_session_id
  ) participant_counts ON ms.id = participant_counts.meeting_session_id
  WHERE (p_community_id IS NULL OR ms.community_id = p_community_id)
    AND (p_user_id IS NULL OR ma.user_id = p_user_id)
    AND ms.status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active meeting participants with real-time data
CREATE OR REPLACE FUNCTION get_active_meeting_participants(p_meeting_session_id uuid)
RETURNS TABLE (
  user_id uuid,
  joined_at timestamptz,
  stream_type text,
  connection_quality text,
  last_seen timestamptz,
  duration_seconds integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.user_id,
    mp.joined_at,
    mp.stream_type,
    mp.connection_quality,
    mp.last_seen,
    EXTRACT(EPOCH FROM (COALESCE(mp.left_at, now()) - mp.joined_at))::integer as duration_seconds
  FROM meeting_participants mp
  WHERE mp.meeting_session_id = p_meeting_session_id
    AND mp.is_active = true
  ORDER BY mp.joined_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update meeting attendance when participants leave
CREATE OR REPLACE FUNCTION update_meeting_attendance_on_leave()
RETURNS TRIGGER AS $$
BEGIN
  -- When a participant becomes inactive, update their meeting attendance
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE meeting_attendance
    SET 
      left_at = NEW.left_at,
      duration_seconds = EXTRACT(EPOCH FROM (NEW.left_at - NEW.joined_at))::integer
    WHERE meeting_session_id = NEW.meeting_session_id
      AND user_id = NEW.user_id
      AND left_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_attendance_on_leave ON meeting_participants;
CREATE TRIGGER trigger_update_attendance_on_leave
  AFTER UPDATE ON meeting_participants
  FOR EACH ROW EXECUTE FUNCTION update_meeting_attendance_on_leave();

-- Trigger to send notifications when meetings start/end
CREATE OR REPLACE FUNCTION notify_meeting_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Meeting started
  IF OLD.status = 'scheduled' AND NEW.status = 'active' THEN
    PERFORM send_meeting_notification(
      NEW.community_id,
      'meeting_started',
      'Meeting has started - join now!',
      NULL
    );
  END IF;
  
  -- Meeting ended
  IF OLD.status = 'active' AND NEW.status = 'completed' THEN
    PERFORM send_meeting_notification(
      NEW.community_id,
      'meeting_ended',
      'Meeting has ended',
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_meeting_status_notifications ON meeting_sessions;
CREATE TRIGGER trigger_meeting_status_notifications
  AFTER UPDATE OF status ON meeting_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_meeting_status_change();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_participant_last_seen(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_inactive_meetings() TO authenticated;
GRANT EXECUTE ON FUNCTION send_meeting_notification(uuid, text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_meeting_statistics(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_meeting_participants(uuid) TO authenticated;

-- Create a scheduled job to run cleanup every minute (this would be set up in production)
-- SELECT cron.schedule('meeting-cleanup', '* * * * *', 'SELECT cleanup_inactive_meetings();');