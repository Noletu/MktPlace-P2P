'use client';

import { useState, useRef } from 'react';
import { DisputeMessage } from '@/types/dispute';

interface DisputeMessageThreadProps {
  messages: DisputeMessage[];
  currentUserId: string;
  onSendMessage?: (message: string, attachments?: File[], visibleTo?: string) => Promise<void>;
  canSendMessages?: boolean;
  visibleTo?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function parseAttachments(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function isImageData(url: string): boolean {
  return url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

function isPdfData(url: string): boolean {
  return url.startsWith('data:application/pdf') || /\.pdf$/i.test(url);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function downloadBase64File(dataUrl: string, filename: string) {
  const blob = dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openBase64File(dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Tipo de arquivo não permitido. Use imagens (JPG, PNG, GIF, WebP) ou PDF.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('Arquivo muito grande. O tamanho máximo é 10MB.');
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !selectedFile) || !onSendMessage) return;

    setSending(true);
    try {
      const files = selectedFile ? [selectedFile] : undefined;
      await onSendMessage(newMessage, files, visibleTo);
      setNewMessage('');
      handleRemoveFile();
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
            const attachments = msg.attachments ? parseAttachments(msg.attachments) : [];

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
                    {isAdmin && <span className="text-blue-600 dark:text-blue-400 font-semibold">&#128737;&#65039; Plataforma</span>}
                    {!isAdmin && (
                      <span className={`text-sm font-semibold ${isCurrentUser || visibleTo ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {isCurrentUser ? 'Você' : msg.author.name}
                      </span>
                    )}
                  </div>

                  {/* Mensagem */}
                  {msg.message && (
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {msg.message}
                    </p>
                  )}

                  {/* Anexos */}
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {attachments.map((url: string, i: number) => {
                        if (isImageData(url)) {
                          return (
                            <div key={i}>
                              <img
                                src={url}
                                alt={`Anexo ${i + 1}`}
                                className="max-w-full max-h-48 rounded border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90"
                                onClick={() => openBase64File(url)}
                                title="Clique para abrir em tamanho real"
                              />
                              <button
                                onClick={() => downloadBase64File(url, `anexo-${i + 1}.${url.match(/data:image\/(\w+)/)?.[1] || 'png'}`)}
                                className="mt-1 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Baixar imagem
                              </button>
                            </div>
                          );
                        }
                        if (isPdfData(url)) {
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs bg-white dark:bg-gray-700 rounded p-2 border border-gray-200 dark:border-gray-600"
                            >
                              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H4zm7 1.5L16.5 9H12a1 1 0 01-1-1V3.5zM7 11h6a1 1 0 110 2H7a1 1 0 110-2zm0 3h4a1 1 0 110 2H7a1 1 0 110-2z"/></svg>
                              <span className="text-gray-700 dark:text-gray-300">Documento PDF - Anexo {i + 1}</span>
                              <button
                                onClick={() => openBase64File(url)}
                                className="ml-auto text-blue-600 dark:text-blue-400 hover:underline font-medium"
                              >
                                Abrir
                              </button>
                              <button
                                onClick={() => downloadBase64File(url, `documento-${i + 1}.pdf`)}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                              >
                                Baixar
                              </button>
                            </div>
                          );
                        }
                        return (
                          <button
                            key={i}
                            onClick={() => downloadBase64File(url, `anexo-${i + 1}`)}
                            className="block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Anexo {i + 1} - Baixar
                          </button>
                        );
                      })}
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
          {/* Preview do arquivo selecionado */}
          {selectedFile && (
            <div className="mb-3 flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded border border-gray-300 dark:border-gray-500" />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center bg-red-100 dark:bg-red-900 rounded border border-gray-300 dark:border-gray-500">
                  <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H4zm7 1.5L16.5 9H12a1 1 0 01-1-1V3.5zM7 11h6a1 1 0 110 2H7a1 1 0 110-2zm0 3h4a1 1 0 110 2H7a1 1 0 110-2z"/></svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(selectedFile.size)}</p>
              </div>
              <button
                onClick={handleRemoveFile}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1"
                title="Remover arquivo"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          <div className="flex gap-2 pb-4">
            {/* Botao anexar */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 h-fit"
              title="Anexar arquivo (imagem ou PDF, max 10MB)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </button>

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
              disabled={(!newMessage.trim() && !selectedFile) || sending}
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
