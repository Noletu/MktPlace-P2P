'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, fetchWithAuth } from '@/utils/api';

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type DeliveryChannel = 'NOTIFICATION' | 'EMAIL' | 'BOTH';
type TargetMode = 'ALL' | 'SELECTED';
type Tab = 'send' | 'history';

interface UserResult {
  id: string;
  email: string;
  name: string | null;
}

interface BroadcastLog {
  id: string;
  adminId: string;
  adminEmail: string;
  title: string;
  message: string;
  priority: string;
  deliveryChannel: string;
  targetMode: string;
  actionUrl: string | null;
  actionLabel: string | null;
  recipientCount: number;
  recipientIds: string | null;
  createdAt: string;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Baixa', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700' },
  { value: 'NORMAL', label: 'Normal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700' },
  { value: 'HIGH', label: 'Alta', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700' },
  { value: 'URGENT', label: 'Urgente', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700' },
];

const CHANNEL_OPTIONS: { value: DeliveryChannel; label: string; icon: string }[] = [
  { value: 'NOTIFICATION', label: 'Apenas Notificacao', icon: '🔔' },
  { value: 'EMAIL', label: 'Apenas Email', icon: '📧' },
  { value: 'BOTH', label: 'Notificacao + Email', icon: '🔔📧' },
];

export default function ComunicacoesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('send');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Comunicacoes</h1>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'send'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Enviar Comunicacao
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'history'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Historico
        </button>
      </div>

      {activeTab === 'send' ? <SendBroadcastForm /> : <BroadcastHistory />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SEND BROADCAST FORM
// ════════════════════════════════════════════════════════════════

function SendBroadcastForm() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [channel, setChannel] = useState<DeliveryChannel>('NOTIFICATION');
  const [targetMode, setTargetMode] = useState<TargetMode>('ALL');
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);

  // Fetch total user count for "ALL" mode
  useEffect(() => {
    apiGet('/admin/users?limit=1&offset=0')
      .then((data) => {
        if (data.data?.pagination?.total) {
          setTotalUsers(data.data.pagination.total);
        } else if (data.data?.total) {
          setTotalUsers(data.data.total);
        }
      })
      .catch(() => {});
  }, []);

  const recipientCount = targetMode === 'ALL' ? (totalUsers ?? '...') : selectedUsers.length;

  const handleSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setResult(null);

    try {
      const payload: any = {
        title,
        message,
        priority,
        deliveryChannel: channel,
        targetMode,
      };

      if (targetMode === 'SELECTED') {
        payload.userIds = selectedUsers.map((u) => u.id);
      }

      if (actionUrl) {
        payload.actionUrl = actionUrl;
        payload.actionLabel = actionLabel || undefined;
      }

      const res = await apiPost('/notifications/admin-broadcast', payload);
      setResult({ success: true, message: res.message || `Enviado para ${res.data?.recipientCount} destinatarios` });

      // Reset form
      setTitle('');
      setMessage('');
      setPriority('NORMAL');
      setChannel('NOTIFICATION');
      setTargetMode('ALL');
      setSelectedUsers([]);
      setActionUrl('');
      setActionLabel('');
      setShowAdvanced(false);
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Erro ao enviar' });
    } finally {
      setSending(false);
    }
  };

  const canSend = title.trim() && message.trim() && (targetMode === 'ALL' || selectedUsers.length > 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
      {/* Result banner */}
      {result && (
        <div
          className={`p-4 rounded-lg border ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}
        >
          {result.success ? '✅' : '❌'} {result.message}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titulo</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Ex: Manutencao programada..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Mensagem <span className="text-gray-400 font-normal">({message.length}/2000)</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          rows={5}
          placeholder="Escreva a mensagem que sera enviada aos usuarios..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
        />
      </div>

      {/* Priority pills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prioridade</label>
        <div className="flex gap-2 flex-wrap">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriority(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                priority === opt.value
                  ? opt.color + ' ring-2 ring-offset-1 ring-blue-400'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Channel */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Canal de Entrega</label>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {CHANNEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setChannel(opt.value)}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${
                channel === opt.value
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Target Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Destinatarios</label>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTargetMode('ALL')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              targetMode === 'ALL'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Todos os Usuarios {totalUsers !== null && `(${totalUsers})`}
          </button>
          <button
            onClick={() => setTargetMode('SELECTED')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              targetMode === 'SELECTED'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Usuarios Especificos
          </button>
        </div>
      </div>

      {/* User Search (when SELECTED) */}
      {targetMode === 'SELECTED' && (
        <UserSelector selectedUsers={selectedUsers} onChangeUsers={setSelectedUsers} />
      )}

      {/* Email warning */}
      {channel !== 'NOTIFICATION' && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Emails serao enviados para <strong>{recipientCount}</strong> destinatario(s). O envio pode levar alguns minutos.
          </p>
        </div>
      )}

      {/* Advanced Options */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <span className={`transition-transform inline-block ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
          Opcoes avancadas
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">URL de acao (botao CTA)</label>
              <input
                type="url"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Label do botao</label>
              <input
                type="text"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                maxLength={50}
                placeholder="Ex: Ver detalhes"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Send Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canSend || sending}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition flex items-center gap-2"
        >
          {sending ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Enviando...
            </>
          ) : (
            'Enviar Comunicacao'
          )}
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <ConfirmDialog
          title={title}
          channel={channel}
          targetMode={targetMode}
          recipientCount={recipientCount}
          priority={priority}
          onConfirm={handleSend}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// USER SELECTOR
// ════════════════════════════════════════════════════════════════

function UserSelector({
  selectedUsers,
  onChangeUsers,
}: {
  selectedUsers: UserResult[];
  onChangeUsers: (users: UserResult[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiGet(`/admin/users?search=${encodeURIComponent(search)}&limit=10`);
        const users: UserResult[] = (data.data?.users || data.data || []).map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name,
        }));
        // Filter out already selected
        const selectedIds = new Set(selectedUsers.map((u) => u.id));
        setResults(users.filter((u) => !selectedIds.has(u.id)));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, selectedUsers]);

  const addUser = (user: UserResult) => {
    onChangeUsers([...selectedUsers, user]);
    setSearch('');
    setResults([]);
  };

  const removeUser = (userId: string) => {
    onChangeUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-200 dark:border-blue-700"
            >
              {user.name || user.email}
              <button
                onClick={() => removeUser(user.id)}
                className="ml-1 text-blue-400 hover:text-red-500 font-bold"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por email ou nome..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Results dropdown */}
        {results.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => addUser(user)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <span className="text-gray-900 dark:text-white">{user.name || '(sem nome)'}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-2">{user.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {selectedUsers.length} usuario(s) selecionado(s)
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CONFIRM DIALOG
// ════════════════════════════════════════════════════════════════

function ConfirmDialog({
  title,
  channel,
  targetMode,
  recipientCount,
  priority,
  onConfirm,
  onCancel,
}: {
  title: string;
  channel: DeliveryChannel;
  targetMode: TargetMode;
  recipientCount: number | string;
  priority: Priority;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const channelLabel = CHANNEL_OPTIONS.find((c) => c.value === channel);
  const priorityLabel = PRIORITY_OPTIONS.find((p) => p.value === priority);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirmar envio</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Titulo:</span>
            <span className="text-gray-900 dark:text-white font-medium text-right max-w-[60%] truncate">{title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Canal:</span>
            <span className="text-gray-900 dark:text-white">{channelLabel?.icon} {channelLabel?.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Destinatarios:</span>
            <span className="text-gray-900 dark:text-white">
              {targetMode === 'ALL' ? `Todos (${recipientCount})` : `${recipientCount} selecionado(s)`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Prioridade:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityLabel?.color}`}>
              {priorityLabel?.label}
            </span>
          </div>
        </div>

        {channel !== 'NOTIFICATION' && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
            ⚠️ Emails serao enviados. Esta acao nao pode ser desfeita.
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Confirmar Envio
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// BROADCAST HISTORY
// ════════════════════════════════════════════════════════════════

function BroadcastHistory() {
  const [logs, setLogs] = useState<BroadcastLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await apiGet(`/notifications/broadcast-history?page=${p}&limit=15`);
      setLogs(data.data?.logs || []);
      setTotalPages(data.data?.pagination?.totalPages || 1);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(page);
  }, [page, fetchHistory]);

  const channelBadge = (ch: string) => {
    switch (ch) {
      case 'NOTIFICATION':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">🔔 Notificacao</span>;
      case 'EMAIL':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">📧 Email</span>;
      case 'BOTH':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">🔔📧 Ambos</span>;
      default:
        return ch;
    }
  };

  const priorityBadge = (p: string) => {
    const opt = PRIORITY_OPTIONS.find((o) => o.value === p);
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${opt?.color || ''}`}>
        {opt?.label || p}
      </span>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <span className="animate-spin inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">Nenhuma comunicacao enviada ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Data</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Titulo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Destinatarios</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Canal</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Prioridade</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Admin</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <>
                <tr
                  key={log.id}
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition"
                >
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium max-w-[200px] truncate">
                    {log.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {log.targetMode === 'ALL' ? `Todos (${log.recipientCount})` : `${log.recipientCount} selecionado(s)`}
                  </td>
                  <td className="px-4 py-3">{channelBadge(log.deliveryChannel)}</td>
                  <td className="px-4 py-3">{priorityBadge(log.priority)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{log.adminEmail}</td>
                </tr>
                {expandedId === log.id && (
                  <tr key={`${log.id}-expanded`} className="bg-gray-50 dark:bg-gray-700/20">
                    <td colSpan={6} className="px-6 py-4">
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line text-sm">{log.message}</p>
                      {log.actionUrl && (
                        <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                          Link: {log.actionUrl} {log.actionLabel && `(${log.actionLabel})`}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Proximo
          </button>
        </div>
      )}
    </div>
  );
}
