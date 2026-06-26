import { prisma } from '../../src/utils/prisma';
import { adminService } from '../../src/services/admin.service';
import { authMiddleware } from '../../src/middleware/auth.middleware';
import { generateToken } from '../../src/utils/jwt';

function makeReqRes(opts: { token: string; method: string; path: string }) {
  const req: any = { method: opts.method, originalUrl: opts.path, headers: { authorization: `Bearer ${opts.token}` }, cookies: {}, user: undefined };
  let statusCode = 0; let jsonBody: any = null; let nextCalled = false;
  const res: any = { status(c: number){ statusCode=c; return this; }, json(b: any){ jsonBody=b; return this; } };
  const next = () => { nextCalled = true; };
  return { req, res, next: next as any, get: () => ({ statusCode, jsonBody, nextCalled }) };
}

async function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };
  const createdIds: string[] = [];

  // master "criador" (so pra preencher createdById no audit)
  let masterId = '';

  try {
    const master = await prisma.user.upsert({
      where: { email: 'f2-master@test.com' },
      update: { legacyRole: 'MASTER' },
      create: { email: 'f2-master@test.com', password: 'x', legacyRole: 'MASTER', name: 'f2-master' },
    });
    masterId = master.id; createdIds.push(master.id);

    // 1) MASTER cria os 3 roles permitidos -> sucesso, sem carteira, forcePasswordReset
    for (const slug of ['support', 'gerente', 'admin'] as const) {
      const staff = await adminService.createStaffAccount({
        email: `f2-${slug}@test.com`, name: `f2-${slug}`, tempPassword: 'tempPass123', roleSlug: slug, createdById: masterId,
      });
      createdIds.push(staff.id);
      check(staff.legacyRole === slug.toUpperCase(), `cria ${slug} -> legacyRole ${staff.legacyRole}`);
      check(staff.forcePasswordReset === true, `${slug}: forcePasswordReset = true`);
      const wallets = await prisma.userWallet.count({ where: { userId: staff.id } });
      check(wallets === 0, `${slug}: nasce SEM carteira (got ${wallets})`);
    }

    // 2) Rejeitar MASTER (dupla barreira slug + level)
    let rejectedMaster = false;
    try {
      await adminService.createStaffAccount({ email: 'f2-evil-master@test.com', name: 'x', tempPassword: 'tempPass123', roleSlug: 'master' as any, createdById: masterId });
    } catch { rejectedMaster = true; }
    check(rejectedMaster, 'criar MASTER -> REJEITADO');

    // 3) Rejeitar USER
    let rejectedUser = false;
    try {
      await adminService.createStaffAccount({ email: 'f2-evil-user@test.com', name: 'x', tempPassword: 'tempPass123', roleSlug: 'user' as any, createdById: masterId });
    } catch { rejectedUser = true; }
    check(rejectedUser, 'criar USER -> REJEITADO');

    // 4) ENCAIXE com Frente 1: a conta staff criada nao consegue criar carteira (gate 403)
    const adminStaff = await prisma.user.findUnique({ where: { email: 'f2-admin@test.com' } });
    if (adminStaff) {
      const tok = generateToken({ userId: adminStaff.id, email: adminStaff.email, role: 'ADMIN' } as any);
      const h = makeReqRes({ token: tok, method: 'POST', path: '/api/v1/wallets' });
      await authMiddleware(h.req, h.res, h.next);
      const r = h.get();
      check(r.statusCode === 403 && !r.nextCalled, 'staff criado tenta POST /wallets -> 403 (gate F1)');
    } else {
      check(false, 'staff admin encontrado para teste de gate');
    }
  } finally {
    if (createdIds.length) await prisma.user.deleteMany({ where: { id: { in: createdIds } } }).catch(() => {});
    // limpar evil emails que possam ter sido criados (nao deveriam)
    await prisma.user.deleteMany({ where: { email: { in: ['f2-evil-master@test.com', 'f2-evil-user@test.com'] } } }).catch(() => {});
    console.log(`  cleanup: ${createdIds.length} contas`);
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
