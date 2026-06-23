export enum DisputeStatus {
  OPEN = 'OPEN', // Disputa aberta, aguardando resposta da outra parte
  UNDER_REVIEW = 'UNDER_REVIEW', // Ambas partes responderam, aguardando decisão da plataforma
  RESOLVED_BUYER = 'RESOLVED_BUYER', // Resolvida a favor do comprador
  RESOLVED_SELLER = 'RESOLVED_SELLER', // Resolvida a favor do vendedor
  CANCELLED = 'CANCELLED', // Cancelada (acordo entre partes ou admin)
}

export enum DisputeCategory {
  // Comprador abre
  PAYMENT_SENT_NOT_CONFIRMED = 'PAYMENT_SENT_NOT_CONFIRMED', // Enviei pagamento mas vendedor não confirma
  CRYPTO_NOT_RELEASED = 'CRYPTO_NOT_RELEASED', // Confirmei pagamento mas crypto não foi liberada

  // Vendedor abre
  PAYMENT_NOT_RECEIVED = 'PAYMENT_NOT_RECEIVED', // Comprovante enviado mas não recebi pagamento
  FAKE_RECEIPT = 'FAKE_RECEIPT', // Comprovante de pagamento é falso/editado
  WRONG_AMOUNT = 'WRONG_AMOUNT', // Valor recebido difere do combinado
  WRONG_RECIPIENT = 'WRONG_RECIPIENT', // Pagamento foi para pessoa/chave errada

  // Ambos
  OTHER = 'OTHER', // Outro motivo
}

/**
 * Tipos de resolucao de disputa
 * Alinhado com frontend e logica de negocio
 */
export enum ResolutionType {
  RELEASE_TO_BUYER = 'RELEASE_TO_BUYER',   // Liberar cripto para o pagador do PIX (comprovante valido)
  RETURN_TO_SELLER = 'RETURN_TO_SELLER',   // Devolver cripto ao vendedor (comprovante invalido)
  CANCEL_NO_PENALTY = 'CANCEL_NO_PENALTY', // Cancelar negociacao sem penalidade
  PENALTY_BUYER = 'PENALTY_BUYER',         // Penalizar pagador do PIX (fraude)
  PENALTY_SELLER = 'PENALTY_SELLER',       // Penalizar vendedor (ma-fe)
}

export interface CreateDisputeInput {
  orderId: string;
  category: DisputeCategory;
  title: string;
  description: string;

  // Evidências
  attachments?: string[]; // URLs dos arquivos enviados

  // Informações específicas (JSON)
  specificData?: {
    // Se comprador (PIX)
    paymentDate?: string;
    paymentTime?: string;
    pixTransactionId?: string;

    // Se vendedor
    checkedBankAccount?: boolean;
    expectedAmount?: string;
    pixKeyUsed?: string;
    boletoBarcode?: string;

    // Análise de fraude
    whyFake?: string;
    receiptAnalysis?: string;
  };
}

export interface RespondDisputeInput {
  contestation: string; // Versão dos fatos da outra parte
  counterEvidences?: string[]; // URLs de contra-evidências

  // Proposta de acordo
  proposeDeal?: {
    type: 'PARTIAL_REFUND' | 'RELEASE_CRYPTO' | 'CANCEL_ORDER';
    amount?: string;
    reason: string;
  };
}

export interface ResolveDisputeInput {
  resolutionType: ResolutionType;
  resolution: string; // Explicação detalhada da decisão

  // Valores (se aplicável)
  refundAmount?: string;
  penaltyAmount?: string;

  // Reputação
  adjustBuyerReputation?: number;
  adjustSellerReputation?: number;

  // Flags
  suspendAccount?: string; // userId se conta deve ser suspensa
  flagForInvestigation?: boolean;
}

export interface AddDisputeMessageInput {
  disputeId: string;
  authorId: string;
  message: string;
  attachments?: string[];
  isAdminMessage?: boolean;
}

// Deadline configs
export const DISPUTE_DEADLINES = {
  RESPONSE_TIME: 48 * 60 * 60 * 1000, // 48h para responder
  RESOLUTION_TIME: 48 * 60 * 60 * 1000, // 48h para resolver
  OPEN_AFTER_PAYMENT_SENT: 24 * 60 * 60 * 1000, // Pode abrir após 24h em PAYMENT_SENT (legado)
  OPEN_AFTER_PAYMENT_SENT_PIX: 0, // PIX: pode abrir imediatamente
  OPEN_AFTER_PAYMENT_SENT_BOLETO: 48 * 60 * 60 * 1000, // Boleto: 48h após o comprovante
};

// Reputation adjustments
export const DISPUTE_REPUTATION = {
  OPEN_PENALTY: -5, // Ao abrir disputa (temporário)
  WIN_BONUS: 10, // Ganhar disputa
  LOSE_PENALTY: -20, // Perder disputa
  FRAUD_PENALTY: -100, // Fraude comprovada
};
