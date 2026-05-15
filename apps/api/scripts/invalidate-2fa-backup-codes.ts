/**
 * CRIT-06 — Invalidação de backup codes 2FA gerados com Math.random().
 *
 * CONTEXTO
 * --------
 * Antes deste script, `TwoFactorService.generateBackupCodes` usava
 * `Math.random().toString(36)...` — V8 implementa Math.random como
 * xorshift128+, previsível a partir de ~5 amostras consecutivas.
 *
 * Qualquer código gerado pré-fix é suspeito: se um único código vazou
 * (screenshot, log, share inadvertido), os outros 9 do mesmo usuário
 * podem ser derivados por um atacante competente.
 *
 * O QUE ESTE SCRIPT FAZ
 * ---------------------
 * SET twoFactorBackupCodes = NULL para todos os users com twoFactorEnabled.
 * Imprime contagem de usuários afetados.
 *
 * CONSEQUÊNCIA PARA O USUÁRIO
 * ---------------------------
 * Após esta invalidação, o usuário ainda consegue logar com TOTP do app
 * (Google Authenticator, Authy, etc.) — só os códigos de RECUPERAÇÃO
 * ficam zerados. Precisa entrar nas configs de 2FA e clicar em
 * "Regenerar backup codes" para receber novos códigos seguros.
 *
 * COMUNICAÇÃO RECOMENDADA
 * -----------------------
 * Enviar email aos usuários afetados ANTES de rodar o script, explicando:
 *   1. Por que: vulnerabilidade descoberta nos backup codes antigos.
 *   2. Impacto: backup codes antigos foram invalidados; TOTP do app
 *      continua funcionando normalmente.
 *   3. Ação: ir em Configurações → Segurança → Regenerar Backup Codes.
 *
 * USO
 * ---
 *   cd apps/api
 *   npx tsx scripts/invalidate-2fa-backup-codes.ts          # dry-run (default)
 *   npx tsx scripts/invalidate-2fa-backup-codes.ts --apply  # executa a invalidação
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const APPLY = process.argv.includes('--apply');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CRIT-06 — Invalidação de backup codes 2FA inseguros');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Modo: ${APPLY ? '⚠️  APPLY (escreve no banco)' : '🟢 DRY-RUN (apenas conta)'}`);
  console.log('───────────────────────────────────────────────────────────');

  const affected = await prisma.user.count({
    where: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: { not: null },
    },
  });

  console.log(`  Usuários com 2FA ativo + backup codes salvos: ${affected}`);

  if (affected === 0) {
    console.log('  Nada a fazer. ✅');
    return;
  }

  if (!APPLY) {
    console.log('───────────────────────────────────────────────────────────');
    console.log('  Para executar de fato, rode com --apply:');
    console.log('  npx tsx scripts/invalidate-2fa-backup-codes.ts --apply');
    return;
  }

  const result = await prisma.user.updateMany({
    where: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: { not: null },
    },
    data: { twoFactorBackupCodes: null },
  });

  console.log('───────────────────────────────────────────────────────────');
  console.log(`  ✅ Invalidados: ${result.count} usuários.`);
  console.log('  Próximo passo: usuários devem regenerar via UI:');
  console.log('  Configurações → Segurança → Regenerar Backup Codes.');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
