import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  message: string;
  type: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
  };
}

export interface Chat {
  id: string;
  orderId: string;
  unreadCount: number;
  lastMessageAt?: string;
  otherParticipant: {
    id: string;
    name: string;
    reputationScore: number;
  };
  messages: ChatMessage[];
}

export function useChat(chatId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Conectar ao WebSocket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io('http://localhost:3001', {
      auth: { token },
      path: '/socket.io/',
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to chat server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from chat server');
      setIsConnected(false);
    });

    newSocket.on('error', (error: any) => {
      console.error('Socket error:', error.message);
    });

    newSocket.on('message:new', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    newSocket.on('user:typing', (data: any) => {
      setIsTyping(data.isTyping);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Entrar no chat quando chatId mudar
  useEffect(() => {
    if (socket && chatId) {
      socket.emit('chat:join', { chatId });

      socket.once('chat:joined', () => {
        console.log('✅ Joined chat:', chatId);
        loadChatMessages();
      });

      return () => {
        socket.emit('chat:leave', { chatId });
      };
    }
  }, [socket, chatId]);

  const loadChatMessages = useCallback(async () => {
    if (!chatId) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v1/chat/${chatId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChat(data.data);
        setMessages(data.data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    }
  }, [chatId]);

  const sendMessage = useCallback((message: string) => {
    if (!socket || !chatId || !message.trim()) return;

    socket.emit('message:send', {
      chatId,
      message: message.trim(),
    });

    stopTyping();
  }, [socket, chatId]);

  const startTyping = useCallback(() => {
    if (!socket || !chatId) return;

    if (!isTyping) {
      socket.emit('typing:start', { chatId });
    }

    // Resetar timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  }, [socket, chatId, isTyping]);

  const stopTyping = useCallback(() => {
    if (!socket || !chatId) return;

    socket.emit('typing:stop', { chatId });
  }, [socket, chatId]);

  const markAsRead = useCallback(() => {
    if (!socket || !chatId) return;

    socket.emit('messages:read', { chatId });
  }, [socket, chatId]);

  return {
    socket,
    messages,
    isConnected,
    isTyping,
    chat,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    loadChatMessages,
  };
}
