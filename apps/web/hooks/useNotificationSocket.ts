import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWsUrl } from '@/config/api';
import { fetchWithAuth } from '@/utils/api';

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

  const getSocketTicket = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetchWithAuth('/auth/socket-ticket');
      if (!res.ok) return null;
      const data = await res.json();
      return data.ticket ?? null;
    } catch {
      return null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected || isConnectedRef.current) {
      return;
    }

    const ticket = await getSocketTicket();
    if (!ticket) return;

    const socket = io(getWsUrl('notifications'), {
      path: '/socket.io/',
      withCredentials: true,
      auth: { token: ticket },
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
  }, [getSocketTicket, onNewNotification, onNotificationRead, onAllRead, onNotificationDeleted, onCountUpdate]);

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
