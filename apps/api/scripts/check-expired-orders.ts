import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkExpiredOrders() {
  try {
    // Buscar usuário Nicolas (por email)
    const nicolas = await prisma.user.findFirst({
      where: {
        email: { contains: 'nkoutroularis' },
      },
    });

    if (!nicolas) {
      console.log('❌ Usuário Nicolas não encontrado. Buscando TODOS os pedidos auto-expirados...\n');

      // Buscar TODOS os pedidos auto-expirados
      const allExpiredOrders = await prisma.order.findMany({
        where: {
          status: 'CANCELLED',
          cancelReason: {
            in: ['AUTO_EXPIRED_BOLETO', 'AUTO_EXPIRED_PIX'],
          },
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (allExpiredOrders.length === 0) {
        console.log('❌ Nenhum pedido auto-expirado encontrado no sistema');
        return;
      }

      console.log(`✅ Encontrados ${allExpiredOrders.length} pedido(s) auto-expirado(s) de diversos usuários:\n`);

      for (const order of allExpiredOrders) {
        console.log(`📦 Pedido: ${order.id}`);
        console.log(`   Usuário: ${order.user.name} (${order.user.email})`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Motivo: ${order.cancelReason}`);
        console.log(`   Criado: ${order.createdAt}`);
        console.log(`   Expirou: ${order.timeoutAt}`);

        // Verificar notificação
        const notifications = await prisma.notification.findMany({
          where: {
            userId: order.userId,
            relatedId: order.id,
            type: 'ORDER_EXPIRED',
          },
        });

        if (notifications.length > 0) {
          console.log(`   ✅ Notificação encontrada`);
        } else {
          console.log(`   ❌ NOTIFICAÇÃO NÃO ENCONTRADA!`);
        }
        console.log('   ───────────────────────────────────\n');
      }

      return;
    }

    console.log(`\n📊 Verificando pedidos expirados de: ${nicolas.name} (${nicolas.email})\n`);

    // Buscar TODOS os pedidos cancelados
    const allCancelledOrders = await prisma.order.findMany({
      where: {
        userId: nicolas.id,
        status: 'CANCELLED',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log(`📦 Total de pedidos CANCELLED: ${allCancelledOrders.length}\n`);

    if (allCancelledOrders.length > 0) {
      console.log('🔍 Analisando motivos de cancelamento:\n');
      for (const order of allCancelledOrders) {
        console.log(`   Pedido: ${order.id}`);
        console.log(`   Motivo: ${order.cancelReason || 'NULL'}`);
        console.log(`   Criado: ${order.createdAt}`);
        console.log(`   Expirou em: ${order.timeoutAt}`);
        console.log(`   ---`);
      }
      console.log('');
    }

    // Buscar pedidos cancelados (auto-expirados)
    const expiredOrders = await prisma.order.findMany({
      where: {
        userId: nicolas.id,
        status: 'CANCELLED',
        OR: [
          { cancelReason: 'AUTO_EXPIRED_BOLETO' },
          { cancelReason: 'AUTO_EXPIRED_PIX' },
          { cancelReason: null, timeoutAt: { lt: new Date() } }, // Sem motivo mas expirados
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (expiredOrders.length === 0) {
      console.log('❌ Nenhum pedido auto-expirado encontrado');
      return;
    }

    console.log(`✅ Encontrados ${expiredOrders.length} pedido(s) auto-expirado(s):\n`);

    for (const order of expiredOrders) {
      console.log(`📦 Pedido: ${order.id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Motivo: ${order.cancelReason}`);
      console.log(`   Criado: ${order.createdAt}`);
      console.log(`   Expirou: ${order.timeoutAt}`);
      console.log('');

      // Verificar se há notificação
      const notifications = await prisma.notification.findMany({
        where: {
          userId: nicolas.id,
          relatedId: order.id,
          relatedType: 'ORDER',
          type: 'ORDER_EXPIRED',
        },
      });

      if (notifications.length > 0) {
        console.log(`   ✅ Notificação encontrada: ${notifications.length}`);
      } else {
        console.log(`   ❌ NOTIFICAÇÃO NÃO ENCONTRADA!`);
      }
      console.log('   ───────────────────────────────────');
    }

    // Resumo
    const ordersWithNotification = await Promise.all(
      expiredOrders.map(async (order) => {
        const notifications = await prisma.notification.findMany({
          where: {
            userId: nicolas.id,
            relatedId: order.id,
            type: 'ORDER_EXPIRED',
          },
        });
        return notifications.length > 0;
      })
    );

    const withNotif = ordersWithNotification.filter(Boolean).length;
    const withoutNotif = ordersWithNotification.length - withNotif;

    console.log(`\n📊 RESUMO:`);
    console.log(`   Total de pedidos expirados: ${expiredOrders.length}`);
    console.log(`   ✅ Com notificação: ${withNotif}`);
    console.log(`   ❌ SEM notificação: ${withoutNotif}`);

    if (withoutNotif > 0) {
      console.log(`\n⚠️  BUG CONFIRMADO: ${withoutNotif} pedido(s) expirado(s) sem notificação!`);
    }
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkExpiredOrders();
