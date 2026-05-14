import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/utils/api';

export function useUnreadChats() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Buscar contador de não lidas da API
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/chat/unread-count');

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.data.unreadChatsCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar contador inicial
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Polling a cada 10 segundos (mais frequente já que não temos WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 10000); // 10 segundos

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    refresh: fetchUnreadCount,
  };
}
