import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import * as encryptionUtils from '@/utils/encryption.utils';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  message?: string; // Mensagens antigas (não criptografadas)
  encryptedContent?: string; // Mensagens novas (criptografadas)
  isEncrypted?: boolean; // Flag de criptografia
  iv?: string; // Initialization Vector
  type: string;
  attachmentUrl?: string;
  attachmentType?: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
  };
  // Campo para mensagem descriptografada (apenas em memória)
  decryptedMessage?: string;
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
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const publicKeyRef = useRef<CryptoKey | null>(null);
  const recipientPublicKeyRef = useRef<CryptoKey | null>(null);

  // Inicializar chaves de criptografia
  const initializeEncryption = useCallback(async () => {
    if (!encryptionUtils.isCryptoSupported()) {
      console.warn('Web Crypto API not supported. Encryption disabled.');
      return;
    }

    try {
      // Tentar recuperar chaves existentes
      let privateKey = await encryptionUtils.getPrivateKey();
      let publicKey = await encryptionUtils.getPublicKey();

      // Se não existir, gerar novas chaves
      if (!privateKey || !publicKey) {
        console.log('🔑 Generating new encryption keys...');
        const keyPair = await encryptionUtils.generateKeyPair();
        privateKey = keyPair.privateKey;
        publicKey = keyPair.publicKey;

        // Armazenar localmente
        await encryptionUtils.storePrivateKey(privateKey);
        await encryptionUtils.storePublicKey(publicKey);

        // Enviar chave pública ao servidor
        const token = localStorage.getItem('accessToken');
        const publicKeyExported = await encryptionUtils.exportPublicKey(publicKey);

        await fetch('http://localhost:3001/api/v1/keys/public-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ publicKey: publicKeyExported }),
        });

        console.log('✅ Public key sent to server');
      }

      privateKeyRef.current = privateKey;
      publicKeyRef.current = publicKey;
      setEncryptionEnabled(true);
      console.log('🔐 Encryption enabled');
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      setEncryptionEnabled(false);
    }
  }, []);

  // Buscar chave pública do destinatário
  const fetchRecipientPublicKey = useCallback(async (recipientId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `http://localhost:3001/api/v1/keys/public-key/${recipientId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const publicKey = await encryptionUtils.importPublicKey(data.data.publicKey);
        recipientPublicKeyRef.current = publicKey;
        console.log('✅ Recipient public key loaded');
        return publicKey;
      }
    } catch (error) {
      console.error('Failed to fetch recipient public key:', error);
    }
    return null;
  }, []);

  // Descriptografar mensagem
  const decryptMessageContent = useCallback(async (msg: ChatMessage): Promise<ChatMessage> => {
    if (!msg.isEncrypted || !msg.encryptedContent || !msg.iv) {
      // Mensagem não criptografada (retrocompatibilidade)
      return { ...msg, decryptedMessage: msg.message };
    }

    if (!privateKeyRef.current) {
      console.warn('Private key not available for decryption');
      return { ...msg, decryptedMessage: '🔒 Mensagem criptografada' };
    }

    try {
      const decrypted = await encryptionUtils.decryptMessage(
        msg.encryptedContent,
        msg.iv,
        privateKeyRef.current
      );
      return { ...msg, decryptedMessage: decrypted };
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return { ...msg, decryptedMessage: '❌ Erro ao descriptografar' };
    }
  }, []);

  // Conectar ao WebSocket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io('http://localhost:3001/chat', {
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

    newSocket.on('message:new', async (message: ChatMessage) => {
      // Descriptografar mensagem se necessário
      const decryptedMsg = await decryptMessageContent(message);
      setMessages((prev) => [...prev, decryptedMsg]);
    });

    newSocket.on('user:typing', (data: any) => {
      setIsTyping(data.isTyping);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Inicializar criptografia ao conectar
    initializeEncryption();

    return () => {
      newSocket.disconnect();
    };
  }, [initializeEncryption]);

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
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;

      const response = await fetch(`http://localhost:3001/api/v1/chat/${chatId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChat(data.data);

        // Buscar chave pública do destinatário
        const otherParticipant = data.data.otherParticipant;
        if (otherParticipant && otherParticipant.id !== currentUser?.id) {
          await fetchRecipientPublicKey(otherParticipant.id);
        }

        // Descriptografar mensagens
        const messages = data.data.messages || [];
        const decryptedMessages = await Promise.all(
          messages.map((msg: ChatMessage) => decryptMessageContent(msg))
        );
        setMessages(decryptedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    }
  }, [chatId, fetchRecipientPublicKey, decryptMessageContent]);

  const stopTyping = useCallback(() => {
    if (!socket || !chatId) return;

    socket.emit('typing:stop', { chatId });
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
  }, [socket, chatId, isTyping, stopTyping]);

  const sendMessage = useCallback(async (message: string, attachment?: { url: string; type: string }) => {
    if (!socket || !chatId) return;
    if (!message.trim() && !attachment) return;

    try {
      // Tentar criptografar se possível
      if (encryptionEnabled && recipientPublicKeyRef.current && !attachment) {
        const encrypted = await encryptionUtils.encryptMessage(
          message.trim(),
          recipientPublicKeyRef.current
        );

        socket.emit('message:send', {
          chatId,
          encryptedContent: encrypted.encryptedContent,
          isEncrypted: true,
          iv: encrypted.iv,
        });

        console.log('🔐 Sent encrypted message');
      } else {
        // Fallback para mensagem não criptografada
        socket.emit('message:send', {
          chatId,
          message: message.trim() || '📎 Anexo',
          attachmentUrl: attachment?.url,
          attachmentType: attachment?.type,
        });

        if (encryptionEnabled && !recipientPublicKeyRef.current) {
          console.warn('⚠️ Recipient public key not available, sent unencrypted');
        }
      }

      stopTyping();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [socket, chatId, encryptionEnabled, stopTyping]);

  const markAsRead = useCallback(() => {
    if (!socket || !chatId) return;

    socket.emit('messages:read', { chatId });
  }, [socket, chatId]);

  const loadChatHistory = useCallback(async () => {
    if (!chatId) return;

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`http://localhost:3001/api/v1/chat/${chatId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChat(data.data.chat);

        // Descriptografar mensagens (incluindo arquivadas)
        const allMessages = data.data.messages || [];
        const decryptedMessages = await Promise.all(
          allMessages.map((msg: ChatMessage) => decryptMessageContent(msg))
        );
        setMessages(decryptedMessages);

        return data.data;
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [chatId, decryptMessageContent]);

  return {
    socket,
    messages,
    isConnected,
    isTyping,
    chat,
    encryptionEnabled,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    loadChatMessages,
    loadChatHistory,
  };
}
