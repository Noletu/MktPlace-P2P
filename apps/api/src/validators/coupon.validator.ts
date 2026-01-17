import { z } from 'zod';

export const CreateCouponSchema = z.object({
  code: z.string()
    .min(3, 'Código deve ter no mínimo 3 caracteres')
    .max(20, 'Código deve ter no máximo 20 caracteres')
    .regex(/^[A-Z0-9_-]+$/, 'Código deve conter apenas letras maiúsculas, números, _ e -'),

  discountPercentage: z.number()
    .int('Desconto deve ser um número inteiro')
    .min(1, 'Desconto deve ser no mínimo 1%')
    .max(100, 'Desconto deve ser no máximo 100%'),

  maxUsesPerUser: z.number()
    .int('Limite de uso deve ser um número inteiro')
    .min(0, 'Limite de uso deve ser no mínimo 0 (0 = ilimitado)'),

  expiresAt: z.string().datetime().optional().nullable(),

  isPublic: z.boolean().default(false),

  isActive: z.boolean().default(true),

  description: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').optional().nullable(),
});

export const UpdateCouponSchema = z.object({
  discountPercentage: z.number().int().min(1).max(100).optional(),
  maxUsesPerUser: z.number().int().min(0).optional(), // 0 = ilimitado
  expiresAt: z.string().datetime().optional().nullable(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500).optional().nullable(),
});

export const ActivateCouponSchema = z.object({
  code: z.string().min(3).max(20),
});
