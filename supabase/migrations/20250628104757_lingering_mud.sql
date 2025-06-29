/*
  # Fix Chat RLS Policies and Database Functions

  1. Security
    - Add missing INSERT policy for chat_participants table
    - Ensure users can only create participation records for communities they belong to

  2. Database Functions
    - Update user presence tracking function
    - Update typing indicator management function
    - Add message search functionality
    - Add message read status tracking
    - Add unread message count calculation
    - Add chat statistics function
    - Fix typing indicator cleanup function

  3. Permissions
    - Grant execute permissions on all functions to authenticated users
*/

-- Add missing INSERT policy for chat_participants
CREATE POLICY "Users can create their own participation records"
  ON chat_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND community_id IN (
    SELECT community_id FROM community_members WHERE user_id = auth.uid()
  ));

-- Drop existing trigger first (it depends on the function)
DROP TRIGGER IF EXISTS trigger_typing_cleanup ON typing_indicators;

-- Drop existing functions if they exist to avoid conflicts
DROP FUNCTION IF EXISTS search_messages(uuid,text,integer,integer);
DROP FUNCTION IF EXISTS update_user_presence(uuid,uuid,text);
DROP FUNCTION IF EXISTS update_typing_indicator(uuid,uuid,boolean);
DROP FUNCTION IF EXISTS mark_messages_as_read(uuid,uuid);
DROP FUNCTION IF EXISTS get_unread_message_count(uuid,uuid);
DROP FUNCTION IF EXISTS get_chat_statistics(uuid,integer);
DROP FUNCTION IF EXISTS trigger_cleanup_typing_indicators();

-- Update user presence function
CREATE OR REPLACE FUNCTION update_user_presence(
  p_user_id uuid,
  p_community_id uuid DEFAULT NULL,
  p_status text DEFAULT 'online'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_presence (user_id, community_id, status, last_activity)
  VALUES (p_user_id, p_community_id, p_status, now())
  ON CONFLICT (user_id, community_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    last_activity = EXCLUDED.last_activity,
    updated_at = now();
END;
$$;

-- Update typing indicator function
CREATE OR REPLACE FUNCTION update_typing_indicator(
  p_community_id uuid,
  p_user_id uuid,
  p_is_typing boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_is_typing THEN
    INSERT INTO typing_indicators (community_id, user_id, is_typing, started_typing_at, expires_at)
    VALUES (p_community_id, p_user_id, true, now(), now() + interval '10 seconds')
    ON CONFLICT (community_id, user_id)
    DO UPDATE SET
      is_typing = true,
      started_typing_at = now(),
      expires_at = now() + interval '10 seconds';
  ELSE
    UPDATE typing_indicators
    SET is_typing = false
    WHERE community_id = p_community_id AND user_id = p_user_id;
  END IF;
END;
$$;

-- Search messages function
CREATE OR REPLACE FUNCTION search_messages(
  p_community_id uuid,
  p_search_term text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  community_id uuid,
  user_id uuid,
  message_type text,
  content text,
  reply_to_id uuid,
  edited_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.community_id,
    cm.user_id,
    cm.message_type,
    cm.content,
    cm.reply_to_id,
    cm.edited_at,
    cm.deleted_at,
    cm.metadata,
    cm.created_at,
    cm.updated_at
  FROM chat_messages cm
  WHERE cm.community_id = p_community_id
    AND cm.deleted_at IS NULL
    AND to_tsvector('english', cm.content) @@ plainto_tsquery('english', p_search_term)
  ORDER BY cm.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Mark messages as read function
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_user_id uuid,
  p_community_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO chat_participants (community_id, user_id, last_message_read_at)
  VALUES (p_community_id, p_user_id, now())
  ON CONFLICT (community_id, user_id)
  DO UPDATE SET
    last_message_read_at = now(),
    updated_at = now();
END;
$$;

-- Get unread message count function
CREATE OR REPLACE FUNCTION get_unread_message_count(
  p_user_id uuid,
  p_community_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_read_at timestamptz;
  unread_count integer;
BEGIN
  -- Get the last message read timestamp
  SELECT last_message_read_at INTO last_read_at
  FROM chat_participants
  WHERE user_id = p_user_id AND community_id = p_community_id;

  -- If no record exists, consider all messages as unread
  IF last_read_at IS NULL THEN
    last_read_at := '1970-01-01'::timestamptz;
  END IF;

  -- Count messages created after last read timestamp
  SELECT COUNT(*)::integer INTO unread_count
  FROM chat_messages
  WHERE community_id = p_community_id
    AND created_at > last_read_at
    AND deleted_at IS NULL
    AND user_id != p_user_id; -- Don't count own messages

  RETURN COALESCE(unread_count, 0);
END;
$$;

-- Get chat statistics function
CREATE OR REPLACE FUNCTION get_chat_statistics(
  p_community_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  total_messages bigint,
  total_participants bigint,
  active_participants bigint,
  messages_today bigint,
  average_messages_per_day numeric
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
    (SELECT COUNT(*) FROM chat_messages 
     WHERE community_id = p_community_id 
       AND deleted_at IS NULL 
       AND created_at >= start_date) as total_messages,
    
    (SELECT COUNT(DISTINCT user_id) FROM chat_participants 
     WHERE community_id = p_community_id) as total_participants,
    
    (SELECT COUNT(DISTINCT user_id) FROM chat_participants 
     WHERE community_id = p_community_id 
       AND last_seen >= start_date) as active_participants,
    
    (SELECT COUNT(*) FROM chat_messages 
     WHERE community_id = p_community_id 
       AND deleted_at IS NULL 
       AND created_at >= CURRENT_DATE) as messages_today,
    
    (SELECT CASE 
       WHEN p_days > 0 THEN 
         (SELECT COUNT(*) FROM chat_messages 
          WHERE community_id = p_community_id 
            AND deleted_at IS NULL 
            AND created_at >= start_date)::numeric / p_days
       ELSE 0
     END) as average_messages_per_day;
END;
$$;

-- Cleanup expired typing indicators function
CREATE OR REPLACE FUNCTION trigger_cleanup_typing_indicators()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM typing_indicators
  WHERE expires_at < now();
  
  RETURN NULL;
END;
$$;

-- Recreate the trigger after the function
CREATE TRIGGER trigger_typing_cleanup
  AFTER INSERT OR UPDATE ON typing_indicators
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_typing_indicators();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION update_user_presence TO authenticated;
GRANT EXECUTE ON FUNCTION update_typing_indicator TO authenticated;
GRANT EXECUTE ON FUNCTION search_messages TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_chat_statistics TO authenticated;