-- Add message_status table to track message delivery status
CREATE TABLE IF NOT EXISTS message_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'delivered', 'read')),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_message_status_message ON message_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_status_user ON message_status(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS message_status_message_id_user_id_key ON message_status(message_id, user_id);

-- Add last_message_delivered_at column to chat_participants
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS last_message_delivered_at timestamptz DEFAULT now();

-- Function to mark messages as delivered
CREATE OR REPLACE FUNCTION mark_messages_as_delivered(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update last_message_delivered_at in chat_participants
  INSERT INTO chat_participants (
    community_id, 
    user_id, 
    last_message_delivered_at
  )
  VALUES (
    p_community_id,
    p_user_id,
    now()
  )
  ON CONFLICT (community_id, user_id)
  DO UPDATE SET
    last_message_delivered_at = now(),
    updated_at = now();
    
  -- Update message status for all undelivered messages
  INSERT INTO message_status (
    message_id,
    user_id,
    status
  )
  SELECT 
    cm.id,
    p_user_id,
    'delivered'
  FROM chat_messages cm
  LEFT JOIN message_status ms ON 
    ms.message_id = cm.id AND 
    ms.user_id = p_user_id
  WHERE 
    cm.community_id = p_community_id AND
    cm.user_id != p_user_id AND
    (ms.id IS NULL OR ms.status = 'sent')
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET
    status = 'delivered',
    updated_at = now();
END;
$$;

-- Function to mark a specific message as delivered
CREATE OR REPLACE FUNCTION mark_message_as_delivered(
  p_message_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update message status
  INSERT INTO message_status (
    message_id,
    user_id,
    status
  )
  VALUES (
    p_message_id,
    p_user_id,
    'delivered'
  )
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET
    status = 'delivered',
    updated_at = now();
END;
$$;

-- Function to mark a specific message as read
CREATE OR REPLACE FUNCTION mark_message_as_read(
  p_message_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update message status
  INSERT INTO message_status (
    message_id,
    user_id,
    status
  )
  VALUES (
    p_message_id,
    p_user_id,
    'read'
  )
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET
    status = 'read',
    updated_at = now();
END;
$$;

-- Function to get message status for a specific message
CREATE OR REPLACE FUNCTION get_message_status(
  p_message_id uuid
)
RETURNS TABLE (
  user_id uuid,
  status text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ms.user_id,
    ms.status,
    ms.updated_at
  FROM message_status ms
  WHERE ms.message_id = p_message_id
  ORDER BY ms.updated_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_messages_as_delivered TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_as_delivered TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_status TO authenticated;