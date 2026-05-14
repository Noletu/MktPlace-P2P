import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para desbloquear saldo que ficou bloqueado em pedidos cancelados/completados
 */
async function fixStuckBalance() {
  console.log('🔧 CORRIGINDO SALDO BLOQUEADO INDEVIDAMENTE\n');

  const nicolas = await prisma.user.findFirst({
    where: { email: { contains: 'nkoutroularis' } },
  });

  if (!nicolas) {
    console.log('❌ Usuário não encontrado');
    await prisma.$disconnect();
    return;
  }

  // Buscar pedidos que estão CANCELLED ou COMPLETED mas ainda têm collateralLocked = true
  const stuckOrders = await prisma.order.findMany({
    where: {
      userId: nicolas.id,
      status: { in: ['CANCELLED', 'COMPLETED'] },
      collateralLocked: true,
      collateralSource: 'INTERNAL_BALANCE',
    },
  });

  console.log(`Encontrados ${stuckOrders.length} pedidos com saldo bloqueado indevidamente:\n`);

  if (stuckOrders.length === 0) {
    console.log('✅ Nenhum problema encontrado!');
    await prisma.$disconnect();
    return;
  }

  for (const order of stuckOrders) {
    console.log(`📦 Pedido: ${order.id.substring(0, 8)}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Valor Bloqueado: ${order.collateralLockedAmount} ${order.cryptoType}`);
    console.log(`   Criado: ${order.createdAt}`);
    console.log(`   Cancelado: ${order.cancelledAt || 'N/A'}`);
  }

  console.log('\n');
  console.log('🔄 Iniciando correção...\n');

  // Usar transação para garantir consistência
  await prisma.$transaction(async (tx) => {
    for (const order of stuckOrders) {
      console.log(`🔓 Desbloqueando: ${order.id.substring(0, 8)}...`);

      // 1. Atualizar o pedido para marcar como desbloqueado
      await tx.order.update({
        where: { id: order.id },
        data: {
          collateralLocked: false,
        },
      });

      // 2. Desbloquear o saldo no InternalBalance
      const balance = await tx.internalBalance.findFirst({
        where: {
          userId: nicolas.id,
          cryptoType: order.cryptoType,
          network: order.cryptoNetwork,
        },
      });

      if (!balance) {
        console.log(`   ❌ Saldo interno não encontrado para ${order.cryptoType}/${order.cryptoNetwork}`);
        continue;
      }

      const currentLocked = parseFloat(balance.lockedAmount);
      const amountToUnlock = parseFloat(order.collateralLockedAmount);
      const newLocked = Math.max(0, currentLocked - amountToUnlock);
      const newAvailable = parseFloat(balance.balance) - newLocked;

      console.log(`   Locked antes: ${balance.lockedAmount}`);
      console.log(`   Desbloqueando: ${order.collateralLockedAmount}`);
      console.log(`   Locked depois: ${newLocked.toFixed(8)}`);
      console.log(`   Disponível depois: ${newAvailable.toFixed(8)}`);

      await tx.internalBalance.update({
        where: { id: balance.id },
        data: {
          lockedAmount: newLocked.toFixed(8),
          availableAmount: newAvailable.toFixed(8),
        },
      });

      console.log(`   ✅ Saldo desbloqueado com sucesso!\n`);
    }
  });

  console.log('✅ CORREÇÃO FINALIZADA!\n');

  // Verificar resultado final
  const finalBalance = await prisma.internalBalance.findFirst({
    where: {
      userId: nicolas.id,
      cryptoType: 'BTC',
    },
  });

  if (finalBalance) {
    console.log('💰 SALDO FINAL:');
    console.log(`   Total: ${finalBalance.balance} BTC`);
    console.log(`   Disponível: ${finalBalance.availableAmount} BTC`);
    console.log(`   Bloqueado: ${finalBalance.lockedAmount} BTC`);
  }

  await prisma.$disconnect();
}

fixStuckBalance().catch((error) => {
  console.error('❌ Erro:', error);
  process.exit(1);
});
