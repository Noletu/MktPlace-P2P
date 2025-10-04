export enum OrderType {
  BOLETO = 'BOLETO',
  PIX = 'PIX',
}

export enum OrderStatus {
  PENDING = 'PENDING', // Esperando matching
  MATCHED = 'MATCHED', // Match encontrado
  PAYMENT_SENT = 'PAYMENT_SENT', // Pagador enviou comprovante
  VALIDATING = 'VALIDATING', // Validando comprovante
  COMPLETED = 'COMPLETED', // Concluído
  DISPUTED = 'DISPUTED', // Em disputa
  CANCELLED = 'CANCELLED', // Cancelado
  TIMEOUT = 'TIMEOUT', // Timeout - plataforma pagou
}

export interface BoletoData {
  barcode: string; // Código de barras do boleto
  dueDate: string; // Data de vencimento
  recipientName: string; // Nome do beneficiário
  recipientDocument: string; // CPF/CNPJ do beneficiário
}

export interface PixData {
  pixKey: string; // Chave PIX
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'; // Tipo de chave
  recipientName: string; // Nome do beneficiário
}

export interface CreateOrderInput {
  userId: string;
  type: OrderType;
  cryptoType: string;
  cryptoNetwork: string;
  cryptoAmount: string;
  brlAmount: string;
  orderData: BoletoData | PixData;
}

export interface FeeCalculation {
  platformFee: string; // 1.5% em crypto
  payerReward: string; // 1% em crypto
  totalFee: string; // 2.5% em crypto
  netCryptoAmount: string; // Valor que o criador recebe
}

// Configurações de taxas
export const FEE_CONFIG = {
  PLATFORM_FEE_PERCENTAGE: 0.015, // 1.5%
  PAYER_REWARD_PERCENTAGE: 0.01, // 1%
  TOTAL_FEE_PERCENTAGE: 0.025, // 2.5%
  TIMEOUT_HOURS: 24, // Horas para timeout
};
