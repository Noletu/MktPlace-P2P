// CRIT-04: integration test — requer Postgres real rodando.
// Pré-requisito: Postgres acessível no DATABASE_URL + migrations aplicadas.
//
// 1) setup.ts global mocka @prisma/client. Aqui desabilitamos para usar Prisma real.
// 2) WalletService importa transitivamente @ethereumjs/wallet (ESM) via
//    derivation.service / key-management.service / blockchain.service /
//    fee-estimator.service. Esses caminhos NÃO são exercitados pelos métodos do
//    ledger (unlock/deduct/credit), então stubamos os módulos para evitar o
//    SyntaxError do Jest CJS ao parsear ESM.
jest.unmock('@prisma/client');
jest.mock('../hd-wallet/derivation.service', () => ({ DerivationService: {} }));
jest.mock('../hd-wallet/key-management.service', () => ({ KeyManagementService: {} }));
jest.mock('../blockchain/blockchain.service', () => ({ BlockchainService: {} }));
jest.mock('../blockchain/fee-estimator.service', () => ({ FeeEstimatorService: {} }));
jest.mock('../email.service', () => ({ emailService: { sendEmail: jest.fn() } }));
jest.mock('../notification.service', () => ({ notificationService: { create: jest.fn() } }));

const RUN_INTEGRATION = (process.env.DATABASE_URL ?? '').startsWith('postgresql://');
const describeIfPg = RUN_INTEGRATION ? describe : describe.skip;

// Lazy-resolved Prisma + WalletService — só carrega se o describe rodar.
let prisma: any;
let WalletService: any;
if (RUN_INTEGRATION) {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  ({ WalletService } = require('../wallet.service'));
}

describeIfPg('CRIT-04: ledger atômico sob concorrência', () => {
  // userId compartilhado entre todos os testes; criado no beforeAll, deletado no afterAll
  const testUserId = `test-crit04-${Date.now()}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@test.local`,
        password: 'test-hash',
      },
    });
  });

  afterAll(async () => {
    // Limpa em ordem: walletTransactions → wallets → user
    await prisma.walletTransaction.deleteMany({ where: { userId: testUserId } });
    await prisma.userWallet.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  async function createWallet(locked = '100', available = '0', cryptoType = 'BTC') {
    // userWallet tem @@unique([userId, cryptoType, network]); usar cryptoType único por test
    return prisma.userWallet.create({
      data: {
        userId: testUserId,
        cryptoType,
        network: 'BITCOIN',
        address: `bc1q-test-${Date.now()}-${Math.random()}`,
        derivationPath: "m/44'/0'/1'/0'/0'",
        encryptedPrivateKey: 'enc-test',
        balance: locked, // total inicial = locked (available começa 0)
        availableBalance: available,
        lockedBalance: locked,
      },
    });
  }

  it('100 unlocks concorrentes de 1 BTC não inventam saldo', async () => {
    const wallet = await createWallet('100', '0', 'BTC-T1');
    const orderIds = Array.from({ length: 100 }, (_, i) => `order-${wallet.id}-${i}`);

    const results = await Promise.allSettled(
      orderIds.map(oid => WalletService.unlockBalance(wallet.id, '1', oid)),
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    expect(fulfilled).toBe(100);

    const final = await prisma.userWallet.findUnique({ where: { id: wallet.id } });
    // Aceita 0 vs 0.00000000000000000 — comparar via BigNumber-safe string
    expect(parseFloat(final!.lockedBalance.toString())).toBe(0);
    expect(parseFloat(final!.availableBalance.toString())).toBe(100);

    // E o ledger de auditoria registrou exatamente 100 UNLOCKs
    const ledgerCount = await prisma.walletTransaction.count({
      where: { walletId: wallet.id, type: 'UNLOCK' },
    });
    expect(ledgerCount).toBe(100);
  }, 60_000);

  it('200 unlocks concorrentes de 1 BTC com saldo de 100: exatamente 100 sucedem', async () => {
    const wallet = await createWallet('100', '0', 'BTC-T2');

    const results = await Promise.allSettled(
      Array.from({ length: 200 }, (_, i) =>
        WalletService.unlockBalance(wallet.id, '1', `order-${wallet.id}-${i}`),
      ),
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    expect(fulfilled).toBe(100);
    expect(rejected).toBe(100);

    const final = await prisma.userWallet.findUnique({ where: { id: wallet.id } });
    expect(parseFloat(final!.lockedBalance.toString())).toBe(0);
    expect(parseFloat(final!.availableBalance.toString())).toBe(100);
  }, 90_000);

  it('50 creditBalance concorrentes de 2 BTC não duplicam créditos', async () => {
    const wallet = await createWallet('0', '0', 'BTC-T3');

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        WalletService.creditBalance(wallet.id, '2', `deposit-${wallet.id}-${i}`),
      ),
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    expect(fulfilled).toBe(50);

    const final = await prisma.userWallet.findUnique({ where: { id: wallet.id } });
    expect(parseFloat(final!.balance.toString())).toBe(100);
    expect(parseFloat(final!.availableBalance.toString())).toBe(100);
  }, 60_000);

  it('30 deductBalance concorrentes de 1 BTC: exatamente 20 sucedem (saldo nunca negativo)', async () => {
    const wallet = await createWallet('20', '0', 'BTC-T4'); // balance=20, locked=20

    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () =>
        WalletService.deductBalance(wallet.id, '1', 'concurrent-deduct-test', true),
      ),
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    expect(fulfilled).toBe(20);
    expect(rejected).toBe(10);

    const final = await prisma.userWallet.findUnique({ where: { id: wallet.id } });
    expect(parseFloat(final!.lockedBalance.toString())).toBe(0);
    expect(parseFloat(final!.balance.toString())).toBe(0);
  }, 60_000);
});
