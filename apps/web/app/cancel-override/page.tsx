'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function CancelOverrideContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setMessage('Token de cancelamento não encontrado na URL.');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    fetch(`${apiUrl}/admin/funds/cancel-override?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setMessage('Override de emergência cancelado com sucesso. A operação não será executada.');
        } else {
          setStatus('error');
          setMessage(data.error ?? 'Não foi possível cancelar o override.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Erro de conexão com o servidor. Tente novamente ou acesse o painel para cancelar.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Processando...</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Cancelando o override de emergência.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">Override Cancelado</h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">{message}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              A operação foi bloqueada e o iniciador foi notificado.
            </p>
          </>
        )}

        {(status === 'error' || status === 'invalid') && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
              {status === 'invalid' ? 'Link inválido' : 'Não foi possível cancelar'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">{message}</p>
            <Link
              href="/admin/aprovacoes"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition"
            >
              Ir para o Painel de Aprovações
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function CancelOverridePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⏳</div>
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    }>
      <CancelOverrideContent />
    </Suspense>
  );
}
