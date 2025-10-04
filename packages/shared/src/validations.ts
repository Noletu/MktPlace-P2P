import { z } from 'zod';
import { KYCLevel, CryptoType, NetworkType, OrderType } from './types';

// CPF validation
export const cpfSchema = z
  .string()
  .regex(/^\d{11}$/, 'CPF deve conter 11 dígitos')
  .refine((cpf) => {
    // Validação básica de CPF (pode ser melhorada)
    if (cpf.split('').every((c) => c === cpf[0])) return false;
    return true;
  }, 'CPF inválido');

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  cpf: cpfSchema,
  phone: z.string().optional(),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
});

// Order schemas
export const createBoletoOrderSchema = z.object({
  cryptoType: z.nativeEnum(CryptoType),
  cryptoNetwork: z.nativeEnum(NetworkType),
  cryptoAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Valor inválido'),
  boletoData: z.object({
    codigo: z.string().min(47, 'Código de barras inválido'),
    vencimento: z.string(), // ISO date
    beneficiario: z.string(),
    valor: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
  }),
});

export const createPixOrderSchema = z.object({
  cryptoType: z.nativeEnum(CryptoType),
  cryptoNetwork: z.nativeEnum(NetworkType),
  cryptoAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Valor inválido'),
  pixData: z.object({
    chave: z.string().min(1, 'Chave PIX obrigatória'),
    tipo: z.enum(['cpf', 'email', 'phone', 'random']),
    valor: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
  }),
});

// Transaction schemas
export const submitComprovanteSchema = z.object({
  orderId: z.string().cuid(),
  comprovanteFile: z.any(), // File object (frontend) or buffer (backend)
});

// KYC schemas
export const kycLevel1Schema = z.object({
  cpf: cpfSchema,
  phone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido'),
});

export const kycLevel2Schema = kycLevel1Schema.extend({
  selfieUrl: z.string().url(),
  documentUrl: z.string().url(),
  address: z.object({
    cep: z.string().regex(/^\d{8}$/, 'CEP inválido'),
    street: z.string(),
    number: z.string(),
    complement: z.string().optional(),
    city: z.string(),
    state: z.string().length(2),
  }),
});

// Constants
export const FEE_RATES = {
  PLATFORM: 0.015, // 1.5%
  PAYER_REWARD: 0.01, // 1%
  TOTAL: 0.025, // 2.5%
  PLATFORM_TIMEOUT: 0.02, // 2% when platform pays
} as const;

export const DAILY_LIMITS = {
  [KYCLevel.NONE]: 0,
  [KYCLevel.LEVEL_1]: 1000, // R$ 1k/dia
  [KYCLevel.LEVEL_2]: 5000, // R$ 5k/dia
  [KYCLevel.LEVEL_3]: 15000, // R$ 15k/dia
  [KYCLevel.LEVEL_4]: 50000, // R$ 50k/dia
} as const;

// Utility functions
export function calculateFees(brlAmount: number) {
  return {
    platformFee: brlAmount * FEE_RATES.PLATFORM,
    payerReward: brlAmount * FEE_RATES.PAYER_REWARD,
    totalFee: brlAmount * FEE_RATES.TOTAL,
  };
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatCrypto(value: number, crypto: CryptoType): string {
  const decimals = crypto === CryptoType.BTC ? 8 : crypto === CryptoType.ETH ? 6 : 2;
  return `${value.toFixed(decimals)} ${crypto}`;
}
