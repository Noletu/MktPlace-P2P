import { prisma } from '../../src/utils/prisma';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ' — ' + detail : ''}`);
}
async function jsonbType(orderId: string): Promise<string | null> {
  const r = await prisma.$queryRaw<Array<{ t: string }>>`
    SELECT jsonb_typeof("orderData") AS t FROM "Order" WHERE id = ${orderId}`;
  return r[0]?.t ?? null;
}

async function main() {
  const colInfo = await prisma.$queryRaw<Array<{ data_type: string }>>`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'orderData'`;
  check('coluna e jsonb', colInfo[0]?.data_type === 'jsonb', String(colInfo[0]?.data_type));

  const user = await prisma.user.findUnique({ where: { email: 'master@mktplace.com' }, select: { id: true } });
  if (!user) { check('user de seed existe', false, 'master@mktplace.com nao encontrado'); return; }

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      type: 'BOLETO',
      cryptoType: 'USDT',
      cryptoNetwork: 'TRON',
      cryptoAmount: '10.0',
      brlAmount: '50.0',
      platformFee: '1.0',
      payerReward: '0.5',
      totalFee: '1.5',
      orderData: { barcode: 'TEST123', dueDate: '2026-12-31' },
    },
    select: { id: true },
  });
  const orderId = order.id;

  try {
    check('grava objeto -> jsonb_typeof = object', (await jsonbType(orderId)) === 'object');

    const read = await prisma.order.findUnique({ where: { id: orderId }, select: { orderData: true } });
    const od = read?.orderData as any;
    check('releitura e objeto (nao string)', od !== null && typeof od === 'object' && !Array.isArray(od), typeof od);
    check('campo barcode preservado', od?.barcode === 'TEST123');

    await prisma.order.update({ where: { id: orderId }, data: { orderData: {} } });
    check('grava {} -> jsonb_typeof = object (NOT NULL ok)', (await jsonbType(orderId)) === 'object');

    await prisma.order.update({ where: { id: orderId }, data: { orderData: '{"legacy":true}' } });
    check('string legada -> jsonb_typeof = string', (await jsonbType(orderId)) === 'string');
    const readStr = await prisma.order.findUnique({ where: { id: orderId }, select: { orderData: true } });
    check('Prisma le string legada como string (dispara ramo tolerante)', typeof readStr?.orderData === 'string', typeof readStr?.orderData);
  } finally {
    await prisma.order.delete({ where: { id: orderId } });
  }

  console.log(failures === 0 ? '\nTODOS OS CHECKS PASSARAM' : `\n${failures} CHECK(S) FALHARAM`);
  process.exitCode = failures === 0 ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
