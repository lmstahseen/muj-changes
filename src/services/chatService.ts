import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  community_id: string;
  user_id: string;
  message_type: 'text' | 'system' | 'announcement' | 'meeting_start' | 'meeting_end' | 'file' | 'image';
  content: string;
  reply_to_id?: string;
  edited_at?: string;
  deleted_at?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_avatar?: string;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
}

export interface ChatParticipant {
  id: string;
  community_id: string;
  user_id: string;
  last_seen: string;
  is_online: boolean;
  status: 'active' | 'away' | 'busy' | 'offline';
  last_message_read_at: string;
  user_name?: string;
  user_avatar?: string;
}

export interface TypingIndicator {
  id: string;
  community_id: string;
  user_id: string;
  is_typing: boolean;
  started_typing_at: string;
  expires_at: string;
  user_name?: string;
}

export interface ChatNotification {
  id: string;
  user_id: string;
  community_id: string;
  message_id?: string;
  notification_type: 'mention' | 'direct_message' | 'announcement' | 'meeting_reminder' | 'community_update';
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface UserPresence {
  id: string;
  user_id: string;
  community_id?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  last_activity: string;
  device_info: any;
}

class ChatService {
  private realtimeChannels: Map<string, any> = new Map();
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Send a message to community chat
  async sendMessage(
    communityId: string,
    userId: string,
    content: string,
    messageType: ChatMessage['message_type'] = 'text',
    replyToId?: string,
    metadata: any = {}
  ): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
    try {
      // Validate message content
      if (!content.trim()) {
        return { success: false, error: 'Message content cannot be empty' };
      }

      if (content.length > 2000) {
        return { success: false, error: 'Message too long (max 2000 characters)' };
      }

      // Check if user is a member of the community
      const { data: membership } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        return { success: false, error: 'You must be a member of this community to send messages' };
      }

      // Insert message
      const { data: message, error } = await supabase
        .from('chat_messages')
        .insert({
          community_id: communityId,
          user_id: userId,
          message_type: messageType,
          content: content.trim(),
          reply_to_id: replyToId,
          metadata
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Update participant's last activity
      await this.updateParticipantActivity(communityId, userId);

      return { success: true, message };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: 'An unexpected error occurred while sending the message' };
    }
  }

  // Get messages for a community with pagination
  async getMessages(
    communityId: string,
    limit: number = 50,
    offset: number = 0,
    beforeTimestamp?: string
  ): Promise<{ success: boolean; messages?: ChatMessage[]; error?: string }> {
    try {
      let query = supabase
        .from('chat_messages')
        .select('*')
        .eq('community_id', communityId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (offset > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      if (beforeTimestamp) {
        query = query.lt('created_at', beforeTimestamp);
      }

      const { data: messages, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      // Reverse to show oldest first
      const reversedMessages = (messages || []).reverse();

      // Enhance messages with user info and reactions
      const enhancedMessages = await Promise.all(
        reversedMessages.map(async (message) => {
          const reactions = await this.getMessageReactions(message.id);
          return {
            ...message,
            user_name: 'User', // In real app, join with user table
            user_avatar: '👤',
            reactions
          };
        })
      );

      return { success: true, messages: enhancedMessages };
    } catch (error) {
      console.error('Error getting messages:', error);
      return { success: false, error: 'An unexpected error occurred while fetching messages' };
    }
  }

  // Search messages in a community
  async searchMessages(
    communityId: string,
    searchTerm: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; messages?: any[]; error?: string }> {
    try {
      const { data: messages, error } = await supabase.rpc('search_messages', {
        p_community_id: communityId,
        p_search_term: searchTerm,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messages: messages || [] };
    } catch (error) {
      console.error('Error searching messages:', error);
      return { success: false, error: 'An unexpected error occurred while searching messages' };
    }
  }

  // Edit a message
  async editMessage(
    messageId: string,
    userId: string,
    newContent: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!newContent.trim()) {
        return { success: false, error: 'Message content cannot be empty' };
      }

      const { error } = await supabase
        .from('chat_messages')
        .update({
          content: newContent.trim(),
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error editing message:', error);
      return { success: false, error: 'An unexpected error occurred while editing the message' };
    }
  }

  // Delete a message
  async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({
          deleted_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error);
      return { success: false, error: 'An unexpected error occurred while deleting the message' };
    }
  }

  // Add reaction to a message
  async addReaction(
    messageId: string,
    userId: string,
    reactionType: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          reaction_type: reactionType
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error adding reaction:', error);
      return { success: false, error: 'An unexpected error occurred while adding reaction' };
    }
  }

  // Remove reaction from a message
  async removeReaction(
    messageId: string,
    userId: string,
    reactionType: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('reaction_type', reactionType);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing reaction:', error);
      return { success: false, error: 'An unexpected error occurred while removing reaction' };
    }
  }

  // Get reactions for a message
  async getMessageReactions(messageId: string): Promise<MessageReaction[]> {
    try {
      const { data: reactions, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId);

      if (error) {
        console.error('Error getting reactions:', error);
        return [];
      }

      return reactions || [];
    } catch (error) {
      console.error('Error getting reactions:', error);
      return [];
    }
  }

  // Get chat participants for a community
  async getChatParticipants(communityId: string): Promise<{ success: boolean; participants?: ChatParticipant[]; error?: string }> {
    try {
      const { data: participants, error } = await supabase
        .from('chat_participants')
        .select('*')
        .eq('community_id', communityId)
        .order('last_seen', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      // Enhance with user info
      const enhancedParticipants = (participants || []).map(participant => ({
        ...participant,
        user_name: 'User', // In real app, join with user table
        user_avatar: '👤'
      }));

      return { success: true, participants: enhancedParticipants };
    } catch (error) {
      console.error('Error getting participants:', error);
      return { success: false, error: 'An unexpected error occurred while fetching participants' };
    }
  }

  // Update participant activity
  async updateParticipantActivity(
    communityId: string,
    userId: string,
    status: ChatParticipant['status'] = 'active'
  ): Promise<void> {
    try {
      await supabase
        .from('chat_participants')
        .upsert({
          community_id: communityId,
          user_id: userId,
          last_seen: new Date().toISOString(),
          is_online: true,
          status
        }, {
          onConflict: 'community_id,user_id'
        });
    } catch (error) {
      console.error('Error updating participant activity:', error);
    }
  }

  // Update typing indicator
  async updateTypingIndicator(
    communityId: string,
    userId: string,
    isTyping: boolean
  ): Promise<void> {
    try {
      await supabase.rpc('update_typing_indicator', {
        p_community_id: communityId,
        p_user_id: userId,
        p_is_typing: isTyping
      });

      // Clear typing timeout if exists
      const timeoutKey = `${communityId}-${userId}`;
      const existingTimeout = this.typingTimeouts.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.typingTimeouts.delete(timeoutKey);
      }

      // Set new timeout to clear typing indicator
      if (isTyping) {
        const timeout = setTimeout(() => {
          this.updateTypingIndicator(communityId, userId, false);
          this.typingTimeouts.delete(timeoutKey);
        }, 10000); // 10 seconds

        this.typingTimeouts.set(timeoutKey, timeout);
      }
    } catch (error) {
      console.error('Error updating typing indicator:', error);
    }
  }

  // Get typing indicators for a community
  async getTypingIndicators(communityId: string): Promise<{ success: boolean; indicators?: TypingIndicator[]; error?: string }> {
    try {
      const { data: indicators, error } = await supabase
        .from('typing_indicators')
        .select('*')
        .eq('community_id', communityId)
        .eq('is_typing', true)
        .gt('expires_at', new Date().toISOString());

      if (error) {
        return { success: false, error: error.message };
      }

      // Enhance with user info
      const enhancedIndicators = (indicators || []).map(indicator => ({
        ...indicator,
        user_name: 'User' // In real app, join with user table
      }));

      return { success: true, indicators: enhancedIndicators };
    } catch (error) {
      console.error('Error getting typing indicators:', error);
      return { success: false, error: 'An unexpected error occurred while fetching typing indicators' };
    }
  }

  // Mark messages as read
  async markMessagesAsRead(
    communityId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await supabase.rpc('mark_messages_as_read', {
        p_user_id: userId,
        p_community_id: communityId
      });

      return { success: true };
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return { success: false, error: 'An unexpected error occurred while marking messages as read' };
    }
  }

  // Get unread message count
  async getUnreadMessageCount(
    userId: string,
    communityId: string
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_unread_message_count', {
        p_user_id: userId,
        p_community_id: communityId
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, count: data || 0 };
    } catch (error) {
      console.error('Error getting unread count:', error);
      return { success: false, error: 'An unexpected error occurred while getting unread count' };
    }
  }

  // Update user presence
  async updateUserPresence(
    userId: string,
    status: UserPresence['status'] = 'online',
    communityId?: string
  ): Promise<void> {
    try {
      await supabase.rpc('update_user_presence', {
        p_user_id: userId,
        p_community_id: communityId,
        p_status: status
      });
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }

  // Get user presence for a community
  async getUserPresence(communityId?: string): Promise<{ success: boolean; presence?: UserPresence[]; error?: string }> {
    try {
      let query = supabase
        .from('user_presence')
        .select('*')
        .order('last_activity', { ascending: false });

      if (communityId) {
        query = query.eq('community_id', communityId);
      }

      const { data: presence, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, presence: presence || [] };
    } catch (error) {
      console.error('Error getting user presence:', error);
      return { success: false, error: 'An unexpected error occurred while fetching user presence' };
    }
  }

  // Get chat notifications for a user
  async getChatNotifications(
    userId: string,
    limit: number = 50,
    onlyUnread: boolean = false
  ): Promise<{ success: boolean; notifications?: ChatNotification[]; error?: string }> {
    try {
      let query = supabase
        .from('chat_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (onlyUnread) {
        query = query.eq('is_read', false);
      }

      const { data: notifications, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, notifications: notifications || [] };
    } catch (error) {
      console.error('Error getting notifications:', error);
      return { success: false, error: 'An unexpected error occurred while fetching notifications' };
    }
  }

  // Mark notification as read
  async markNotificationAsRead(
    notificationId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('chat_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: 'An unexpected error occurred while marking notification as read' };
    }
  }

  // Get chat statistics
  async getChatStatistics(
    communityId: string,
    days: number = 30
  ): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
      const { data: stats, error } = await supabase.rpc('get_chat_statistics', {
        p_community_id: communityId,
        p_days: days
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, stats: stats?.[0] || {} };
    } catch (error) {
      console.error('Error getting chat statistics:', error);
      return { success: false, error: 'An unexpected error occurred while fetching chat statistics' };
    }
  }

  // Subscribe to real-time chat updates
  subscribeToChat(
    communityId: string,
    callbacks: {
      onMessage?: (message: ChatMessage) => void;
      onTyping?: (indicators: TypingIndicator[]) => void;
      onPresence?: (presence: UserPresence[]) => void;
      onParticipants?: (participants: ChatParticipant[]) => void;
    }
  ): () => void {
    const channelKey = `chat_${communityId}`;
    
    // Clean up existing channel
    if (this.realtimeChannels.has(channelKey)) {
      this.realtimeChannels.get(channelKey).unsubscribe();
    }

    // Create new channel
    const channel = supabase.channel(channelKey, {
      config: {
        broadcast: { self: true },
        presence: { key: 'user_id' }
      }
    });

    // Listen for new messages
    if (callbacks.onMessage) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `community_id=eq.${communityId}`
        },
        (payload) => {
          callbacks.onMessage?.(payload.new as ChatMessage);
        }
      );
    }

    // Listen for typing indicators
    if (callbacks.onTyping) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `community_id=eq.${communityId}`
        },
        async () => {
          const result = await this.getTypingIndicators(communityId);
          if (result.success && result.indicators) {
            callbacks.onTyping?.(result.indicators);
          }
        }
      );
    }

    // Listen for presence updates
    if (callbacks.onPresence) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `community_id=eq.${communityId}`
        },
        async () => {
          const result = await this.getUserPresence(communityId);
          if (result.success && result.presence) {
            callbacks.onPresence?.(result.presence);
          }
        }
      );
    }

    // Listen for participant updates
    if (callbacks.onParticipants) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_participants',
          filter: `community_id=eq.${communityId}`
        },
        async () => {
          const result = await this.getChatParticipants(communityId);
          if (result.success && result.participants) {
            callbacks.onParticipants?.(result.participants);
          }
        }
      );
    }

    // Subscribe to channel
    channel.subscribe();
    this.realtimeChannels.set(channelKey, channel);

    // Return cleanup function
    return () => {
      channel.unsubscribe();
      this.realtimeChannels.delete(channelKey);
    };
  }

  // Cleanup all subscriptions
  cleanup(): void {
    this.realtimeChannels.forEach(channel => {
      channel.unsubscribe();
    });
    this.realtimeChannels.clear();

    this.typingTimeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.typingTimeouts.clear();
  }
}

export default new ChatService();