import { prisma } from '../../src/utils/prisma';
import { transactionService } from '../../src/services/transaction.service';

const TAG = 'BOLETO_DEADLINE_SMOKE';

async function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };
  const orderIds: string[] = [];
  const txIds: string[] = [];

  async function makePendingTx(type: 'BOLETO' | 'PIX', payerId: string, ownerId: string) {
    const order = await prisma.order.create({
      data: {
        userId: ownerId, orderType: 'SELL', type, status: 'PENDING',
        cryptoType: 'BTC', cryptoNetwork: 'BITCOIN', cryptoAmount: '0.001', brlAmount: '600',
        platformFee: '0', payerReward: '0', totalFee: '0', orderData: {},
      },
    });
    orderIds.push(order.id);
    const tx = await prisma.transaction.create({
      data: { orderId: order.id, payerId, status: 'PENDING' },
    });
    txIds.push(tx.id);
    return { order, tx };
  }

  try {
    const users = await prisma.user.findMany({ take: 2, select: { id: true } });
    if (users.length < 2) throw new Error('preciso de 2 users');
    const payer = users[0].id, owner = users[1].id;

    // BOLETO -> espera ~72h
    const b = await makePendingTx('BOLETO', payer, owner);
    const tNow = Date.now();
    await transactionService.submitProof({
      transactionId: b.tx.id, userId: payer,
      comprovanteUrl: 'http://teste/c.png', comprovanteData: 'x',
    } as any);
    const bTx = await prisma.transaction.findUnique({ where: { id: b.tx.id }, select: { validationDeadline: true, status: true } });
    const bHours = bTx?.validationDeadline ? (new Date(bTx.validationDeadline).getTime() - tNow) / 3600000 : 0;
    check(bTx?.status === 'VALIDATING', `BOLETO: status -> VALIDATING (got ${bTx?.status})`);
    check(bHours > 71 && bHours < 73, `BOLETO: validationDeadline ~72h (got ${bHours.toFixed(1)}h)`);

    // PIX -> espera ~24h
    const p = await makePendingTx('PIX', payer, owner);
    const tNow2 = Date.now();
    await transactionService.submitProof({
      transactionId: p.tx.id, userId: payer,
      comprovanteUrl: 'http://teste/c.png', comprovanteData: 'x',
    } as any);
    const pTx = await prisma.transaction.findUnique({ where: { id: p.tx.id }, select: { validationDeadline: true } });
    const pHours = pTx?.validationDeadline ? (new Date(pTx.validationDeadline).getTime() - tNow2) / 3600000 : 0;
    check(pHours > 23 && pHours < 25, `PIX: validationDeadline ~24h (got ${pHours.toFixed(1)}h)`);
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
