import { useState, useEffect, useCallback } from 'react';

export interface ChatData {
  id: string;
  orderId: string;
  unreadCount: number;
  lastMessageAt: string;
  participant1: {
    id: string;
    name: string;
    reputationScore: number;
  };
  participant2: {
    id: string;
    name: string;
    reputationScore: number;
  };
  otherParticipant: {
    id: string;
    name: string;
    reputationScore: number;
  };
  order: {
    id: string;
    type: string;
    status: string;
    brlAmount: string;
    cryptoAmount: string;
    cryptoType: string;
  };
  messages: Array<{
    id: string;
    message: string;
    createdAt: string;
    sender: {
      id: string;
      name: string;
    };
  }>;
}

export function useChats() {
  const [chats, setChats] = useState<ChatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar todos os chats da API
  const fetchChats = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setChats([]);
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:3001/api/v1/chat', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChats(data.data || []);
        setError(null);
      } else {
        setError('Erro ao buscar chats');
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      setError('Erro ao buscar chats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar inicialmente
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Polling a cada 10 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchChats();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchChats]);

  // Função para obter contador de não lidas por orderId
  const getUnreadCountByOrderId = useCallback(
    (orderId: string): number => {
      const chat = chats.find((c) => c.orderId === orderId);
      return chat?.unreadCount || 0;
    },
    [chats]
  );

  // Função para obter total de não lidas
  const getTotalUnreadCount = useCallback((): number => {
    return chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
  }, [chats]);

  return {
    chats,
    loading,
    error,
    refresh: fetchChats,
    getUnreadCountByOrderId,
    getTotalUnreadCount,
  };
}
