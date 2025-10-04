// Shared types entre frontend e backend

export enum KYCLevel {
  NONE = 'NONE',
  LEVEL_1 = 'LEVEL_1', // CPF + Email (R$1k/dia)
  LEVEL_2 = 'LEVEL_2', // + Selfie + Prova endereço (R$5k/dia)
  LEVEL_3 = 'LEVEL_3', // + Renda + Banco (R$15k/dia)
  LEVEL_4 = 'LEVEL_4', // Enhanced Due Diligence (>R$50k/mês)
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
}

export enum CryptoType {
  BTC = 'BTC',      // Bitcoin
  ETH = 'ETH',      // Ethereum
  XMR = 'XMR',      // Monero
  ZEC = 'ZEC',      // Zcash
  USDC = 'USDC',    // USD Coin
  USDT = 'USDT',    // Tether
}

export enum NetworkType {
  BITCOIN = 'BITCOIN',
  ETHEREUM = 'ETHEREUM',
  POLYGON = 'POLYGON',
  BSC = 'BSC',          // Binance Smart Chain
  SOLANA = 'SOLANA',
  TRC20 = 'TRC20',      // Tron
  MONERO = 'MONERO',
  ZCASH = 'ZCASH',
}

export enum OrderType {
  BOLETO = 'BOLETO',
  PIX = 'PIX',
}

export enum OrderStatus {
  PENDING = 'PENDING',             // Aguardando matching
  MATCHED = 'MATCHED',             // Match encontrado, aguardando pagamento
  PAYMENT_SENT = 'PAYMENT_SENT',   // Comprovante enviado
  VALIDATING = 'VALIDATING',       // Validando comprovante
  COMPLETED = 'COMPLETED',         // Transação completa
  DISPUTED = 'DISPUTED',           // Em disputa
  CANCELLED = 'CANCELLED',         // Cancelada
  TIMEOUT = 'TIMEOUT',             // Timeout - plataforma vai pagar
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DISPUTED = 'DISPUTED',
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// User types
export interface User {
  id: string;
  email: string;
  cpf: string;
  name?: string;
  kycLevel: KYCLevel;
  reputationScore: number;
  role: UserRole;
  createdAt: string;
}

// Wallet types
export interface Wallet {
  id: string;
  userId: string;
  crypto: CryptoType;
  network: NetworkType;
  address: string;
  balance: string;
  isActive: boolean;
}

// Order types
export interface Order {
  id: string;
  userId: string;
  type: OrderType;
  status: OrderStatus;
  cryptoType: CryptoType;
  cryptoNetwork: NetworkType;
  cryptoAmount: string;
  brlAmount: string;
  platformFee: string;
  payerReward: string;
  totalFee: string;
  orderData: BoletoData | PixData;
  timeoutAt?: string;
  paidByPlatform: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoletoData {
  codigo: string;
  vencimento: string;
  beneficiario: string;
  valor: string;
}

export interface PixData {
  chave: string;
  tipo: 'cpf' | 'email' | 'phone' | 'random';
  valor: string;
}

// Transaction types
export interface Transaction {
  id: string;
  orderId: string;
  payerId: string;
  status: TransactionStatus;
  comprovanteUrl?: string;
  validationScore?: number;
  validatedAt?: string;
  createdAt: string;
}

// Price Quote
export interface PriceQuote {
  cryptoType: CryptoType;
  brlPrice: string;
  source: string;
  timestamp: string;
}

// Network info
export interface NetworkInfo {
  type: NetworkType;
  name: string;
  averageFee: string;
  confirmationTime: string;
  priority: number; // 1-5 (5 = recommended)
}

export const NETWORK_INFO: Record<NetworkType, NetworkInfo> = {
  [NetworkType.SOLANA]: {
    type: NetworkType.SOLANA,
    name: 'Solana',
    averageFee: '$0.00025',
    confirmationTime: '1-2s',
    priority: 5,
  },
  [NetworkType.POLYGON]: {
    type: NetworkType.POLYGON,
    name: 'Polygon',
    averageFee: '$0.01',
    confirmationTime: '2-5s',
    priority: 4,
  },
  [NetworkType.BSC]: {
    type: NetworkType.BSC,
    name: 'Binance Smart Chain',
    averageFee: '$0.15',
    confirmationTime: '3-5s',
    priority: 3,
  },
  [NetworkType.TRC20]: {
    type: NetworkType.TRC20,
    name: 'Tron (TRC20)',
    averageFee: '$1',
    confirmationTime: '3-5min',
    priority: 2,
  },
  [NetworkType.BITCOIN]: {
    type: NetworkType.BITCOIN,
    name: 'Bitcoin',
    averageFee: '$2-10',
    confirmationTime: '10-60min',
    priority: 3,
  },
  [NetworkType.ETHEREUM]: {
    type: NetworkType.ETHEREUM,
    name: 'Ethereum',
    averageFee: '$5-50',
    confirmationTime: '1-3min',
    priority: 2,
  },
  [NetworkType.MONERO]: {
    type: NetworkType.MONERO,
    name: 'Monero',
    averageFee: '$0.02',
    confirmationTime: '2-20min',
    priority: 4,
  },
  [NetworkType.ZCASH]: {
    type: NetworkType.ZCASH,
    name: 'Zcash',
    averageFee: '$0.01',
    confirmationTime: '2-10min',
    priority: 4,
  },
};
