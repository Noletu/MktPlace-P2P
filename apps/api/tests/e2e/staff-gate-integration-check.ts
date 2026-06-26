import { prisma } from '../../src/utils/prisma';
import { authMiddleware } from '../../src/middleware/auth.middleware';
import { generateToken } from '../../src/utils/jwt';

// mock minimo de req/res/next pra exercitar o authMiddleware real
function makeReqRes(opts: { token: string; method: string; path: string }) {
  const req: any = {
    method: opts.method,
    originalUrl: opts.path,
    headers: { authorization: `Bearer ${opts.token}` },
    cookies: {},
    user: undefined,
  };
  let statusCode = 0;
  let jsonBody: any = null;
  const res: any = {
    status(c: number) { statusCode = c; return this; },
    json(b: any) { jsonBody = b; return this; },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return { req, res, next: next as any, get: () => ({ statusCode, jsonBody, nextCalled }) };
}

async function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };
  const createdIds: string[] = [];

  async function ensureUser(email: string, legacyRole: string) {
    const u = await prisma.user.upsert({
      where: { email },
      update: { legacyRole },
      create: { email, password: 'x', legacyRole, name: `test-${legacyRole}` },
    });
    createdIds.push(u.id);
    return u;
  }

  async function run(token: string, method: string, path: string) {
    const h = makeReqRes({ token, method, path });
    await authMiddleware(h.req, h.res, h.next);
    return h.get();
  }

  try {
    // contas reais: um USER comum e um ADMIN (staff)
    const userAcc  = await ensureUser('gate-user@test.com', 'USER');
    const adminAcc = await ensureUser('gate-admin@test.com', 'ADMIN');
    const userTok  = generateToken({ userId: userAcc.id,  email: userAcc.email,  role: 'USER' } as any);
    const adminTok = generateToken({ userId: adminAcc.id, email: adminAcc.email, role: 'ADMIN' } as any);

    // STAFF (admin) tentando OPERAR -> 403, next nao chamado
    let r = await run(adminTok, 'POST', '/api/v1/orders');
    check(r.statusCode === 403 && r.jsonBody?.staffOperationBlocked === true && !r.nextCalled, 'ADMIN criar pedido -> 403 bloqueado');

    r = await run(adminTok, 'POST', '/api/v1/wallets');
    check(r.statusCode === 403 && !r.nextCalled, 'ADMIN criar carteira -> 403');

    r = await run(adminTok, 'POST', '/api/v1/transactions/submit-proof');
    check(r.statusCode === 403 && !r.nextCalled, 'ADMIN enviar comprovante -> 403');

    // STAFF (admin) fazendo funcao ADMIN ou GET -> passa (next chamado)
    r = await run(adminTok, 'POST', '/api/v1/transactions/t1/validate');
    check(r.nextCalled && r.statusCode !== 403, 'ADMIN validar comprovante -> liberado');

    r = await run(adminTok, 'POST', '/api/v1/coupons');
    check(r.nextCalled, 'ADMIN criar cupom -> liberado');

    r = await run(adminTok, 'GET', '/api/v1/orders/marketplace');
    check(r.nextCalled, 'ADMIN GET marketplace -> liberado');

    r = await run(adminTok, 'POST', '/api/v1/admin/funds/transfer');
    check(r.nextCalled, 'ADMIN rota /admin/* -> liberado (carteira plataforma)');

    // USER comum operando -> passa em tudo
    r = await run(userTok, 'POST', '/api/v1/orders');
    check(r.nextCalled && r.statusCode !== 403, 'USER criar pedido -> liberado');

    r = await run(userTok, 'POST', '/api/v1/wallets');
    check(r.nextCalled, 'USER criar carteira -> liberado');

    r = await run(userTok, 'POST', '/api/v1/transactions/submit-proof');
    check(r.nextCalled, 'USER enviar comprovante -> liberado');
  } finally {
    if (createdIds.length) await prisma.user.deleteMany({ where: { id: { in: createdIds } } }).catch(() => {});
    console.log(`  cleanup: ${createdIds.length} contas de teste`);
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
