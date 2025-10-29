#!/usr/bin/env tsx
/**
 * Script para corrigir saldos bloqueados órfãos (pedidos completados mas com collateralLocked=true)
 * VERSÃO ATÔMICA: Todas as operações em uma única transação
 */

import { prisma } from '../src/utils/prisma';
import { CollateralTransactionType } from '../src/services/collateral-transaction.service';

async function fixOrphanedBalances() {
  console.log('🔍 Buscando pedidos órfãos (COMPLETED mas com collateralLocked=true)...\n');

  // Buscar pedidos completados com colateral ainda bloqueado
  const orphanedOrders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      collateralSource: 'INTERNAL_BALANCE',
      collateralLocked: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (orphanedOrders.length === 0) {
    console.log('✅ Nenhum pedido órfão encontrado! Todos os saldos estão corretos.\n');
    return;
  }

  console.log(`⚠️  Encontrados ${orphanedOrders.length} pedidos órfãos:\n`);

  for (const order of orphanedOrders) {
    console.log(`📦 Pedido: ${order.id}`);
    console.log(`   Usuário: ${order.user.name} (${order.user.email})`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Valor bloqueado: ${order.collateralLockedAmount} ${order.cryptoType}`);
    console.log(`   Data completado: ${order.completedAt}`);
    console.log('');
  }

  console.log('🚀 Iniciando correção atômica...\n');

  let fixed = 0;
  let errors = 0;

  for (const order of orphanedOrders) {
    try {
      console.log(`🔧 Processando pedido ${order.id}...`);

      // TRANSAÇÃO ATÔMICA: Todas as operações juntas
      await prisma.$transaction(async (tx) => {
        // 1. Marcar pedido como desbloqueado
        await tx.order.update({
          where: { id: order.id },
          data: {
            collateralLocked: false,
            collateralUnlockedAt: new Date(),
          },
        });

        console.log(`   ✅ Pedido marcado como desbloqueado`);

        // 2. Processar saldo interno
        const amountNum = parseFloat(order.collateralLockedAmount!);

        // Buscar saldo interno
        const balance = await tx.internalBalance.findUnique({
          where: {
            userId_cryptoType_network: {
              userId: order.userId,
              cryptoType: order.cryptoType,
              network: order.cryptoNetwork,
            },
          },
        });

        if (!balance) {
          throw new Error(`Saldo interno não encontrado para ${order.cryptoType}/${order.cryptoNetwork}`);
        }

        const total = parseFloat(balance.balance);
        const locked = parseFloat(balance.lockedAmount);
        const totalUsed = parseFloat(balance.totalUsed);

        // Calcular novos valores
        const newTotal = total - amountNum;
        const newLocked = Math.max(0, locked - amountNum);
        const newAvailable = newTotal - newLocked;
        const newTotalUsed = totalUsed + amountNum;

        // 3. Atualizar InternalBalance (deduct + unlock)
        await tx.internalBalance.update({
          where: { id: balance.id },
          data: {
            balance: newTotal.toFixed(8),
            lockedAmount: newLocked.toFixed(8),
            availableAmount: newAvailable.toFixed(8),
            totalUsed: newTotalUsed.toFixed(8),
          },
        });

        console.log(`   💸 Colateral deduzido: ${order.collateralLockedAmount} ${order.cryptoType}`);
        console.log(`      Saldo total: ${total.toFixed(8)} → ${newTotal.toFixed(8)}`);
        console.log(`      Bloqueado: ${locked.toFixed(8)} → ${newLocked.toFixed(8)}`);
        console.log(`      Disponível: ${newAvailable.toFixed(8)}`);

        // 4. Criar registro de auditoria
        await tx.collateralTransaction.create({
          data: {
            userId: order.userId,
            balanceId: balance.id,
            type: CollateralTransactionType.DEDUCT,
            amount: order.collateralLockedAmount!,
            balanceBefore: balance.balance,
            balanceAfter: newTotal.toFixed(8),
            orderId: order.id,
            network: order.cryptoNetwork,
            description: `[CORREÇÃO] Colateral deduzido de pedido órfão ${order.id}`,
          },
        });

        console.log(`   📝 Registro de auditoria criado`);
      }, {
        timeout: 60000,
        maxWait: 20000,
      });

      fixed++;
      console.log(`   ✅ Pedido ${order.id} corrigido com sucesso!\n`);
    } catch (error: any) {
      errors++;
      console.error(`   ❌ Erro ao processar pedido ${order.id}:`, error.message);
      console.error(`      Stack:`, error.stack);
      console.log('');
    }
  }

  console.log('\n📊 RESUMO DA CORREÇÃO:');
  console.log(`   Total órfãos encontrados: ${orphanedOrders.length}`);
  console.log(`   ✅ Corrigidos com sucesso: ${fixed}`);
  console.log(`   ❌ Erros: ${errors}`);
  console.log('');

  if (fixed > 0) {
    console.log('🎉 Correção concluída! Os saldos foram liberados.');
  }
}

// Executar
fixOrphanedBalances()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
