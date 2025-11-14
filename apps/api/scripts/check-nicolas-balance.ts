import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigate() {
  // Buscar Nicolas
  const nicolas = await prisma.user.findFirst({
    where: { email: { contains: 'nkoutroularis' } },
    include: {
      internalBalances: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!nicolas) {
    console.log('❌ Usuário Nicolas não encontrado');
    await prisma.$disconnect();
    return;
  }

  console.log('👤 Usuário: Nicolas');
  console.log('📧 Email:', nicolas.email);
  console.log('🆔 ID:', nicolas.id);
  console.log('');
  console.log('💰 SALDO INTERNO (Internal Balance):');
  console.log('════════════════════════════════════════');

  if (nicolas.internalBalances.length === 0) {
    console.log('❌ Nenhum saldo encontrado');
  } else {
    for (const balance of nicolas.internalBalances) {
      const blocked = parseFloat(balance.lockedAmount);
      const available = parseFloat(balance.availableAmount);
      const total = parseFloat(balance.balance);

      console.log('');
      console.log(`💎 ${balance.cryptoType} (${balance.network})`);
      console.log(`   Saldo Total: ${balance.balance}`);
      console.log(`   Disponível: ${balance.availableAmount}`);
      console.log(`   Bloqueado: ${balance.lockedAmount}`);
      console.log(`   Total Depositado: ${balance.totalDeposited}`);
      console.log(`   Total Usado: ${balance.totalUsed}`);

      if (blocked > 0) {
        console.log('');
        console.log('   ⚠️ HÁ SALDO BLOQUEADO! Investigando pedidos...');
      }
    }
  }

  console.log('');
  console.log('');
  console.log('📋 PEDIDOS DE NICOLAS (últimos 10):');
  console.log('════════════════════════════════════════');

  if (nicolas.orders.length === 0) {
    console.log('❌ Nenhum pedido encontrado');
  } else {
    for (const order of nicolas.orders) {
      console.log('');
      console.log(`📦 Pedido: ${order.id.substring(0, 8)}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Tipo: ${order.type}`);
      console.log(`   Valor Crypto: ${order.cryptoAmount} ${order.cryptoType}`);
      console.log(`   Valor BRL: R$ ${parseFloat(order.brlAmount).toFixed(2)}`);
      console.log(`   Criado: ${order.createdAt.toLocaleString()}`);

      if (order.status === 'PENDING' || order.status === 'MATCHED') {
        console.log(`   ⏰ Expira: ${order.timeoutAt ? order.timeoutAt.toLocaleString() : 'N/A'}`);
      }

      if (order.cancelledAt) {
        console.log(`   ❌ Cancelado: ${order.cancelledAt.toLocaleString()}`);
        console.log(`   Motivo: ${order.cancelReason || 'N/A'}`);
      }
    }
  }

  console.log('');
  console.log('');
  console.log('🔍 ANÁLISE:');
  console.log('════════════════════════════════════════');

  // Contar pedidos ativos
  const activeOrders = nicolas.orders.filter(o =>
    o.status === 'PENDING' || o.status === 'MATCHED' || o.status === 'PAYMENT_SENT' || o.status === 'VALIDATING'
  );

  console.log(`Pedidos ATIVOS (PENDING/MATCHED/PAYMENT_SENT/VALIDATING): ${activeOrders.length}`);

  if (activeOrders.length > 0) {
    console.log('');
    console.log('Detalhes dos pedidos ativos:');
    for (const order of activeOrders) {
      console.log(`  - ${order.id.substring(0, 8)}: ${order.status} - ${order.cryptoAmount} ${order.cryptoType}`);
    }
  }

  // Verificar se há saldo bloqueado mas sem pedidos ativos
  const totalBlocked = nicolas.internalBalances.reduce((sum, b) => sum + parseFloat(b.lockedAmount), 0);

  if (totalBlocked > 0 && activeOrders.length === 0) {
    console.log('');
    console.log('⚠️⚠️⚠️ PROBLEMA IDENTIFICADO! ⚠️⚠️⚠️');
    console.log(`Há ${totalBlocked} de saldo bloqueado mas NENHUM pedido ativo!`);
    console.log('Isso indica que um pedido foi cancelado/finalizado mas o saldo não foi liberado.');
  } else if (totalBlocked > 0 && activeOrders.length > 0) {
    console.log('');
    console.log('✅ Saldo bloqueado corresponde aos pedidos ativos');
  } else {
    console.log('');
    console.log('✅ Nenhum saldo bloqueado - Tudo OK!');
  }

  await prisma.$disconnect();
}

investigate().catch(console.error);
