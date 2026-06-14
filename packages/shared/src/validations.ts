import { z } from 'zod';
import { CryptoType, NetworkType, OrderType } from './types';

// SECURITY: Validação completa de CPF com dígitos verificadores
const validateCPF = (cpf: string): boolean => {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/[^\d]/g, '');

  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais (ex: 111.111.111-11)
  if (cpf.split('').every((c) => c === cpf[0])) return false;

  // Validar primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;

  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(10))) return false;

  return true;
};

// CPF validation com algoritmo completo
export const cpfSchema = z
  .string()
  .regex(/^\d{11}$/, 'CPF deve conter 11 dígitos')
  .refine(validateCPF, 'CPF inválido (dígitos verificadores incorretos)');

// SECURITY (SER-27): Validação completa de CNPJ com dígitos verificadores
export const validateCNPJ = (cnpj: string): boolean => {
  cnpj = cnpj.replace(/[^\d]/g, '');
  if (cnpj.length !== 14) return false;
  if (cnpj.split('').every((c) => c === cnpj[0])) return false;
  const calcDigit = (len: number): number => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(cnpj.charAt(len - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (calcDigit(12) !== parseInt(cnpj.charAt(12))) return false;
  if (calcDigit(13) !== parseInt(cnpj.charAt(13))) return false;
  return true;
};

export const cnpjSchema = z
  .string()
  .regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos')
  .refine(validateCNPJ, 'CNPJ inválido (dígitos verificadores incorretos)');

// SECURITY (SER-27): documento = CPF OU CNPJ (ambos com dígitos verificadores)
export const documentSchema = z
  .string()
  .refine(
    (v) => validateCPF(v) || validateCNPJ(v),
    'CPF ou CNPJ inválido (dígitos verificadores incorretos)'
  );

// SECURITY: Política de senha forte
export const strongPasswordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial (!@#$%^&*...)');

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  // SECURITY (SER-23): no login apenas validamos a credencial — a política
  // de tamanho é aplicada no registro. min(1) evita vazar a política aqui e
  // faz uma senha curta cair no 401 uniforme, não num 400 distinto.
  password: z.string().min(1, 'Senha obrigatória'),
  // SECURITY (SER-23): twoFactorToken removido do /auth/login — o código
  // 2FA agora vai para /auth/complete-login (passo 2).
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: strongPasswordSchema, // SECURITY: Usar política de senha forte
  name: z.string().optional(),
});

// SECURITY (SER-23): body do /auth/complete-login (passo 2). O código 2FA é
// opcional — ausente na primeira chamada (servidor responde requires2FA),
// presente na segunda. Aceita DOIS formatos (twoFactorService.verifyToken
// decide qual usar internamente — TOTP primeiro, depois backup code):
//   - TOTP: 6 dígitos.
//   - Backup code: 10 chars hex (formato exibido XXXX-XXXX-XX, hífens
//     opcionais — bate com normalizeBackupCode do twoFactor.service).
export const completeLoginSchema = z.object({
  twoFactorToken: z
    .union([
      z.string().regex(/^\d{6}$/), // TOTP (6 dígitos)
      z.string().regex(/^[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{2}$/), // backup code
    ])
    .optional(),
});

// Password reset schemas
export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalido'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Email invalido'),
  token: z.string().min(1, 'Token e obrigatorio'),
  newPassword: strongPasswordSchema,
  twoFactorToken: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: strongPasswordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da atual',
    path: ['newPassword'],
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

// Constants
export const FEE_RATES = {
  PLATFORM: 0.015, // 1.5%
  PAYER_REWARD: 0.01, // 1%
  TOTAL: 0.025, // 2.5%
  PLATFORM_TIMEOUT: 0.02, // 2% when platform pays
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
  const decimals = crypto === CryptoType.BTC ? 8 : 2; // BTC: 8 decimais, USDC/USDT: 2 decimais
  return `${value.toFixed(decimals)} ${crypto}`;
}
