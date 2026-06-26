import { isStaffOperationBlocked } from '../../src/middleware/auth.middleware';

function main() {
  let pass = 0, fail = 0;
  const check = (got: boolean, want: boolean, label: string) => {
    if (got === want) { pass++; console.log(`  PASS: ${label}`); }
    else { fail++; console.log(`  FAIL: ${label} (esperava ${want}, veio ${got})`); }
  };

  // ---- DEVE BLOQUEAR (staff operando como cliente) ----
  check(isStaffOperationBlocked('POST',  '/api/v1/orders'), true, 'criar pedido');
  check(isStaffOperationBlocked('POST',  '/api/v1/orders/quote'), true, 'cotacao');
  check(isStaffOperationBlocked('POST',  '/api/v1/orders/abc123/match'), true, 'match');
  check(isStaffOperationBlocked('POST',  '/api/v1/orders/abc123/accept-buy'), true, 'accept-buy');
  check(isStaffOperationBlocked('PATCH', '/api/v1/orders/abc123'), true, 'editar pedido');
  check(isStaffOperationBlocked('POST',  '/api/v1/orders/abc123/cancel'), true, 'cancelar (estrito: bloqueia)');
  check(isStaffOperationBlocked('POST',  '/api/v1/wallets'), true, 'criar carteira');
  check(isStaffOperationBlocked('POST',  '/api/v1/wallets/w1/withdraw'), true, 'sacar');
  check(isStaffOperationBlocked('POST',  '/api/v1/wallets/w1/sync'), true, 'sync carteira');
  check(isStaffOperationBlocked('POST',  '/api/v1/collateral/generate'), true, 'gerar colateral');
  check(isStaffOperationBlocked('POST',  '/api/v1/collateral-balance/deposit'), true, 'depositar');
  check(isStaffOperationBlocked('POST',  '/api/v1/transactions/submit-proof'), true, 'enviar comprovante');
  check(isStaffOperationBlocked('POST',  '/api/v1/transactions/t1/confirm-received'), true, 'confirmar recebido');
  check(isStaffOperationBlocked('POST',  '/api/v1/transactions/t1/confirm-payment-made'), true, 'confirmar pago');
  check(isStaffOperationBlocked('POST',  '/api/v1/transactions/t1/dispute'), true, 'disputa (estrito: bloqueia)');
  check(isStaffOperationBlocked('POST',  '/api/v1/reviews'), true, 'criar review');
  check(isStaffOperationBlocked('POST',  '/api/v1/reviews/r1/respond'), true, 'responder review (cliente) — BLOQUEADO');
  check(isStaffOperationBlocked('POST',  '/api/v1/reviews/r1/suspicious'), false, 'moderar review (admin) — LIBERADO');
  check(isStaffOperationBlocked('POST',  '/api/v1/reviews/r1/hide'), false, 'ocultar review (admin) — LIBERADO');
  check(isStaffOperationBlocked('POST',  '/api/v1/coupons/activate'), true, 'ativar cupom');
  check(isStaffOperationBlocked('POST',  '/api/v1/presence/orders/o1/toggle'), true, 'presenca toggle');

  // ---- NÃO DEVE BLOQUEAR (excecao admin) ----
  check(isStaffOperationBlocked('POST',  '/api/v1/transactions/t1/validate'), false, 'validar comprovante (admin)');

  // ---- NÃO DEVE BLOQUEAR (GETs sempre liberados) ----
  check(isStaffOperationBlocked('GET',   '/api/v1/orders/marketplace'), false, 'GET marketplace');
  check(isStaffOperationBlocked('GET',   '/api/v1/orders/abc123'), false, 'GET detalhe pedido');
  check(isStaffOperationBlocked('GET',   '/api/v1/wallets'), false, 'GET carteiras');
  check(isStaffOperationBlocked('GET',   '/api/v1/transactions/t1'), false, 'GET transacao');

  // ---- NÃO DEVE BLOQUEAR (/admin/* e outras areas: funcao de staff intacta) ----
  check(isStaffOperationBlocked('POST',  '/api/v1/admin/funds/transfer'), false, 'admin funds (plataforma)');
  check(isStaffOperationBlocked('POST',  '/api/v1/admin/users/u1/freeze'), false, 'admin freeze');
  check(isStaffOperationBlocked('POST',  '/api/v1/admin/balance/fix/u1'), false, 'admin balance fix');
  check(isStaffOperationBlocked('POST',  '/api/v1/disputes/d1/resolve'), false, 'resolver disputa');
  check(isStaffOperationBlocked('POST',  '/api/v1/admin/approvals/a1/approve'), false, 'aprovar pendingapproval');
  check(isStaffOperationBlocked('POST',  '/api/v1/roles'), false, 'criar role');
  check(isStaffOperationBlocked('POST',  '/api/v1/coupons'), false, 'criar cupom (admin) — LIBERADO');
  check(isStaffOperationBlocked('PUT',   '/api/v1/coupons/c1'), false, 'editar cupom (admin) — LIBERADO');
  check(isStaffOperationBlocked('DELETE','/api/v1/coupons/c1'), false, 'deletar cupom (admin) — LIBERADO');
  check(isStaffOperationBlocked('POST',  '/api/v1/coupons/activate'), true, 'ativar cupom (cliente) — BLOQUEADO');
  check(isStaffOperationBlocked('POST',  '/api/v1/coupons/deactivate'), true, 'desativar cupom (cliente) — BLOQUEADO');
  check(isStaffOperationBlocked('POST',  '/api/v1/notifications/broadcast'), false, 'broadcast');
  check(isStaffOperationBlocked('POST',  '/api/v1/auth/logout'), false, 'logout');
  check(isStaffOperationBlocked('POST',  '/api/v1/support'), false, 'criar ticket suporte');

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
