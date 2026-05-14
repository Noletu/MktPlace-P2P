/**
 * Script para corrigir URLs antigas de notificações de chat
 *
 * Transforma: /orders/{id}/chat -> /orders/{id}?tab=chat
 *
 * Execução:
 * cd apps/api
 * npx tsx scripts/fix-chat-notification-urls.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixChatNotificationUrls() {
  console.log('🔧 Fixing chat notification URLs...\n');

  try {
    // Buscar todas as notificações de chat com URL antiga
    const notifications = await prisma.notification.findMany({
      where: {
        type: 'CHAT_MESSAGE',
        actionUrl: {
          endsWith: '/chat',
        },
      },
      select: {
        id: true,
        actionUrl: true,
        createdAt: true,
      },
    });

    console.log(`📊 Found ${notifications.length} notification(s) to update\n`);

    if (notifications.length === 0) {
      console.log('✅ No notifications need updating. All URLs are already in the correct format!');
      return;
    }

    // Atualizar cada notificação
    let updated = 0;
    for (const notification of notifications) {
      if (notification.actionUrl) {
        const oldUrl = notification.actionUrl;
        const newUrl = notification.actionUrl.replace(/\/chat$/, '?tab=chat');

        await prisma.notification.update({
          where: { id: notification.id },
          data: { actionUrl: newUrl },
        });

        updated++;
        console.log(`✅ [${updated}/${notifications.length}] Updated notification ${notification.id.substring(0, 8)}...`);
        console.log(`   Old: ${oldUrl}`);
        console.log(`   New: ${newUrl}`);
        console.log(`   Created: ${notification.createdAt.toISOString()}\n`);
      }
    }

    console.log(`\n✅ Migration complete! Updated ${updated} notification(s)`);
    console.log('\n📌 Summary:');
    console.log(`   - Total found: ${notifications.length}`);
    console.log(`   - Successfully updated: ${updated}`);
    console.log(`   - Failed: ${notifications.length - updated}`);

  } catch (error: any) {
    console.error('\n❌ Error during migration:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
fixChatNotificationUrls()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
