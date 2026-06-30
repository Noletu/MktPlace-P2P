import { prisma } from '../src/utils/prisma';

/**
 * HANDOFF DAS CONTAS RAIZ (rodar apenas no go-live).
 * Prepara as 2 contas MASTER para serem assumidas por pessoas reais:
 *  - forcePasswordReset: true  -> cada um define a propria senha no 1o login
 *  - zera 2FA (twoFactorEnabled=false, secrets=null) -> cada um configura o proprio 2FA
 *  - opcionalmente troca o email (se NEW_EMAIL_* for fornecido)
 *
 * NAO toca em hdAccountIndex (custodia). NAO altera role.
 *
 * Uso (DRY-RUN por padrao):
 *   npx tsx scripts/root-account-handoff.ts
 * Aplicar:
 *   APPLY=1 npx tsx scripts/root-account-handoff.ts
 * Trocar emails (opcional):
 *   APPLY=1 NEW_EMAIL_MASTER=adao@real.com NEW_EMAIL_ADMIN=eva@real.com npx tsx scripts/root-account-handoff.ts
 *
 * "MASTER" aqui = master@mktplace.com (conta raiz 1); "ADMIN" = admin@mktplace.com (conta raiz 2, ja promovida a master).
 */

const ROOT_1 = 'master@mktplace.com';
const ROOT_2 = 'admin@mktplace.com';

async function prepare(email: string, newEmail?: string) {
  const u = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, hdAccountIndex: true, twoFactorEnabled: true, role: { select: { slug: true } } },
  });
  if (!u) { console.log(`  [SKIP] ${email} nao encontrado.`); return null; }
  return {
    id: u.id, email: u.email, newEmail: newEmail || u.email,
    hdAccountIndex: u.hdAccountIndex?.toString(), roleSlug: u.role?.slug, twoFactorEnabled: u.twoFactorEnabled,
  };
}

async function main() {
  const apply = process.env.APPLY === '1';
  const newEmail1 = process.env.NEW_EMAIL_MASTER;
  const newEmail2 = process.env.NEW_EMAIL_ADMIN;
  console.log(apply ? '=== HANDOFF: MODO APPLY ===' : '=== HANDOFF: DRY-RUN (nada sera alterado) ===');

  const accounts = [await prepare(ROOT_1, newEmail1), await prepare(ROOT_2, newEmail2)].filter(Boolean) as any[];

  for (const a of accounts) {
    console.log(`\nConta: ${a.email}`);
    console.log(`  role: ${a.roleSlug} | hdAccountIndex: ${a.hdAccountIndex} (PRESERVADO)`);
    console.log(`  -> forcePasswordReset: true`);
    console.log(`  -> 2FA: zerado (era ${a.twoFactorEnabled ? 'ativo' : 'inativo'}) -> exige novo setup`);
    if (a.newEmail !== a.email) console.log(`  -> email: ${a.email} -> ${a.newEmail}`);
  }

  if (!apply) {
    console.log('\n[DRY-RUN] Nada alterado. Para aplicar no go-live: APPLY=1 (e NEW_EMAIL_* se for trocar emails).');
    await prisma.$disconnect(); process.exit(0);
  }

  for (const a of accounts) {
    await prisma.user.update({
      where: { id: a.id },
      data: {
        email: a.newEmail,
        forcePasswordReset: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorTempSecret: null,
        twoFactorBackupCodes: undefined,
      },
    });
    console.log(`  OK: ${a.newEmail} preparada para handoff.`);
  }
  console.log('\nHandoff aplicado. Cada socio: login com senha temporaria -> troca senha -> configura 2FA proprio.');
  await prisma.$disconnect(); process.exit(0);
}

main();
