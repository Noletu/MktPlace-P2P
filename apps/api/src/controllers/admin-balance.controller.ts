/**
 * Controller de Auditoria de Saldo Admin
 *
 * FINALIDADE:
 * - Diagnóstico manual de inconsistências de saldo
 * - Correção forçada de saldos por admin
 * - Validação cruzada entre saldo e pedidos
 *
 * ENDPOINTS:
 * GET  /api/v1/admin/balance/audit/:userId - Auditar saldo de usuário
 * POST /api/v1/admin/balance/fix/:userId   - Forçar correção de saldo
 * GET  /api/v1/admin/balance/validate-all  - Validar todos os saldos
 *
 * VERSÃO: 3.0.7
 * DATA: 25/10/2025
 */

import { Request, Response } from 'express';
import { balanceValidatorService } from '../services/balance-validator.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Estados de pedidos ativos
const ACTIVE_ORDER_STATUSES = ['PENDING', 'IN_NEGOTIATION', 'MATCHED', 'PAYMENT_SENT', 'VALIDATING'];

/**
 * GET /api/v1/admin/balance/audit/:userId
 * Auditar saldo de um usuário específico
 */
export const auditUserBalance = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Validar se usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
      });
    }

    // Buscar todos os saldos do usuário
    const balances = await prisma.internalBalance.findMany({
      where: { userId },
    });

    // Auditar cada saldo
    const auditResults = [];

    for (const balance of balances) {
      // 1. Buscar pedidos ativos com saldo bloqueado
      const activeOrders = await prisma.order.findMany({
        where: {
          userId,
          cryptoType: balance.cryptoType,
          cryptoNetwork: balance.network,
          collateralSource: 'INTERNAL_BALANCE',
          collateralLocked: true,
          status: {
            in: ACTIVE_ORDER_STATUSES,
          },
        },
        select: {
          id: true,
          status: true,
          collateralLockedAmount: true,
          brlAmount: true,
          createdAt: true,
        },
      });

      // 2. Buscar pedidos finalizados com saldo ainda bloqueado (ÓRFÃOS)
      const orphanOrders = await prisma.order.findMany({
        where: {
          userId,
          cryptoType: balance.cryptoType,
          cryptoNetwork: balance.network,
          collateralSource: 'INTERNAL_BALANCE',
          collateralLocked: true,
          status: {
            notIn: ACTIVE_ORDER_STATUSES,
          },
        },
        select: {
          id: true,
          status: true,
          collateralLockedAmount: true,
          brlAmount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // 3. Calcular lockedAmount esperado
      let expectedLocked = 0;
      for (const order of activeOrders) {
        expectedLocked += parseFloat(order.collateralLockedAmount || '0');
      }

      const currentLocked = parseFloat(balance.lockedAmount);
      const currentAvailable = parseFloat(balance.availableAmount);
      const total = parseFloat(balance.balance);
      const difference = currentLocked - expectedLocked;
      const tolerance = 0.00000001;
      const isValid = Math.abs(difference) < tolerance;

      // 4. Calcular valores corretos
      const correctLocked = expectedLocked;
      const correctAvailable = total - correctLocked;

      // 5. Construir resultado
      auditResults.push({
        cryptoType: balance.cryptoType,
        network: balance.network,
        isValid,
        currentState: {
          total: balance.balance,
          locked: balance.lockedAmount,
          available: balance.availableAmount,
        },
        expectedState: {
          total: total.toFixed(8),
          locked: correctLocked.toFixed(8),
          available: correctAvailable.toFixed(8),
        },
        difference: {
          locked: difference.toFixed(8),
          available: (currentAvailable - correctAvailable).toFixed(8),
        },
        orders: {
          active: {
            count: activeOrders.length,
            totalLocked: expectedLocked.toFixed(8),
            list: activeOrders.map((o) => ({
              id: o.id,
              status: o.status,
              amount: o.collateralLockedAmount,
              brlAmount: o.brlAmount,
              createdAt: o.createdAt,
            })),
          },
          orphan: {
            count: orphanOrders.length,
            list: orphanOrders.map((o) => ({
              id: o.id,
              status: o.status,
              amount: o.collateralLockedAmount,
              brlAmount: o.brlAmount,
              createdAt: o.createdAt,
              updatedAt: o.updatedAt,
            })),
          },
        },
        needsCorrection: !isValid || orphanOrders.length > 0,
      });
    }

    // Resumo geral
    const totalBalances = auditResults.length;
    const validBalances = auditResults.filter((r) => r.isValid && !r.needsCorrection).length;
    const invalidBalances = totalBalances - validBalances;
    const totalOrphans = auditResults.reduce((sum, r) => sum + r.orders.orphan.count, 0);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        summary: {
          totalBalances,
          validBalances,
          invalidBalances,
          totalOrphans,
        },
        balances: auditResults,
      },
    });
  } catch (error: any) {
    console.error('❌ [ADMIN BALANCE AUDIT] Erro ao auditar saldo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao auditar saldo do usuário',
      details: error.message,
    });
  }
};

/**
 * POST /api/v1/admin/balance/fix/:userId
 * Forçar correção de saldo de um usuário
 *
 * Body: {
 *   cryptoType?: string,  // Se omitido, corrige todos
 *   network?: string,     // Se omitido, corrige todos
 *   autoFix: boolean      // true = auto-corrigir pequenas diferenças
 * }
 */
export const fixUserBalance = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { cryptoType, network, autoFix = true } = req.body;

    // Validar se usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
      });
    }

    let results;

    // Corrigir saldo específico ou todos
    if (cryptoType && network) {
      const result = await balanceValidatorService.validateUserBalance(
        userId,
        cryptoType,
        network,
        autoFix
      );
      results = [result];
    } else {
      results = await balanceValidatorService.validateAllUserBalances(userId, autoFix);
    }

    // Recalcular lockedAmount forçadamente
    const recalcResults: Array<{
      oldLocked: string;
      newLocked: string;
      updated: boolean;
    }> = [];
    for (const result of results) {
      const recalcResult = await balanceValidatorService.recalculateLockedAmount(
        result.userId,
        result.cryptoType,
        result.network
      );
      recalcResults.push(recalcResult);
    }

    // Resumo
    const totalFixed = results.filter((r) => r.autoFixed).length;
    const totalRecalculated = recalcResults.filter((r) => r.updated).length;
    const totalInvalid = results.filter((r) => !r.isValid).length;

    return res.status(200).json({
      success: true,
      message: 'Correção de saldo executada',
      data: {
        user: {
          id: user.id,
          email: user.email,
        },
        summary: {
          totalBalances: results.length,
          totalFixed,
          totalRecalculated,
          totalInvalid,
        },
        results: results.map((r, i) => ({
          cryptoType: r.cryptoType,
          network: r.network,
          isValid: r.isValid,
          autoFixed: r.autoFixed,
          recalculated: recalcResults[i]?.updated || false,
          before: {
            locked: r.currentLocked,
          },
          after: {
            locked: recalcResults[i]?.newLocked || r.currentLocked,
          },
          inconsistencies: r.inconsistencies,
        })),
      },
    });
  } catch (error: any) {
    console.error('❌ [ADMIN BALANCE FIX] Erro ao corrigir saldo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao corrigir saldo do usuário',
      details: error.message,
    });
  }
};

/**
 * GET /api/v1/admin/balance/validate-all
 * Validar TODOS os saldos do sistema
 *
 * Query params:
 * - autoFix=true/false (default: false)
 */
export const validateAllBalances = async (req: Request, res: Response) => {
  try {
    const autoFix = req.query.autoFix === 'true';

    console.log(`🔍 [ADMIN BALANCE] Iniciando validação de todos os saldos (autoFix=${autoFix})...`);

    const result = await balanceValidatorService.validateAllBalances(autoFix);

    return res.status(200).json({
      success: true,
      message: 'Validação de saldos concluída',
      data: {
        summary: {
          total: result.total,
          valid: result.valid,
          invalid: result.invalid,
          autoFixed: result.autoFixed,
        },
        invalidBalances: result.results.map((r) => ({
          userId: r.userId,
          cryptoType: r.cryptoType,
          network: r.network,
          currentLocked: r.currentLocked,
          expectedLocked: r.expectedLocked,
          difference: r.difference,
          activeOrdersCount: r.activeOrdersCount,
          inconsistencies: r.inconsistencies,
          autoFixed: r.autoFixed,
        })),
      },
    });
  } catch (error: any) {
    console.error('❌ [ADMIN BALANCE VALIDATE] Erro ao validar saldos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao validar saldos do sistema',
      details: error.message,
    });
  }
};
