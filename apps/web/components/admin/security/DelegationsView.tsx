'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface DelegationUser {
  id: string;
  name: string | null;
  email: string;
  role?: { slug: string; level: number; name: string } | null;
}

interface Delegation {
  id: string;
  grantorId: string;
  grantor: DelegationUser;
  granteeId: string;
  grantee: DelegationUser;
  operationScope: string;
  reason: string;
  startsAt: string;
  expiresAt: string;
  isRevoked: boolean;
  revokedBy: DelegationUser | null;
  revokedAt: string | null;
  revokeReason: string | null;
  timesUsed: number;
  lastUsedAt: string | null;
  createdAt: string;
}

interface EligibleGrantee {
  id: string;
  name: string | null;
  email: string;
  role: { slug: string; level: number; name: string } | null;
}

const OPERATION_OPTIONS = [
  { value: 'INTERNAL_TRANSFER', label: 'Transferência Interna' },
  { value: 'ADJUST_BALANCE',    label: 'Ajuste de Saldo' },
  { value: 'PLATFORM_REFUND',   label: 'Reembolso de Plataforma' },
  { value: 'LOCK_BALANCE',      label: 'Bloqueio de Saldo' },
  { value: 'UNLOCK_BALANCE',    label: 'Desbloqueio de Saldo' },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function parseScopeLabel(scopeStr: string): string {
  try {
    const arr: string[] = JSON.parse(scopeStr);
    if (arr.length === 0) return 'Todas as operações';
    return arr
      .map(v => OPERATION_OPTIONS.find(o => o.value === v)?.label ?? v)
      .join(', ');
  } catch {
    return scopeStr;
  }
}

function isActive(d: Delegation): boolean {
  return !d.isRevoked && new Date(d.expiresAt) > new Date();
}

export default function DelegationsView() {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [eligibleGrantees, setEligibleGrantees] = useState<EligibleGrantee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [granteeId, setGranteeId] = useState('');
  const [operationScope, setOperationScope] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [expiryValue, setExpiryValue] = useState('7');
  const [expiryUnit, setExpiryUnit] = useState<'days' | 'hours'>('days');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Revoke state
  const [revokeId, setRevokeId] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeTwoFactor, setRevokeTwoFactor] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [delegRes, granteesRes] = await Promise.all([
        fetchWithAuth('/admin/delegations'),
        fetchWithAuth('/admin/delegations/eligible-grantees'),
      ]);
      if (delegRes.ok) {
        const d = await delegRes.json();
        setDelegations(d.data ?? []);
      }
      if (granteesRes.ok) {
        const g = await granteesRes.json();
        setEligibleGrantees(g.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!granteeId) { setFormError('Selecione o delegado.'); return; }
    if (!reason.trim()) { setFormError('Informe o motivo.'); return; }
    const val = parseInt(expiryValue);
    const expiryHours = expiryUnit === 'days' ? val * 24 : val;
    if (isNaN(val) || val < 1) { setFormError('Prazo inválido.'); return; }
    if (expiryHours < 1 || expiryHours > 720) { setFormError('Prazo deve ser entre 1 hora e 720 horas (30 dias).'); return; }

    setFormLoading(true);
    try {
      const res = await fetchWithAuth('/admin/delegations', {
        method: 'POST',
        body: JSON.stringify({ granteeId, operationScope, reason: reason.trim(), expiryHours, twoFactorCode }),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setGranteeId('');
        setOperationScope([]);
        setReason('');
        setExpiryValue('7');
        setExpiryUnit('days');
        setTwoFactorCode('');
        fetchData();
      } else {
        setFormError(data.error ?? 'Erro ao criar delegação.');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!revokeReason.trim()) { alert('Informe o motivo da revogação.'); return; }
    setRevokeLoading(true);
    try {
      const res = await fetchWithAuth(`/admin/delegations/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ revokeReason: revokeReason.trim(), twoFactorCode: revokeTwoFactor }),
      });
      const data = await res.json();
      if (data.success) {
        setRevokeId('');
        setRevokeReason('');
        setRevokeTwoFactor('');
        fetchData();
      } else {
        alert(data.error ?? 'Erro ao revogar delegação.');
      }
    } finally {
      setRevokeLoading(false);
    }
  };

  const toggleScope = (val: string) => {
    setOperationScope(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const activeDelegations = delegations.filter(isActive);
  const historyDelegations = delegations.filter(d => !isActive(d));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div />
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition"
        >
          + Nova Delegação
        </button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-4">Nova Delegação</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Delegado *
              </label>
              <select
                value={granteeId}
                onChange={e => setGranteeId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="">Selecione o usuário...</option>
                {eligibleGrantees.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email} — {u.email} ({u.role?.name ?? u.role?.slug ?? 'GERENTE/ADMIN'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Escopo de Operações
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Selecione quais operações o delegado pode aprovar. Deixe em branco para permitir todas.
              </p>
              <div className="space-y-1">
                {OPERATION_OPTIONS.map(op => (
                  <label key={op.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={operationScope.includes(op.value)}
                      onChange={() => toggleScope(op.value)}
                      className="rounded"
                    />
                    {op.label}
                  </label>
                ))}
              </div>
              {operationScope.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Nenhuma seleção = todas as 5 operações críticas
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Motivo *
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="Ex: Viagem de negócios por 2 semanas, indisponibilidade temporária..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prazo * — máximo 30 dias (720 horas)
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={1}
                  max={expiryUnit === 'days' ? 30 : 720}
                  value={expiryValue}
                  onChange={e => setExpiryValue(e.target.value)}
                  className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <select
                  value={expiryUnit}
                  onChange={e => {
                    const newUnit = e.target.value as 'days' | 'hours';
                    // Converte o valor atual ao trocar de unidade
                    const val = parseInt(expiryValue) || 1;
                    if (newUnit === 'hours' && expiryUnit === 'days') {
                      setExpiryValue(String(val * 24));
                    } else if (newUnit === 'days' && expiryUnit === 'hours') {
                      setExpiryValue(String(Math.max(1, Math.round(val / 24))));
                    }
                    setExpiryUnit(newUnit);
                  }}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="days">dias</option>
                  <option value="hours">horas</option>
                </select>
              </div>
              {expiryUnit === 'hours' && parseInt(expiryValue) > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ≈ {(parseInt(expiryValue) / 24).toFixed(1)} dias
                </p>
              )}
              {expiryUnit === 'days' && parseInt(expiryValue) > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  = {parseInt(expiryValue) * 24} horas
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Código 2FA *
                <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">(obrigatório em produção)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={twoFactorCode}
                onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-36 border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono tracking-widest text-center"
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={formLoading}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {formLoading ? 'Criando...' : 'Criar Delegação'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500">Carregando delegações...</div>
      ) : (
        <>
          {/* Delegações Ativas */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Delegações Ativas ({activeDelegations.length})
          </h2>

          {activeDelegations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl mb-6">
              <p className="text-3xl mb-2">🤝</p>
              <p className="text-sm">Nenhuma delegação ativa no momento</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {activeDelegations.map(d => (
                <div
                  key={d.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-amber-300 dark:border-amber-700 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap gap-3 items-start justify-between mb-3">
                    <div>
                      <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs font-semibold rounded-full mb-1">
                        ATIVA
                      </span>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {d.grantee?.name ?? d.grantee?.email}
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                          ({d.grantee?.email})
                        </span>
                      </p>
                    </div>
                    {revokeId !== d.id && (
                      <button
                        onClick={() => { setRevokeId(d.id); setRevokeReason(''); }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition"
                      >
                        Revogar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <span><strong>Concedida por:</strong> {d.grantor?.name ?? d.grantor?.email}</span>
                    <span><strong>Usos:</strong> {d.timesUsed}</span>
                    <span><strong>Escopo:</strong> {parseScopeLabel(d.operationScope)}</span>
                    <span><strong>Expira em:</strong> {formatDateTime(d.expiresAt)}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <strong>Motivo:</strong> {d.reason}
                  </p>

                  {revokeId === d.id && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Confirmar Revogação</p>
                      <input
                        type="text"
                        value={revokeReason}
                        onChange={e => setRevokeReason(e.target.value)}
                        placeholder="Motivo da revogação..."
                        className="w-full border border-red-300 dark:border-red-700 rounded p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white mb-2"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={revokeTwoFactor}
                        onChange={e => setRevokeTwoFactor(e.target.value.replace(/\D/g, ''))}
                        placeholder="Código 2FA"
                        className="w-full border border-red-300 dark:border-red-700 rounded p-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white mb-2 font-mono tracking-widest text-center"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRevoke(d.id)}
                          disabled={revokeLoading || !revokeReason.trim() || revokeTwoFactor.length !== 6}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50"
                        >
                          {revokeLoading ? 'Revogando...' : 'Confirmar Revogação'}
                        </button>
                        <button
                          onClick={() => { setRevokeId(''); setRevokeReason(''); setRevokeTwoFactor(''); }}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Histórico */}
          {historyDelegations.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Histórico ({historyDelegations.length})
              </h2>
              <div className="space-y-3">
                {historyDelegations.map(d => (
                  <div
                    key={d.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 opacity-75"
                  >
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        d.isRevoked
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {d.isRevoked ? (d.revokeReason === 'EXPIRED' ? 'EXPIRADA' : 'REVOGADA') : 'EXPIRADA'}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {d.grantee?.name ?? d.grantee?.email}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({parseScopeLabel(d.operationScope)})
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Concedida por {d.grantor?.name ?? d.grantor?.email} em {formatDateTime(d.createdAt)}
                      {d.revokedAt && ` · Encerrada em ${formatDateTime(d.revokedAt)}`}
                      {d.revokeReason && d.revokeReason !== 'EXPIRED' && ` · Motivo: ${d.revokeReason}`}
                      {' '}· {d.timesUsed} uso(s)
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
