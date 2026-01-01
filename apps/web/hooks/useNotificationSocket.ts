import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCount {
  unreadCount: number;
  total: number;
}

interface UseNotificationSocketProps {
  onNewNotification?: (notification: Notification) => void;
  onNotificationRead?: (notificationId: string) => void;
  onAllRead?: () => void;
  onNotificationDeleted?: (notificationId: string) => void;
  onCountUpdate?: (count: NotificationCount) => void;
}

export function useNotificationSocket({
  onNewNotification,
  onNotificationRead,
  onAllRead,
  onNotificationDeleted,
  onCountUpdate,
}: UseNotificationSocketProps = {}) {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);

  const connect = useCallback(() => {
    if (socketRef.current?.connected || isConnectedRef.current) {
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('[WebSocket] No access token, skipping connection');
      return;
    }

    const socket = io('http://localhost:3000/notifications', {
      path: '/socket.io/',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Notification socket connected', socket.id);
      isConnectedRef.current = true;
    });

    socket.on('notification:connected', (data: { userId: string; timestamp: string }) => {
      console.log('[WebSocket] Notification room joined', data);
    });

    socket.on('notification:new', (notification: Notification) => {
      console.log('[WebSocket] New notification received', notification);
      onNewNotification?.(notification);
    });

    socket.on('notification:read', (data: { notificationId: string }) => {
      console.log('[WebSocket] Notification marked as read', data.notificationId);
      onNotificationRead?.(data.notificationId);
    });

    socket.on('notification:all-read', () => {
      console.log('[WebSocket] All notifications marked as read');
      onAllRead?.();
    });

    socket.on('notification:deleted', (data: { notificationId: string }) => {
      console.log('[WebSocket] Notification deleted', data.notificationId);
      onNotificationDeleted?.(data.notificationId);
    });

    socket.on('notification:count', (count: NotificationCount) => {
      console.log('[WebSocket] Unread count updated', count);
      onCountUpdate?.(count);
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error', error.message);
      isConnectedRef.current = false;
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Notification socket disconnected', reason);
      isConnectedRef.current = false;
    });

    socketRef.current = socket;
  }, [onNewNotification, onNotificationRead, onAllRead, onNotificationDeleted, onCountUpdate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
      console.log('[WebSocket] Notification socket disconnected manually');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected: isConnectedRef.current,
    connect,
    disconnect,
  };
}
