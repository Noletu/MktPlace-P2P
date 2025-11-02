import { useState, useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationFilters {
  category?: string;
  isRead?: boolean;
  priority?: string;
}

export function useNotifications(filters?: NotificationFilters, limit: number = 20) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchNotifications = useCallback(async (customOffset?: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', (customOffset ?? offset).toString());

      if (filters?.category) params.append('category', filters.category);
      if (filters?.isRead !== undefined) params.append('isRead', filters.isRead.toString());
      if (filters?.priority) params.append('priority', filters.priority);

      const response = await fetch(\`http://localhost:3001/api/v1/notifications?\${params.toString()}\`, {
        headers: {
          'Authorization': \`Bearer \${token}\`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
        setTotal(data.data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, limit, offset]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/notifications/unread-count', {
        headers: {
          'Authorization': \`Bearer \${token}\`,
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

      const response = await fetch(\`http://localhost:3001/api/v1/notifications/\${notificationId}/read\`, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${token}\`,
        },
      });

      if (response.ok) {
        // Optimistic update
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${token}\`,
        },
      });

      if (response.ok) {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(\`http://localhost:3001/api/v1/notifications/\${notificationId}\`, {
        method: 'DELETE',
        headers: {
          'Authorization': \`Bearer \${token}\`,
        },
      });

      if (response.ok) {
        // Optimistic update
        const deleted = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setTotal(prev => Math.max(0, prev - 1));
        if (deleted && !deleted.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, [notifications]);

  const deleteAllRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/notifications/delete-all-read', {
        method: 'DELETE',
        headers: {
          'Authorization': \`Bearer \${token}\`,
        },
      });

      if (response.ok) {
        // Optimistic update
        setNotifications(prev => prev.filter(n => !n.isRead));
        const readCount = notifications.filter(n => n.isRead).length;
        setTotal(prev => Math.max(0, prev - readCount));
      }
    } catch (error) {
      console.error('Failed to delete all read:', error);
    }
  }, [notifications]);

  const loadMore = useCallback(() => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    fetchNotifications(newOffset);
  }, [offset, limit, fetchNotifications]);

  const resetPagination = useCallback(() => {
    setOffset(0);
    fetchNotifications(0);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
    // Polling removido - agora usamos WebSocket para atualizações em tempo real
  }, [fetchNotifications]);

  // Reset pagination when filters change
  useEffect(() => {
    resetPagination();
  }, [filters?.category, filters?.isRead, filters?.priority]);

  const hasMore = offset + notifications.length < total;

  return {
    notifications,
    unreadCount,
    total,
    loading,
    hasMore,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    loadMore,
    resetPagination,
  };
}
