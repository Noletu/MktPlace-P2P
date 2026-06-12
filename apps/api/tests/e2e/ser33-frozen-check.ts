/**
 * SER-33 — Verificação empírica do gate de conta congelada (accountFrozen).
 * Pré-requisito: dev server rodando em http://localhost:3001 (npm run dev).
 *
 * Congela temporariamente um usuário seed, minta um Bearer token e confirma que o
 * authMiddleware aplica o allowlist ponta-a-ponta:
 *   POST /orders                → 403 + accountFrozen:true (bloqueado)
 *   POST /wallets/:id/withdraw   → 403 + accountFrozen:true (bloqueado)
 *   POST /disputes               → NÃO é o 403-frozen       (apelação passa)
 * Restaura o estado original do usuário no finally.
 *
 * Rodar: cd apps/api && npx tsx tests/e2e/ser33-frozen-check.ts
 */
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../../src/utils/jwt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';
const TEST_EMAIL = 'admin@mktplace.com';

async function post(path: string, token: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: 'http://localhost:3000' },
    body: JSON.stringify({}),
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* sem corpo JSON */ }
  return { status: res.status, body };
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!user) throw new Error(`Usuário seed ${TEST_EMAIL} não encontrado — rodou o prisma:seed?`);
  const wasFrozen = user.accountFrozen;
  const checks: { name: string; pass: boolean; detail: string }[] = [];

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { accountFrozen: true, frozenReason: 'SER-33 empirical check (temporário)' },
    });
    console.log(`🔒 Congelado temporariamente: ${TEST_EMAIL} (${user.id})`);

    const token = generateToken({ userId: user.id, email: user.email, role: user.legacyRole ?? 'USER' });

    const orders = await post('/orders', token);
    const withdraw = await post('/wallets/dummy-wallet-id/withdraw', token);
    const disputes = await post('/disputes', token);

    console.log('\n--- Respostas cruas ---');
    console.log('POST /orders               →', orders.status, JSON.stringify(orders.body));
    console.log('POST /wallets/:id/withdraw  →', withdraw.status, JSON.stringify(withdraw.body));
    console.log('POST /disputes              →', disputes.status, JSON.stringify(disputes.body));

    checks.push({ name: 'order BLOQUEADO (403 + accountFrozen)', pass: orders.status === 403 && orders.body?.accountFrozen === true, detail: `status ${orders.status}` });
    checks.push({ name: 'withdraw BLOQUEADO (403 + accountFrozen)', pass: withdraw.status === 403 && withdraw.body?.accountFrozen === true, detail: `status ${withdraw.status}` });
    checks.push({ name: 'disputa PASSA o gate frozen (apelação)', pass: disputes.body?.accountFrozen !== true, detail: `status ${disputes.status}` });
  } finally {
    if (!wasFrozen) {
      await prisma.user.update({
        where: { id: user.id },
        data: { accountFrozen: false, frozenReason: null, frozenAt: null, frozenBy: null },
      });
    }
    console.log(`🔓 Estado restaurado: accountFrozen=${wasFrozen}`);
    await prisma.$disconnect();
  }

  console.log('\n--- Resultado ---');
  let allPass = true;
  for (const c of checks) { console.log(`${c.pass ? '✅' : '❌'} ${c.name} (${c.detail})`); if (!c.pass) allPass = false; }
  console.log(allPass ? '\n✅ SER-33 verificado empiricamente — bloqueia op sensível e libera apelação.' : '\n❌ Alguma asserção falhou — ver respostas cruas acima.');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Erro no teste empírico:', err);
  console.error('(O dev server está rodando em http://localhost:3001? `npm run dev` em apps/api.)');
  process.exit(1);
});
