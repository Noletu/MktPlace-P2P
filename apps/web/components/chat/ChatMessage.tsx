import { ChatMessage as ChatMessageType } from '@/hooks/useChat';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwnMessage: boolean;
}

export default function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  const isSystemMessage = message.type === 'SYSTEM';

  if (isSystemMessage) {
    return (
      <div className="flex justify-center py-2">
        <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full max-w-md text-center">
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className="max-w-[70%]">
        {!isOwnMessage && (
          <p className="text-xs text-gray-500 mb-1 ml-2">
            {message.sender.name}
          </p>
        )}
        <div
          className={`rounded-lg px-4 py-2 ${
            isOwnMessage
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-900'
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
          {message.message && message.message !== '📎 Anexo' && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.message}
            </p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1 ml-2">
          {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
