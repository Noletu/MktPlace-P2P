import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../src/utils/bcrypt';
import { generateToken } from '../../src/utils/jwt';

const prisma = new PrismaClient();
const API = 'http://localhost:3001/api/v1';
const ORIGIN = 'http://localhost:3000';
const TEST_EMAIL = 'test-ser15@mktplace.com';
const OLD_PW = 'OldPass@2025';
const NEW_PW = 'NewPass@2025';

const H = (token: string) => ({
  'Content-Type': 'application/json',
  Origin: ORIGIN,
  Authorization: `Bearer ${token}`,
});

async function main() {
  const hashed = await hashPassword(OLD_PW);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { password: hashed, forcePasswordReset: true, accountFrozen: false, name: 'Test SER-15' },
    create: { email: TEST_EMAIL, password: hashed, name: 'Test SER-15', forcePasswordReset: true },
  });
  console.log(`user de teste: ${user.email} (forcePasswordReset=true)`);
  const token = generateToken({ userId: user.id, email: user.email, role: 'USER' });
  const results: string[] = [];

  // 1) mutação bloqueada pelo gate
  const r1 = await fetch(`${API}/orders`, { method: 'POST', headers: H(token), body: '{}' });
  const b1: any = await r1.json().catch(() => ({}));
  results.push(r1.status === 403 && b1.forcePasswordReset
    ? 'OK: mutacao BLOQUEADA pelo gate (403 forcePasswordReset)'
    : `FALHA: esperava 403 forcePasswordReset; veio ${r1.status} ${JSON.stringify(b1)}`);

  // 2) change-password passa o gate e troca
  const r2 = await fetch(`${API}/auth/change-password`, {
    method: 'POST', headers: H(token),
    body: JSON.stringify({ currentPassword: OLD_PW, newPassword: NEW_PW }),
  });
  const b2: any = await r2.json().catch(() => ({}));
  results.push(r2.status === 200
    ? 'OK: change-password (passou o gate e trocou)'
    : `FALHA: change-password: ${r2.status} ${JSON.stringify(b2)}`);

  // 3) flag zerado no banco
  const after = await prisma.user.findUnique({ where: { id: user.id }, select: { forcePasswordReset: true } });
  results.push(after && after.forcePasswordReset === false
    ? 'OK: forcePasswordReset zerado no banco apos a troca'
    : `FALHA: flag nao foi zerado: ${JSON.stringify(after)}`);

  // 4) mutação liberada (nao mais 403-forcePasswordReset)
  const r4 = await fetch(`${API}/orders`, { method: 'POST', headers: H(token), body: '{}' });
  const b4: any = await r4.json().catch(() => ({}));
  results.push(!(r4.status === 403 && b4.forcePasswordReset)
    ? `OK: gate liberado apos a troca (status ${r4.status}, sem forcePasswordReset)`
    : 'FALHA: ainda bloqueado pelo gate apos a troca');

  console.log('\n--- Resultado SER-15 (gate + change-password) ---');
  results.forEach((r) => console.log(r));
}

main()
  .catch((e) => { console.error('Erro no check:', e); process.exitCode = 1; })
  .finally(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
    console.log('usuario de teste removido');
    await prisma.$disconnect();
  });
