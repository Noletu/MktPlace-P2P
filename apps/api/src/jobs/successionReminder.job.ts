import cron from 'node-cron';
import { prisma } from '../utils/prisma';
import { emailService } from '../services/email.service';

/**
 * Job que envia lembrete trimestral para usuários MASTER revisarem o Kit de Sucessão.
 * Executa às 9h no dia 1º de janeiro, abril, julho e outubro.
 *
 * Cenário C do Plano de Contingência — indisponibilidade permanente (morte/incapacidade).
 * O lembrete garante que o Kit de Sucessão físico esteja sempre atualizado.
 */
export const startSuccessionReminderJob = () => {
  // 9h no dia 1º de cada trimestre: jan(1), abr(4), jul(7), out(10)
  cron.schedule('0 9 1 1,4,7,10 *', async () => {
    try {
      console.log('[SuccessionReminder Job] Iniciando envio de lembretes trimestrais...');

      const masters = await prisma.user.findMany({
        where: {
          role: { slug: 'master' },
          accountFrozen: false,
        },
        select: { id: true, email: true, name: true },
      });

      if (masters.length === 0) {
        console.log('[SuccessionReminder Job] Nenhum MASTER ativo encontrado.');
        return;
      }

      console.log(`[SuccessionReminder Job] Enviando lembretes para ${masters.length} MASTER(s)...`);

      for (const master of masters) {
        await emailService.sendSuccessionKitReminderEmail(master.email, {
          name: master.name ?? master.email,
        });
        console.log(`[SuccessionReminder Job] Lembrete enviado: ${master.email}`);
      }

      console.log(`[SuccessionReminder Job] Concluído — ${masters.length} lembrete(s) enviado(s).`);
    } catch (err) {
      console.error('[SuccessionReminder Job] Erro ao enviar lembretes:', err);
    }
  });

  console.log('[SuccessionReminder Job] Iniciado — 9h no dia 1º de jan/abr/jul/out');
};
