import { prisma } from '../../src/utils/prisma';

const TAG = 'MED33_WTX_SMOKE';

async function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };
  let walletId: string | null = null;
  const txIds: string[] = [];

  try {
    const col = await prisma.$queryRaw<Array<{ data_type: string }>>`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'WalletTransaction' AND column_name = 'metadata'`;
    check(col[0]?.data_type === 'jsonb', `coluna metadata e jsonb (got: ${col[0]?.data_type})`);

    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) throw new Error('nenhum User no banco');

    const wallet = await prisma.userWallet.create({
      data: {
        userId: user.id, cryptoType: 'MED33TEST', network: 'MED33TEST',
        address: 'med33-smoke-address', derivationPath: "m/44'/0'/0'/0/0",
        encryptedPrivateKey: 'med33-smoke-dummy',
      },
    });
    walletId = wallet.id;

    // caminho 1: create com metadata OBJETO (classe dos 20 writes convertidos)
    const t1 = await prisma.walletTransaction.create({
      data: { walletId, userId: user.id, type: TAG, amount: '0', balanceBefore: '0', balanceAfter: '0',
        metadata: { category: 'LOCK_TEST', via: 'object', n: 1 } },
    });
    txIds.push(t1.id);
    const r1 = await prisma.$queryRaw<Array<{ t: string; cat: string }>>`
      SELECT jsonb_typeof("metadata") AS t, ("metadata"->>'category') AS cat FROM "WalletTransaction" WHERE id = ${t1.id}`;
    check(r1[0]?.t === 'object', `create objeto -> jsonb object (got: ${r1[0]?.t})`);
    check(r1[0]?.cat === 'LOCK_TEST', `estrutura preservada (category lido = ${r1[0]?.cat})`);

    // caminho 2: leitura tolerante (mesma logica do adminFunds:1803)
    const read = await prisma.walletTransaction.findUnique({ where: { id: t1.id }, select: { metadata: true } });
    const meta: any = typeof read?.metadata === 'string' ? JSON.parse(read.metadata) : read?.metadata;
    check(meta?.category === 'LOCK_TEST', `leitura tolerante devolve category (${meta?.category})`);

    // caminho 3: sem metadata -> NULL
    const t3 = await prisma.walletTransaction.create({
      data: { walletId, userId: user.id, type: TAG, amount: '0', balanceBefore: '0', balanceAfter: '0' },
    });
    txIds.push(t3.id);
    const r3 = await prisma.$queryRaw<Array<{ m: any }>>`
      SELECT "metadata" AS m FROM "WalletTransaction" WHERE id = ${t3.id}`;
    check(r3[0]?.m === null, `sem metadata -> NULL (got: ${JSON.stringify(r3[0]?.m)})`);
  } finally {
    if (txIds.length) await prisma.walletTransaction.deleteMany({ where: { id: { in: txIds } } });
    if (walletId) await prisma.userWallet.delete({ where: { id: walletId } }).catch(() => {});
    console.log(`  cleanup: ${txIds.length} WalletTransaction + ${walletId ? 1 : 0} UserWallet removidos`);
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
