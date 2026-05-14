import { PrismaClient } from '@prisma/client';

const BACKUP_DB_PATH = '/home/nicode/MktPlace-P2P/apps/api/prisma/dev.db.backup-2025-10-27';
const CURRENT_DB_PATH = '/home/nicode/MktPlace-P2P/apps/api/prisma/dev.db';

const NICOLAS_ID = 'cmgl9hauq0000rnbhosvjijm2';
const BRUNA_ID = 'cmgla5rol000ilaysd4j8rrsd';

async function checkBackupDatabase() {
  console.log('🔍 Verificando banco de dados de backup (27 de outubro)...\n');

  // Conectar ao backup
  const backupPrisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${BACKUP_DB_PATH}`,
      },
    },
  });

  // Conectar ao banco atual
  const currentPrisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${CURRENT_DB_PATH}`,
      },
    },
  });

  try {
    console.log('📊 BACKUP (27 de outubro):');
    console.log('─'.repeat(60));

    // Verificar pedidos no backup
    const backupOrders = await backupPrisma.order.findMany({
      where: {
        OR: [
          { userId: NICOLAS_ID },
          { userId: BRUNA_ID },
        ],
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
      },
    });

    console.log(`Total de pedidos: ${backupOrders.length}`);
    console.log(`  Nicolas: ${backupOrders.filter((o) => o.userId === NICOLAS_ID).length}`);
    console.log(`  Bruna: ${backupOrders.filter((o) => o.userId === BRUNA_ID).length}\n`);

    if (backupOrders.length > 0) {
      console.log('Pedidos encontrados no backup:');
      backupOrders.forEach((order, i) => {
        const owner = order.userId === NICOLAS_ID ? 'Nicolas' : 'Bruna';
        console.log(
          `  ${i + 1}. [${owner}] ${order.type} - ${order.cryptoAmount} ${order.cryptoType} = R$ ${order.brlAmount}`
        );
        console.log(`     Status: ${order.status}, Criado: ${order.createdAt.toISOString().split('T')[0]}`);
      });
      console.log('');
    }

    // Verificar transações no backup
    const backupTransactions = await backupPrisma.transaction.findMany({
      where: {
        OR: [
          { order: { userId: NICOLAS_ID } },
          { order: { userId: BRUNA_ID } },
          { payerId: NICOLAS_ID },
          { payerId: BRUNA_ID },
        ],
      },
    });

    console.log(`Total de transações: ${backupTransactions.length}\n`);

    // Verificar colateral no backup
    const backupCollateral = await backupPrisma.collateralTransaction.findMany({
      where: {
        OR: [{ userId: NICOLAS_ID }, { userId: BRUNA_ID }],
      },
    });

    console.log(`Total de transações de colateral: ${backupCollateral.length}\n`);

    console.log('─'.repeat(60));
    console.log('\n📊 BANCO ATUAL:');
    console.log('─'.repeat(60));

    // Verificar pedidos atuais
    const currentOrders = await currentPrisma.order.findMany({
      where: {
        OR: [
          { userId: NICOLAS_ID },
          { userId: BRUNA_ID },
        ],
      },
    });

    console.log(`Total de pedidos: ${currentOrders.length}`);
    console.log(`  Nicolas: ${currentOrders.filter((o) => o.userId === NICOLAS_ID).length}`);
    console.log(`  Bruna: ${currentOrders.filter((o) => o.userId === BRUNA_ID).length}\n`);

    console.log('─'.repeat(60));
    console.log('\n📈 COMPARAÇÃO:');
    console.log('─'.repeat(60));

    const diff = {
      orders: backupOrders.length - currentOrders.length,
      transactions: backupTransactions.length,
      collateral: backupCollateral.length,
    };

    console.log(`Diferença de pedidos: ${diff.orders > 0 ? '+' : ''}${diff.orders}`);
    console.log(`Transações no backup: ${diff.transactions}`);
    console.log(`Colateral no backup: ${diff.collateral}\n`);

    if (diff.orders > 0) {
      console.log('✅ O backup contém mais dados históricos!');
      console.log(
        `   Você pode restaurar o backup para recuperar ${diff.orders} pedido(s) perdido(s).\n`
      );
    } else {
      console.log('ℹ️  O banco atual tem a mesma quantidade ou mais pedidos.\n');
    }
  } catch (error) {
    console.error('❌ Erro ao verificar backup:', error);
  } finally {
    await backupPrisma.$disconnect();
    await currentPrisma.$disconnect();
  }
}

checkBackupDatabase()
  .then(() => {
    console.log('✅ Verificação concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
