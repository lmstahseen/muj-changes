import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Search, Smile, MoreVertical, Reply, Edit, Trash2, Users, Settings, RefreshCw, ArrowDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { ChatMessage } from '../services/chatService';

interface ChatInterfaceProps {
  communityId: string;
  isInMeeting?: boolean;
  className?: string;
}

export function ChatInterface({ communityId, isInMeeting = false, className = '' }: ChatInterfaceProps) {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef<number>(0);
  const isNearBottomRef = useRef<boolean>(true);

  const {
    messages,
    participants,
    typingIndicators,
    unreadCount,
    isLoading,
    error,
    sendMessage,
    editMessage: editMessageAction,
    deleteMessage,
    addReaction,
    removeReaction,
    markAsRead,
    setTyping,
    loadMoreMessages,
    searchMessages,
    refreshMessages
  } = useChat({
    communityId,
    autoMarkAsRead: true,
    enableTypingIndicators: true,
    enablePresence: !isInMeeting
  });

  // Auto-scroll to bottom on new messages (only if user was at bottom)
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom();
    } else {
      setShowScrollToBottom(true);
    }
  }, [messages]);

  // Handle scroll events to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      isNearBottomRef.current = isNearBottom;
      setShowScrollToBottom(!isNearBottom && messages.length > 0);
      
      // Load more messages when scrolling to top
      if (scrollTop < 100 && scrollTop < lastScrollTop.current) {
        loadMoreMessages();
      }
      
      lastScrollTop.current = scrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length, loadMoreMessages]);

  // Handle search
  useEffect(() => {
    if (searchTerm.trim()) {
      const timeoutId = setTimeout(async () => {
        const results = await searchMessages(searchTerm.trim());
        setSearchResults(results);
      }, 300);
      
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, searchMessages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setReplyToMessage(null);

    try {
      if (editingMessage) {
        // Edit existing message
        const success = await editMessageAction(editingMessage.id, messageContent);
        if (success) {
          setEditingMessage(null);
        }
      } else {
        // Send new message
        await sendMessage(messageContent, replyToMessage?.id);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(messageContent); // Restore message on error
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Update typing indicator
    if (e.target.value.trim()) {
      setTyping(true);
    } else {
      setTyping(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      await deleteMessage(messageId);
    }
  };

  const handleReaction = async (messageId: string, reactionType: string) => {
    const message = messages.find(m => m.id === messageId);
    const existingReaction = message?.reactions?.find(
      r => r.user_id === user?.id && r.reaction_type === reactionType
    );

    if (existingReaction) {
      await removeReaction(messageId, reactionType);
    } else {
      await addReaction(messageId, reactionType);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getTypingText = () => {
    const typingUsers = typingIndicators
      .filter(indicator => indicator.user_id !== user?.id)
      .map(indicator => indicator.user_name || 'Someone');

    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
  };

  const displayMessages = showSearch && searchResults.length > 0 ? searchResults : messages;

  if (isLoading && messages.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className={`text-sm ${isInMeeting ? 'text-gray-300' : 'text-gray-600'}`}>Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${isInMeeting ? 'bg-gray-800 text-white' : 'bg-white'} ${className}`}>
      {/* Chat Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        isInMeeting ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex items-center space-x-3">
          <h3 className={`font-semibold ${isInMeeting ? 'text-white' : 'text-gray-900'}`}>
            {isInMeeting ? 'Meeting Chat' : 'Community Chat'}
          </h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={refreshMessages}
            className={`p-2 rounded-lg transition-colors ${
              isInMeeting 
                ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Refresh messages"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg transition-colors ${
              isInMeeting 
                ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Search messages"
          >
            <Search size={16} />
          </button>
          {!isInMeeting && (
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              title="Show participants"
            >
              <Users size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className={`p-4 border-b ${isInMeeting ? 'border-gray-700' : 'border-gray-200'}`}>
          <input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              isInMeeting 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'border-gray-200'
            }`}
          />
          {searchResults.length > 0 && (
            <p className={`text-xs mt-2 ${isInMeeting ? 'text-gray-400' : 'text-gray-600'}`}>
              Found {searchResults.length} result(s)
            </p>
          )}
        </div>
      )}

      {/* Participants Sidebar */}
      {showParticipants && !isInMeeting && (
        <div className="p-4 border-b border-gray-200 max-h-32 overflow-y-auto">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Online ({participants.filter(p => p.is_online).length})
          </h4>
          <div className="space-y-2">
            {participants.filter(p => p.is_online).map(participant => (
              <div key={participant.id} className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-xs">
                  {participant.user_avatar || '👤'}
                </div>
                <span className="text-sm text-gray-700">{participant.user_name}</span>
                <div className={`w-2 h-2 rounded-full ${
                  participant.status === 'active' ? 'bg-green-500' :
                  participant.status === 'away' ? 'bg-yellow-500' :
                  participant.status === 'busy' ? 'bg-red-500' :
                  'bg-gray-400'
                }`}></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={`p-4 border-b ${
          isInMeeting ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm ${isInMeeting ? 'text-red-200' : 'text-red-700'}`}>{error}</p>
        </div>
      )}

      {/* Reply Banner */}
      {replyToMessage && (
        <div className={`p-3 border-b flex items-center justify-between ${
          isInMeeting ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center space-x-2">
            <Reply size={16} className={isInMeeting ? 'text-blue-300' : 'text-blue-600'} />
            <span className={`text-sm ${isInMeeting ? 'text-blue-200' : 'text-blue-800'}`}>
              Replying to {replyToMessage.user_name}: {replyToMessage.content.substring(0, 50)}...
            </span>
          </div>
          <button
            onClick={() => setReplyToMessage(null)}
            className={isInMeeting ? 'text-blue-300 hover:text-blue-100' : 'text-blue-600 hover:text-blue-800'}
          >
            ×
          </button>
        </div>
      )}

      {/* Edit Banner */}
      {editingMessage && (
        <div className={`p-3 border-b flex items-center justify-between ${
          isInMeeting ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center space-x-2">
            <Edit size={16} className={isInMeeting ? 'text-yellow-300' : 'text-yellow-600'} />
            <span className={`text-sm ${isInMeeting ? 'text-yellow-200' : 'text-yellow-800'}`}>Editing message</span>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setNewMessage('');
            }}
            className={isInMeeting ? 'text-yellow-300 hover:text-yellow-100' : 'text-yellow-600 hover:text-yellow-800'}
          >
            ×
          </button>
        </div>
      )}

      {/* Messages Container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative"
      >
        {displayMessages.length === 0 ? (
          <div className={`text-center py-8 ${isInMeeting ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
              isInMeeting ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              💬
            </div>
            <p className="text-sm">
              {showSearch && searchTerm ? 'No messages found' : 'No messages yet'}
            </p>
            <p className="text-xs">
              {showSearch && searchTerm ? 'Try a different search term' : 'Start the conversation!'}
            </p>
          </div>
        ) : (
          displayMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-xs lg:max-w-md rounded-lg p-3 relative group ${
                message.user_id === user?.id 
                  ? isInMeeting 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-primary-600 text-white'
                  : isInMeeting 
                    ? 'bg-gray-700 text-gray-100' 
                    : 'bg-gray-100 text-gray-900'
              }`}>
                {/* Message Header */}
                {message.user_id !== user?.id && (
                  <div className="flex items-center space-x-2 mb-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      isInMeeting ? 'bg-gray-600' : 'bg-primary-100'
                    }`}>
                      {message.user_avatar || '👤'}
                    </div>
                    <span className="text-xs font-medium">{message.user_name}</span>
                  </div>
                )}

                {/* Reply Context */}
                {message.reply_to_id && (
                  <div className="text-xs opacity-75 mb-2 p-2 bg-black bg-opacity-10 rounded">
                    Replying to previous message
                  </div>
                )}

                {/* Message Content */}
                <p className="text-sm break-words">{message.content}</p>

                {/* Message Footer */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs opacity-75">
                    {formatTimestamp(message.created_at)}
                    {message.edited_at && ' (edited)'}
                  </span>
                  
                  {/* Message Actions */}
                  {message.user_id === user?.id && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setEditingMessage(message);
                          setNewMessage(message.content);
                          messageInputRef.current?.focus();
                        }}
                        className="p-1 hover:bg-black hover:bg-opacity-10 rounded"
                        title="Edit message"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="p-1 hover:bg-black hover:bg-opacity-10 rounded"
                        title="Delete message"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(
                      message.reactions.reduce((acc, reaction) => {
                        acc[reaction.reaction_type] = (acc[reaction.reaction_type] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([reactionType, count]) => (
                      <button
                        key={reactionType}
                        onClick={() => handleReaction(message.id, reactionType)}
                        className="text-xs bg-black bg-opacity-10 px-2 py-1 rounded-full hover:bg-opacity-20 transition-colors"
                      >
                        {reactionType} {count}
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Reactions */}
                {message.user_id !== user?.id && (
                  <div className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`flex space-x-1 rounded-full shadow-lg p-1 ${
                      isInMeeting ? 'bg-gray-600' : 'bg-white'
                    }`}>
                      {['👍', '❤️', '😂', '😮'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(message.id, emoji)}
                          className={`w-6 h-6 text-xs rounded-full transition-colors ${
                            isInMeeting ? 'hover:bg-gray-500' : 'hover:bg-gray-100'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing Indicators */}
        {typingIndicators.length > 0 && (
          <div className="flex justify-start">
            <div className={`rounded-lg p-3 text-sm ${
              isInMeeting ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
            }`}>
              {getTypingText()}
              <div className="flex space-x-1 mt-1">
                <div className={`w-2 h-2 rounded-full animate-bounce ${
                  isInMeeting ? 'bg-gray-500' : 'bg-gray-400'
                }`}></div>
                <div className={`w-2 h-2 rounded-full animate-bounce ${
                  isInMeeting ? 'bg-gray-500' : 'bg-gray-400'
                }`} style={{ animationDelay: '0.1s' }}></div>
                <div className={`w-2 h-2 rounded-full animate-bounce ${
                  isInMeeting ? 'bg-gray-500' : 'bg-gray-400'
                }`} style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-20 right-4 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 transition-colors z-10"
            title="Scroll to bottom"
          >
            <ArrowDown size={20} />
          </button>
        )}
      </div>

      {/* Message Input */}
      <div className={`p-4 border-t ${isInMeeting ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <input
              ref={messageInputRef}
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              onBlur={() => setTyping(false)}
              placeholder={editingMessage ? 'Edit your message...' : 'Type a message...'}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-12 ${
                isInMeeting 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'border-gray-200'
              }`}
              maxLength={2000}
            />
            <button
              onClick={() => {/* Emoji picker would go here */}}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${
                isInMeeting 
                  ? 'text-gray-400 hover:text-gray-200' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Add emoji"
            >
              <Smile size={20} />
            </button>
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="bg-primary-600 text-white p-3 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={editingMessage ? 'Save changes' : 'Send message'}
          >
            <Send size={20} />
          </button>
        </div>
        
        {/* Character Count */}
        <div className={`flex justify-between items-center mt-2 text-xs ${
          isInMeeting ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <span>{newMessage.length}/2000</span>
          {replyToMessage && (
            <button
              onClick={() => setReplyToMessage(null)}
              className={isInMeeting ? 'text-blue-400 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}
            >
              Cancel reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}