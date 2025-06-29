/*
  # Create meeting participants table for real-time tracking

  1. New Tables
    - `meeting_participants`
      - `id` (uuid, primary key)
      - `meeting_session_id` (uuid, foreign key)
      - `user_id` (uuid)
      - `community_id` (uuid, foreign key)
      - `joined_at` (timestamp)
      - `left_at` (timestamp, nullable)
      - `is_active` (boolean, default true)
      - `stream_type` (text - 'camera', 'screen', 'audio_only')
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `meeting_participants` table
    - Add policies for authenticated users to manage their participation
*/

CREATE TABLE IF NOT EXISTS meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_session_id uuid NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  is_active boolean DEFAULT true,
  stream_type text DEFAULT 'camera' CHECK (stream_type IN ('camera', 'screen', 'audio_only')),
  created_at timestamptz DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meeting_participants_session ON meeting_participants(meeting_session_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_active ON meeting_participants(meeting_session_id, is_active);

-- Enable RLS
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view meeting participants"
  ON meeting_participants FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can manage their participation"
  ON meeting_participants FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Function to update participant status
CREATE OR REPLACE FUNCTION update_participant_status(
  p_meeting_session_id uuid,
  p_user_id uuid,
  p_is_active boolean,
  p_stream_type text DEFAULT 'camera'
) RETURNS void AS $$
BEGIN
  IF p_is_active THEN
    -- Join or update participation
    INSERT INTO meeting_participants (
      meeting_session_id, user_id, community_id, stream_type
    )
    SELECT p_meeting_session_id, p_user_id, ms.community_id, p_stream_type
    FROM meeting_sessions ms
    WHERE ms.id = p_meeting_session_id
    ON CONFLICT (meeting_session_id, user_id) 
    DO UPDATE SET 
      is_active = true,
      stream_type = p_stream_type,
      left_at = NULL;
  ELSE
    -- Leave participation
    UPDATE meeting_participants
    SET is_active = false, left_at = now()
    WHERE meeting_session_id = p_meeting_session_id 
      AND user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint to prevent duplicate active participants
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_participants_unique_active 
ON meeting_participants(meeting_session_id, user_id) 
WHERE is_active = true;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_participant_status(uuid, uuid, boolean, text) TO authenticated;