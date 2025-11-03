import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { playNotificationSound } from '@/utils/sound.utils';

export interface Notification {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isRead: boolean;
  createdAt: string;
}

// Browser Notification Permission state
let browserNotificationPermission: NotificationPermission = 'default';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      browserNotificationPermission = Notification.permission;

      if (browserNotificationPermission === 'default') {
        // Request permission after a short delay to avoid annoying the user immediately
        setTimeout(() => {
          Notification.requestPermission().then((permission) => {
            browserNotificationPermission = permission;
            console.log('[NOTIFICATIONS] Browser permission:', permission);
          });
        }, 3000);
      }
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((notification: Notification) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (browserNotificationPermission !== 'granted') return;

    // Only show if page is not focused
    if (document.hasFocus()) return;

    try {
      const browserNotif = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === 'URGENT' || notification.priority === 'HIGH',
      });

      browserNotif.onclick = () => {
        window.focus();
        if (notification.actionUrl) {
          window.location.href = notification.actionUrl;
        }
        browserNotif.close();
      };

      // Auto-close after 5 seconds for low priority
      if (notification.priority === 'LOW' || notification.priority === 'NORMAL') {
        setTimeout(() => browserNotif.close(), 5000);
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] Failed to show browser notification:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/notifications?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`http://localhost:3001/api/v1/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [fetchNotifications]);

  // Handle new notification from WebSocket
  const handleNewNotification = useCallback((notification: Notification) => {
    console.log('[NOTIFICATIONS] New notification received:', notification);

    // Add to notifications list
    setNotifications((prev) => [notification, ...prev].slice(0, 20));

    // Increment unread count
    setUnreadCount((prev) => prev + 1);

    // Play sound notification
    playNotificationSound(notification.priority);

    // Show browser notification
    showBrowserNotification(notification);
  }, [showBrowserNotification]);

  // Initialize WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchNotifications();

    // Connect to WebSocket
    const socket = io('http://localhost:3001', {
      auth: { token },
      path: '/socket.io/',
    });

    socket.on('connect', () => {
      console.log('✅ [NOTIFICATIONS] Connected to notification server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ [NOTIFICATIONS] Disconnected from notification server');
      setIsConnected(false);
    });

    socket.on('error', (error: any) => {
      console.error('[NOTIFICATIONS] Socket error:', error.message);
    });

    // Listen for new notifications
    socket.on('notification:new', handleNewNotification);

    socketRef.current = socket;

    // Fallback polling (only if not connected via WebSocket)
    const pollInterval = setInterval(() => {
      if (!socketRef.current?.connected) {
        console.log('[NOTIFICATIONS] WebSocket not connected, using polling fallback');
        fetchUnreadCount();
      }
    }, 30000);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, [fetchNotifications, fetchUnreadCount, handleNewNotification]);

  return {
    notifications,
    unreadCount,
    loading,
    isConnected,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
