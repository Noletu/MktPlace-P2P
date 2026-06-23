import { prisma } from '../../src/utils/prisma';
import { disputeService } from '../../src/services/dispute.service';

const TAG = 'BOLETO_DEADLINE_EP_SMOKE';
const HORA = 60 * 60 * 1000;

async function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };
  const orderIds: string[] = [];
  const txIds: string[] = [];

  async function makeScenario(type: 'BOLETO' | 'PIX', comprovanteAgeH: number | null, payerId: string, ownerId: string) {
    const order = await prisma.order.create({
      data: {
        userId: ownerId, orderType: 'SELL', type, status: 'PAYMENT_SENT',
        cryptoType: 'BTC', cryptoNetwork: 'BITCOIN', cryptoAmount: '0.001', brlAmount: '600',
        platformFee: '0', payerReward: '0', totalFee: '0', orderData: {},
      },
    });
    orderIds.push(order.id);
    if (comprovanteAgeH !== null) {
      const tx = await prisma.transaction.create({
        data: {
          orderId: order.id, payerId, status: 'VALIDATING',
          comprovanteUrl: 'http://teste/c.png',
          createdAt: new Date(Date.now() - comprovanteAgeH * HORA),
        },
      });
      txIds.push(tx.id);
    }
    return order;
  }

  try {
    const users = await prisma.user.findMany({ take: 2, select: { id: true } });
    if (users.length < 2) throw new Error('preciso de 2 users');
    const payer = users[0].id, owner = users[1].id;

    // 1: BOLETO comprovante recente (1h) -> blocked true, remaining ~47h
    const o1 = await makeScenario('BOLETO', 1, payer, owner);
    const r1 = await disputeService.getBoletoDisputeDeadline(o1.id);
    check(r1.blocked === true, `BOLETO <48h -> blocked true (got ${r1.blocked})`);
    const h1 = (r1 as any).remainingMs ? (r1 as any).remainingMs / HORA : -1;
    check(h1 > 46 && h1 < 48, `BOLETO <48h -> remaining ~47h (got ${h1.toFixed(1)}h)`);

    // 2: BOLETO comprovante antigo (50h) -> blocked false
    const o2 = await makeScenario('BOLETO', 50, payer, owner);
    const r2 = await disputeService.getBoletoDisputeDeadline(o2.id);
    check(r2.blocked === false, `BOLETO >48h -> blocked false (got ${r2.blocked})`);

    // 3: PIX comprovante recente -> blocked false (regra so boleto)
    const o3 = await makeScenario('PIX', 1, payer, owner);
    const r3 = await disputeService.getBoletoDisputeDeadline(o3.id);
    check(r3.blocked === false, `PIX -> blocked false (got ${r3.blocked})`);

    // 4: BOLETO sem comprovante -> blocked false
    const o4 = await makeScenario('BOLETO', null, payer, owner);
    const r4 = await disputeService.getBoletoDisputeDeadline(o4.id);
    check(r4.blocked === false, `BOLETO sem comprovante -> blocked false (got ${r4.blocked})`);

    // 5: orderId inexistente -> blocked false (nao quebra)
    const r5 = await disputeService.getBoletoDisputeDeadline('id-que-nao-existe');
    check(r5.blocked === false, `order inexistente -> blocked false (got ${r5.blocked})`);
  } finally {
    if (txIds.length) await prisma.transaction.deleteMany({ where: { id: { in: txIds } } }).catch(() => {});
    if (orderIds.length) await prisma.order.deleteMany({ where: { id: { in: orderIds } } }).catch(() => {});
    console.log(`  cleanup: ${txIds.length} tx, ${orderIds.length} orders`);
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
