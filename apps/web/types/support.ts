export enum TicketStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketCategory {
  ACCOUNT_ISSUE = 'ACCOUNT_ISSUE',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',
  KYC_ISSUE = 'KYC_ISSUE',
  WALLET_ISSUE = 'WALLET_ISSUE',
  QUESTION = 'QUESTION',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  OTHER = 'OTHER',
}

export enum TicketPriority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

// Labels traduzidos para exibição
export const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Aberto',
  [TicketStatus.UNDER_REVIEW]: 'Em Análise',
  [TicketStatus.RESOLVED]: 'Resolvido',
  [TicketStatus.CLOSED]: 'Fechado',
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  [TicketCategory.ACCOUNT_ISSUE]: 'Problema com Conta',
  [TicketCategory.PAYMENT_ISSUE]: 'Problema com Pagamento',
  [TicketCategory.TECHNICAL_ISSUE]: 'Problema Técnico',
  [TicketCategory.KYC_ISSUE]: 'Problema com KYC',
  [TicketCategory.WALLET_ISSUE]: 'Problema com Carteira',
  [TicketCategory.QUESTION]: 'Dúvida',
  [TicketCategory.FEATURE_REQUEST]: 'Sugestão de Funcionalidade',
  [TicketCategory.OTHER]: 'Outro',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.URGENT]: 'Urgente',
  [TicketPriority.HIGH]: 'Alta',
  [TicketPriority.MEDIUM]: 'Média',
  [TicketPriority.LOW]: 'Baixa',
};

// Cores para badges de status
export const STATUS_COLORS: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  [TicketStatus.UNDER_REVIEW]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  [TicketStatus.RESOLVED]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  [TicketStatus.CLOSED]: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

// Cores para badges de prioridade
export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  [TicketPriority.URGENT]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  [TicketPriority.HIGH]: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  [TicketPriority.MEDIUM]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  [TicketPriority.LOW]: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export interface SupportTicket {
  id: string;
  createdBy: string;
  status: TicketStatus;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  resolvedBy?: string;
  resolution?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    name: string | null;
    email: string;
  };
  resolver?: {
    id: string;
    name: string | null;
    email: string;
  };
  messages?: TicketMessage[];
  _count?: {
    messages: number;
  };
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  message: string;
  attachments: string | null;
  isSupportMessage: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    legacyRole?: string;
    role?: {
      name: string;
      level: number;
    } | null;
  };
}

export interface CreateTicketData {
  category: TicketCategory;
  subject: string;
  description: string;
  attachments?: string[];
}

export interface AddMessageData {
  message: string;
  attachments?: string[];
}

export interface ResolveTicketData {
  resolution: string;
}

export interface TicketFilters {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  limit?: number;
  offset?: number;
}

export interface TicketStats {
  total: number;
  byStatus: {
    open: number;
    underReview: number;
    resolved: number;
    closed: number;
  };
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  resolutionRate: number;
}
