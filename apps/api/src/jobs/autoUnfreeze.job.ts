import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { notificationService } from '../services/notification.service';

const prisma = new PrismaClient();

/**
 * Job que roda a cada 5 minutos para verificar contas com freeze temporário expirado
 * Desbloqueia automaticamente contas onde frozenUntil <= now
 *
 * Funcionalidades:
 * - Busca contas bloqueadas (accountFrozen = true) com frozenUntil expirado
 * - Desbloqueia em batch todas as contas encontradas
 * - Cria audit logs para cada desbloqueio automático
 * - TODO: Enviar notificações por email para usuários desbloqueados
 */
export const startAutoUnfreezeJob = () => {
  // Executar a cada 5 minutos: */5 * * * *
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('[AutoUnfreeze Job] Verificando contas para auto-desbloqueio...');

      const now = new Date();

      // Buscar contas bloqueadas com frozenUntil expirado
      const expiredFreezes = await prisma.user.findMany({
        where: {
          accountFrozen: true,
          frozenUntil: {
            lte: now, // menor ou igual a agora
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          frozenReason: true,
          frozenAt: true,
          frozenUntil: true,
        },
      });

      if (expiredFreezes.length === 0) {
        console.log('[AutoUnfreeze Job] Nenhuma conta para desbloquear.');
        return;
      }

      console.log(`[AutoUnfreeze Job] Encontradas ${expiredFreezes.length} contas para desbloquear.`);

      // Desbloquear todas em batch
      const userIds = expiredFreezes.map(u => u.id);

      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: {
          accountFrozen: false,
          frozenReason: null,
          frozenAt: null,
          frozenBy: null,
          frozenUntil: null,
        },
      });

      // Criar audit logs para cada desbloqueio
      const auditLogs = expiredFreezes.map(user => ({
        userId: 'SYSTEM',
        action: 'AUTO_UNFREEZE_ACCOUNT',
        resource: 'USER',
        resourceId: user.id,
        description: `Conta desbloqueada automaticamente: ${user.email}`,
        metadata: JSON.stringify({
          email: user.email,
          name: user.name,
          frozenReason: user.frozenReason,
          frozenAt: user.frozenAt,
          frozenUntil: user.frozenUntil,
          unfrozenAt: now,
        }),
        success: true,
      }));

      await prisma.auditLog.createMany({ data: auditLogs });

      // NOTIFICAÇÃO: Avisar usuários desbloqueados automaticamente
      for (const user of expiredFreezes) {
        await notificationService.createNotification({
          userId: user.id,
          type: 'ACCOUNT_UNFROZEN',
          category: 'ACCOUNT',
          title: '✅ Suspensão Temporária Expirada',
          message: 'Sua suspensão temporária expirou e sua conta foi reativada automaticamente. Você já pode usar todas as funcionalidades da plataforma.',
          priority: 'NORMAL',
          actionUrl: '/dashboard',
          actionLabel: 'Ver Dashboard',
        });
      }

      console.log(`[AutoUnfreeze Job] ${expiredFreezes.length} contas desbloqueadas com sucesso.`);

    } catch (error) {
      console.error('[AutoUnfreeze Job] Erro ao desbloquear contas:', error);
    }
  });

  console.log('[AutoUnfreeze Job] Iniciado com sucesso (executa a cada 5 minutos)');
};
