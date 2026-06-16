// CRIT-05: TOCTOU em submitProof — claim atômico via updateMany.
//
// Garante que duas requests simultâneas para a mesma transação não conseguem
// ambas fazer a transição PENDING → VALIDATING: apenas uma avança, a outra
// recebe erro com mensagem diferenciada.
//
// Requer Postgres real (DATABASE_URL=postgresql://...).
// Pré-requisito: migrations aplicadas.
jest.unmock('@prisma/client');

// Módulos ESM e side-effect pesados — stubados para isolar o DB path
jest.mock('../hd-wallet/derivation.service', () => ({ DerivationService: {} }));
jest.mock('../hd-wallet/key-management.service', () => ({ KeyManagementService: {} }));
jest.mock('../blockchain/blockchain.service', () => ({ BlockchainService: {} }));
jest.mock('../blockchain/fee-estimator.service', () => ({ FeeEstimatorService: {} }));
jest.mock('../email.service', () => ({
  emailService: {
    sendIfAllowed: jest.fn().mockResolvedValue(undefined),
    sendPaymentSentEmail: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../notification.service', () => ({
  notificationService: { notifyPaymentSent: jest.fn() },
}));
jest.mock('../platformWallet.service', () => ({ PlatformWalletService: { recordMovement: jest.fn() } }));
jest.mock('../auditLog.service', () => ({
  auditLogService: { log: jest.fn() },
  AUDIT_ACTIONS: {},
  AUDIT_RESOURCES: {},
}));

export {}; // torna o arquivo um módulo TS — evita colisão de variáveis ao rodar junto com outros specs

const RUN_INTEGRATION = (process.env.DATABASE_URL ?? '').startsWith('postgresql://');
const describeIfPg = RUN_INTEGRATION ? describe : describe.skip;

let prisma: any;
let TransactionService: any;
if (RUN_INTEGRATION) {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  ({ TransactionService } = require('../transaction.service'));
}

describeIfPg('CRIT-05: submitProof — claim atômico', () => {
  const suffix = `crit05-tx-${Date.now()}`;
  let seller: any;
  let buyer: any;
  let svc: any;

  beforeAll(async () => {
    seller = await prisma.user.create({
      data: { id: `${suffix}-seller`, email: `${suffix}-seller@test.local`, password: 'hash' },
    });
    buyer = await prisma.user.create({
      data: { id: `${suffix}-buyer`, email: `${suffix}-buyer@test.local`, password: 'hash' },
    });
    svc = new TransactionService();
  });

  afterAll(async () => {
    await prisma.cancellationHistory.deleteMany({ where: { orderId: { startsWith: suffix } } });
    await prisma.transaction.deleteMany({ where: { payerId: buyer.id } });
    await prisma.order.deleteMany({ where: { userId: seller.id } });
    await prisma.user.deleteMany({ where: { id: { in: [seller.id, buyer.id] } } });
    await prisma.$disconnect();
  });

  async function createOrder(status = 'MATCHED') {
    return prisma.order.create({
      data: {
        userId: seller.id,
        type: 'PIX',
        orderType: 'SELL',
        status,
        cryptoType: 'BTC',
        cryptoNetwork: 'BITCOIN',
        cryptoAmount: '0.001',
        brlAmount: '100.00',
        platformFee: '1.50',
        payerReward: '1.00',
        totalFee: '2.50',
        orderData: {},
      },
    });
  }

  async function createTx(orderId: string, payerId: string, status = 'PENDING') {
    return prisma.transaction.create({ data: { orderId, payerId, status } });
  }

  const proofInput = {
    comprovanteData: 'base64data',
    comprovanteUrl: 'https://example.com/comprovante.jpg',
  };

  it('a) caminho feliz: transição PENDING→VALIDATING + order→PAYMENT_SENT', async () => {
    const order = await createOrder();
    const tx = await createTx(order.id, buyer.id);

    const result = await svc.submitProof({
      transactionId: tx.id,
      userId: buyer.id,
      ...proofInput,
    });

    expect(result.status).toBe('VALIDATING');
    expect(result.comprovanteUrl).toBe(proofInput.comprovanteUrl);

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder.status).toBe('PAYMENT_SENT');
  });

  it('b) estado inválido: tx já em VALIDATING lança erro', async () => {
    const order = await createOrder('PAYMENT_SENT');
    const tx = await createTx(order.id, buyer.id, 'VALIDATING');

    await expect(
      svc.submitProof({ transactionId: tx.id, userId: buyer.id, ...proofInput }),
    ).rejects.toThrow('não está aguardando comprovante');
  });

  it('c) não autorizado: payerId errado lança erro', async () => {
    const order = await createOrder();
    const tx = await createTx(order.id, buyer.id);

    await expect(
      svc.submitProof({ transactionId: tx.id, userId: `${suffix}-intruder`, ...proofInput }),
    ).rejects.toThrow('não tem permissão');
  });

  it('d) não encontrado: transactionId inexistente lança erro', async () => {
    await expect(
      svc.submitProof({ transactionId: 'non-existent-id', userId: buyer.id, ...proofInput }),
    ).rejects.toThrow('não encontrada');
  });

  it('e) atomicidade: Promise.all → exatamente 1 sucesso + 1 falha', async () => {
    const order = await createOrder();
    const tx = await createTx(order.id, buyer.id);

    const results = await Promise.allSettled([
      svc.submitProof({ transactionId: tx.id, userId: buyer.id, ...proofInput }),
      svc.submitProof({ transactionId: tx.id, userId: buyer.id, ...proofInput }),
    ]);

    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason.message).toMatch(
      /não está aguardando comprovante/,
    );

    // Exatamente UMA transição gravada no DB
    const final = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(final.status).toBe('VALIDATING');
  }, 30_000);
});
