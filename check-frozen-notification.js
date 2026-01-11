const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFrozenNotifications() {
  try {
    console.log('🔍 Verificando notificações de conta bloqueada...\n');

    // Buscar usuário bloqueado
    const frozenUser = await prisma.user.findFirst({
      where: { accountFrozen: true },
      select: {
        id: true,
        email: true,
        name: true,
        frozenReason: true,
        frozenAt: true,
        frozenUntil: true,
      }
    });

    if (!frozenUser) {
      console.log('❌ Nenhum usuário bloqueado encontrado.');
      return;
    }

    console.log('✅ Usuário bloqueado encontrado:');
    console.log({
      email: frozenUser.email,
      name: frozenUser.name,
      frozenReason: frozenUser.frozenReason,
      frozenAt: frozenUser.frozenAt,
      frozenUntil: frozenUser.frozenUntil,
    });

    // Buscar notificações desse usuário
    const notifications = await prisma.notification.findMany({
      where: {
        userId: frozenUser.id,
        type: { in: ['ACCOUNT_FROZEN', 'ACCOUNT_UNFROZEN'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log(`\n📬 Notificações de bloqueio encontradas: ${notifications.length}\n`);

    if (notifications.length === 0) {
      console.log('⚠️  NENHUMA notificação encontrada!');
      console.log('   Isso significa que a notificação NÃO foi criada ao bloquear.');
    } else {
      notifications.forEach((notif, index) => {
        console.log(`${index + 1}. ${notif.type}`);
        console.log(`   Título: ${notif.title}`);
        console.log(`   Mensagem: ${notif.message}`);
        console.log(`   Prioridade: ${notif.priority}`);
        console.log(`   Criado em: ${notif.createdAt}`);
        console.log(`   Lido: ${notif.isRead ? 'Sim' : 'Não'}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFrozenNotifications();
