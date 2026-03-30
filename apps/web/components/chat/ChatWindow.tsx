'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import ChatMessage from './ChatMessage';
import { fetchWithAuth } from '@/utils/api';

interface ChatWindowProps {
  orderId: string;
  onClose?: () => void;
  onMinimize?: () => void;
  readOnly?: boolean; // Bloqueia envio de mensagens (pedidos finalizados)
  onNewMessage?: (isMine: boolean) => void; // Callback para notificar novas mensagens
}

export default function ChatWindow({ orderId, onClose, onMinimize, readOnly = false, onNewMessage }: ChatWindowProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isConnected,
    isTyping,
    chat,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  } = useChat(chatId || undefined, {
    onNewMessage: (message, isMine) => {
      // Notificar componente pai sobre nova mensagem
      if (onNewMessage) {
        onNewMessage(isMine);
      }
    },
  });

  // Buscar ou criar chat para o pedido
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return;

        const userId = JSON.parse(userStr).id;
        setCurrentUserId(userId);

        const response = await fetchWithAuth(`/chat/order/${orderId}`);

        if (response.ok) {
          const data = await response.json();
          setChatId(data.data.id);
        }
      } catch (error) {
        console.error('Erro ao buscar chat:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChat();
  }, [orderId]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Marcar mensagens como lidas quando chat abre
  useEffect(() => {
    if (chatId && chat) {
      markAsRead();
    }
  }, [chatId, chat]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo (imagens e PDFs)
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Apenas imagens (JPEG, PNG, GIF, WebP) e PDFs são permitidos');
      return;
    }

    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Tamanho máximo: 10MB');
      return;
    }

    setSelectedFile(file);

    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() && !selectedFile) return;

    let attachment: { url: string; type: string } | undefined;

    if (selectedFile && filePreview) {
      attachment = {
        url: filePreview,
        type: selectedFile.type,
      };
    }

    sendMessage(inputMessage, attachment);
    setInputMessage('');
    handleRemoveFile();
    stopTyping();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    startTyping();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Carregando chat...</div>
      </div>
    );
  }

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Chat não disponível</div>
      </div>
    );
  }

  const otherParticipant = chat?.otherParticipant;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 bg-blue-600 dark:bg-blue-700 text-white rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">
            {otherParticipant?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="font-semibold">{otherParticipant?.name || 'Usuário'}</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
              <span>{isConnected ? 'Online' : 'Offline'}</span>
              {otherParticipant && (
                <span className="ml-2">
                  ⭐ {otherParticipant.reputationScore}/100
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="text-white hover:bg-blue-700 rounded-full p-2 transition-colors"
              title="Minimizar"
            >
              −
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-700 rounded-full p-2 transition-colors"
              title="Fechar"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
            Nenhuma mensagem ainda. Inicie a conversa!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = String(msg.sender?.id) === String(currentUserId);
            return (
              <ChatMessage
                key={msg.id}
                message={msg}
                isOwnMessage={isOwn}
              />
            );
          })
        )}
        {isTyping && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{otherParticipant?.name} está digitando...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input ou Banner de Chat Encerrado */}
      {readOnly ? (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-100 dark:bg-gray-800 rounded-b-lg">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm">Chat encerrado. Voce pode visualizar o historico de mensagens.</span>
          </div>
        </div>
      ) : (
        <div className="border-t dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
          {/* File Preview */}
          {filePreview && selectedFile && (
            <div className="mb-3 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-300 dark:border-gray-600">
              <div className="flex items-start gap-3">
                {selectedFile.type.startsWith('image/') ? (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded"
                  />
                ) : (
                  <div className="w-20 h-20 bg-red-100 dark:bg-red-900 rounded flex items-center justify-center">
                    <span className="text-2xl">📄</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,.pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected || !!selectedFile}
              className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Anexar arquivo"
            >
              📎
            </button>
            <input
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Digite uma mensagem..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              disabled={!isConnected}
            />
            <button
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && !selectedFile) || !isConnected}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Enviar
            </button>
          </div>
          {!isConnected && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-2">
              Desconectado. Tentando reconectar...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
