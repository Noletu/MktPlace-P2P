export enum TransactionStatus {
  PENDING = 'PENDING', // Aguardando pagamento
  VALIDATING = 'VALIDATING', // Validando comprovante
  APPROVED = 'APPROVED', // Aprovado
  REJECTED = 'REJECTED', // Rejeitado
  DISPUTED = 'DISPUTED', // Em disputa
}

export interface SubmitProofInput {
  transactionId: string;
  userId: string;
  comprovanteData: string; // Base64 da imagem
  comprovanteUrl?: string; // URL se já estiver hospedado
}

export interface ValidateProofInput {
  transactionId: string;
  validatedBy: string;
  approved: boolean;
  validationScore?: number;
  reason?: string;
}

export interface DisputeInput {
  transactionId: string;
  userId: string;
  reason: string;
  disputeData?: any;
}
