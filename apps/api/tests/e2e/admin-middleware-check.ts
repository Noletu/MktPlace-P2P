import { adminMiddleware } from '../../src/middleware/admin.middleware';

function run(role: string | undefined) {
  const req: any = { user: role ? { userId: 'x', role } : undefined };
  let status = 0; let body: any = null; let nextCalled = false;
  const res: any = { status(c: number){ status=c; return this; }, json(b: any){ body=b; return this; } };
  const next = () => { nextCalled = true; };
  adminMiddleware(req, res, next);
  return { status, body, nextCalled };
}

function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };

  let r = run('MASTER');
  check(r.nextCalled && r.status === 0, 'MASTER -> passa (next chamado)');
  r = run('ADMIN');
  check(r.nextCalled, 'ADMIN -> passa');
  r = run('SUPPORT');
  check(r.nextCalled, 'SUPPORT -> passa');
  r = run('USER');
  check(!r.nextCalled && r.status === 403, 'USER -> bloqueado (403)');
  r = run('GERENTE');
  check(!r.nextCalled && r.status === 403, 'GERENTE -> bloqueado (403) [nao esta na allowlist deste mw]');
  r = run(undefined);
  check(!r.nextCalled && r.status === 401, 'sem user -> 401');

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
