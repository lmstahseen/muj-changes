import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import chatService, { ChatNotification } from '../services/chatService';

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className = '' }: NotificationCenterProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadNotifications();
      
      // Set up periodic refresh
      const interval = setInterval(loadNotifications, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user, filter]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const result = await chatService.getChatNotifications(
        user.id, 
        50, 
        filter === 'unread'
      );
      
      if (result.success && result.notifications) {
        setNotifications(result.notifications);
        setUnreadCount(result.notifications.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    
    try {
      const result = await chatService.markNotificationAsRead(notificationId, user.id);
      if (result.success) {
        setNotifications(prev => prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifications.map(n => chatService.markNotificationAsRead(n.id, user.id))
      );
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: ChatNotification['notification_type']) => {
    switch (type) {
      case 'mention': return 'solar:chat-round-dots-bold-duotone';
      case 'direct_message': return 'solar:chat-round-line-bold-duotone';
      case 'announcement': return 'solar:bell-bold-duotone';
      case 'meeting_reminder': return 'solar:calendar-bold-duotone';
      case 'community_update': return 'solar:users-group-rounded-bold-duotone';
      default: return 'solar:bell-bold-duotone';
    }
  };

  const getNotificationColor = (type: ChatNotification['notification_type']) => {
    switch (type) {
      case 'mention': return 'text-blue-600';
      case 'direct_message': return 'text-green-600';
      case 'announcement': return 'text-purple-600';
      case 'meeting_reminder': return 'text-orange-600';
      case 'community_update': return 'text-indigo-600';
      default: return 'text-gray-600';
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

  const filteredNotifications = notifications.filter(n => 
    filter === 'all' || !n.is_read
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:text-primary-600 transition-colors rounded-lg hover:bg-gray-100"
        title="Notifications"
      >
        <Icon icon="solar:bell-bold-duotone" width={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-medium border border-gray-100 z-50 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon icon="solar:close-circle-bold" width={20} />
              </button>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  filter === 'all'
                    ? 'bg-white text-gray-900 shadow-soft'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`flex-1 px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  filter === 'unread'
                    ? 'bg-white text-gray-900 shadow-soft'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            
            {/* Actions */}
            {unreadCount > 0 && (
              <div className="flex justify-end mt-3">
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-600 text-sm">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Icon icon="solar:bell-bold-duotone" className="mx-auto mb-3 text-gray-400" width={32} />
                <p className="text-gray-600 font-medium">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  {filter === 'unread' 
                    ? 'All caught up!' 
                    : 'Notifications will appear here when you receive them'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredNotifications.map((notification) => {
                  const iconName = getNotificationIcon(notification.notification_type);
                  const iconColor = getNotificationColor(notification.notification_type);
                  
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notification.is_read ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => !notification.is_read && markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                          <Icon icon={iconName} width={16} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-sm font-medium ${
                              !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h4>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                          
                          <p className={`text-sm mt-1 ${
                            !notification.is_read ? 'text-gray-700' : 'text-gray-600'
                          }`}>
                            {notification.content}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(notification.created_at)}
                            </span>
                            
                            {!notification.is_read && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <button className="w-full text-center text-sm text-gray-600 hover:text-gray-900 font-medium py-2 flex items-center justify-center space-x-2">
              <Icon icon="solar:settings-bold-duotone" width={16} />
              <span>Notification Settings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}