const TRANSACTION_LABELS: Record<string, string> = {
  DEPOSIT: 'Depósito',
  WITHDRAWAL: 'Saque',
  LOCK: 'Bloqueio',
  UNLOCK: 'Desbloqueio',
  DEDUCT: 'Dedução',
  CREDIT: 'Crédito',
  REFUND: 'Reembolso',
  ADMIN_CREDIT: 'Crédito Administrativo',
  ADMIN_DEBIT: 'Débito Administrativo',
  ADMIN_LOCK: 'Bloqueio Administrativo',
  ADMIN_UNLOCK: 'Desbloqueio Administrativo',
  ADMIN_ADJUSTMENT: 'Ajuste Administrativo',
  PLATFORM_FEE: 'Taxa da Plataforma',
  ADMIN_DISPUTE: 'Disputa Administrativa',
  WITHDRAWAL_REJECTED: 'Saque Rejeitado',
};

export function getTransactionLabel(type: string): string {
  return TRANSACTION_LABELS[type] || type;
}
