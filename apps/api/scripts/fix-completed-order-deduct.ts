/**
 * Script para Debitar Saldo de Pedidos COMPLETED Órfãos
 *
 * PROBLEMA:
 * - Pedido COMPLETED teve saldo desbloqueado mas não debitado
 * - balance (total) não foi reduzido
 * - Falta transação DEDUCT no histórico
 *
 * SOLUÇÃO:
 * - Buscar pedidos COMPLETED com collateralSource = INTERNAL_BALANCE
 * - Verificar se já existe transação DEDUCT
 * - Se não existir: Debitar saldo + criar transação
 *
 * VERSÃO: 3.0.7
 * DATA: 25/10/2025
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('💸 Iniciando correção de débitos de pedidos COMPLETED...\n');

  // Buscar pedidos COMPLETED que usaram saldo interno
  const completedOrders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      collateralSource: 'INTERNAL_BALANCE',
      collateralLockedAmount: {
        not: null,
      },
    },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  console.log(`📊 Total de pedidos COMPLETED encontrados: ${completedOrders.length}\n`);

  for (const order of completedOrders) {
    console.log(`${'='.repeat(80)}`);
    console.log(`📦 Pedido: ${order.id}`);
    console.log(`👤 Usuário: ${order.user.email} (${order.userId})`);
    console.log(`💰 Cripto: ${order.cryptoType} (${order.cryptoNetwork})`);
    console.log(`💸 Valor: ${order.collateralLockedAmount} ${order.cryptoType}`);
    console.log(`📅 Concluído em: ${order.completedAt}`);
    console.log(`${'='.repeat(80)}\n`);

    // Buscar saldo interno
    const balance = await prisma.internalBalance.findUnique({
      where: {
        userId_cryptoType_network: {
          userId: order.userId,
          cryptoType: order.cryptoType,
          network: order.cryptoNetwork,
        },
      },
    });

    if (!balance) {
      console.log(`❌ Saldo interno não encontrado! Pulando...\n`);
      continue;
    }

    // Verificar se já existe transação DEDUCT para este pedido
    const existingDeduct = await prisma.collateralTransaction.findFirst({
      where: {
        balanceId: balance.id,
        orderId: order.id,
        type: 'DEDUCT',
      },
    });

    if (existingDeduct) {
      console.log(`✅ Transação DEDUCT já existe! Nada a fazer.\n`);
      continue;
    }

    console.log(`⚠️  Transação DEDUCT NÃO encontrada! Processando...\n`);

    // Calcular valores
    const currentBalance = parseFloat(balance.balance);
    const deductAmount = parseFloat(order.collateralLockedAmount!);
    const newBalance = currentBalance - deductAmount;
    const currentTotalUsed = parseFloat(balance.totalUsed);
    const newTotalUsed = currentTotalUsed + deductAmount;

    console.log(`📊 ANTES:`);
    console.log(`   Balance: ${currentBalance.toFixed(8)} ${order.cryptoType}`);
    console.log(`   TotalUsed: ${currentTotalUsed.toFixed(8)} ${order.cryptoType}\n`);

    console.log(`📊 DEPOIS:`);
    console.log(`   Balance: ${newBalance.toFixed(8)} ${order.cryptoType}`);
    console.log(`   TotalUsed: ${newTotalUsed.toFixed(8)} ${order.cryptoType}\n`);

    // Executar em transação atômica
    await prisma.$transaction(async (tx) => {
      // 1. Atualizar saldo
      await tx.internalBalance.update({
        where: { id: balance.id },
        data: {
          balance: newBalance.toFixed(8),
          totalUsed: newTotalUsed.toFixed(8),
          availableAmount: (newBalance - parseFloat(balance.lockedAmount)).toFixed(8),
        },
      });

      // 2. Criar transação DEDUCT
      await tx.collateralTransaction.create({
        data: {
          userId: order.userId,
          balanceId: balance.id,
          orderId: order.id,
          type: 'DEDUCT',
          amount: order.collateralLockedAmount!,
          balanceBefore: currentBalance.toFixed(8),
          balanceAfter: newBalance.toFixed(8),
          description: `Colateral gasto (pedido concluído ${order.id})`,
        },
      });
    });

    console.log(`✅ Saldo debitado e transação DEDUCT criada com sucesso!\n`);
  }

  console.log(`\n✅ Correção finalizada!\n`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
