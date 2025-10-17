import { useState, useEffect, useCallback } from 'react';

export function useUnreadChats() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Buscar contador de não lidas da API
  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:3001/api/v1/chat/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

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
