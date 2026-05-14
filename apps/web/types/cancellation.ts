/**
 * Tipos para Sistema de Cancelamentos e Penalidades - Frontend
 */

export enum CancellationReason {
  USER_CHANGED_MIND = 'USER_CHANGED_MIND',
  FOUND_BETTER_PRICE = 'FOUND_BETTER_PRICE',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  SELLER_UNRESPONSIVE = 'SELLER_UNRESPONSIVE',
  BUYER_SUSPICIOUS = 'BUYER_SUSPICIOUS',
  BUYER_UNRESPONSIVE = 'BUYER_UNRESPONSIVE',
  NO_LONGER_AVAILABLE = 'NO_LONGER_AVAILABLE',
  TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',
  PERSONAL_EMERGENCY = 'PERSONAL_EMERGENCY',
  OTHER = 'OTHER',
}

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  [CancellationReason.USER_CHANGED_MIND]: 'Mudei de ideia',
  [CancellationReason.FOUND_BETTER_PRICE]: 'Encontrei preço melhor',
  [CancellationReason.PAYMENT_ISSUE]: 'Problema com meu pagamento',
  [CancellationReason.SELLER_UNRESPONSIVE]: 'Vendedor não responde',
  [CancellationReason.BUYER_SUSPICIOUS]: 'Comprador suspeito',
  [CancellationReason.BUYER_UNRESPONSIVE]: 'Comprador não responde',
  [CancellationReason.NO_LONGER_AVAILABLE]: 'Crypto não disponível',
  [CancellationReason.TECHNICAL_ISSUE]: 'Problema técnico',
  [CancellationReason.PERSONAL_EMERGENCY]: 'Emergência pessoal',
  [CancellationReason.OTHER]: 'Outro motivo',
};

export interface CancellationWarning {
  shouldWarn: boolean;
  warningMessage?: string;
  cancellationCount: number;
  nextPenaltyPoints: number;
}

export interface CancellationResponse {
  success: boolean;
  message: string;
  penaltyApplied: boolean;
  penaltyPoints: number;
}

export interface CancellationStats {
  userId: string;
  totalCancellations: number;
  recentCancellations: number;
  lastCancellationAt?: string;
  cancellationsAsSeller: number;
  cancellationsAsBuyer: number;
  totalPenaltyPoints: number;
  averagePenaltyPoints: number;
  mostCommonReason?: CancellationReason;
}

export interface AntiSpamStats {
  pendingCancellationsToday: number;
  pendingCancellationsLast7Days: number;
  totalCancellations: number;
  canCancel: boolean;
  warningLevel: 'none' | 'warning' | 'restricted' | 'penalized';
}
