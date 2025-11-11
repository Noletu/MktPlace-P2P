import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para limpar pedidos em status IN_NEGOTIATION
 * Após remover funcionalidade de negociação pré-match, pedidos devem voltar para PENDING
 */
async function cleanupInNegotiationOrders() {
  console.log('🧹 Iniciando limpeza de pedidos IN_NEGOTIATION...\n');

  try {
    // Buscar todos os pedidos IN_NEGOTIATION
    const orders = await prisma.order.findMany({
      where: {
        status: 'IN_NEGOTIATION',
      },
    });

    console.log(`📊 Encontrados ${orders.length} pedidos em status IN_NEGOTIATION\n`);

    if (orders.length === 0) {
      console.log('✅ Nenhum pedido para limpar. Tudo OK!\n');
      return;
    }

    // Listar os pedidos encontrados
    orders.forEach((order, index) => {
      console.log(`${index + 1}. Pedido ${order.id}`);
      console.log(`   - Criado por: ${order.userId}`);
      console.log(`   - Tipo: ${order.type}`);
      console.log(`   - Valor BRL: R$ ${order.brlAmount}`);
      console.log(`   - Crypto: ${order.cryptoAmount} ${order.cryptoType}`);
      if ((order as any).negotiatingUserId) {
        console.log(`   - Em negociação com: ${(order as any).negotiatingUserId}`);
      }
      console.log('');
    });

    // Atualizar todos os pedidos para PENDING
    const result = await prisma.order.updateMany({
      where: {
        status: 'IN_NEGOTIATION',
      },
      data: {
        status: 'PENDING',
        // Limpar campos de negociação (se existirem)
        negotiatingUserId: null,
        negotiationStartedAt: null,
      },
    });

    console.log(`✅ ${result.count} pedidos atualizados para status PENDING\n`);
    console.log('🎉 Limpeza concluída com sucesso!\n');
    console.log('ℹ️  Estes pedidos agora estão novamente disponíveis no marketplace.\n');

  } catch (error) {
    console.error('❌ Erro ao limpar pedidos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
cleanupInNegotiationOrders()
  .then(() => {
    console.log('Script finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script falhou:', error);
    process.exit(1);
  });
