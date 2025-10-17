import { ChatMessage as ChatMessageType } from '@/hooks/useChat';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwnMessage: boolean;
}

export default function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  const isSystemMessage = message.type === 'SYSTEM';

  // Determinar qual mensagem exibir (descriptografada ou original)
  const displayMessage = message.decryptedMessage || message.message || '';
  const isEncrypted = message.isEncrypted || false;

  if (isSystemMessage) {
    return (
      <div className="flex justify-center py-2">
        <div className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-3 py-1 rounded-full max-w-md text-center">
          {displayMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3 gap-2`}>
      {/* Avatar para mensagens recebidas (ESQUERDA) */}
      {!isOwnMessage && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
          {message.sender.name?.[0]?.toUpperCase() || '?'}
        </div>
      )}

      <div className="max-w-[70%]">
        {/* Nome do remetente */}
        <p className={`text-xs font-semibold mb-1 ${isOwnMessage ? 'text-right mr-2' : 'ml-2'} ${
          isOwnMessage ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
        }`}>
          {isOwnMessage ? 'Você' : message.sender.name}
        </p>

        <div
          className={`rounded-lg px-4 py-2 ${
            isOwnMessage
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
          }`}
        >
          {/* Renderizar anexo se houver */}
          {message.attachmentUrl && (
            <div className="mb-2">
              {message.attachmentType?.startsWith('image/') ? (
                <img
                  src={message.attachmentUrl}
                  alt="Anexo"
                  className="max-w-full rounded cursor-pointer hover:opacity-90"
                  onClick={() => window.open(message.attachmentUrl, '_blank')}
                />
              ) : message.attachmentType === 'application/pdf' ? (
                <a
                  href={message.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-3 py-2 rounded ${
                    isOwnMessage ? 'bg-blue-700' : 'bg-gray-200'
                  } hover:opacity-90`}
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-sm">Ver PDF</span>
                </a>
              ) : null}
            </div>
          )}

          {/* Renderizar mensagem de texto */}
          {displayMessage && displayMessage !== '📎 Anexo' && (
            <div>
              <p className="text-sm whitespace-pre-wrap break-words">
                {displayMessage}
              </p>
              {/* Indicador de criptografia */}
              {isEncrypted && (
                <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
                  <span>🔒</span>
                  <span>Criptografado</span>
                </p>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-2">
          {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
