'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface ApprovalUser {
  id: string;
  name: string | null;
  email: string;
}

interface PendingApproval {
  id: string;
  operationType: string;
  operationPayload: string;
  initiatorId: string;
  initiator: ApprovalUser;
  approverId: string | null;
  approver: ApprovalUser | null;
  approverNote: string | null;
  status: string;
  expiresAt: string;
  initiatorNote: string | null;
  overrideRequestedAt: string | null;
  overrideExecuteAfter: string | null;
  overrideJustification: string | null;
  overrideCancelledBy: string | null;
  overrideCancelledAt: string | null;
  executedAt: string | null;
  executionError: string | null;
  createdAt: string;
  delegation: { id: string; grantee: { name: string | null } } | null;
}

type TabType = 'pending' | 'mine' | 'history';

const OPERATION_LABELS: Record<string, string> = {
  INTERNAL_TRANSFER: 'Transferência Interna',
  ADJUST_BALANCE:    'Ajuste de Saldo',
  PLATFORM_REFUND:   'Reembolso de Plataforma',
  LOCK_BALANCE:      'Bloqueio de Saldo',
  UNLOCK_BALANCE:    'Desbloqueio de Saldo',
  DEMOTE_MASTER:     'Rebaixamento de MASTER',
};

const OPERATION_COLORS: Record<string, string> = {
  INTERNAL_TRANSFER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  ADJUST_BALANCE:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  PLATFORM_REFUND:   'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  LOCK_BALANCE:      'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  UNLOCK_BALANCE:    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  DEMOTE_MASTER:     'bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_APPROVAL:    { label: 'Aguardando Aprovação', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  APPROVED:            { label: 'Aprovado e Executado', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  REJECTED:            { label: 'Rejeitado', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  CANCELLED:           { label: 'Cancelado pelo Iniciador', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  EXPIRED:             { label: 'Expirado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  OVERRIDE_PENDING:    { label: 'Override em andamento', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  OVERRIDE_EXECUTED:   { label: 'Executado via Override', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  OVERRIDE_CANCELLED:  { label: 'Override Cancelado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  EXECUTION_FAILED:    { label: 'Falha na Execução', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

function summarizePayload(operationType: string, payloadStr: string): string {
  try {
    const p = JSON.parse(payloadStr);
    switch (operationType) {
      case 'INTERNAL_TRANSFER':
        return `De carteira ${p.fromWalletId?.slice(0, 8)}... → ${p.toWalletId?.slice(0, 8)}... | Valor: ${p.amount} | Motivo: ${p.reason}`;
      case 'ADJUST_BALANCE':
        return `Carteira ${p.walletId?.slice(0, 8)}... | Ajuste: ${p.adjustment} | Motivo: ${p.reason}`;
      case 'PLATFORM_REFUND':
        return `Carteira ${p.toWalletId?.slice(0, 8)}... | Valor: ${p.amount} ${p.cryptoType} (${p.network}) | Direção: ${p.direction ?? 'TO_USER'} | Motivo: ${p.reason}`;
      case 'LOCK_BALANCE':
        return `Carteira ${p.walletId?.slice(0, 8)}... | Valor: ${p.amount} | Categoria: ${p.category} | Motivo: ${p.reason}`;
      case 'UNLOCK_BALANCE':
        return `Carteira ${p.walletId?.slice(0, 8)}... | Valor: ${p.amount} | Categoria: ${p.category} | Motivo: ${p.reason}`;
      case 'DEMOTE_MASTER':
        return `Usuário: ${p.targetUserName} (${p.targetUserEmail}) → ${p.newRole} | Motivo: ${p.reason}`;
      default:
        return JSON.stringify(p);
    }
  } catch {
    return payloadStr;
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function getMinutesUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 60000));
}

export default function AprovacoesPage() {
  const [tab, setTab] = useState<TabType>('pending');
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');

  // Modal states
  const [modalType, setModalType] = useState<'approve' | 'reject' | 'override' | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [justification, setJustification] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/admin/funds/pending-approvals?tab=${tab}`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.data?.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchWithAuth('/auth/me').then(r => r.json()).then(d => {
      setCurrentUserId(d.data?.id ?? '');
    });
  }, []);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const openModal = (type: 'approve' | 'reject' | 'override', id: string) => {
    setModalType(type);
    setSelectedId(id);
    setNote('');
    setTwoFactorCode('');
    setJustification('');
    setError('');
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedId('');
    setError('');
  };

  const handleAction = async () => {
    setActionLoading(true);
    setError('');
    try {
      let endpoint = '';
      let body: Record<string, string> = {};

      if (modalType === 'approve') {
        endpoint = `/admin/funds/pending-approvals/${selectedId}/approve`;
        body = { approverNote: note, twoFactorCode };
      } else if (modalType === 'reject') {
        endpoint = `/admin/funds/pending-approvals/${selectedId}/reject`;
        body = { approverNote: note };
      } else if (modalType === 'override') {
        endpoint = `/admin/funds/pending-approvals/${selectedId}/emergency-override`;
        body = { justification, twoFactorCode };
      }

      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        closeModal();
        fetchApprovals();
      } else {
        setError(data.error ?? 'Erro ao executar ação.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Erro de conexão.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelApproval = async (id: string) => {
    if (!confirm('Cancelar esta solicitação? A operação será descartada e não poderá ser desfeita.')) return;
    const res = await fetchWithAuth(`/admin/approvals/${id}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      fetchApprovals();
    } else {
      alert(data.error ?? 'Erro ao cancelar solicitação.');
    }
  };

  const handleCancelOverride = async (id: string) => {
    if (!confirm('Confirma o cancelamento do override de emergência?')) return;
    const res = await fetchWithAuth(`/admin/funds/pending-approvals/${id}/cancel-override`, {
      method: 'POST',
    });
    const data = await res.json();
    if (data.success) {
      fetchApprovals();
    } else {
      alert(data.error ?? 'Erro ao cancelar override.');
    }
  };

  const tabCount = (t: TabType) => {
    if (t === 'pending') return approvals.filter(a =>
      ['PENDING_APPROVAL', 'OVERRIDE_PENDING'].includes(a.status) && a.initiatorId !== currentUserId
    ).length;
    return undefined;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Aprovações Duais</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Operações financeiras críticas que exigem confirmação de dois sócios MASTER.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-1">
        {([
          { key: 'pending', label: 'Aguardando Minha Aprovação' },
          { key: 'mine',    label: 'Minhas Solicitações' },
          { key: 'history', label: 'Histórico' },
        ] as { key: TabType; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              tab === t.key
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800'
            }`}
          >
            {t.label}
            {t.key === 'pending' && tabCount('pending') !== undefined && (tabCount('pending') ?? 0) > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {tabCount('pending')}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Carregando aprovações...</div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-4xl mb-3">🔐</p>
          <p className="font-medium">Nenhuma aprovação encontrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(approval => {
            const isInitiator = approval.initiatorId === currentUserId;
            const canApproveOrReject = !isInitiator && approval.status === 'PENDING_APPROVAL';
            const canRequestOverride = isInitiator && approval.status === 'PENDING_APPROVAL';
            const isOverridePending = approval.status === 'OVERRIDE_PENDING';
            const minutesLeft = isOverridePending && approval.overrideExecuteAfter
              ? getMinutesUntil(approval.overrideExecuteAfter)
              : null;
            const statusCfg = STATUS_LABELS[approval.status] ?? { label: approval.status, color: '' };
            const opColor = OPERATION_COLORS[approval.operationType] ?? 'bg-gray-100 text-gray-800';

            return (
              <div
                key={approval.id}
                className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-5 ${
                  isOverridePending ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex flex-wrap gap-2 items-start justify-between mb-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${opColor}`}>
                      {OPERATION_LABELS[approval.operationType] ?? approval.operationType}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    {isInitiator && (
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        Iniciado por mim
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateTime(approval.createdAt)}
                  </span>
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                  <span className="font-medium">Iniciador:</span> {approval.initiator?.name ?? approval.initiator?.email}
                </p>

                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 mb-3 text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                  {summarizePayload(approval.operationType, approval.operationPayload)}
                </div>

                {approval.initiatorNote && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span className="font-medium">Nota do iniciador:</span> {approval.initiatorNote}
                  </p>
                )}

                {approval.status === 'PENDING_APPROVAL' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Expira em: {formatDateTime(approval.expiresAt)}
                  </p>
                )}

                {isOverridePending && approval.overrideJustification && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-3">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
                      Override de Emergência em andamento
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Justificativa: {approval.overrideJustification}
                    </p>
                    {minutesLeft !== null && (
                      <p className="text-sm font-bold text-red-700 dark:text-red-300 mt-1">
                        Executa automaticamente em {minutesLeft} minuto(s)
                      </p>
                    )}
                  </div>
                )}

                {approval.approver && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span className="font-medium">
                      {approval.status === 'APPROVED' ? 'Aprovado por' : 'Rejeitado por'}:
                    </span>{' '}
                    {approval.approver.name ?? approval.approver.email}
                    {approval.delegation && ` (via delegação de ${approval.delegation.grantee?.name})`}
                  </p>
                )}

                {approval.approverNote && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span className="font-medium">Nota:</span> {approval.approverNote}
                  </p>
                )}

                {approval.executionError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                    <span className="font-medium">Erro na execução:</span> {approval.executionError}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {canApproveOrReject && (
                    <>
                      <button
                        onClick={() => openModal('approve', approval.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => openModal('reject', approval.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                  {canRequestOverride && (
                    <>
                      <button
                        onClick={() => handleCancelApproval(approval.id)}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
                      >
                        Cancelar Solicitação
                      </button>
                      <button
                        onClick={() => openModal('override', approval.id)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition"
                      >
                        Override de Emergência
                      </button>
                    </>
                  )}
                  {isOverridePending && (
                    <button
                      onClick={() => handleCancelOverride(approval.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      Cancelar Override
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalType && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              {modalType === 'approve' && 'Confirmar Aprovação'}
              {modalType === 'reject'  && 'Confirmar Rejeição'}
              {modalType === 'override' && 'Override de Emergência'}
            </h2>

            {modalType === 'override' && (
              <>
                <p className="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">
                  Ao solicitar o override, o outro sócio receberá um e-mail de alerta. A operação será executada automaticamente em 30 minutos se ele não cancelar.
                </p>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Justificativa (mínimo 50 caracteres) *
                </label>
                <textarea
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  rows={3}
                  placeholder="Explique por que não pode aguardar a aprovação normal..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white mb-1 resize-none"
                />
                <p className="text-xs text-gray-500 mb-3">{justification.length}/50 caracteres mínimos</p>
              </>
            )}

            {modalType === 'approve' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nota (opcional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Adicione uma observação..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            )}

            {modalType === 'reject' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motivo da rejeição *
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="Explique o motivo da rejeição..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none"
                />
              </div>
            )}

            {(modalType === 'approve' || modalType === 'override') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Código 2FA *
                </label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-center tracking-widest text-lg"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading || (modalType === 'approve' && twoFactorCode.length < 6) || (modalType === 'override' && (justification.length < 50 || twoFactorCode.length < 6))}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${
                  modalType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  modalType === 'reject'  ? 'bg-red-600 hover:bg-red-700' :
                  'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {actionLoading ? 'Processando...' : (
                  modalType === 'approve' ? 'Confirmar Aprovação' :
                  modalType === 'reject'  ? 'Confirmar Rejeição' :
                  'Solicitar Override'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
