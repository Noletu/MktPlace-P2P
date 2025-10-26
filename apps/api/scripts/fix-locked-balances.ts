/**
 * Script para Corrigir Saldos Bloqueados de Pedidos Órfãos
 *
 * PROBLEMA: Pedidos CANCELLED e COMPLETED com saldo interno bloqueado não foram processados corretamente:
 * - CANCELLED: Saldo deveria estar desbloqueado (disponível novamente)
 * - COMPLETED: Saldo deveria estar desbloqueado E debitado do total (gasto)
 *
 * Este script:
 * 1. Identifica pedidos CANCELLED com saldo bloqueado → Desbloqueia
 * 2. Identifica pedidos COMPLETED com saldo bloqueado → Desbloqueia + Debita
 *
 * COMO USAR:
 * cd apps/api
 * npx tsx scripts/fix-locked-balances.ts
 *
 * VERSÃO: 3.0.7
 * DATA: 25/10/2025
 */

import { PrismaClient } from '@prisma/client';
import { internalBalanceService } from '../src/services/internal-balance.service';

const prisma = new PrismaClient();

interface ProblemOrder {
  id: string;
  userId: string;
  status: string;
  cryptoType: string;
  cryptoNetwork: string;
  collateralLockedAmount: string;
  createdAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
}

async function main() {
  console.log('🔍 Iniciando correção de saldos bloqueados...\n');

  // 1. Buscar pedidos órfãos (CANCELLED ou COMPLETED com saldo bloqueado)
  const orphanOrders = await prisma.order.findMany({
    where: {
      collateralSource: 'INTERNAL_BALANCE',
      collateralLocked: true,
      status: {
        in: ['CANCELLED', 'COMPLETED'],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`📊 Total de pedidos órfãos encontrados: ${orphanOrders.length}\n`);

  if (orphanOrders.length === 0) {
    console.log('✅ Nenhum pedido órfão encontrado. Sistema está limpo!');
    return;
  }

  const cancelledOrders: ProblemOrder[] = [];
  const completedOrders: ProblemOrder[] = [];

  // Separar por status
  for (const order of orphanOrders) {
    const problemOrder: ProblemOrder = {
      id: order.id,
      userId: order.userId,
      status: order.status,
      cryptoType: order.cryptoType,
      cryptoNetwork: order.cryptoNetwork,
      collateralLockedAmount: order.collateralLockedAmount || '0',
      createdAt: order.createdAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
    };

    if (order.status === 'CANCELLED') {
      cancelledOrders.push(problemOrder);
    } else if (order.status === 'COMPLETED') {
      completedOrders.push(problemOrder);
    }
  }

  console.log(`🔴 Pedidos CANCELLED com saldo bloqueado: ${cancelledOrders.length}`);
  console.log(`✅ Pedidos COMPLETED com saldo bloqueado: ${completedOrders.length}\n`);

  // 2. Processar pedidos CANCELLED (apenas desbloquear)
  if (cancelledOrders.length > 0) {
    console.log('🔧 Processando pedidos CANCELLED...\n');

    for (const order of cancelledOrders) {
      console.log(`\n📝 Processando pedido CANCELLED ${order.id}...`);
      console.log(`   Valor bloqueado: ${order.collateralLockedAmount} ${order.cryptoType}`);
      console.log(`   Cancelado em: ${order.cancelledAt?.toISOString()}`);

      try {
        // Desbloquear saldo
        await internalBalanceService.unlockBalance(
          order.userId,
          order.cryptoType,
          order.cryptoNetwork,
          order.collateralLockedAmount,
          order.id
        );

        // Atualizar pedido para marcar que foi corrigido
        await prisma.order.update({
          where: { id: order.id },
          data: {
            collateralLocked: false,
          },
        });

        console.log(`   ✅ Saldo desbloqueado com sucesso!`);
      } catch (error: any) {
        console.error(`   ❌ Erro ao desbloquear saldo:`, error.message);
      }
    }
  }

  // 3. Processar pedidos COMPLETED (desbloquear + debitar)
  if (completedOrders.length > 0) {
    console.log('\n\n🔧 Processando pedidos COMPLETED...\n');

    for (const order of completedOrders) {
      console.log(`\n📝 Processando pedido COMPLETED ${order.id}...`);
      console.log(`   Valor bloqueado: ${order.collateralLockedAmount} ${order.cryptoType}`);
      console.log(`   Concluído em: ${order.completedAt?.toISOString()}`);

      try {
        // 1. Desbloquear saldo
        await internalBalanceService.unlockBalance(
          order.userId,
          order.cryptoType,
          order.cryptoNetwork,
          order.collateralLockedAmount,
          order.id
        );

        console.log(`   🔓 Saldo desbloqueado`);

        // 2. Debitar do saldo total (consumir o colateral)
        await internalBalanceService.deductBalance(
          order.userId,
          order.cryptoType,
          order.cryptoNetwork,
          order.collateralLockedAmount
        );

        console.log(`   💸 Saldo debitado (gasto)`);

        // Atualizar pedido para marcar que foi corrigido
        await prisma.order.update({
          where: { id: order.id },
          data: {
            collateralLocked: false,
          },
        });

        console.log(`   ✅ Pedido corrigido com sucesso!`);
      } catch (error: any) {
        console.error(`   ❌ Erro ao processar saldo:`, error.message);
      }
    }
  }

  console.log('\n\n📊 Resumo da Correção:');
  console.log(`   Pedidos CANCELLED processados: ${cancelledOrders.length}`);
  console.log(`   Pedidos COMPLETED processados: ${completedOrders.length}`);
  console.log(`   Total de pedidos corrigidos: ${orphanOrders.length}\n`);

  console.log('✅ Correção concluída!\n');
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
