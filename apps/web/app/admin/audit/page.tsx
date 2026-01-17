'use client';

import { useEffect, useState } from 'react';
import StatusBadge from '@/components/admin/shared/StatusBadge';

interface AuditLog {
  id: string;
  userId?: string;
  email?: string;
  role?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterSuccess, setFilterSuccess] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/admin/audit-logs?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setLogs(data.data.logs || []);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchAction = filterAction === 'ALL' || log.action === filterAction;
    const matchSuccess = filterSuccess === 'ALL' ||
                        (filterSuccess === 'true' ? log.success : !log.success);
    return matchAction && matchSuccess;
  });

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('Sessão expirada. Faça login novamente.');
        return;
      }

      // Construir URL com filtros atuais
      const params = new URLSearchParams();

      // Aplicar filtros selecionados
      if (filterAction && filterAction !== 'ALL') {
        params.append('action', filterAction);
      }

      if (filterSuccess && filterSuccess !== 'ALL') {
        params.append('success', filterSuccess);
      }

      // Fazer requisição
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/admin/audit-logs/export?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao exportar logs');
      }

      // Obter CSV como blob
      const blob = await response.blob();

      // Criar URL temporária para download
      const downloadUrl = window.URL.createObjectURL(blob);

      // Criar link temporário e clicar
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `audit-logs-${new Date().toISOString()}.csv`;
      document.body.appendChild(link);
      link.click();

      // Limpar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      console.log('✅ Audit logs exported successfully');
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      alert('Erro ao exportar logs. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-700 dark:text-gray-300">Carregando logs...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 border border-blue-500 text-gray-900 dark:text-white rounded-lg transition"
          >
            🔄 Atualizar
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <span className="animate-spin">⏳</span>
                Exportando...
              </>
            ) : (
              <>
                📥 Exportar CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total de Eventos</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{logs.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Sucessos</p>
          <p className="text-3xl font-bold text-green-400 mt-2">
            {logs.filter(l => l.success).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Falhas</p>
          <p className="text-3xl font-bold text-red-400 mt-2">
            {logs.filter(l => !l.success).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Ação</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-600 text-gray-900 dark:text-white rounded-lg"
            >
              <option value="ALL">Todas</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="CREATE_ORDER">Criar Pedido</option>
              <option value="APPROVE_KYC">Aprovar KYC</option>
              <option value="REJECT_KYC">Rejeitar KYC</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Status</label>
            <select
              value={filterSuccess}
              onChange={(e) => setFilterSuccess(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-600 text-gray-900 dark:text-white rounded-lg"
            >
              <option value="ALL">Todos</option>
              <option value="true">Sucesso</option>
              <option value="false">Falha</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Data/Hora</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Usuário</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Ação</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Recurso</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">IP</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-700/50 transition">
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">{log.email || 'Sistema'}</p>
                      {log.role && (
                        <StatusBadge
                          status={log.role}
                          variant={log.role === 'ADMIN' ? 'info' : 'default'}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-blue-400">{log.action}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">{log.resource}</p>
                      {log.resourceId && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{log.resourceId.substring(0, 8)}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">{log.ipAddress || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={log.success ? '✓ Sucesso' : '✗ Falha'}
                      variant={log.success ? 'success' : 'danger'}
                    />
                    {log.errorMessage && (
                      <p className="text-xs text-red-400 mt-1">{log.errorMessage}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Nenhum log encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
