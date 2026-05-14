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

// Mapeamento automático de categoria para prioridade
export const CATEGORY_PRIORITY_MAP: Record<TicketCategory, TicketPriority> = {
  [TicketCategory.ACCOUNT_ISSUE]: TicketPriority.URGENT,
  [TicketCategory.PAYMENT_ISSUE]: TicketPriority.HIGH,
  [TicketCategory.WALLET_ISSUE]: TicketPriority.HIGH,
  [TicketCategory.KYC_ISSUE]: TicketPriority.MEDIUM,
  [TicketCategory.TECHNICAL_ISSUE]: TicketPriority.MEDIUM,
  [TicketCategory.QUESTION]: TicketPriority.LOW,
  [TicketCategory.FEATURE_REQUEST]: TicketPriority.LOW,
  [TicketCategory.OTHER]: TicketPriority.MEDIUM,
};

export interface CreateTicketInput {
  createdBy: string;
  category: TicketCategory;
  subject: string;
  description: string;
  attachments?: string[];
}

export interface AddTicketMessageInput {
  ticketId: string;
  authorId: string;
  message: string;
  attachments?: string[];
  isSupportMessage?: boolean;
}

export interface ResolveTicketInput {
  ticketId: string;
  resolvedBy: string;
  resolution: string;
}

export interface GetTicketsFilters {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  limit?: number;
  offset?: number;
}
