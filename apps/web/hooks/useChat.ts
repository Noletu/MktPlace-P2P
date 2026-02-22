import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import * as encryptionUtils from '@/utils/encryption.utils';
import { getWsUrl } from '@/config/api';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  message?: string; // Mensagens antigas (não criptografadas)
  encryptedContent?: string; // Criptografado para o DESTINATÁRIO
  encryptedForSender?: string; // Criptografado para o REMETENTE (E2E correto)
  isEncrypted?: boolean; // Flag de criptografia
  iv?: string; // IV para encryptedContent (destinatário)
  ivForSender?: string; // IV para encryptedForSender (remetente)
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

interface UseChatOptions {
  onNewMessage?: (message: ChatMessage, isMine: boolean) => void;
}

export function useChat(chatId?: string, options?: UseChatOptions) {
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
  // Map para guardar mensagens próprias antes da criptografia
  const ownMessagesRef = useRef<Map<string, string>>(new Map());
  // Texto da mensagem que acabou de ser enviada (esperando ID do servidor)
  const pendingMessageRef = useRef<string | null>(null);
  // Callback ref para evitar re-renders
  const onNewMessageRef = useRef(options?.onNewMessage);

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

        await fetch('http://localhost:3002/api/v1/keys/public-key', {
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
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api/v1"}/keys/public-key/${recipientId}`,
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
    if (!msg.isEncrypted) {
      // Mensagem não criptografada (retrocompatibilidade)
      return { ...msg, decryptedMessage: msg.message };
    }

    // Verificar se tenho algum conteúdo criptografado
    if (!msg.encryptedContent && !msg.encryptedForSender) {
      return { ...msg, decryptedMessage: msg.message };
    }

    if (!privateKeyRef.current) {
      console.warn('Private key not available for decryption');
      return { ...msg, decryptedMessage: '🔒 Mensagem criptografada' };
    }

    // Determinar se sou o remetente ou destinatário
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const isMine = currentUser && msg.senderId === currentUser.id;

    // Escolher a versão criptografada correta e seu IV:
    // - Se sou o remetente: usar encryptedForSender + ivForSender
    // - Se sou o destinatário: usar encryptedContent + iv
    const contentToDecrypt = isMine ? msg.encryptedForSender : msg.encryptedContent;
    const ivToUse = isMine ? msg.ivForSender : msg.iv;

    if (!contentToDecrypt || !ivToUse) {
      // Fallback: tentar a outra versão ou mensagem em texto
      console.warn('[Chat] No encrypted content/IV for my role, trying fallback');
      if (msg.encryptedContent && msg.iv) {
        try {
          const decrypted = await encryptionUtils.decryptMessage(
            msg.encryptedContent,
            msg.iv,
            privateKeyRef.current
          );
          return { ...msg, decryptedMessage: decrypted };
        } catch {
          // Não conseguiu descriptografar
        }
      }
      return { ...msg, decryptedMessage: msg.message || '🔒 Mensagem criptografada' };
    }

    try {
      const decrypted = await encryptionUtils.decryptMessage(
        contentToDecrypt,
        ivToUse,
        privateKeyRef.current
      );
      return { ...msg, decryptedMessage: decrypted };
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return { ...msg, decryptedMessage: '❌ Erro ao descriptografar' };
    }
  }, []);

  // Atualizar ref do callback quando options mudar
  useEffect(() => {
    onNewMessageRef.current = options?.onNewMessage;
  }, [options?.onNewMessage]);

  // Conectar ao WebSocket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(getWsUrl('chat'), {
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
      // Verificar se é própria mensagem para guardar no cache
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const isMine = currentUser && message.senderId === currentUser.id;

      console.log('[Chat] New message received:', {
        id: message.id.slice(0, 8),
        isEncrypted: message.isEncrypted,
        hasIV: !!message.iv,
        senderId: message.senderId.slice(0, 8),
        isMine,
      });

      // Se é minha mensagem e tenho pendingMessage, guardar no cache
      if (isMine && pendingMessageRef.current) {
        console.log('[Chat] Storing own message plaintext:', message.id.slice(0, 8));
        ownMessagesRef.current.set(message.id, pendingMessageRef.current);
        pendingMessageRef.current = null; // Limpar após usar
      }

      // Descriptografar mensagem se necessário
      const decryptedMsg = await decryptMessageContent(message);
      setMessages((prev) => [...prev, decryptedMsg]);

      // Notificar componente pai sobre nova mensagem (para atualizar badge)
      if (onNewMessageRef.current) {
        onNewMessageRef.current(decryptedMsg, !!isMine);
      }
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
      // Limpar cache de mensagens próprias ao trocar de chat
      ownMessagesRef.current.clear();
      pendingMessageRef.current = null;

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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api/v1"}/chat/${chatId}`, {
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
      // Tentar criptografar se possível (precisa das duas chaves: minha e do destinatário)
      if (encryptionEnabled && recipientPublicKeyRef.current && publicKeyRef.current && !attachment) {
        // Criptografar para o DESTINATÁRIO (ele vai usar sua chave privada para ler)
        const encryptedForRecipient = await encryptionUtils.encryptMessage(
          message.trim(),
          recipientPublicKeyRef.current
        );

        // Criptografar para MIM MESMO (vou usar minha chave privada para ler no histórico)
        const encryptedForMe = await encryptionUtils.encryptMessage(
          message.trim(),
          publicKeyRef.current
        );

        socket.emit('message:send', {
          chatId,
          encryptedContent: encryptedForRecipient.encryptedContent, // Para destinatário
          encryptedForSender: encryptedForMe.encryptedContent, // Para mim (remetente)
          isEncrypted: true,
          iv: encryptedForRecipient.iv, // IV para destinatário
          ivForSender: encryptedForMe.iv, // IV para remetente
        });

        console.log('🔐 Sent E2E encrypted message (for both parties)');
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api/v1"}/chat/${chatId}/history`, {
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
