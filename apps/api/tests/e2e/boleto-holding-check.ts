import { prisma } from '../../src/utils/prisma';
import { disputeService } from '../../src/services/dispute.service';

const TAG = 'BOLETO_HOLDING_SMOKE';
const HORA = 60 * 60 * 1000;

async function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };
  const orderIds: string[] = [];
  const txIds: string[] = [];
  const dispIds: string[] = [];

  // helper: cria um pedido + transacao com comprovante numa idade dada (em horas)
  async function makeScenario(opts: { type: 'BOLETO' | 'PIX'; comprovanteAgeH: number; payerId: string; ownerId: string }) {
    const order = await prisma.order.create({
      data: {
        userId: opts.ownerId, orderType: 'SELL', type: opts.type, status: 'PAYMENT_SENT',
        cryptoType: 'BTC', cryptoNetwork: 'BITCOIN', cryptoAmount: '0.001', brlAmount: '600',
        platformFee: '0', payerReward: '0', totalFee: '0', orderData: {},
      },
    });
    orderIds.push(order.id);
    const tx = await prisma.transaction.create({
      data: {
        orderId: order.id, payerId: opts.payerId, status: 'VALIDATING',
        comprovanteUrl: 'http://teste/comprovante.png',
        createdAt: new Date(Date.now() - opts.comprovanteAgeH * HORA),
      },
    });
    txIds.push(tx.id);
    return { order, tx };
  }

  // tenta abrir disputa; retorna 'ok' se criou, ou a mensagem de erro
  async function tryDispute(orderId: string, txId: string, createdBy: string): Promise<'ok' | string> {
    try {
      const d = await disputeService.createDispute({
        orderId, transactionId: txId, createdBy,
        category: 'OTHER', title: TAG, description: TAG + ' teste',
      } as any);
      if (d?.id) dispIds.push(d.id);
      return 'ok';
    } catch (e: any) {
      return e.message as string;
    }
  }

  try {
    const users = await prisma.user.findMany({ take: 2, select: { id: true } });
    if (users.length < 2) throw new Error('preciso de 2 users no banco');
    const payer = users[0].id;   // comprador
    const owner = users[1].id;   // vendedor/dono

    // Cenario 1: BOLETO, comprovante recente (1h), COMPRADOR -> deve BLOQUEAR
    const s1 = await makeScenario({ type: 'BOLETO', comprovanteAgeH: 1, payerId: payer, ownerId: owner });
    const r1 = await tryDispute(s1.order.id, s1.tx.id, payer);
    check(r1 !== 'ok' && /48 horas/.test(r1), `BOLETO <48h + comprador -> BLOQUEADO (got: ${r1 === 'ok' ? 'criou!' : 'bloqueou'})`);

    // Cenario 2: BOLETO, comprovante antigo (50h), COMPRADOR -> deve LIBERAR
    const s2 = await makeScenario({ type: 'BOLETO', comprovanteAgeH: 50, payerId: payer, ownerId: owner });
    const r2 = await tryDispute(s2.order.id, s2.tx.id, payer);
    check(r2 === 'ok', `BOLETO >48h + comprador -> LIBERADO (got: ${r2 === 'ok' ? 'criou' : r2})`);

    // Cenario 3: BOLETO, comprovante recente (1h), VENDEDOR/DONO -> deve LIBERAR (boleto falso)
    const s3 = await makeScenario({ type: 'BOLETO', comprovanteAgeH: 1, payerId: payer, ownerId: owner });
    const r3 = await tryDispute(s3.order.id, s3.tx.id, owner);
    check(r3 === 'ok', `BOLETO <48h + vendedor -> LIBERADO (got: ${r3 === 'ok' ? 'criou' : r3})`);

    // Cenario 4: PIX, comprovante recente (1h), COMPRADOR -> deve LIBERAR (regra so vale boleto)
    const s4 = await makeScenario({ type: 'PIX', comprovanteAgeH: 1, payerId: payer, ownerId: owner });
    const r4 = await tryDispute(s4.order.id, s4.tx.id, payer);
    check(r4 === 'ok', `PIX <48h + comprador -> LIBERADO (got: ${r4 === 'ok' ? 'criou' : r4})`);
  } finally {
    // limpeza na ordem das FKs: mensagens/disputas -> transacoes -> ordens
    if (dispIds.length) {
      await prisma.disputeMessage.deleteMany({ where: { disputeId: { in: dispIds } } }).catch(() => {});
      await prisma.dispute.deleteMany({ where: { id: { in: dispIds } } }).catch(() => {});
    }
    if (txIds.length) await prisma.transaction.deleteMany({ where: { id: { in: txIds } } }).catch(() => {});
    if (orderIds.length) await prisma.order.deleteMany({ where: { id: { in: orderIds } } }).catch(() => {});
    console.log(`  cleanup: ${dispIds.length} disputas, ${txIds.length} tx, ${orderIds.length} orders`);
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
