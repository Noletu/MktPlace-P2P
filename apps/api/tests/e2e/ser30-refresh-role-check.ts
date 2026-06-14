import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../src/utils/bcrypt';
import { refreshTokenService } from '../../src/services/refreshToken.service';

const prisma = new PrismaClient();
const API = 'http://localhost:3001/api/v1';
const ORIGIN = 'http://localhost:3000';
const TEST_EMAIL = 'test-ser30@mktplace.com';

function getCookieFromResponse(res: Response, name: string): string | null {
  const headers: any = res.headers;
  let list: string[] = [];
  if (typeof headers.getSetCookie === 'function') {
    list = headers.getSetCookie();
  } else {
    const raw = res.headers.get('set-cookie');
    if (raw) list = [raw];
  }
  for (const sc of list) {
    const m = sc.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

async function refreshAndReadRole(userId: string): Promise<{ status: number; userRole: string | null }> {
  const rt = await refreshTokenService.createRefreshToken(userId);
  const res = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ refreshToken: rt }),
  });
  return { status: res.status, userRole: getCookieFromResponse(res, 'userRole') };
}

async function main() {
  const results: string[] = [];
  const hashed = await hashPassword('TestPass@2025');

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { password: hashed, legacyRole: 'USER', accountFrozen: false, name: 'Test SER-30' },
    create: { email: TEST_EMAIL, password: hashed, name: 'Test SER-30', legacyRole: 'USER' },
  });
  console.log(`user de teste: ${user.email} (legacyRole=USER)`);

  // A1: role atual = USER -> refresh seta cookie userRole=USER
  const a1 = await refreshAndReadRole(user.id);
  results.push(a1.status === 200 && a1.userRole === 'USER'
    ? `OK: refresh seta userRole=USER (status ${a1.status})`
    : `FALHA: esperava userRole=USER; veio status=${a1.status} userRole=${a1.userRole}`);

  // promove a ADMIN no banco (sem relogar)
  await prisma.user.update({ where: { id: user.id }, data: { legacyRole: 'ADMIN' } });
  console.log('promovido a ADMIN no banco (sem relogar)');

  // A2 (principal): refresh deve ressincronizar o cookie para ADMIN
  const a2 = await refreshAndReadRole(user.id);
  results.push(a2.status === 200 && a2.userRole === 'ADMIN'
    ? `OK: refresh ressincronizou userRole=ADMIN apos promocao (status ${a2.status})`
    : `FALHA (regressao SER-30): esperava userRole=ADMIN; veio status=${a2.status} userRole=${a2.userRole}`);

  // rebaixa de volta a USER
  await prisma.user.update({ where: { id: user.id }, data: { legacyRole: 'USER' } });
  console.log('rebaixado a USER no banco (sem relogar)');

  // A3: refresh deve ressincronizar de volta para USER
  const a3 = await refreshAndReadRole(user.id);
  results.push(a3.status === 200 && a3.userRole === 'USER'
    ? `OK: refresh ressincronizou userRole=USER apos rebaixamento (status ${a3.status})`
    : `FALHA (regressao SER-30): esperava userRole=USER; veio status=${a3.status} userRole=${a3.userRole}`);

  console.log('\n--- Resultado SER-30 (refresh ressincroniza cookie userRole) ---');
  results.forEach((r) => console.log(r));
  if (results.some((r) => r.startsWith('FALHA'))) process.exitCode = 1;
}

main()
  .catch((e) => { console.error('Erro no check (server de pe em :3001?):', e); process.exitCode = 1; })
  .finally(async () => {
    const u = await prisma.user.findUnique({ where: { email: TEST_EMAIL } }).catch(() => null);
    if (u) await prisma.refreshToken.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
    console.log('usuario de teste e refresh tokens removidos');
    await prisma.$disconnect();
  });
