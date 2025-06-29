import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import chatService, { ChatMessage, ChatParticipant, TypingIndicator } from '../services/chatService';

interface UseChatOptions {
  communityId: string;
  autoMarkAsRead?: boolean;
  enableTypingIndicators?: boolean;
  enablePresence?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  participants: ChatParticipant[];
  typingIndicators: TypingIndicator[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, replyToId?: string) => Promise<boolean>;
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  addReaction: (messageId: string, reactionType: string) => Promise<boolean>;
  removeReaction: (messageId: string, reactionType: string) => Promise<boolean>;
  markAsRead: () => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  loadMoreMessages: () => Promise<void>;
  searchMessages: (searchTerm: string) => Promise<ChatMessage[]>;
  refreshMessages: () => Promise<void>;
}

export function useChat({
  communityId,
  autoMarkAsRead = true,
  enableTypingIndicators = true,
  enablePresence = true
}: UseChatOptions): UseChatReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize chat data and real-time subscriptions
  useEffect(() => {
    if (!communityId || !user) return;

    initializeChat();
    
    return () => {
      cleanup();
    };
  }, [communityId, user]);

  // Auto-mark messages as read when component is visible
  useEffect(() => {
    if (autoMarkAsRead && messages.length > 0 && user) {
      const timer = setTimeout(() => {
        markAsRead();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [messages, autoMarkAsRead, user]);

  const initializeChat = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Load initial messages
      await loadMessages();
      
      // Load participants if presence is enabled
      if (enablePresence) {
        await loadParticipants();
      }
      
      // Load unread count
      await loadUnreadCount();
      
      // Set up real-time subscriptions
      setupRealtimeSubscriptions();
      
      // Update user presence
      if (enablePresence) {
        await chatService.updateParticipantActivity(communityId, user.id, 'active');
      }
    } catch (err) {
      setError('Failed to initialize chat');
      console.error('Chat initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (offset = 0) => {
    try {
      const result = await chatService.getMessages(communityId, 50, offset);
      if (result.success && result.messages) {
        if (offset === 0) {
          setMessages(result.messages);
        } else {
          setMessages(prev => [...result.messages, ...prev]);
        }
        setHasMoreMessages(result.messages.length === 50);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const loadParticipants = async () => {
    try {
      const result = await chatService.getChatParticipants(communityId);
      if (result.success && result.participants) {
        setParticipants(result.participants);
      }
    } catch (err) {
      console.error('Error loading participants:', err);
    }
  };

  const loadUnreadCount = async () => {
    if (!user) return;
    
    try {
      const result = await chatService.getUnreadMessageCount(user.id, communityId);
      if (result.success && result.count !== undefined) {
        setUnreadCount(result.count);
      }
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const unsubscribe = chatService.subscribeToChat(communityId, {
      onMessage: handleNewMessage,
      onTyping: enableTypingIndicators ? setTypingIndicators : undefined,
      onParticipants: enablePresence ? setParticipants : undefined
    });
    
    unsubscribeRef.current = unsubscribe;
  };

  const handleNewMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      // Avoid duplicates
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });

    // Update unread count if message is from another user
    if (user && message.user_id !== user.id) {
      setUnreadCount(prev => prev + 1);
    }
  }, [user]);

  const sendMessage = async (content: string, replyToId?: string): Promise<boolean> => {
    if (!user || !content.trim()) return false;

    try {
      const result = await chatService.sendMessage(
        communityId,
        user.id,
        content.trim(),
        'text',
        replyToId
      );

      if (result.success) {
        // Stop typing indicator
        setTyping(false);
        return true;
      } else {
        setError(result.error || 'Failed to send message');
        return false;
      }
    } catch (err) {
      setError('An unexpected error occurred');
      return false;
    }
  };

  const editMessage = async (messageId: string, newContent: string): Promise<boolean> => {
    if (!user || !newContent.trim()) return false;

    try {
      const result = await chatService.editMessage(messageId, user.id, newContent.trim());
      
      if (result.success) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: newContent.trim(), edited_at: new Date().toISOString() }
            : msg
        ));
        return true;
      } else {
        setError(result.error || 'Failed to edit message');
        return false;
      }
    } catch (err) {
      setError('An unexpected error occurred');
      return false;
    }
  };

  const deleteMessage = async (messageId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const result = await chatService.deleteMessage(messageId, user.id);
      
      if (result.success) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        return true;
      } else {
        setError(result.error || 'Failed to delete message');
        return false;
      }
    } catch (err) {
      setError('An unexpected error occurred');
      return false;
    }
  };

  const addReaction = async (messageId: string, reactionType: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const result = await chatService.addReaction(messageId, user.id, reactionType);
      
      if (result.success) {
        // Refresh message reactions
        const reactions = await chatService.getMessageReactions(messageId);
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, reactions } : msg
        ));
        return true;
      } else {
        setError(result.error || 'Failed to add reaction');
        return false;
      }
    } catch (err) {
      setError('An unexpected error occurred');
      return false;
    }
  };

  const removeReaction = async (messageId: string, reactionType: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const result = await chatService.removeReaction(messageId, user.id, reactionType);
      
      if (result.success) {
        // Refresh message reactions
        const reactions = await chatService.getMessageReactions(messageId);
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, reactions } : msg
        ));
        return true;
      } else {
        setError(result.error || 'Failed to remove reaction');
        return false;
      }
    } catch (err) {
      setError('An unexpected error occurred');
      return false;
    }
  };

  const markAsRead = async (): Promise<void> => {
    if (!user) return;

    try {
      await chatService.markMessagesAsRead(communityId, user.id);
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const setTyping = (isTyping: boolean): void => {
    if (!user || !enableTypingIndicators) return;

    chatService.updateTypingIndicator(communityId, user.id, isTyping);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        chatService.updateTypingIndicator(communityId, user.id, false);
      }, 3000);
    }
  };

  const loadMoreMessages = useCallback(async (): Promise<void> => {
    if (!hasMoreMessages || isLoading) return;
    
    setIsLoading(true);
    try {
      await loadMessages(messages.length);
    } finally {
      setIsLoading(false);
    }
  }, [hasMoreMessages, isLoading, messages.length]);

  const searchMessages = async (searchTerm: string): Promise<ChatMessage[]> => {
    try {
      const result = await chatService.searchMessages(communityId, searchTerm);
      if (result.success && result.messages) {
        return result.messages;
      }
      return [];
    } catch (err) {
      console.error('Error searching messages:', err);
      return [];
    }
  };

  const refreshMessages = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await loadMessages(0);
      await loadUnreadCount();
    } finally {
      setIsLoading(false);
    }
  };

  const cleanup = (): void => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Update user presence to offline
    if (user && enablePresence) {
      chatService.updateUserPresence(user.id, 'offline', communityId);
    }
  };

  return {
    messages,
    participants,
    typingIndicators,
    unreadCount,
    isLoading,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    markAsRead,
    setTyping,
    loadMoreMessages,
    searchMessages,
    refreshMessages
  };
}