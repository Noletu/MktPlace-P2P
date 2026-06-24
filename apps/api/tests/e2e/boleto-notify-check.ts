import { prisma } from '../../src/utils/prisma';
import { orderExpirationWorker } from '../../src/workers/order-expiration.worker';

const HORA = 60 * 60 * 1000;

async function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };
  const orderIds: string[] = [];
  const txIds: string[] = [];
  const notifIds: string[] = [];

  // conta notificacoes BOLETO_DISPUTE_AVAILABLE para um user+order
  async function countNotif(userId: string, orderId: string) {
    const ns = await prisma.notification.findMany({
      where: { userId, type: 'BOLETO_DISPUTE_AVAILABLE', relatedId: orderId },
      select: { id: true },
    });
    ns.forEach(n => { if (!notifIds.includes(n.id)) notifIds.push(n.id); });
    return ns.length;
  }

  async function makeBoleto(comprovanteAgeH: number, payerId: string, ownerId: string) {
    const order = await prisma.order.create({
      data: {
        userId: ownerId, orderType: 'SELL', type: 'BOLETO', status: 'PAYMENT_SENT',
        cryptoType: 'BTC', cryptoNetwork: 'BITCOIN', cryptoAmount: '0.001', brlAmount: '600',
        platformFee: '0', payerReward: '0', totalFee: '0', orderData: {},
      },
    });
    orderIds.push(order.id);
    const tx = await prisma.transaction.create({
      data: {
        orderId: order.id, payerId, status: 'VALIDATING',
        comprovanteUrl: 'http://teste/c.png',
        createdAt: new Date(Date.now() - comprovanteAgeH * HORA),
      },
    });
    txIds.push(tx.id);
    return order;
  }

  try {
    const users = await prisma.user.findMany({ take: 2, select: { id: true } });
    if (users.length < 2) throw new Error('preciso de 2 users');
    const payer = users[0].id, owner = users[1].id;

    // Cenario A: boleto com comprovante de 50h (>48h) -> deve notificar UMA vez
    const oA = await makeBoleto(50, payer, owner);
    // Cenario B: boleto com comprovante de 10h (<48h) -> NAO deve notificar
    const oB = await makeBoleto(10, payer, owner);

    // roda o check (metodo private -> cast)
    await (orderExpirationWorker as any).checkBoletoDisputeWindows();

    const aAfter1 = await countNotif(payer, oA.id);
    const bAfter1 = await countNotif(payer, oB.id);
    const oArow1 = await prisma.order.findUnique({ where: { id: oA.id }, select: { boletoDisputeNotifiedAt: true } });
    const oBrow1 = await prisma.order.findUnique({ where: { id: oB.id }, select: { boletoDisputeNotifiedAt: true } });

    check(aAfter1 === 1, `A (>48h): notificou 1x (got ${aAfter1})`);
    check(oArow1?.boletoDisputeNotifiedAt != null, `A: campo boletoDisputeNotifiedAt marcado`);
    check(bAfter1 === 0, `B (<48h): NAO notificou (got ${bAfter1})`);
    check(oBrow1?.boletoDisputeNotifiedAt == null, `B: campo continua null`);

    // roda DE NOVO -> A nao pode re-notificar (anti-spam)
    await (orderExpirationWorker as any).checkBoletoDisputeWindows();
    const aAfter2 = await countNotif(payer, oA.id);
    check(aAfter2 === 1, `A: apos 2a rodada, continua 1x (anti-spam) (got ${aAfter2})`);
  } finally {
    if (notifIds.length) await prisma.notification.deleteMany({ where: { id: { in: notifIds } } }).catch(() => {});
    if (txIds.length) await prisma.transaction.deleteMany({ where: { id: { in: txIds } } }).catch(() => {});
    if (orderIds.length) await prisma.order.deleteMany({ where: { id: { in: orderIds } } }).catch(() => {});
    console.log(`  cleanup: ${notifIds.length} notif, ${txIds.length} tx, ${orderIds.length} orders`);
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
