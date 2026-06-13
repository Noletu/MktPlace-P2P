import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { AdminFundsService } from '../../src/services/adminFunds.service';

const prisma = new PrismaClient();

async function ensureUnfrozen(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { accountFrozen: false, frozenReason: null, frozenAt: null, frozenBy: null, frozenUntil: null },
  }).catch(() => {});
}

async function main() {
  const master = await prisma.user.findUnique({
    where: { email: 'master@mktplace.com' },
    select: { id: true, email: true, legacyRole: true, role: { select: { level: true } } },
  });
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@mktplace.com' },
    select: { id: true, email: true, legacyRole: true, role: { select: { level: true } } },
  });
  if (!master || !admin) throw new Error('seed users (master@/admin@) nao encontrados');

  console.log('Niveis efetivos:');
  console.log(`  master: legacyRole=${master.legacyRole} role.level=${master.role?.level ?? 'null'}`);
  console.log(`  admin : legacyRole=${admin.legacyRole} role.level=${admin.role?.level ?? 'null'}`);

  const results: string[] = [];

  // 1) admin tenta congelar master -> deve FALHAR (nao congela acima)
  try {
    await AdminFundsService.freezeAccount({ userId: master.id, reason: 'SER-41 check: admin->master', adminUserId: admin.id });
    results.push('FALHA: admin CONSEGUIU congelar master (NAO deveria)');
  } catch (e: any) {
    results.push(`OK: admin->master BLOQUEADO (status ${e.statusCode ?? '?'}): ${e.message}`);
  }

  // 2) master tenta se auto-congelar -> deve FALHAR
  try {
    await AdminFundsService.freezeAccount({ userId: master.id, reason: 'SER-41 check: self', adminUserId: master.id });
    results.push('FALHA: master CONSEGUIU se auto-congelar (NAO deveria)');
  } catch (e: any) {
    results.push(`OK: auto-freeze BLOQUEADO (status ${e.statusCode ?? '?'}): ${e.message}`);
  }

  // 3) master congela admin (nivel inferior) -> deve PASSAR. Restaura logo apos.
  let frozeAdmin = false;
  try {
    await AdminFundsService.freezeAccount({ userId: admin.id, reason: 'SER-41 check: master->admin (temporario)', adminUserId: master.id, duration: 1 });
    frozeAdmin = true;
    results.push('OK: master->admin PERMITIDO (congelou nivel inferior)');
  } catch (e: any) {
    results.push(`FALHA: master->admin foi BLOQUEADO (NAO deveria): ${e.message}`);
  } finally {
    if (frozeAdmin) {
      try {
        await AdminFundsService.unfreezeAccount({ userId: admin.id, adminUserId: master.id });
        results.push('admin restaurado (unfreeze via service)');
      } catch (e: any) {
        results.push(`unfreeze falhou (${e.message}) - restaurando direto no banco`);
        await ensureUnfrozen(admin.id);
      }
    }
  }

  console.log('\n--- Resultado SER-41 ---');
  results.forEach((r) => console.log(r));
}

main()
  .catch((e) => { console.error('Erro no check:', e); process.exitCode = 1; })
  .finally(async () => {
    const m = await prisma.user.findFirst({ where: { email: 'master@mktplace.com' }, select: { id: true } });
    const a = await prisma.user.findFirst({ where: { email: 'admin@mktplace.com' }, select: { id: true } });
    if (m) await ensureUnfrozen(m.id);
    if (a) await ensureUnfrozen(a.id);
    await prisma.$disconnect();
  });
