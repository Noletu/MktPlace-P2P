/**
 * SER-32 e2e — rejeição de origin deve retornar 403 (não 500).
 * Requer o dev server de pé em http://localhost:3001 (npm run dev em apps/api,
 * com CORS_ALLOW_NO_ORIGIN=false e ALLOWED_ORIGINS incluindo http://localhost:3000).
 * Roda: npx tsx tests/e2e/ser32-cors-status.ts
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3001';
const PATH = '/api/health'; // path neutro: o CORS roda antes de qualquer rota

let pass = 0;
let fail = 0;

function assert(cond: boolean, label: string, detail: string) {
  console.log(`${cond ? 'PASS ' : 'FAIL '} ${label} — ${detail}`);
  cond ? pass++ : fail++;
}

async function main() {
  // 1) Origin NÃO-autorizada → 403 (antes do SER-32 era 500)
  const blocked = await fetch(`${BASE}${PATH}`, {
    headers: { Origin: 'http://evil.example.com' },
  });
  assert(
    blocked.status === 403,
    'origin não-autorizada → 403',
    `status=${blocked.status} (esperado 403; regressão = 500)`
  );

  // 2) Sem Origin com a flag CORS_ALLOW_NO_ORIGIN=false → 403 (era 500)
  const noOrigin = await fetch(`${BASE}${PATH}`);
  assert(
    noOrigin.status === 403,
    'sem origin (flag false) → 403',
    `status=${noOrigin.status} (esperado 403; regressão = 500)`
  );

  // 3) Origin autorizada → passa o CORS (não 403, não 500)
  const allowed = await fetch(`${BASE}${PATH}`, {
    headers: { Origin: 'http://localhost:3000' },
  });
  assert(
    allowed.status !== 403 && allowed.status !== 500,
    'origin autorizada → passa o CORS',
    `status=${allowed.status} (404 aqui é ok: passou o CORS, a rota é que pode não existir)`
  );

  console.log(`\n${fail === 0 ? 'OK' : 'FALHOU'} — ${pass} passaram, ${fail} falharam`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Erro no e2e (o dev server está de pé em :3001?):', e);
  process.exit(1);
});
