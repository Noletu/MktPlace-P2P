/**
 * Serviço de Validação Automática de Saldo
 *
 * FINALIDADE:
 * - Validar consistência entre saldo bloqueado e pedidos ativos
 * - Detectar inconsistências automaticamente
 * - Auto-corrigir pequenas inconsistências
 * - Alertar sobre inconsistências graves
 *
 * CHAMADO EM:
 * - Após criar pedido
 * - Após cancelar pedido
 * - Após completar pedido
 * - Periodicamente (worker)
 *
 * VERSÃO: 3.0.7
 * DATA: 25/10/2025
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Estados de pedidos que DEVEM ter saldo bloqueado
const ACTIVE_ORDER_STATUSES = ['PENDING', 'IN_NEGOTIATION', 'MATCHED', 'PAYMENT_SENT', 'VALIDATING'];

export interface BalanceValidationResult {
  isValid: boolean;
  userId: string;
  cryptoType: string;
  network: string;
  currentLocked: number;
  expectedLocked: number;
  difference: number;
  activeOrdersCount: number;
  inconsistencies: string[];
  autoFixed: boolean;
}

export class BalanceValidatorService {
  /**
   * Validar saldo de um usuário específico
   */
  async validateUserBalance(
    userId: string,
    cryptoType: string,
    network: string,
    autoFix: boolean = false
  ): Promise<BalanceValidationResult> {
    // 1. Buscar saldo atual
    const balance = await prisma.internalBalance.findUnique({
      where: {
        userId_cryptoType_network: {
          userId,
          cryptoType,
          network,
        },
      },
    });

    if (!balance) {
      return {
        isValid: true, // Não tem saldo = válido
        userId,
        cryptoType,
        network,
        currentLocked: 0,
        expectedLocked: 0,
        difference: 0,
        activeOrdersCount: 0,
        inconsistencies: [],
        autoFixed: false,
      };
    }

    // 2. Buscar pedidos ativos com saldo bloqueado
    const activeOrders = await prisma.order.findMany({
      where: {
        userId,
        cryptoType,
        cryptoNetwork: network,
        collateralSource: 'INTERNAL_BALANCE',
        collateralLocked: true,
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
      },
    });

    // 3. Calcular lockedAmount esperado
    let expectedLocked = 0;
    for (const order of activeOrders) {
      expectedLocked += parseFloat(order.collateralLockedAmount || '0');
    }

    const currentLocked = parseFloat(balance.lockedAmount);
    const difference = currentLocked - expectedLocked;
    const tolerance = 0.00000001; // Tolerância para arredondamento
    const isValid = Math.abs(difference) < tolerance;

    const inconsistencies: string[] = [];

    // 4. Detectar inconsistências
    if (!isValid) {
      if (difference > 0) {
        inconsistencies.push(
          `Saldo bloqueado MAIOR que esperado: ${currentLocked.toFixed(8)} > ${expectedLocked.toFixed(8)}`
        );
        inconsistencies.push(
          `Possível causa: Pedido finalizado mas saldo não foi desbloqueado`
        );
      } else {
        inconsistencies.push(
          `Saldo bloqueado MENOR que esperado: ${currentLocked.toFixed(8)} < ${expectedLocked.toFixed(8)}`
        );
        inconsistencies.push(
          `Possível causa: Pedido ativo mas saldo não foi bloqueado corretamente`
        );
      }
    }

    // 5. Auto-corrigir se solicitado e a diferença for pequena (<= 10%)
    let autoFixed = false;
    if (autoFix && !isValid && Math.abs(difference / expectedLocked) <= 0.1) {
      try {
        const newTotal = parseFloat(balance.balance);
        const newLocked = expectedLocked;
        const newAvailable = newTotal - newLocked;

        await prisma.internalBalance.update({
          where: { id: balance.id },
          data: {
            lockedAmount: newLocked.toFixed(8),
            availableAmount: newAvailable.toFixed(8),
          },
        });

        console.log(`🔧 [BALANCE VALIDATOR] Auto-corrigido saldo de ${userId}:`);
        console.log(`   ${cryptoType}/${network}`);
        console.log(`   Bloqueado: ${currentLocked.toFixed(8)} → ${newLocked.toFixed(8)}`);

        autoFixed = true;
      } catch (error: any) {
        console.error(`❌ [BALANCE VALIDATOR] Erro ao auto-corrigir:`, error.message);
        inconsistencies.push(`Falha na auto-correção: ${error.message}`);
      }
    }

    return {
      isValid: isValid || autoFixed,
      userId,
      cryptoType,
      network,
      currentLocked,
      expectedLocked,
      difference,
      activeOrdersCount: activeOrders.length,
      inconsistencies,
      autoFixed,
    };
  }

  /**
   * Validar todos os saldos de um usuário
   */
  async validateAllUserBalances(
    userId: string,
    autoFix: boolean = false
  ): Promise<BalanceValidationResult[]> {
    const balances = await prisma.internalBalance.findMany({
      where: { userId },
    });

    const results: BalanceValidationResult[] = [];

    for (const balance of balances) {
      const result = await this.validateUserBalance(
        userId,
        balance.cryptoType,
        balance.network,
        autoFix
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Validar TODOS os saldos do sistema
   * (Usado em worker periódico)
   */
  async validateAllBalances(autoFix: boolean = false): Promise<{
    total: number;
    valid: number;
    invalid: number;
    autoFixed: number;
    results: BalanceValidationResult[];
  }> {
    const balances = await prisma.internalBalance.findMany();

    const results: BalanceValidationResult[] = [];
    let valid = 0;
    let invalid = 0;
    let autoFixed = 0;

    for (const balance of balances) {
      const result = await this.validateUserBalance(
        balance.userId,
        balance.cryptoType,
        balance.network,
        autoFix
      );

      results.push(result);

      if (result.isValid) {
        valid++;
      } else {
        invalid++;
      }

      if (result.autoFixed) {
        autoFixed++;
      }
    }

    return {
      total: balances.length,
      valid,
      invalid,
      autoFixed,
      results: results.filter(r => !r.isValid), // Retornar apenas inválidos
    };
  }

  /**
   * Recalcular lockedAmount baseado em pedidos ativos
   * (Usa como fonte de verdade os pedidos, não o saldo atual)
   */
  async recalculateLockedAmount(
    userId: string,
    cryptoType: string,
    network: string
  ): Promise<{
    oldLocked: string;
    newLocked: string;
    updated: boolean;
  }> {
    // 1. Buscar saldo
    const balance = await prisma.internalBalance.findUnique({
      where: {
        userId_cryptoType_network: {
          userId,
          cryptoType,
          network,
        },
      },
    });

    if (!balance) {
      return {
        oldLocked: '0',
        newLocked: '0',
        updated: false,
      };
    }

    // 2. Buscar pedidos ativos
    const activeOrders = await prisma.order.findMany({
      where: {
        userId,
        cryptoType,
        cryptoNetwork: network,
        collateralSource: 'INTERNAL_BALANCE',
        collateralLocked: true,
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
      },
    });

    // 3. Calcular novo lockedAmount
    let newLocked = 0;
    for (const order of activeOrders) {
      newLocked += parseFloat(order.collateralLockedAmount || '0');
    }

    const oldLocked = parseFloat(balance.lockedAmount);
    const tolerance = 0.00000001;

    // 4. Atualizar se diferente
    if (Math.abs(oldLocked - newLocked) > tolerance) {
      const newTotal = parseFloat(balance.balance);
      const newAvailable = newTotal - newLocked;

      await prisma.internalBalance.update({
        where: { id: balance.id },
        data: {
          lockedAmount: newLocked.toFixed(8),
          availableAmount: newAvailable.toFixed(8),
        },
      });

      console.log(`✅ [BALANCE VALIDATOR] Recalculado lockedAmount:`);
      console.log(`   ${userId} - ${cryptoType}/${network}`);
      console.log(`   ${oldLocked.toFixed(8)} → ${newLocked.toFixed(8)}`);

      return {
        oldLocked: oldLocked.toFixed(8),
        newLocked: newLocked.toFixed(8),
        updated: true,
      };
    }

    return {
      oldLocked: oldLocked.toFixed(8),
      newLocked: newLocked.toFixed(8),
      updated: false,
    };
  }
}

export const balanceValidatorService = new BalanceValidatorService();
