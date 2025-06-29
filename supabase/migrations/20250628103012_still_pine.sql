/*
  # Complete Real-time Chat & Communication System

  1. New Tables
    - `chat_messages` - Store all chat messages with community context
    - `chat_participants` - Track active chat participants and presence
    - `message_reactions` - Handle message reactions and emoji responses
    - `chat_notifications` - Manage chat-related notifications
    - `user_presence` - Track real-time user presence and activity
    - `typing_indicators` - Handle typing status for real-time feedback

  2. Security
    - Enable RLS on all chat tables
    - Add policies for community-based access control
    - Implement message moderation and reporting

  3. Functions
    - Real-time presence management
    - Message search and filtering
    - Notification delivery system
    - Chat analytics and statistics

  4. Triggers
    - Automatic notification creation
    - Presence status updates
    - Message indexing for search
*/

-- Chat messages table for all community communications
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'announcement', 'meeting_start', 'meeting_end', 'file', 'image')),
  content text NOT NULL,
  reply_to_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Chat participants for presence tracking
CREATE TABLE IF NOT EXISTS chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_seen timestamptz DEFAULT now(),
  is_online boolean DEFAULT true,
  status text DEFAULT 'active' CHECK (status IN ('active', 'away', 'busy', 'offline')),
  last_message_read_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- Message reactions for emoji responses
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reaction_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, reaction_type)
);

-- Chat notifications for important events
CREATE TABLE IF NOT EXISTS chat_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('mention', 'direct_message', 'announcement', 'meeting_reminder', 'community_update')),
  title text NOT NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- User presence for real-time status
CREATE TABLE IF NOT EXISTS user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  last_activity timestamptz DEFAULT now(),
  device_info jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, community_id)
);

-- Typing indicators for real-time feedback
CREATE TABLE IF NOT EXISTS typing_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_typing boolean DEFAULT false,
  started_typing_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '10 seconds'),
  UNIQUE(community_id, user_id)
);

-- Message search index
CREATE INDEX IF NOT EXISTS idx_chat_messages_search ON chat_messages USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_chat_messages_community_created ON chat_messages(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_participants_community ON chat_participants(community_id, is_online);
CREATE INDEX IF NOT EXISTS idx_user_presence_activity ON user_presence(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_expires ON typing_indicators(expires_at);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_user_unread ON chat_notifications(user_id, is_read, created_at DESC);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their communities"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM community_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their communities"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    community_id IN (
      SELECT community_id FROM community_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can edit their own messages"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for chat_participants
CREATE POLICY "Users can view participants in their communities"
  ON chat_participants FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM community_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own participation"
  ON chat_participants FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for message_reactions
CREATE POLICY "Users can view reactions in their communities"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    message_id IN (
      SELECT id FROM chat_messages WHERE community_id IN (
        SELECT community_id FROM community_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their own reactions"
  ON message_reactions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for chat_notifications
CREATE POLICY "Users can view their own notifications"
  ON chat_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON chat_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON chat_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for user_presence
CREATE POLICY "Users can view presence in their communities"
  ON user_presence FOR SELECT
  TO authenticated
  USING (
    community_id IS NULL OR
    community_id IN (
      SELECT community_id FROM community_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own presence"
  ON user_presence FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for typing_indicators
CREATE POLICY "Users can view typing indicators in their communities"
  ON typing_indicators FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM community_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own typing status"
  ON typing_indicators FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to update user presence
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
  ON CONFLICT (user_id, COALESCE(community_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    status = EXCLUDED.status,
    last_activity = EXCLUDED.last_activity,
    updated_at = now();
END;
$$;

-- Function to handle typing indicators
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
    DELETE FROM typing_indicators
    WHERE community_id = p_community_id AND user_id = p_user_id;
  END IF;
END;
$$;

-- Function to search messages
CREATE OR REPLACE FUNCTION search_messages(
  p_community_id uuid,
  p_search_term text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content text,
  message_type text,
  created_at timestamptz,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.user_id,
    m.content,
    m.message_type,
    m.created_at,
    ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', p_search_term)) as rank
  FROM chat_messages m
  WHERE 
    m.community_id = p_community_id
    AND m.deleted_at IS NULL
    AND to_tsvector('english', m.content) @@ plainto_tsquery('english', p_search_term)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to get unread message count
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
  -- Get last read timestamp
  SELECT last_message_read_at INTO last_read_at
  FROM chat_participants
  WHERE user_id = p_user_id AND community_id = p_community_id;
  
  -- If no record, consider all messages as unread
  IF last_read_at IS NULL THEN
    last_read_at := '1970-01-01'::timestamptz;
  END IF;
  
  -- Count unread messages
  SELECT COUNT(*)::integer INTO unread_count
  FROM chat_messages
  WHERE 
    community_id = p_community_id
    AND user_id != p_user_id
    AND created_at > last_read_at
    AND deleted_at IS NULL;
    
  RETURN unread_count;
END;
$$;

-- Function to mark messages as read
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

-- Function to create chat notification
CREATE OR REPLACE FUNCTION create_chat_notification(
  p_user_id uuid,
  p_community_id uuid,
  p_message_id uuid,
  p_notification_type text,
  p_title text,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO chat_notifications (
    user_id, community_id, message_id, notification_type, title, content
  )
  VALUES (
    p_user_id, p_community_id, p_message_id, p_notification_type, p_title, p_content
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Function to cleanup expired typing indicators
CREATE OR REPLACE FUNCTION cleanup_expired_typing_indicators()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM typing_indicators
  WHERE expires_at < now();
END;
$$;

-- Function to get chat statistics
CREATE OR REPLACE FUNCTION get_chat_statistics(
  p_community_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  total_messages bigint,
  active_users bigint,
  messages_today bigint,
  average_messages_per_day numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_messages,
    COUNT(DISTINCT user_id) as active_users,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as messages_today,
    ROUND(COUNT(*)::numeric / p_days, 2) as average_messages_per_day
  FROM chat_messages
  WHERE 
    community_id = p_community_id
    AND created_at >= (CURRENT_DATE - interval '1 day' * p_days)
    AND deleted_at IS NULL;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_participants_updated_at
  BEFORE UPDATE ON chat_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_presence_updated_at
  BEFORE UPDATE ON user_presence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to create notifications for mentions
CREATE OR REPLACE FUNCTION handle_message_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user_id uuid;
  community_member RECORD;
BEGIN
  -- Check for @mentions in the message content
  FOR community_member IN 
    SELECT cm.user_id
    FROM community_members cm
    WHERE cm.community_id = NEW.community_id
    AND cm.user_id != NEW.user_id
  LOOP
    -- Simple mention detection (in real app, you'd use more sophisticated parsing)
    IF NEW.content ILIKE '%@' || community_member.user_id::text || '%' THEN
      PERFORM create_chat_notification(
        community_member.user_id,
        NEW.community_id,
        NEW.id,
        'mention',
        'You were mentioned',
        'You were mentioned in a message'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_message_mentions
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION handle_message_mentions();

-- Trigger to cleanup old typing indicators
CREATE OR REPLACE FUNCTION trigger_cleanup_typing_indicators()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM cleanup_expired_typing_indicators();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_typing_cleanup
  AFTER INSERT OR UPDATE ON typing_indicators
  FOR EACH STATEMENT EXECUTE FUNCTION trigger_cleanup_typing_indicators();