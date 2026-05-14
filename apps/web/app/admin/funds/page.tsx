'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/utils/api';
import ToastContainer from '@/components/admin/ToastContainer';
import { Toast } from '@/components/admin/ToastNotification';
import LockedBalancesView from '@/components/admin/funds/LockedBalancesView';
import PlatformWalletsView from '@/components/admin/funds/PlatformWalletsView';
import WithdrawalsView from '@/components/admin/funds/WithdrawalsView';
import { formatActionLabel } from '@/utils/auditLabels';
import DraggableTabBar, { TabConfig } from '@/components/admin/DraggableTabBar';


interface DashboardData {
  totalCustody: string;
  networkSummary: Array<{
    network: string;
    balance: string;
    lockedBalance: string;
    availableBalance: string;
    walletsCount: number;
  }>;
  topUsers: Array<{
    userId: string;
    email: string;
    name: string | null;
    accountFrozen: boolean;
    totalBalance: string;
    walletsCount: number;
  }>;
  totalUsers: number;
  totalWallets: number;
  solvency: Array<{
    cryptoType: string;
    network: string;
    hotWalletBalance: string;
    totalUserBalance: string;
    delta: string;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  }>;
}

interface SearchedWalletData {
  id: string;
  cryptoType: string;
  network: string;
  address: string;
  balance: string;
  availableBalance: string;
  lockedBalance: string;
}

interface SearchedUserData {
  user: { id: string; email: string; name: string | null };
  wallets: SearchedWalletData[];
}

interface WalletLookupData {
  id: string;
  cryptoType: string;
  network: string;
  address: string;
  balance: string;
  lockedBalance: string;
  availableBalance: string;
  isActive: boolean;
  user: { id: string; email: string; name: string | null };
}

interface AuditLogEntry {
  id: string;
  admin: string;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string | null;
  metadata: any;
  success: boolean;
  createdAt: string;
}

const FUNDS_TAB_CONFIG: TabConfig[] = [
  { key: 'wallets',     label: 'Carteiras',        icon: '🏦', activeColor: 'border-blue-500 text-blue-400' },
  { key: 'withdrawals', label: 'Saques',            icon: '💸', activeColor: 'border-yellow-500 text-yellow-400' },
  { key: 'locked',      label: 'Saldos Bloqueados', icon: '🔒', activeColor: 'border-orange-500 text-orange-400' },
  { key: 'operations',  label: 'Operações',         icon: '⚡', activeColor: 'border-orange-500 text-orange-400' },
  { key: 'audit',       label: 'Audit Log',         icon: '📝', activeColor: 'border-blue-500 text-blue-400' },
];

export default function AdminFundsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const validTabs = ['wallets', 'withdrawals', 'locked', 'operations', 'audit'] as const;
  type FundsTab = typeof validTabs[number];
  const initialTab = validTabs.includes(searchParams.get('tab') as FundsTab) ? (searchParams.get('tab') as FundsTab) : 'wallets';
  const [activeTab, setActiveTab] = useState<FundsTab>(initialTab);

  // Operations tab — unified state
  const [operationType, setOperationType] = useState<'transfer' | 'refund' | 'adjust'>('transfer');
  const [operationLoading, setOperationLoading] = useState(false);

  // Transfer fields
  const [transferCrypto, setTransferCrypto] = useState('');
  const [transferNetwork, setTransferNetwork] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromUserData, setFromUserData] = useState<SearchedUserData | null>(null);
  const [fromWalletId, setFromWalletId] = useState('');
  const [fromSearchLoading, setFromSearchLoading] = useState(false);
  const [toEmail, setToEmail] = useState('');
  const [toUserData, setToUserData] = useState<SearchedUserData | null>(null);
  const [toWalletId, setToWalletId] = useState('');
  const [toSearchLoading, setToSearchLoading] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferTwoFactor, setTransferTwoFactor] = useState('');

  // Platform operation fields
  const [platformEmail, setPlatformEmail] = useState('');
  const [platformUserData, setPlatformUserData] = useState<SearchedUserData | null>(null);
  const [platformSearchLoading, setPlatformSearchLoading] = useState(false);
  const [refundToWalletId, setRefundToWalletId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [platformDirection, setPlatformDirection] = useState<'TO_USER' | 'FROM_USER'>('TO_USER');
  const [refundTwoFactor, setRefundTwoFactor] = useState('');

  // Adjust fields
  const [adjustWalletId, setAdjustWalletId] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustTwoFactor, setAdjustTwoFactor] = useState('');
  const [adjustPending, setAdjustPending] = useState<{ id: string; operationType: string } | null>(null);

  // Wallet lookup cache (walletId → data)
  const [walletLookups, setWalletLookups] = useState<Record<string, WalletLookupData>>({});
  const [lookupLoading, setLookupLoading] = useState<Record<string, boolean>>({});

  // Audit Log states
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    adminUserId: '',
    success: '',
    startDate: '',
    endDate: '',
    limit: '50',
  });
  const [auditPagination, setAuditPagination] = useState({ total: 0, offset: 0, hasMore: false });

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: Toast['type'], message: string, duration?: number) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const lookupWallet = async (walletId: string) => {
    if (!walletId.trim()) return;
    if (walletLookups[walletId]) return; // já em cache

    setLookupLoading((prev) => ({ ...prev, [walletId]: true }));

    try {
      const response = await fetchWithAuth(`/admin/funds/wallets/${walletId}`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Carteira não encontrada');
      }

      const result = await response.json();
      setWalletLookups((prev) => ({ ...prev, [walletId]: result.data }));
    } catch (error) {
      addToast('error', `Wallet ${walletId.slice(0, 12)}...: ${(error as Error).message}`);
    } finally {
      setLookupLoading((prev) => ({ ...prev, [walletId]: false }));
    }
  };

  const searchUserByEmail = async (email: string, target: 'from' | 'to' | 'platform') => {
    if (!email.trim()) return;
    const setLoading = target === 'platform' ? setPlatformSearchLoading : target === 'from' ? setFromSearchLoading : setToSearchLoading;
    const setData = target === 'platform' ? setPlatformUserData : target === 'from' ? setFromUserData : setToUserData;
    const setWallet = target === 'platform' ? setRefundToWalletId : target === 'from' ? setFromWalletId : setToWalletId;

    setLoading(true);
    setData(null);
    setWallet('');

    try {
      const response = await fetchWithAuth(`/admin/funds/users/search?query=${encodeURIComponent(email)}`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Usuário não encontrado');
      }

      const result = await response.json();
      setData(result.data);
    } catch (error) {
      addToast('error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredWallets = (data: SearchedUserData | null): SearchedWalletData[] => {
    if (!data) return [];
    return data.wallets.filter((w) =>
      (!transferCrypto || w.cryptoType === transferCrypto) &&
      (!transferNetwork || w.network === transferNetwork)
    );
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await fetchWithAuth('/admin/funds/dashboard');

      if (!response.ok) {
        throw new Error('Erro ao carregar dashboard');
      }

      const result = await response.json();
      setDashboard(result.data);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      alert('Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleInternalTransfer = async () => {
    if (!fromWalletId || !toWalletId || !transferAmount.trim() || !transferReason.trim()) {
      alert('Preencha todos os campos e selecione as carteiras');
      return;
    }

    const fromWallet = fromUserData?.wallets.find((w) => w.id === fromWalletId);
    const fromLabel = `${fromUserData?.user.email} (${fromWallet?.cryptoType}/${fromWallet?.network} - saldo: ${fromWallet?.availableBalance})`;
    const toLabel = `${toUserData?.user.email}`;

    if (!confirm(`Confirmar Transferência\n\nTransferir ${transferAmount} ${transferCrypto}/${transferNetwork}\n\nDe: ${fromLabel}\nPara: ${toLabel}\n\nMotivo: ${transferReason}\n\nDeseja prosseguir?`)) {
      return;
    }

    setOperationLoading(true);

    try {
      const response = await fetchWithAuth('/admin/funds/internal-transfer', {
        method: 'POST',
        body: JSON.stringify({
          fromWalletId,
          toWalletId,
          amount: transferAmount,
          reason: transferReason,
          twoFactorCode: transferTwoFactor,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao transferir fundos');
      }

      addToast('success', 'Transferência interna realizada com sucesso!');
      setTransferTwoFactor('');
      setFromWalletId('');
      setToWalletId('');
      setFromEmail('');
      setToEmail('');
      setFromUserData(null);
      setToUserData(null);
      setTransferAmount('');
      setTransferReason('');
      loadDashboard();
    } catch (error) {
      console.error('Erro ao transferir fundos:', error);
      addToast('error', `Erro na transferência: ${(error as Error).message}`);
    } finally {
      setOperationLoading(false);
    }
  };

  const handlePlatformRefund = async () => {
    // Pegar crypto/network da wallet selecionada
    const selectedWallet = platformUserData?.wallets.find(w => w.id === refundToWalletId);
    const crypto = selectedWallet?.cryptoType || '';
    const network = selectedWallet?.network || '';

    if (!crypto || !network || !refundToWalletId.trim() || !refundAmount.trim() || !refundReason.trim()) {
      alert('Preencha todos os campos (busque o usuário e selecione a carteira)');
      return;
    }

    const userEmail = platformUserData?.user.email || refundToWalletId;
    const isCollect = platformDirection === 'FROM_USER';

    const confirmMsg = isCollect
      ? `Confirmar Cobrança\n\nCobrar ${refundAmount} ${crypto}/${network} de ${userEmail} para a PlatformWallet?\n\nMotivo: ${refundReason}\n\nDeseja prosseguir?`
      : `Confirmar Reembolso\n\nReembolsar ${refundAmount} ${crypto}/${network} da PlatformWallet para ${userEmail}?\n\nMotivo: ${refundReason}\n\nDeseja prosseguir?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    // Dupla confirmação
    const finalMsg = isCollect
      ? `CONFIRMAÇÃO FINAL\n\nVocê tem CERTEZA ABSOLUTA que deseja executar esta cobrança?\n\nValor: ${refundAmount} ${crypto}\nRede: ${network}\nOrigem: ${userEmail}`
      : `CONFIRMAÇÃO FINAL\n\nVocê tem CERTEZA ABSOLUTA que deseja executar este reembolso?\n\nValor: ${refundAmount} ${crypto}\nRede: ${network}\nDestino: ${userEmail}`;

    if (!confirm(finalMsg)) {
      return;
    }

    setOperationLoading(true);

    try {
      const response = await fetchWithAuth('/admin/funds/platform-refund', {
        method: 'POST',
        body: JSON.stringify({
          cryptoType: crypto,
          network: network,
          toWalletId: refundToWalletId,
          amount: refundAmount,
          reason: refundReason,
          direction: platformDirection,
          twoFactorCode: refundTwoFactor,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || (isCollect ? 'Erro ao cobrar' : 'Erro ao reembolsar'));
      }

      addToast('success', isCollect ? 'Cobrança da plataforma realizada com sucesso!' : 'Reembolso da plataforma realizado com sucesso!');
      setRefundTwoFactor('');
      setPlatformEmail('');
      setPlatformUserData(null);
      setRefundToWalletId('');
      setRefundAmount('');
      setRefundReason('');
      setPlatformDirection('TO_USER');
      loadDashboard();
    } catch (error) {
      console.error(isCollect ? 'Erro ao cobrar:' : 'Erro ao reembolsar:', error);
      addToast('error', `${isCollect ? 'Erro na cobrança' : 'Erro no reembolso'}: ${(error as Error).message}`);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustWalletId.trim() || !adjustment.trim() || !adjustReason.trim()) {
      alert('Preencha todos os campos');
      return;
    }

    const adjustValue = parseFloat(adjustment);
    if (isNaN(adjustValue)) {
      alert('Valor de ajuste inválido');
      return;
    }

    const action = adjustValue >= 0 ? 'ADICIONAR' : 'SUBTRAIR';
    const absValue = Math.abs(adjustValue);

    if (!confirm(`⚠️ OPERAÇÃO CRÍTICA\n\n${action} ${absValue} na carteira ${adjustWalletId}?\n\nMotivo: ${adjustReason}\n\nEsta ação é IRREVERSÍVEL!`)) {
      return;
    }

    setOperationLoading(true);

    try {
      const response = await fetchWithAuth('/admin/funds/adjust-balance', {
        method: 'POST',
        body: JSON.stringify({
          walletId: adjustWalletId,
          adjustment,
          reason: adjustReason,
          twoFactorCode: adjustTwoFactor,
        }),
      });

      const result = await response.json();

      // Operação enfileirada para aprovação dupla (202 = queued, não executada)
      if (response.status === 202) {
        setAdjustPending(result.data);
        setAdjustWalletId('');
        setAdjustment('');
        setAdjustReason('');
        setAdjustTwoFactor('');
        addToast('info', 'Ajuste enfileirado! Aguardando aprovação do segundo MASTER em /admin/aprovações.');
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Erro ao ajustar saldo');
      }

      addToast('success', 'Saldo ajustado com sucesso!');
      setAdjustWalletId('');
      setAdjustment('');
      setAdjustReason('');
      setAdjustTwoFactor('');
      loadDashboard();
    } catch (error) {
      console.error('Erro ao ajustar saldo:', error);
      addToast('error', `Erro ao ajustar saldo: ${(error as Error).message}`);
    } finally {
      setOperationLoading(false);
    }
  };

  const loadAuditLog = async (offsetOverride?: number) => {
    setAuditLoading(true);

    try {
      const params = new URLSearchParams();
      if (auditFilters.action) params.append('action', auditFilters.action);
      if (auditFilters.adminUserId) params.append('adminUserId', auditFilters.adminUserId);
      if (auditFilters.success) params.append('success', auditFilters.success);
      if (auditFilters.startDate) params.append('startDate', auditFilters.startDate);
      if (auditFilters.endDate) params.append('endDate', auditFilters.endDate);
      if (auditFilters.limit) params.append('limit', auditFilters.limit);
      const currentOffset = offsetOverride !== undefined ? offsetOverride : auditPagination.offset;
      params.append('offset', String(currentOffset));

      const response = await fetchWithAuth(`/admin/funds/audit-log?${params.toString()}`);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao buscar audit log');
      }

      setAuditLogs(result.data?.logs || []);
      setAuditPagination({
        total: result.data?.pagination?.total || 0,
        offset: result.data?.pagination?.offset || 0,
        hasMore: result.data?.pagination?.hasMore || false,
      });
    } catch (error) {
      console.error('Erro ao buscar audit log:', error);
      alert(`Erro: ${(error as Error).message}`);
    } finally {
      setAuditLoading(false);
    }
  };

  const exportAuditLog = () => {
    if (auditLogs.length === 0) {
      alert('Nenhum registro para exportar');
      return;
    }

    const csvContent = [
      ['ID', 'Data', 'Ação', 'Admin', 'Descrição', 'Recurso', 'Resource ID', 'Status', 'Metadata'].join(','),
      ...auditLogs.map(log => [
        log.id,
        new Date(log.createdAt).toLocaleString('pt-BR'),
        log.action,
        log.admin,
        (log.description || '').replace(/,/g, ';'),
        log.resource,
        log.resourceId || '',
        log.success ? 'OK' : 'FALHA',
        log.metadata ? JSON.stringify(log.metadata).replace(/,/g, ';') : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `audit-log-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">💰 Controle de Fundos</h1>
        <p className="text-gray-600 dark:text-gray-400">Gestão completa de fundos em custódia da plataforma</p>
      </div>

      {/* Tabs */}
      <DraggableTabBar
        tabs={FUNDS_TAB_CONFIG}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as FundsTab)}
        storageKey="admin-funds-tabs"
      />

      {/* Platform Wallets View */}
      {activeTab === 'wallets' && (
        <PlatformWalletsView />
      )}

      {/* Withdrawals View */}
      {activeTab === 'withdrawals' && (
        <WithdrawalsView />
      )}

      {/* Locked Balances View */}
      {activeTab === 'locked' && (
        <LockedBalancesView />
      )}

      {/* Operations Tab (Unified: Transfer + Refund + Adjust) */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4">
            <p className="text-red-300 text-sm">
              <strong>Operações financeiras:</strong> Afetam saldos reais dos usuários. Exigem autenticação 2FA e são registradas no Audit Log.
            </p>
          </div>

          {/* Operation Type Selector */}
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Tipo de Operação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                  operationType === 'transfer'
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="operationType"
                  value="transfer"
                  checked={operationType === 'transfer'}
                  onChange={() => setOperationType('transfer')}
                  className="text-blue-500"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Transferência entre Usuários</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">UserWallet → UserWallet</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                  operationType === 'refund'
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="operationType"
                  value="refund"
                  checked={operationType === 'refund'}
                  onChange={() => setOperationType('refund')}
                  className="text-purple-500"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Operação Plataforma</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">PlatformWallet ↔ UserWallet</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                  operationType === 'adjust'
                    ? 'border-red-500 bg-red-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="operationType"
                  value="adjust"
                  checked={operationType === 'adjust'}
                  onChange={() => setOperationType('adjust')}
                  className="text-red-500"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Ajuste Manual</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Adicionar/subtrair de UserWallet</p>
                </div>
              </label>
            </div>
          </div>

          {/* Transfer Form */}
          {operationType === 'transfer' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Transferência entre Usuários</h3>
              <div className="space-y-4">
                {/* Crypto + Network */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Crypto</label>
                    <select
                      value={transferCrypto}
                      onChange={(e) => { setTransferCrypto(e.target.value); setFromWalletId(''); setToWalletId(''); }}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="BTC">BTC</option>
                      <option value="USDT">USDT</option>
                      <option value="USDC">USDC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rede</label>
                    <select
                      value={transferNetwork}
                      onChange={(e) => { setTransferNetwork(e.target.value); setFromWalletId(''); setToWalletId(''); }}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="BITCOIN">BITCOIN</option>
                      <option value="BASE">BASE</option>
                      <option value="SOLANA">SOLANA</option>
                    </select>
                  </div>
                </div>

                {/* From User */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Origem - Buscar usuário</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchUserByEmail(fromEmail, 'from')}
                      placeholder="ID, email ou ID da carteira"
                      className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => searchUserByEmail(fromEmail, 'from')}
                      disabled={fromSearchLoading || !fromEmail.trim()}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm transition"
                    >
                      {fromSearchLoading ? '...' : 'Buscar'}
                    </button>
                  </div>
                  {fromUserData && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-400 mb-1">
                        {fromUserData.user.name || fromUserData.user.email} — {getFilteredWallets(fromUserData).length} carteira(s) {transferCrypto}/{transferNetwork}
                      </p>
                      {getFilteredWallets(fromUserData).length > 0 ? (
                        <select
                          value={fromWalletId}
                          onChange={(e) => setFromWalletId(e.target.value)}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Selecione a carteira...</option>
                          {getFilteredWallets(fromUserData).map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.cryptoType}/{w.network} — Saldo: {w.balance} | Disponível: {w.availableBalance} | Bloqueado: {w.lockedBalance}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-red-400">Nenhuma carteira encontrada para {transferCrypto || '?'}/{transferNetwork || '?'}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* To User */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Destino - Buscar usuário</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={toEmail}
                      onChange={(e) => setToEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchUserByEmail(toEmail, 'to')}
                      placeholder="ID, email ou ID da carteira"
                      className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => searchUserByEmail(toEmail, 'to')}
                      disabled={toSearchLoading || !toEmail.trim()}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm transition"
                    >
                      {toSearchLoading ? '...' : 'Buscar'}
                    </button>
                  </div>
                  {toUserData && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-400 mb-1">
                        {toUserData.user.name || toUserData.user.email} — {getFilteredWallets(toUserData).length} carteira(s) {transferCrypto}/{transferNetwork}
                      </p>
                      {getFilteredWallets(toUserData).length > 0 ? (
                        <select
                          value={toWalletId}
                          onChange={(e) => setToWalletId(e.target.value)}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Selecione a carteira...</option>
                          {getFilteredWallets(toUserData).map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.cryptoType}/{w.network} — Saldo: {w.balance} | Disponível: {w.availableBalance}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-red-400">Nenhuma carteira encontrada para {transferCrypto || '?'}/{transferNetwork || '?'}</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Valor</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00000000"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Motivo (obrigatório)</label>
                  <textarea
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="Ex: Correção de saldo incorreto, reembolso aprovado, etc."
                    rows={3}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Código 2FA *
                    <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">(obrigatório)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={transferTwoFactor}
                    onChange={(e) => setTransferTwoFactor(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono tracking-widest text-center text-lg"
                  />
                </div>

                <button
                  onClick={handleInternalTransfer}
                  disabled={operationLoading || !fromWalletId || !toWalletId}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg font-medium transition"
                >
                  {operationLoading ? 'Processando...' : 'Executar Transferência'}
                </button>
              </div>
            </div>
          )}

          {/* Platform Operation Form */}
          {operationType === 'refund' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Operação Plataforma</h3>

              {/* Direction Toggle */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setPlatformDirection('TO_USER')}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition border-2 ${
                    platformDirection === 'TO_USER'
                      ? 'border-green-500 bg-green-900/20 text-green-400'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  ↗ Enviar para Usuário (Reembolso)
                </button>
                <button
                  onClick={() => setPlatformDirection('FROM_USER')}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition border-2 ${
                    platformDirection === 'FROM_USER'
                      ? 'border-orange-500 bg-orange-900/20 text-orange-400'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  ↙ Receber de Usuário (Cobrança)
                </button>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {platformDirection === 'TO_USER'
                  ? 'Transfere fundos da PlatformWallet para uma carteira de usuário. Use para devolver fees em caso de reversão de transação P2P.'
                  : 'Cobra fundos de uma carteira de usuário para a PlatformWallet. Use para fees não pagas, créditos indevidos ou reversão de reembolsos incorretos.'}
              </p>
              <div className="space-y-4">
                {/* Busca por Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {platformDirection === 'TO_USER' ? 'Destino - Buscar usuário' : 'Origem - Buscar usuário'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={platformEmail}
                      onChange={(e) => setPlatformEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchUserByEmail(platformEmail, 'platform')}
                      placeholder="ID, email ou ID da carteira"
                      className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => searchUserByEmail(platformEmail, 'platform')}
                      disabled={platformSearchLoading || !platformEmail.trim()}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm transition"
                    >
                      {platformSearchLoading ? '...' : 'Buscar'}
                    </button>
                  </div>
                  {platformUserData && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-400 mb-1">
                        {platformUserData.user.name || platformUserData.user.email} — {platformUserData.wallets.length} carteira(s)
                      </p>
                      {platformUserData.wallets.length > 0 ? (
                        <select
                          value={refundToWalletId}
                          onChange={(e) => setRefundToWalletId(e.target.value)}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Selecione a carteira...</option>
                          {platformUserData.wallets.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.cryptoType}/{w.network} — Saldo: {w.balance} | Disponível: {w.availableBalance} | Bloqueado: {w.lockedBalance}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-red-400">Nenhuma carteira encontrada para este usuário</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.00000000"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Motivo (obrigatório)
                  </label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Ex: Reversão de transação #xyz, devolução de fee por disputa resolvida, etc."
                    rows={3}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Código 2FA *
                    <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">(obrigatório)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={refundTwoFactor}
                    onChange={(e) => setRefundTwoFactor(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 font-mono tracking-widest text-center text-lg"
                  />
                </div>

                <button
                  onClick={handlePlatformRefund}
                  disabled={operationLoading}
                  className={`w-full px-6 py-3 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg font-medium transition ${
                    platformDirection === 'FROM_USER'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {operationLoading ? 'Processando...' : platformDirection === 'FROM_USER' ? 'Executar Cobrança' : 'Executar Reembolso'}
                </button>
              </div>
            </div>
          )}

          {/* Adjust Form */}
          {operationType === 'adjust' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Ajuste Manual de Saldo</h3>

              {adjustPending && (
                <div className="mb-4 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                  <p className="text-blue-300 font-bold mb-1">Solicitação enfileirada para aprovação dupla</p>
                  <p className="text-blue-200 text-sm">
                    O ajuste não foi executado ainda. Um segundo MASTER deve aprovar em{' '}
                    <a href="/admin/aprovacoes" className="underline hover:text-blue-100">Aprovações</a>.
                  </p>
                  <p className="text-xs text-blue-400 font-mono mt-2">ID: {adjustPending.id}</p>
                  <button
                    onClick={() => setAdjustPending(null)}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-200 underline"
                  >
                    Fechar aviso
                  </button>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Wallet ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={adjustWalletId}
                      onChange={(e) => setAdjustWalletId(e.target.value)}
                      placeholder="ID da carteira"
                      className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => lookupWallet(adjustWalletId)}
                      disabled={lookupLoading[adjustWalletId] || !adjustWalletId.trim()}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm transition"
                    >
                      {lookupLoading[adjustWalletId] ? '...' : 'Buscar'}
                    </button>
                  </div>
                  {walletLookups[adjustWalletId] && (
                    <div className="mt-2 p-3 bg-gray-900/50 border border-gray-600 rounded-lg text-sm">
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <span className="text-gray-400">Usuário: <span className="text-white">{walletLookups[adjustWalletId].user.email}</span></span>
                        <span className="text-gray-400">Crypto: <span className="text-yellow-400 font-medium">{walletLookups[adjustWalletId].cryptoType}/{walletLookups[adjustWalletId].network}</span></span>
                        <span className="text-gray-400">Saldo: <span className="text-green-400 font-mono">{walletLookups[adjustWalletId].balance}</span></span>
                        <span className="text-gray-400">Disponível: <span className="text-green-300 font-mono">{walletLookups[adjustWalletId].availableBalance}</span></span>
                        <span className="text-gray-400">Bloqueado: <span className="text-yellow-300 font-mono">{walletLookups[adjustWalletId].lockedBalance}</span></span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ajuste (use valores negativos para subtrair)
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={adjustment}
                    onChange={(e) => setAdjustment(e.target.value)}
                    placeholder="Ex: 100.50 para adicionar ou -50.25 para subtrair"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Valor positivo = adicionar, negativo = subtrair
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Motivo (obrigatório)
                  </label>
                  <textarea
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Ex: Correção de crédito duplicado, erro de sistema, etc."
                    rows={3}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Código 2FA{' '}
                    <span className="text-gray-500 dark:text-gray-400 font-normal">(obrigatório em produção)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={adjustTwoFactor}
                    onChange={(e) => setAdjustTwoFactor(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono tracking-widest"
                  />
                </div>

                <button
                  onClick={handleAdjustBalance}
                  disabled={operationLoading}
                  className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg font-medium transition"
                >
                  {operationLoading ? 'Processando...' : 'Executar Ajuste de Saldo'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              ℹ️ <strong>Audit Log:</strong> Registro completo de todas as operações administrativas realizadas no sistema.
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🔍 Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Ação
                </label>
                <select
                  value={auditFilters.action}
                  onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Todas</option>
                  {['FREEZE_ACCOUNT', 'UNFREEZE_ACCOUNT', 'AUTO_UNFREEZE_ACCOUNT', 'INTERNAL_TRANSFER', 'BALANCE_ADJUSTMENT', 'PLATFORM_REFUND', 'PLATFORM_COLLECT', 'ADMIN_LOCK_BALANCE', 'ADMIN_UNLOCK_BALANCE'].map(action => (
                    <option key={action} value={action}>{formatActionLabel(action)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Admin User ID
                </label>
                <input
                  type="text"
                  value={auditFilters.adminUserId}
                  onChange={(e) => setAuditFilters({ ...auditFilters, adminUserId: e.target.value })}
                  placeholder="ID do administrador"
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={auditFilters.success}
                  onChange={(e) => setAuditFilters({ ...auditFilters, success: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="true">Sucesso</option>
                  <option value="false">Falha</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Limite
                </label>
                <select
                  value={auditFilters.limit}
                  onChange={(e) => setAuditFilters({ ...auditFilters, limit: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="10">10 registros</option>
                  <option value="50">50 registros</option>
                  <option value="100">100 registros</option>
                  <option value="500">500 registros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data Início
                </label>
                <input
                  type="date"
                  value={auditFilters.startDate}
                  onChange={(e) => setAuditFilters({ ...auditFilters, startDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={auditFilters.endDate}
                  onChange={(e) => setAuditFilters({ ...auditFilters, endDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => loadAuditLog(0)}
                disabled={auditLoading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg font-medium transition"
              >
                {auditLoading ? 'Carregando...' : '🔍 Buscar Logs'}
              </button>
              <button
                onClick={exportAuditLog}
                disabled={auditLogs.length === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg font-medium transition"
              >
                📥 Exportar CSV
              </button>
            </div>
          </div>

          {/* Results */}
          {auditLogs.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  📋 Resultados ({auditPagination.total} registros)
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-300 dark:border-gray-700">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Data/Hora</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Ação</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Admin</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Descrição</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Recurso</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-300 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            log.action.includes('FREEZE') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                            log.action.includes('UNFREEZE') ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300' :
                            log.action.includes('TRANSFER') ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' :
                            log.action.includes('REFUND') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' :
                            log.action.includes('COLLECT') ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' :
                            log.action.includes('ADJUSTMENT') ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                            log.action.includes('UNLOCK') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                            log.action.includes('LOCK') ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {formatActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {log.admin}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={log.description || ''}>
                          {log.description || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                          {log.resource}
                          {log.resourceId && (
                            <span className="text-xs text-gray-500 dark:text-gray-500 block">{log.resourceId.slice(0, 12)}...</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            log.success
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                          }`}>
                            {log.success ? 'OK' : 'FALHA'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {log.metadata && (
                            <details className="cursor-pointer">
                              <summary className="hover:text-gray-900 dark:hover:text-white">Ver detalhes</summary>
                              <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto max-w-md">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
                <button
                  onClick={() => loadAuditLog(Math.max(0, auditPagination.offset - parseInt(auditFilters.limit || '50')))}
                  disabled={auditPagination.offset === 0 || auditLoading}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg text-sm font-medium transition"
                >
                  ← Anterior
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando {auditPagination.offset + 1}–{Math.min(auditPagination.offset + auditLogs.length, auditPagination.total)} de {auditPagination.total} registros
                </span>
                <button
                  onClick={() => loadAuditLog(auditPagination.offset + parseInt(auditFilters.limit || '50'))}
                  disabled={!auditPagination.hasMore || auditLoading}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg text-sm font-medium transition"
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}

          {!auditLoading && auditLogs.length === 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Nenhum registro encontrado. Clique em "Buscar Logs" para carregar os dados.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
