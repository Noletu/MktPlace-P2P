'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface WorkerStatus {
  worker: string;
  state: 'running' | 'stopped';
  interval?: string;
  description?: string;
}

export default function WorkersControlPage() {
  const router = useRouter();
  const [balanceSyncStatus, setBalanceSyncStatus] = useState<WorkerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchWorkerStatus();
    // Auto-refresh a cada 5 segundos
    const interval = setInterval(fetchWorkerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchWorkerStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/workers/balance-sync/status', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        setBalanceSyncStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching worker status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorker = async () => {
    if (!confirm('Deseja iniciar o BalanceSyncWorker?\n\n⚠️ Ele irá sincronizar saldos com a blockchain, removendo saldos de teste.')) {
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/workers/balance-sync/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data.success) {
        alert('✅ Worker iniciado com sucesso!');
        fetchWorkerStatus();
      } else {
        alert('❌ Erro: ' + data.error);
      }
    } catch (error) {
      alert('❌ Erro ao iniciar worker: ' + (error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopWorker = async () => {
    if (!confirm('Deseja parar o BalanceSyncWorker?')) {
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/workers/balance-sync/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data.success) {
        alert('✅ Worker parado com sucesso!');
        fetchWorkerStatus();
      } else {
        alert('❌ Erro: ' + data.error);
      }
    } catch (error) {
      alert('❌ Erro ao parar worker: ' + (error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleWorker = async () => {
    const action = balanceSyncStatus?.state === 'running' ? 'parar' : 'iniciar';

    if (!confirm(`Deseja ${action} o BalanceSyncWorker?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/workers/balance-sync/toggle', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data.success) {
        alert(`✅ Worker ${data.data.currentState === 'running' ? 'iniciado' : 'parado'} com sucesso!`);
        fetchWorkerStatus();
      } else {
        alert('❌ Erro: ' + data.error);
      }
    } catch (error) {
      alert('❌ Erro ao alternar worker: ' + (error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">🤖 Controle de Workers</h1>
          <div className="animate-pulse">
            <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = balanceSyncStatus?.state === 'running';

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">🤖 Controle de Workers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie workers de background do sistema. Controle quando cada worker deve rodar.
          </p>
        </div>

        {/* Info Alert */}
        <div className="mb-6 p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            💡 <strong>Dica:</strong> Durante testes com saldos simulados, mantenha o BalanceSyncWorker <strong>parado</strong> para evitar reconciliações automáticas.
          </p>
        </div>

        {/* Worker Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-gray-900 dark:text-white">
                📊 BalanceSyncWorker
                {isRunning ? (
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-400 rounded-full text-xs font-medium">
                    🟢 Rodando
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 border border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-400 rounded-full text-xs font-medium">
                    🔴 Parado
                  </span>
                )}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {balanceSyncStatus?.description || 'Sincroniza saldos on-chain com banco de dados'}
              </p>
              {balanceSyncStatus?.interval && (
                <p className="text-gray-500 dark:text-gray-500 text-xs">
                  ⏱️ Intervalo: {balanceSyncStatus.interval}
                </p>
              )}
            </div>

            {/* Auto-refresh indicator */}
            <div className="text-xs text-gray-500 dark:text-gray-500">
              🔄 Auto-refresh: 5s
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 dark:border-gray-700 my-6"></div>

          {/* Controls */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
              Controles
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Start Button */}
              <button
                onClick={handleStartWorker}
                disabled={actionLoading || isRunning}
                className={`p-4 rounded-lg border-2 transition text-center text-gray-900 dark:text-white ${
                  isRunning
                    ? 'border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-800/50 cursor-not-allowed opacity-50'
                    : 'border-green-600 dark:border-green-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                }`}
              >
                <span className="text-3xl block mb-2">▶️</span>
                <span className="text-sm font-medium">
                  {actionLoading ? 'Processando...' : 'Iniciar Worker'}
                </span>
              </button>

              {/* Stop Button */}
              <button
                onClick={handleStopWorker}
                disabled={actionLoading || !isRunning}
                className={`p-4 rounded-lg border-2 transition text-center text-gray-900 dark:text-white ${
                  !isRunning
                    ? 'border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-800/50 cursor-not-allowed opacity-50'
                    : 'border-red-600 dark:border-red-700 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
              >
                <span className="text-3xl block mb-2">⏹️</span>
                <span className="text-sm font-medium">
                  {actionLoading ? 'Processando...' : 'Parar Worker'}
                </span>
              </button>

              {/* Toggle Button */}
              <button
                onClick={handleToggleWorker}
                disabled={actionLoading}
                className="p-4 rounded-lg border-2 border-blue-600 dark:border-blue-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-center text-gray-900 dark:text-white"
              >
                <span className="text-3xl block mb-2">🔄</span>
                <span className="text-sm font-medium">
                  {actionLoading ? 'Processando...' : 'Alternar Estado'}
                </span>
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900/50 rounded border border-gray-300 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              ℹ️ O que este worker faz?
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Consulta saldos on-chain (blockchain real)</li>
              <li>• Compara com saldos salvos no banco de dados</li>
              <li>• Corrige discrepâncias automaticamente</li>
              <li>• <strong className="text-yellow-600 dark:text-yellow-400">⚠️ Remove saldos de teste</strong> (não existem na blockchain)</li>
            </ul>
          </div>
        </div>

        {/* Warning Box */}
        <div className="mt-6 p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
            ⚠️ Importante para Testes
          </h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-200">
            Mantenha este worker <strong>PARADO</strong> quando estiver testando com saldos simulados.
            Caso contrário, ele irá detectar que o saldo não existe on-chain e removerá do banco de dados.
          </p>
        </div>
      </div>
    </div>
  );
}
