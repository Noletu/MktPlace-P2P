import { prisma } from '../src/utils/prisma';

// Promove admin@mktplace.com (ADMIN) -> MASTER, ficando com 2 MASTERs.
// NAO toca em hdAccountIndex, 2FA, senha ou email. So muda roleId + legacyRole.
// Use APPLY=1 para aplicar; sem isso, roda em DRY-RUN (so mostra o que faria).

const TARGET_EMAIL = 'admin@mktplace.com';

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '=== MODO APPLY (vai alterar) ===' : '=== DRY-RUN (nada sera alterado) ===');

  const masterRole = await prisma.role.findUnique({ where: { slug: 'master' } });
  if (!masterRole) throw new Error("Role 'master' nao encontrado (rode o rbac-seed).");

  const target = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true, email: true, legacyRole: true, hdAccountIndex: true,
              twoFactorEnabled: true, role: { select: { slug: true, level: true } } },
  });
  if (!target) throw new Error(`Conta ${TARGET_EMAIL} nao encontrada.`);

  console.log('\nANTES:', JSON.stringify({
    email: target.email, legacyRole: target.legacyRole, roleSlug: target.role?.slug,
    level: target.role?.level, hdAccountIndex: target.hdAccountIndex?.toString(),
    twoFactorEnabled: target.twoFactorEnabled,
  }, null, 2));

  if (target.role?.slug === 'master') {
    console.log('\nJa e MASTER. Nada a fazer.');
    await prisma.$disconnect(); process.exit(0);
  }

  console.log('\nMUDANCA: roleId -> master, legacyRole -> MASTER');
  console.log('PRESERVADO (nao toca): hdAccountIndex, 2FA, senha, email.');

  // conferir quantos masters existem antes/depois
  const mastersBefore = await prisma.user.count({ where: { role: { slug: 'master' } } });
  console.log(`\nMASTERs hoje: ${mastersBefore} | apos promocao: ${mastersBefore + 1}`);

  if (!apply) {
    console.log('\n[DRY-RUN] Nada foi alterado. Para aplicar: APPLY=1 npx tsx scripts/promote-admin-to-master.ts');
    await prisma.$disconnect(); process.exit(0);
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { roleId: masterRole.id, legacyRole: 'MASTER' },
  });

  const after = await prisma.user.findUnique({
    where: { id: target.id },
    select: { email: true, legacyRole: true, hdAccountIndex: true, role: { select: { slug: true, level: true } } },
  });
  console.log('\nDEPOIS:', JSON.stringify({
    email: after?.email, legacyRole: after?.legacyRole, roleSlug: after?.role?.slug,
    level: after?.role?.level, hdAccountIndex: after?.hdAccountIndex?.toString(),
  }, null, 2));
  const mastersAfter = await prisma.user.count({ where: { role: { slug: 'master' } } });
  console.log(`\nTotal de MASTERs agora: ${mastersAfter}`);
  console.log('OK. admin@mktplace.com agora e MASTER.');

  await prisma.$disconnect(); process.exit(0);
}

main();
