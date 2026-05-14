import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NICOLAS_ID = 'cmgl9hauq0000rnbhosvjijm2';
const BRUNA_ID = 'cmgla5rol000ilaysd4j8rrsd';

async function showAllOrders() {
  console.log('📋 HISTÓRICO COMPLETO DE PEDIDOS\n');
  console.log('═'.repeat(80));

  try {
    const allOrders = await prisma.order.findMany({
      where: {
        OR: [{ userId: NICOLAS_ID }, { userId: BRUNA_ID }],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        cryptoType: true,
        cryptoAmount: true,
        brlAmount: true,
        status: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`\n📊 Total: ${allOrders.length} pedidos`);
    console.log(`   Nicolas: ${allOrders.filter((o) => o.userId === NICOLAS_ID).length}`);
    console.log(`   Bruna: ${allOrders.filter((o) => o.userId === BRUNA_ID).length}\n`);
    console.log('═'.repeat(80));

    // Agrupar por mês
    const byMonth: Record<string, typeof allOrders> = {};
    allOrders.forEach((order) => {
      const month = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(order);
    });

    // Exibir por mês
    Object.keys(byMonth)
      .sort()
      .forEach((month) => {
        const monthOrders = byMonth[month];
        const monthName = new Date(month + '-01').toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric',
        });

        console.log(`\n📅 ${monthName.toUpperCase()} (${monthOrders.length} pedidos)`);
        console.log('─'.repeat(80));

        monthOrders.forEach((order, i) => {
          const date = order.createdAt.toLocaleDateString('pt-BR');
          const time = order.createdAt.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const owner = order.userId === NICOLAS_ID ? '👤 Nicolas' : '👤 Bruna';

          console.log(`\n${i + 1}. ${owner} - ${date} ${time}`);
          console.log(
            `   ${order.type === 'BUY' ? '💵 Compra' : '💰 Venda'}: ${order.cryptoAmount} ${order.cryptoType} = R$ ${order.brlAmount}`
          );

          let statusEmoji = '';
          let statusText = order.status;
          switch (order.status) {
            case 'COMPLETED':
              statusEmoji = '✅';
              statusText = 'Concluído';
              break;
            case 'CANCELLED':
              statusEmoji = '❌';
              statusText = 'Cancelado';
              break;
            case 'PAYMENT_SENT':
              statusEmoji = '💸';
              statusText = 'Pagamento Enviado';
              break;
            case 'PENDING':
              statusEmoji = '⏳';
              statusText = 'Pendente';
              break;
            case 'MATCHED':
              statusEmoji = '🤝';
              statusText = 'Pareado';
              break;
            default:
              statusEmoji = '📌';
          }

          console.log(`   Status: ${statusEmoji} ${statusText}`);
          console.log(`   ID: ${order.id}`);
        });
      });

    // Estatísticas
    console.log('\n');
    console.log('═'.repeat(80));
    console.log('📊 ESTATÍSTICAS');
    console.log('═'.repeat(80));

    const stats = {
      total: allOrders.length,
      completed: allOrders.filter((o) => o.status === 'COMPLETED').length,
      cancelled: allOrders.filter((o) => o.status === 'CANCELLED').length,
      paymentSent: allOrders.filter((o) => o.status === 'PAYMENT_SENT').length,
      pending: allOrders.filter((o) => o.status === 'PENDING').length,
      buys: allOrders.filter((o) => o.type === 'BUY').length,
      sells: allOrders.filter((o) => o.type === 'SELL').length,
    };

    console.log(`\n Por Status:`);
    console.log(`   ✅ Concluídos: ${stats.completed}`);
    console.log(`   ❌ Cancelados: ${stats.cancelled}`);
    console.log(`   💸 Pagamento Enviado: ${stats.paymentSent}`);
    console.log(`   ⏳ Pendentes: ${stats.pending}`);

    console.log(`\n Por Tipo:`);
    console.log(`   💵 Compras: ${stats.buys}`);
    console.log(`   💰 Vendas: ${stats.sells}`);

    const totalBRL = allOrders.reduce((sum, o) => sum + parseFloat(o.brlAmount), 0);
    const totalBTC = allOrders.reduce((sum, o) => sum + parseFloat(o.cryptoAmount), 0);

    console.log(`\n Volume Total:`);
    console.log(`   R$ ${totalBRL.toFixed(2)}`);
    console.log(`   ${totalBTC.toFixed(8)} BTC`);
    console.log('');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showAllOrders()
  .then(() => {
    console.log('✅ Relatório concluído!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
