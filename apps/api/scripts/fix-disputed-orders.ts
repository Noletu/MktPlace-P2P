import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDisputedOrders() {
  console.log('🔍 Buscando pedidos com disputa resolvida mas status DISPUTED...\n');

  // Buscar todos os pedidos em DISPUTED
  const disputedOrders = await prisma.order.findMany({
    where: { status: 'DISPUTED' },
    include: {
      disputes: {
        where: {
          status: {
            in: ['RESOLVED_BUYER', 'RESOLVED_SELLER', 'CANCELLED']
          }
        },
        include: {
          resolver: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  console.log(`📋 Encontrados ${disputedOrders.length} pedidos com status DISPUTED`);

  if (disputedOrders.length === 0) {
    console.log('✅ Nenhum pedido precisa de correção!');
    await prisma.$disconnect();
    return;
  }

  let fixed = 0;

  for (const order of disputedOrders) {
    if (order.disputes.length > 0) {
      const dispute = order.disputes[0];
      let newStatus = 'CANCELLED';

      // Determinar novo status baseado na resolução
      if (dispute.status === 'RESOLVED_SELLER') {
        newStatus = 'COMPLETED';
      } else if (dispute.status === 'RESOLVED_BUYER' || dispute.status === 'CANCELLED') {
        newStatus = 'CANCELLED';
      }

      console.log(`\n📝 Pedido: ${order.id}`);
      console.log(`   Disputa resolvida por: ${dispute.resolver?.name || 'Admin'}`);
      console.log(`   Status da disputa: ${dispute.status}`);
      console.log(`   ✅ Corrigindo: DISPUTED → ${newStatus}`);

      await prisma.order.update({
        where: { id: order.id },
        data: { status: newStatus }
      });

      fixed++;
    }
  }

  console.log(`\n🎉 Correção concluída: ${fixed} pedidos atualizados!`);
  console.log('✅ Os pedidos agora mostram o status correto no frontend.\n');

  await prisma.$disconnect();
}

fixDisputedOrders()
  .catch((e) => {
    console.error('❌ Erro ao corrigir pedidos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
