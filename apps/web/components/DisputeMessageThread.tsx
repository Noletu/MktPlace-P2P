'use client';

import { useState } from 'react';
import { DisputeMessage } from '@/types/dispute';

interface DisputeMessageThreadProps {
  messages: DisputeMessage[];
  currentUserId: string;
  onSendMessage?: (message: string, attachments?: File[], visibleTo?: string) => Promise<void>;
  canSendMessages?: boolean;
  visibleTo?: string;
}

export default function DisputeMessageThread({
  messages,
  currentUserId,
  onSendMessage,
  canSendMessages = true,
  visibleTo,
}: DisputeMessageThreadProps) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!newMessage.trim() || !onSendMessage) return;

    setSending(true);
    try {
      await onSendMessage(newMessage, undefined, visibleTo);
      setNewMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Thread de mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Nenhuma mensagem ainda
          </div>
        ) : (
          messages.map((msg) => {
            const isCurrentUser = msg.authorId === currentUserId;
            const isAdmin = msg.isAdminMessage;

            return (
              <div
                key={msg.id}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    isAdmin
                      ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-300 dark:border-blue-700'
                      : isCurrentUser
                      ? 'bg-green-100 dark:bg-green-900'
                      : visibleTo
                      ? 'bg-green-100 dark:bg-green-900'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  {/* Nome do autor */}
                  <div className="flex items-center gap-2 mb-1">
                    {isAdmin && <span className="text-blue-600 dark:text-blue-400 font-semibold">🛡️ Plataforma</span>}
                    {!isAdmin && (
                      <span className={`text-sm font-semibold ${isCurrentUser || visibleTo ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {isCurrentUser ? 'Você' : msg.author.name}
                      </span>
                    )}
                  </div>

                  {/* Mensagem */}
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {msg.message}
                  </p>

                  {/* Anexos */}
                  {msg.attachments && JSON.parse(msg.attachments).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {JSON.parse(msg.attachments).map((url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          📎 Anexo {i + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Data/hora */}
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input de nova mensagem */}
      {canSendMessages && onSendMessage && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 flex-shrink-0">
          <div className="flex gap-2 pb-4">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white resize-none"
              rows={3}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed h-fit"
            >
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
