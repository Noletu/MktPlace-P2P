/**
 * Sistema de Cancelamentos e Penalidades
 *
 * Define tipos, enums e interfaces para o sistema de rastreamento
 * de cancelamentos e aplicação de penalidades.
 */

/**
 * Motivos categorizados para cancelamento de pedidos
 */
export enum CancellationReason {
  // Cancelamentos pelo comprador/pagador
  USER_CHANGED_MIND = 'USER_CHANGED_MIND',           // Mudei de ideia
  FOUND_BETTER_PRICE = 'FOUND_BETTER_PRICE',         // Encontrei preço melhor
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',                   // Problema com meu pagamento
  SELLER_UNRESPONSIVE = 'SELLER_UNRESPONSIVE',       // Vendedor não responde

  // Cancelamentos pelo vendedor
  BUYER_SUSPICIOUS = 'BUYER_SUSPICIOUS',             // Comprador suspeito
  BUYER_UNRESPONSIVE = 'BUYER_UNRESPONSIVE',         // Comprador não responde
  NO_LONGER_AVAILABLE = 'NO_LONGER_AVAILABLE',       // Crypto não disponível

  // Genéricos
  TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',               // Problema técnico
  PERSONAL_EMERGENCY = 'PERSONAL_EMERGENCY',         // Emergência pessoal
  OTHER = 'OTHER',                                   // Outro motivo
}

/**
 * Labels amigáveis para os motivos de cancelamento
 */
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

/**
 * Papel do usuário no pedido
 */
export enum UserRole {
  SELLER = 'SELLER',  // Criador do pedido (vendedor de crypto)
  BUYER = 'BUYER',    // Pagador (comprador de crypto)
}

/**
 * Severidade da penalidade
 */
export enum PenaltySeverity {
  NONE = 'NONE',         // Sem penalidade (primeira vez)
  WARNING = 'WARNING',   // Advertência leve
  MINOR = 'MINOR',       // Penalidade menor
  MAJOR = 'MAJOR',       // Penalidade maior
  CRITICAL = 'CRITICAL', // Penalidade crítica (fraude)
}

/**
 * Input para criar histórico de cancelamento
 */
export interface CreateCancellationHistoryInput {
  userId: string;
  orderId: string;
  role: UserRole;
  reason: CancellationReason;
  note?: string;
  penaltyApplied: boolean;
  penaltyPoints: number;
  reputationBefore?: number;
  reputationAfter?: number;
  orderStatus: string;
  orderValue: string;
}

/**
 * Input para cancelar pedido com justificativa
 */
export interface CancelOrderInput {
  orderId: string;
  userId: string;
  reason: CancellationReason;
  note: string; // Obrigatório - mínimo 20 caracteres
}

/**
 * Resultado do cálculo de penalidade
 */
export interface PenaltyCalculation {
  shouldApplyPenalty: boolean;       // Se deve aplicar penalidade
  penaltyPoints: number;              // Pontos de penalidade
  severity: PenaltySeverity;          // Severidade da penalidade
  totalCancellations: number;         // Total de cancelamentos
  recentCancellations: number;        // Cancelamentos nos últimos 30 dias
  message: string;                    // Mensagem explicativa
  reputationImpact: number;           // Impacto na reputação (negativo)
}

/**
 * Estatísticas de cancelamento de um usuário
 */
export interface CancellationStats {
  userId: string;
  totalCancellations: number;         // Total histórico
  recentCancellations: number;        // Últimos 30 dias
  lastCancellationAt?: Date;          // Data do último
  cancellationsAsSeller: number;      // Como vendedor
  cancellationsAsBuyer: number;       // Como comprador
  totalPenaltyPoints: number;         // Total de pontos acumulados
  averagePenaltyPoints: number;       // Média de pontos por cancelamento
  mostCommonReason?: CancellationReason; // Motivo mais comum
}

/**
 * Configurações do sistema de penalidades
 */
export interface PenaltyConfig {
  // Penalidades progressivas (baseadas em total)
  progressive: {
    first: number;        // 0 pontos (sem penalidade)
    second: number;       // 5 pontos
    third: number;        // 10 pontos
    fourthFifth: number;  // 15 pontos
    sixth: number;        // 20 pontos
  };

  // Penalidades por frequência (últimos 30 dias)
  frequency: {
    low: { threshold: number; points: number };      // 1-2 cancelamentos: 0 pontos
    medium: { threshold: number; points: number };   // 3-4 cancelamentos: 15 pontos
    high: { threshold: number; points: number };     // 5+ cancelamentos: 30 pontos
  };

  // Janela de tempo para contar cancelamentos recentes (em dias)
  recentWindowDays: number;

  // Threshold para suspensão (futuro)
  suspensionThreshold?: number;
}

/**
 * Configuração padrão do sistema de penalidades
 */
export const DEFAULT_PENALTY_CONFIG: PenaltyConfig = {
  progressive: {
    first: 0,
    second: 5,
    third: 10,
    fourthFifth: 15,
    sixth: 20,
  },
  frequency: {
    low: { threshold: 2, points: 0 },
    medium: { threshold: 4, points: 15 },
    high: { threshold: 5, points: 30 },
  },
  recentWindowDays: 30,
};

/**
 * Resposta de cancelamento com penalidade
 */
export interface CancellationResponse {
  success: boolean;
  message: string;
  penaltyApplied: boolean;
  penaltyPoints?: number;
  newReputation?: number;
  warning?: string;
}
