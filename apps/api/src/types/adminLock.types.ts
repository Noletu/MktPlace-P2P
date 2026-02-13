/**
 * Admin Lock Types
 *
 * Tipos para operações de bloqueio/desbloqueio manual de saldo
 * Usado em /admin/funds para gerenciar saldos bloqueados
 */

// Categorias de bloqueio administrativo
export enum LockCategory {
  ORPHAN_COLLATERAL = 'ORPHAN_COLLATERAL',       // Colateral órfão de bug anterior
  DISPUTE = 'DISPUTE',                             // Saldo em disputa ativa
  SECURITY = 'SECURITY',                           // Bloqueio preventivo por segurança
  FRAUD_INVESTIGATION = 'FRAUD_INVESTIGATION',     // Investigação de fraude em andamento
  ADMINISTRATIVE = 'ADMINISTRATIVE',               // Ajuste administrativo genérico
  LEGAL_HOLD = 'LEGAL_HOLD',                       // Bloqueio por ordem judicial/legal
}

// Labels para exibição no frontend
export const LockCategoryLabels: Record<LockCategory, string> = {
  [LockCategory.ORPHAN_COLLATERAL]: 'Colateral Órfão',
  [LockCategory.DISPUTE]: 'Disputa',
  [LockCategory.SECURITY]: 'Segurança',
  [LockCategory.FRAUD_INVESTIGATION]: 'Investigação de Fraude',
  [LockCategory.ADMINISTRATIVE]: 'Administrativo',
  [LockCategory.LEGAL_HOLD]: 'Bloqueio Legal',
};

// Descrições para exibição no frontend
export const LockCategoryDescriptions: Record<LockCategory, string> = {
  [LockCategory.ORPHAN_COLLATERAL]: 'Saldo bloqueado de um pedido que foi cancelado/finalizado mas não teve o colateral liberado automaticamente',
  [LockCategory.DISPUTE]: 'Saldo retido enquanto uma disputa está sendo analisada',
  [LockCategory.SECURITY]: 'Bloqueio preventivo por atividade suspeita detectada',
  [LockCategory.FRAUD_INVESTIGATION]: 'Saldo retido durante investigação de possível fraude',
  [LockCategory.ADMINISTRATIVE]: 'Bloqueio/desbloqueio por motivo administrativo interno',
  [LockCategory.LEGAL_HOLD]: 'Bloqueio por determinação judicial ou compliance',
};

// DTO para bloquear saldo
export interface AdminLockBalanceDto {
  walletId: string;
  amount: string;
  category: LockCategory;
  reason: string;
}

// DTO para desbloquear saldo
export interface AdminUnlockBalanceDto {
  walletId: string;
  amount: string;
  category: LockCategory;
  reason: string;
}

// Filtros para listagem de saldos bloqueados
export interface LockedBalancesFilters {
  cryptoType?: string;
  network?: string;
  userId?: string;
  minAmount?: string;
}

// Informação de carteira com saldo bloqueado
export interface LockedWalletInfo {
  walletId: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  cryptoType: string;
  network: string;
  address: string;
  balance: string;
  lockedBalance: string;
  availableBalance: string;
  lastLockDate: Date | null;
  hasActiveOrder: boolean;
  lockHistory: LockHistoryEntry[];
}

// Entrada do histórico de bloqueios
export interface LockHistoryEntry {
  id: string;
  type: string;
  amount: string;
  category: LockCategory | null;
  reason: string | null;
  adminUserId: string | null;
  adminEmail: string | null;
  orderId: string | null;
  createdAt: Date;
}
