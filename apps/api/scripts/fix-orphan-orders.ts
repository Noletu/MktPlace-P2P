/**
 * Script para Corrigir Pedidos Órfãos
 *
 * PROBLEMA: Devido ao bug v0.3.5 de transaction timeout, alguns pedidos foram criados
 * com saldo interno MAS o saldo não foi bloqueado (transaction falhou parcialmente).
 *
 * Este script:
 * 1. Identifica pedidos criados com collateralSource='INTERNAL_BALANCE'
 * 2. Verifica se o saldo foi bloqueado corretamente
 * 3. Oferece opções:
 *    - OPÇÃO A: Bloquear saldo retroativamente (se disponível)
 *    - OPÇÃO B: Cancelar pedido (se saldo insuficiente)
 *
 * COMO USAR:
 * cd apps/api
 * npx tsx scripts/fix-orphan-orders.ts
 *
 * VERSÃO: 0.3.6
 * DATA: 25/10/2025
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OrphanOrder {
  id: string;
  userId: string;
  cryptoType: string;
  cryptoNetwork: string;
  collateralLockedAmount: string;
  createdAt: Date;
  status: string;
  internalBalanceId: string | null;
}

async function main() {
  console.log('🔍 Iniciando verificação de pedidos órfãos...\n');

  // 1. Buscar pedidos criados com saldo interno
  const ordersWithInternalBalance = await prisma.order.findMany({
    where: {
      collateralSource: 'INTERNAL_BALANCE',
      collateralConfirmed: true,
      status: {
        in: ['PENDING', 'IN_NEGOTIATION'], // Apenas pedidos ativos
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`📊 Total de pedidos com saldo interno: ${ordersWithInternalBalance.length}`);

  if (ordersWithInternalBalance.length === 0) {
    console.log('✅ Nenhum pedido encontrado. Sistema está limpo!');
    return;
  }

  const orphanOrders: OrphanOrder[] = [];

  // 2. Verificar cada pedido
  for (const order of ordersWithInternalBalance) {
    // Verificar se existe registro de LOCK na CollateralTransaction
    const lockTransaction = await prisma.collateralTransaction.findFirst({
      where: {
        orderId: order.id,
        type: 'LOCK',
      },
    });

    if (!lockTransaction) {
      console.log(`⚠️  Pedido órfão encontrado: ${order.id}`);
      console.log(`   - Criado em: ${order.createdAt.toISOString()}`);
      console.log(`   - Status: ${order.status}`);
      console.log(`   - Valor bloqueado esperado: ${order.collateralLockedAmount} ${order.cryptoType}`);
      console.log(`   - ❌ SEM registro de bloqueio de saldo!\n`);

      orphanOrders.push({
        id: order.id,
        userId: order.userId,
        cryptoType: order.cryptoType,
        cryptoNetwork: order.cryptoNetwork,
        collateralLockedAmount: order.collateralLockedAmount || '0',
        createdAt: order.createdAt,
        status: order.status,
        internalBalanceId: order.internalBalanceId,
      });
    }
  }

  console.log(`\n🐛 Total de pedidos órfãos: ${orphanOrders.length}`);

  if (orphanOrders.length === 0) {
    console.log('✅ Todos os pedidos estão com saldo bloqueado corretamente!');
    return;
  }

  // 3. Processar pedidos órfãos
  console.log('\n🔧 Iniciando correção automática...\n');

  for (const orphan of orphanOrders) {
    console.log(`\n📝 Processando pedido ${orphan.id}...`);

    // Buscar saldo interno do usuário
    const balance = await prisma.internalBalance.findUnique({
      where: {
        userId_cryptoType_network: {
          userId: orphan.userId,
          cryptoType: orphan.cryptoType,
          network: orphan.cryptoNetwork,
        },
      },
    });

    if (!balance) {
      console.log(`   ❌ Saldo interno não encontrado. Cancelando pedido...`);
      await cancelOrder(orphan.id);
      continue;
    }

    const currentTotal = parseFloat(balance.balance);
    const currentLocked = parseFloat(balance.lockedAmount);
    const available = currentTotal - currentLocked;
    const required = parseFloat(orphan.collateralLockedAmount);

    console.log(`   💰 Saldo disponível: ${available.toFixed(8)} ${orphan.cryptoType}`);
    console.log(`   🎯 Necessário: ${required.toFixed(8)} ${orphan.cryptoType}`);

    if (available >= required) {
      // OPÇÃO A: Bloquear saldo retroativamente
      console.log(`   ✅ Saldo suficiente! Bloqueando retroativamente...`);
      await lockBalanceForOrder(orphan, balance);
    } else {
      // OPÇÃO B: Cancelar pedido
      console.log(`   ❌ Saldo insuficiente. Cancelando pedido...`);
      await cancelOrder(orphan.id);
    }
  }

  console.log('\n✅ Correção concluída!\n');
}

/**
 * Bloquear saldo retroativamente para pedido órfão
 */
async function lockBalanceForOrder(orphan: OrphanOrder, balance: any) {
  const requiredAmount = parseFloat(orphan.collateralLockedAmount);
  const currentLocked = parseFloat(balance.lockedAmount);
  const currentTotal = parseFloat(balance.balance);
  const newLocked = currentLocked + requiredAmount;
  const newAvailable = currentTotal - newLocked;

  await prisma.$transaction(async (tx) => {
    // 1. Atualizar saldo bloqueado
    await tx.internalBalance.update({
      where: { id: balance.id },
      data: {
        lockedAmount: newLocked.toFixed(8),
        availableAmount: newAvailable.toFixed(8),
        totalUsed: (parseFloat(balance.totalUsed) + requiredAmount).toFixed(8),
      },
    });

    // 2. Registrar transação de colateral
    await tx.collateralTransaction.create({
      data: {
        userId: orphan.userId,
        balanceId: balance.id,
        orderId: orphan.id,
        type: 'LOCK',
        amount: orphan.collateralLockedAmount,
        balanceBefore: currentLocked.toFixed(8),
        balanceAfter: newLocked.toFixed(8),
        network: orphan.cryptoNetwork,
        description: `[CORREÇÃO] Colateral bloqueado retroativamente para pedido órfão ${orphan.id}`,
      },
    });

    console.log(`   ✅ Saldo bloqueado: ${orphan.collateralLockedAmount} ${orphan.cryptoType}`);
    console.log(`   📝 Transação de colateral registrada`);
  });
}

/**
 * Cancelar pedido órfão
 */
async function cancelOrder(orderId: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: '[AUTOMÁTICO] Pedido órfão corrigido - Saldo não foi bloqueado durante criação (bug v0.3.5)',
    },
  });

  console.log(`   ✅ Pedido ${orderId} cancelado`);
}

// Executar script
main()
  .then(() => {
    console.log('🎉 Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
