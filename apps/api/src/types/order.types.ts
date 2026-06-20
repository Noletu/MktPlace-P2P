export enum OrderType {
  BUY = 'BUY',   // User wants to buy crypto (pay BRL)
  SELL = 'SELL', // User wants to sell crypto (receive BRL)
}

export enum PaymentMethod {
  BOLETO = 'BOLETO',
  PIX = 'PIX',
}

export enum OrderStatus {
  PENDING = 'PENDING', // Esperando matching
  IN_NEGOTIATION = 'IN_NEGOTIATION', // Em negociação (chat iniciado, sem match confirmado)
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
  paymentMethod?: PaymentMethod; // Optional: payment method
  cryptoType: string;
  cryptoNetwork: string;
  cryptoAmount: string;
  brlAmount: string;
  unitPrice?: string; // FEATURE (preço personalizado): preço unitário BRL/cripto definido pelo criador; null = preço de mercado
  quoteId?: string; // FEATURE (price-lock): cotação travada a consumir (pedido a preço de mercado com preço congelado); ausente = mercado live
  orderData: BoletoData | PixData;
  customExpirationHours?: number; // Custom expiration time (1-720 hours)
  manualCancelOnly?: boolean; // If true, expires after 6 months instead of custom/default
}

export interface FeeCalculation {
  platformFee: string; // 1.5% em crypto (com desconto de cupom aplicado, se houver)
  payerReward: string; // 1% em crypto (permanece inalterado)
  totalFee: string; // 2.5% em crypto (ou menos com cupom)
  netCryptoAmount: string; // Valor que o criador recebe
  appliedCoupon?: {
    couponId: string;
    code: string;
    discountPercentage: number;
    originalPlatformFee: string;
    discountAmount: string;
  } | null;
}

// Configurações de taxas
export const FEE_CONFIG = {
  PLATFORM_FEE_PERCENTAGE: 0.015, // 1.5%
  PAYER_REWARD_PERCENTAGE: 0.01, // 1%
  TOTAL_FEE_PERCENTAGE: 0.025, // 2.5%
  TIMEOUT_HOURS: 24, // Horas para timeout
};

// Configurações específicas para ordens BUY
// Em ordens BUY: comprador paga 2.5% de markup, provedor deposita crypto + 1.5% fee
// Provedor recebe BRL com 2.5% extra, paga 1.5% fee em crypto = ~1% lucro líquido
export const BUY_ORDER_CONFIG = {
  BRL_MARKUP_PERCENTAGE: 0.025, // 2.5% markup no preço BRL
  PROVIDER_COLLATERAL_FEE: 0.015, // 1.5% que provedor deposita extra (platform fee)
};

// Input para criação de ordem BUY (comprador não tem crypto)
export interface CreateBuyOrderInput {
  userId: string;
  cryptoType: string;
  cryptoNetwork: string;
  cryptoAmount: string; // Quanto crypto quer comprar
  unitPrice?: string; // FEATURE (preço personalizado): preço unitário BRL/cripto definido pelo comprador; null = preço de mercado
  customExpirationHours?: number;
  manualCancelOnly?: boolean;
}

// Input para provedor aceitar ordem BUY
export interface AcceptBuyOrderInput {
  orderId: string;
  providerId: string;
  pixKey: string;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';
  recipientName: string;
}
