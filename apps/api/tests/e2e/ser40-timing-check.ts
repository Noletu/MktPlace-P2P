// SER-40: medição empírica do piso de tempo nos caminhos de falha do login.
// Mede verifyCredentials diretamente (sem HTTP) para evitar o authLimiter
// (5 falhas/15min/IP) e isolar o gap de I/O interno. Reseta o contador entre
// amostras do caminho C para não disparar o lockout (threshold 3).
import { authService } from '../../src/services/auth.service';
import { accountLockoutService } from '../../src/services/accountLockout.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const N = 10;
const WRONG = 'SenhaErrada-xyz-123!';
const SEED_EMAIL = 'master@mktplace.com';

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
async function timeOne(fn: () => Promise<unknown>): Promise<number> {
  const t0 = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: SEED_EMAIL }, select: { id: true } });
  if (!user) {
    console.error(`Seed user ${SEED_EMAIL} nao encontrado. Rode o seed e garanta o Postgres de pe.`);
    process.exitCode = 1;
    return;
  }

  for (let i = 0; i < 3; i++) {
    await authService.verifyCredentials({ email: `warmup-${i}@example.com`, password: WRONG });
  }

  const a: number[] = [];
  for (let i = 0; i < N; i++) {
    a.push(await timeOne(() => authService.verifyCredentials({ email: `naoexiste-${i}-${Date.now()}@example.com`, password: WRONG })));
  }

  const c: number[] = [];
  for (let i = 0; i < N; i++) {
    await accountLockoutService.recordSuccessfulLogin(user.id);
    c.push(await timeOne(() => authService.verifyCredentials({ email: SEED_EMAIL, password: WRONG })));
  }

  await accountLockoutService.recordSuccessfulLogin(user.id);
  for (let i = 0; i < 3; i++) {
    await authService.verifyCredentials({ email: SEED_EMAIL, password: WRONG });
  }
  const b: number[] = [];
  for (let i = 0; i < N; i++) {
    b.push(await timeOne(() => authService.verifyCredentials({ email: SEED_EMAIL, password: WRONG })));
  }
  await accountLockoutService.recordSuccessfulLogin(user.id);

  const aMed = median(a), bMed = median(b), cMed = median(c);
  const gapAC = Math.abs(cMed - aMed);
  const gapPctAC = (gapAC / Math.min(aMed, cMed)) * 100;
  const gapAB = Math.abs(bMed - aMed);

  console.log(`\nSER-40 — timing do login (N=${N}, piso ${process.env.LOGIN_FAIL_FLOOR_MS || 700}ms)`);
  console.log(`A  email inexistente       : mean=${mean(a).toFixed(1)}ms  median=${aMed.toFixed(1)}ms`);
  console.log(`B  conta em lockout (Z)    : mean=${mean(b).toFixed(1)}ms  median=${bMed.toFixed(1)}ms`);
  console.log(`C  conta real, senha errada: mean=${mean(c).toFixed(1)}ms  median=${cMed.toFixed(1)}ms`);
  console.log(`\nGap A<->C: ${gapAC.toFixed(1)}ms (${gapPctAC.toFixed(1)}%)`);
  console.log(`Gap A<->B: ${gapAB.toFixed(1)}ms`);
  const pass = gapAC < 50 && gapPctAC < 15;
  console.log(`\nCriterio (A<->C < 50ms E < 15%): ${pass ? 'PASS' : 'FAIL'}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
