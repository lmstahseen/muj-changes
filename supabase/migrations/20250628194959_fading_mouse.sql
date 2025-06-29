-- Add retention_policy column to meeting_recordings
ALTER TABLE meeting_recordings ADD COLUMN IF NOT EXISTS retention_policy text DEFAULT 'standard' CHECK (retention_policy IN ('standard', 'extended', 'permanent'));

-- Add access_level column to meeting_recordings
ALTER TABLE meeting_recordings ADD COLUMN IF NOT EXISTS access_level text DEFAULT 'community' CHECK (access_level IN ('community', 'restricted', 'deleted'));

-- Function to manage recording retention based on report outcomes
CREATE OR REPLACE FUNCTION trigger_recording_retention_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If report status changed to resolved, update recording retention
  IF OLD.status = 'pending' AND NEW.status LIKE 'resolved_%' AND NEW.meeting_session_id IS NOT NULL THEN
    -- For disqualified members, keep recording with extended retention
    IF NEW.status = 'resolved_disqualify' THEN
      UPDATE meeting_recordings 
      SET 
        retention_policy = 'extended',
        updated_at = now()
      WHERE meeting_session_id = NEW.meeting_session_id;
    -- For cleared reports, mark recording for deletion
    ELSIF NEW.status IN ('resolved_no_action', 'resolved_false_report') THEN
      UPDATE meeting_recordings 
      SET 
        upload_status = 'pending_deletion',
        updated_at = now()
      WHERE meeting_session_id = NEW.meeting_session_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists before creating it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_recording_retention'
  ) THEN
    DROP TRIGGER trigger_update_recording_retention ON reports;
  END IF;
END $$;

-- Create trigger for recording retention management
CREATE TRIGGER trigger_update_recording_retention
  AFTER UPDATE OF status ON reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recording_retention_update();

-- Function to clean up old recordings
CREATE OR REPLACE FUNCTION cleanup_old_recordings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recording_record record;
BEGIN
  -- Find recordings marked for deletion
  FOR recording_record IN
    SELECT mr.id, mr.file_path
    FROM meeting_recordings mr
    WHERE mr.upload_status = 'pending_deletion'
    LIMIT 100
  LOOP
    -- In a real implementation, this would delete the file from storage
    -- For now, just update the status
    UPDATE meeting_recordings
    SET 
      upload_status = 'deleted',
      access_level = 'deleted',
      updated_at = now()
    WHERE id = recording_record.id;
  END LOOP;
  
  -- Find old recordings (older than 30 days) with standard retention
  FOR recording_record IN
    SELECT mr.id, mr.file_path
    FROM meeting_recordings mr
    JOIN meeting_sessions ms ON mr.meeting_session_id = ms.id
    WHERE 
      mr.retention_policy = 'standard' AND
      mr.upload_status = 'completed' AND
      ms.created_at < now() - interval '30 days'
    LIMIT 100
  LOOP
    -- Mark for deletion
    UPDATE meeting_recordings
    SET 
      upload_status = 'pending_deletion',
      updated_at = now()
    WHERE id = recording_record.id;
  END LOOP;
END;
$$;

-- Function to get recording URL (placeholder - would be implemented with Supabase Storage in production)
CREATE OR REPLACE FUNCTION get_recording_signed_url(
  p_file_path text,
  p_expiry_seconds integer DEFAULT 3600
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_signed_url text;
BEGIN
  -- This is a placeholder - in a real implementation, this would call
  -- Supabase Storage API to generate a signed URL
  -- For now, we'll just return a dummy URL
  v_signed_url := 'https://storage.example.com/signed-url/' || p_file_path;
  
  RETURN v_signed_url;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_recording_retention_update TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_recordings TO service_role;
GRANT EXECUTE ON FUNCTION get_recording_signed_url TO authenticated;