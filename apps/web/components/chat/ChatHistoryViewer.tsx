'use client';

import { useState, useEffect } from 'react';
import ChatMessage from './ChatMessage';

interface ArchiveInfo {
  isArchived: boolean;
  archives: Array<{
    id: string;
    reason: string;
    archivedAt: string;
    expiresAt: string;
    messageCount: number;
  }>;
}

interface ChatHistoryViewerProps {
  chatId: string;
}

export default function ChatHistoryViewer({ chatId }: ChatHistoryViewerProps) {
  const [archiveStatus, setArchiveStatus] = useState<ArchiveInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArchiveStatus = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api/v1"}/chat/${chatId}/archive-status`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setArchiveStatus(data.data);
        }
      } catch (error) {
        console.error('Erro ao buscar status de arquivo:', error);
      } finally {
        setLoading(false);
      }
    };

    if (chatId) {
      fetchArchiveStatus();
    }
  }, [chatId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-gray-500 dark:text-gray-400">Carregando histórico...</div>
      </div>
    );
  }

  if (!archiveStatus?.isArchived) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Nenhum arquivo de chat encontrado.</p>
        <p className="text-sm mt-2">O histórico é preservado por 1 ano após o pedido ser concluído.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Archive Info Banner */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📦</span>
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">
              Chat Arquivado - Histórico Preservado
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
              Este chat foi arquivado e será mantido por <strong>1 ano</strong> para fins de rastreabilidade e auditoria.
            </p>
            {archiveStatus.archives.length > 0 && (
              <div className="mt-3 space-y-2">
                {archiveStatus.archives.map((archive) => (
                  <div key={archive.id} className="text-xs text-yellow-700 dark:text-yellow-400">
                    <span className="font-medium">Motivo:</span> {archive.reason}
                    {' • '}
                    <span className="font-medium">Mensagens:</span> {archive.messageCount}
                    {' • '}
                    <span className="font-medium">Expira em:</span> {new Date(archive.expiresAt).toLocaleDateString('pt-BR')}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info sobre acesso */}
      <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
        <p>💡 Para visualizar as mensagens arquivadas, use a aba "Chat" acima.</p>
        <p className="mt-1">O histórico completo (ativo + arquivado) está disponível lá.</p>
      </div>
    </div>
  );
}
