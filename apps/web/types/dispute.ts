export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED_BUYER = 'RESOLVED_BUYER',
  RESOLVED_SELLER = 'RESOLVED_SELLER',
  CANCELLED = 'CANCELLED',
}

export enum DisputeCategory {
  PAYMENT_SENT_NOT_CONFIRMED = 'PAYMENT_SENT_NOT_CONFIRMED',
  CRYPTO_NOT_RELEASED = 'CRYPTO_NOT_RELEASED',
  PAYMENT_NOT_RECEIVED = 'PAYMENT_NOT_RECEIVED',
  FAKE_RECEIPT = 'FAKE_RECEIPT',
  WRONG_AMOUNT = 'WRONG_AMOUNT',
  WRONG_RECIPIENT = 'WRONG_RECIPIENT',
  OTHER = 'OTHER',
}

export interface Dispute {
  id: string;
  orderId: string;
  transactionId?: string;
  createdBy: string;
  status: DisputeStatus;
  category: DisputeCategory;
  title: string;
  description: string;
  resolvedBy?: string;
  resolution?: string;
  resolutionType?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  order: {
    id: string;
    type: string;
    brlAmount: string;
    cryptoAmount: string;
    cryptoType: string;
    // Vendedor de cripto (criador do anuncio)
    user?: {
      id: string;
      name: string;
      email: string;
    };
    // Transacoes com dados do pagador do PIX
    transactions?: Array<{
      id: string;
      payerId: string;
      payer?: {
        id: string;
        name: string;
        email: string;
      };
      payerWalletAddress?: string;
    }>;
  };
  attachments?: string[];
  messages: DisputeMessage[];
}

export interface DisputeMessage {
  id: string;
  disputeId: string;
  authorId: string;
  message: string;
  attachments?: string;
  isAdminMessage: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
}

export const CATEGORY_LABELS: Record<DisputeCategory, string> = {
  [DisputeCategory.PAYMENT_SENT_NOT_CONFIRMED]: 'Enviei pagamento mas vendedor não confirma',
  [DisputeCategory.CRYPTO_NOT_RELEASED]: 'Confirmei pagamento mas crypto não foi liberada',
  [DisputeCategory.PAYMENT_NOT_RECEIVED]: 'Comprovante enviado mas não recebi pagamento',
  [DisputeCategory.FAKE_RECEIPT]: 'Comprovante de pagamento é falso/editado',
  [DisputeCategory.WRONG_AMOUNT]: 'Valor recebido difere do combinado',
  [DisputeCategory.WRONG_RECIPIENT]: 'Pagamento foi para pessoa/chave errada',
  [DisputeCategory.OTHER]: 'Outro motivo',
};

export const STATUS_LABELS: Record<DisputeStatus, string> = {
  [DisputeStatus.OPEN]: 'Aberta',
  [DisputeStatus.UNDER_REVIEW]: 'Em Análise',
  [DisputeStatus.RESOLVED_BUYER]: 'Resolvida - Favor do Comprador',
  [DisputeStatus.RESOLVED_SELLER]: 'Resolvida - Favor do Vendedor',
  [DisputeStatus.CANCELLED]: 'Cancelada',
};
