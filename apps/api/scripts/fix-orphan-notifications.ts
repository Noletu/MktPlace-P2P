import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrphanNotifications() {
  console.log('🔍 Starting orphan notifications cleanup...\n');

  try {
    // 1. Buscar todas as notificações relacionadas a pedidos
    const orderNotifications = await prisma.notification.findMany({
      where: {
        relatedType: 'ORDER',
        relatedId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        relatedId: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    console.log(`📊 Found ${orderNotifications.length} notifications related to orders\n`);

    // 2. Buscar todos os IDs de pedidos existentes
    const allOrders = await prisma.order.findMany({
      select: { id: true },
    });
    const validOrderIds = new Set(allOrders.map((o) => o.id));

    console.log(`✅ Found ${validOrderIds.size} valid orders in database\n`);

    // 3. Identificar notificações órfãs
    const orphanedNotifications = orderNotifications.filter(
      (notif) => !validOrderIds.has(notif.relatedId!)
    );

    if (orphanedNotifications.length === 0) {
      console.log('✨ No orphaned notifications found. Database is clean!\n');
      return;
    }

    console.log(`⚠️  Found ${orphanedNotifications.length} orphaned notifications:\n`);

    // 4. Exibir detalhes das notificações órfãs
    orphanedNotifications.forEach((notif, index) => {
      console.log(`${index + 1}. Notification ID: ${notif.id}`);
      console.log(`   User: ${notif.user.email}`);
      console.log(`   Type: ${notif.type}`);
      console.log(`   Title: ${notif.title}`);
      console.log(`   Related Order ID: ${notif.relatedId} (DELETED)`);
      console.log(`   Created: ${notif.createdAt.toISOString()}`);
      console.log('');
    });

    // 5. Deletar notificações órfãs
    console.log('🗑️  Deleting orphaned notifications...\n');

    const deleteResult = await prisma.notification.deleteMany({
      where: {
        id: {
          in: orphanedNotifications.map((n) => n.id),
        },
      },
    });

    console.log(`✅ Successfully deleted ${deleteResult.count} orphaned notifications\n`);

    // 6. Verificação final
    const remainingOrphans = await prisma.notification.findMany({
      where: {
        relatedType: 'ORDER',
        relatedId: { not: null },
      },
    });

    const stillOrphaned = remainingOrphans.filter(
      (notif) => !validOrderIds.has(notif.relatedId!)
    );

    if (stillOrphaned.length === 0) {
      console.log('✨ Verification: All orphaned notifications have been cleaned up!\n');
    } else {
      console.log(`⚠️  Warning: ${stillOrphaned.length} orphaned notifications still remain\n`);
    }

    // 7. Estatísticas finais
    console.log('📊 Final Statistics:');
    console.log(`   - Total notifications checked: ${orderNotifications.length}`);
    console.log(`   - Valid orders in DB: ${validOrderIds.size}`);
    console.log(`   - Orphaned notifications found: ${orphanedNotifications.length}`);
    console.log(`   - Notifications deleted: ${deleteResult.count}`);
    console.log(`   - Remaining orphans: ${stillOrphaned.length}\n`);

  } catch (error) {
    console.error('❌ Error during orphan notification cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
fixOrphanNotifications()
  .then(() => {
    console.log('✅ Orphan notification cleanup completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Orphan notification cleanup failed:', error);
    process.exit(1);
  });
