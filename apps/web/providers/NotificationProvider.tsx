'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { useToast } from '@/hooks/useToast';

interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { showToast } = useToast();

  // Callback quando nova notificação chega via WebSocket
  const handleNewNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.isRead) {
      setUnreadCount(prev => prev + 1);
    }

    // Show toast notification
    const toastType =
      notification.priority === 'URGENT' ? 'error' :
      notification.priority === 'HIGH' ? 'warning' :
      notification.priority === 'LOW' ? 'info' : 'info';

    showToast({
      title: notification.title,
      message: notification.message,
      type: toastType,
      duration: notification.priority === 'URGENT' ? 10000 : 5000,
    });
  }, [showToast]);

  // Callback quando notificação é marcada como lida via WebSocket
  const handleNotificationRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Callback quando todas as notificações são marcadas como lidas
  const handleAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  // Callback quando notificação é deletada via WebSocket
  const handleNotificationDeleted = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      const filtered = prev.filter(n => n.id !== notificationId);

      // Se era não lida, decrementar contador
      if (notification && !notification.isRead) {
        setUnreadCount(prevCount => Math.max(0, prevCount - 1));
      }

      return filtered;
    });
  }, []);

  // Callback quando contagem é atualizada
  const handleCountUpdate = useCallback((count: { unreadCount: number; total: number }) => {
    setUnreadCount(count.unreadCount);
  }, []);

  // Conectar ao WebSocket
  useNotificationSocket({
    onNewNotification: handleNewNotification,
    onNotificationRead: handleNotificationRead,
    onAllRead: handleAllRead,
    onNotificationDeleted: handleNotificationDeleted,
    onCountUpdate: handleCountUpdate,
  });

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('[Notifications] Permission:', permission);
      });
    }
  }, []);

  // Actions (estes serão chamados pelos componentes, não pelo WebSocket)
  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.isRead) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      const filtered = prev.filter(n => n.id !== notificationId);

      if (notification && !notification.isRead) {
        setUnreadCount(prevCount => Math.max(0, prevCount - 1));
      }

      return filtered;
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        setNotifications,
        setUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}
