// CRIT-05: TOCTOU nas 3 funções de cancelamento — claim atômico via updateMany.
//
// Valida que duas requests simultâneas de cancelamento da mesma ordem não conseguem
// ambas fazer a transição de estado: apenas uma avança, a outra recebe erro diferenciado.
//
// Requer Postgres real (DATABASE_URL=postgresql://...).
// Pré-requisito: migrations aplicadas.
jest.unmock('@prisma/client');

// Módulos ESM e serviços externos — stubados para isolar o path do DB
jest.mock('../hd-wallet/derivation.service', () => ({ DerivationService: {} }));
jest.mock('../hd-wallet/key-management.service', () => ({ KeyManagementService: {} }));
jest.mock('../blockchain/blockchain.service', () => ({ BlockchainService: {} }));
jest.mock('../blockchain/fee-estimator.service', () => ({ FeeEstimatorService: {} }));
jest.mock('../email.service', () => ({
  emailService: {
    sendIfAllowed: jest.fn().mockResolvedValue(undefined),
    sendOrderCancelledEmail: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../notification.service', () => ({
  notificationService: {
    notifyOrderCancelled: jest.fn(),
    createNotification: jest.fn(),
  },
}));
jest.mock('../wallet.service', () => ({
  WalletService: { unlockBalance: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../limit.service', () => ({ limitService: {} }));
jest.mock('../price.service', () => ({ priceService: {} }));
jest.mock('../boleto-ocr.service', () => ({ boletoOCRService: {} }));
jest.mock('../coupon.service', () => ({ couponService: {} }));

// Serviços importados dinamicamente dentro das funções de cancel
jest.mock('../antiSpam.service', () => ({
  antiSpamService: {
    canCancelPendingOrder: jest.fn().mockResolvedValue({ allowed: true }),
  },
}));
jest.mock('../penalty.service', () => ({
  penaltyService: {
    calculateCancellationPenalty: jest.fn().mockResolvedValue({
      shouldApplyPenalty: false,
      penaltyPoints: 0,
      message: 'Sem penalidade',
    }),
    applyReputationPenalty: jest.fn().mockResolvedValue({ oldReputation: 50, newReputation: 50 }),
  },
}));
jest.mock('../cancellationHistory.service', () => ({ cancellationHistoryService: {} }));
jest.mock('../../types/cancellation.types', () => ({
  UserRole: { BUYER: 'BUYER', SELLER: 'SELLER' },
}));

export {}; // torna o arquivo um módulo TS — evita colisão de variáveis ao rodar junto com outros specs

const RUN_INTEGRATION = (process.env.DATABASE_URL ?? '').startsWith('postgresql://');
const describeIfPg = RUN_INTEGRATION ? describe : describe.skip;

let prisma: any;
let OrderService: any;
if (RUN_INTEGRATION) {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  ({ OrderService } = require('../order.service'));
}

describeIfPg('CRIT-05: cancelOrder / cancelOrderByPayer / cancelOrderByProvider', () => {
  const suffix = `crit05-ord-${Date.now()}`;
  let creator: any;
  let payer: any;
  let provider: any;
  let svc: any;

  beforeAll(async () => {
    [creator, payer, provider] = await Promise.all([
      prisma.user.create({ data: { id: `${suffix}-creator`, email: `${suffix}-creator@test.local`, password: 'hash' } }),
      prisma.user.create({ data: { id: `${suffix}-payer`, email: `${suffix}-payer@test.local`, password: 'hash' } }),
      prisma.user.create({ data: { id: `${suffix}-provider`, email: `${suffix}-provider@test.local`, password: 'hash' } }),
    ]);
    svc = new OrderService();
  });

  afterAll(async () => {
    const orderIds = (await prisma.order.findMany({
      where: { userId: { in: [creator.id, provider.id] } },
      select: { id: true },
    })).map((o: any) => o.id);

    await prisma.cancellationHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.transaction.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [creator.id, payer.id, provider.id] } } });
    await prisma.$disconnect();
  });

  const cancelArgs = {
    reason: 'USER_CHANGED_MIND',
    note: 'teste CRIT-05',
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  async function createSellOrder(status = 'MATCHED') {
    return prisma.order.create({
      data: {
        userId: creator.id,
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
        orderData: JSON.stringify({}),
        collateralLocked: false,
      },
    });
  }

  async function createBuyOrder(status = 'MATCHED') {
    return prisma.order.create({
      data: {
        userId: creator.id,
        type: 'PIX',
        orderType: 'BUY',
        status,
        cryptoType: 'BTC',
        cryptoNetwork: 'BITCOIN',
        cryptoAmount: '0.001',
        brlAmount: '100.00',
        platformFee: '1.50',
        payerReward: '1.00',
        totalFee: '2.50',
        orderData: JSON.stringify({}),
        providerId: provider.id,
        collateralLocked: false,
      },
    });
  }

  async function createTx(orderId: string, payerId: string, status = 'PENDING') {
    return prisma.transaction.create({ data: { orderId, payerId, status } });
  }

  // ─── cancelOrder (criador) ────────────────────────────────────────────────────

  describe('cancelOrder (pelo criador)', () => {
    it('a) caminho feliz: MATCHED → CANCELLED', async () => {
      const order = await createSellOrder('MATCHED');
      await createTx(order.id, payer.id);

      const result = await svc.cancelOrder(order.id, creator.id, cancelArgs.reason, cancelArgs.note);
      expect(result.penaltyApplied).toBe(false);

      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated.status).toBe('CANCELLED');
    });

    it('b) estado inválido: COMPLETED não pode cancelar', async () => {
      const order = await createSellOrder('COMPLETED');

      await expect(
        svc.cancelOrder(order.id, creator.id, cancelArgs.reason, cancelArgs.note),
      ).rejects.toThrow('não pode ser cancelado no status atual');
    });

    it('c) não autorizado: outro userId lança erro', async () => {
      const order = await createSellOrder('PENDING');

      await expect(
        svc.cancelOrder(order.id, `${suffix}-intruder`, cancelArgs.reason, cancelArgs.note),
      ).rejects.toThrow('não tem permissão');
    });

    it('d) não encontrado: orderId inexistente lança erro', async () => {
      await expect(
        svc.cancelOrder('non-existent-id', creator.id, cancelArgs.reason, cancelArgs.note),
      ).rejects.toThrow('não encontrado');
    });

    it('e) atomicidade: Promise.all → exatamente 1 sucesso + 1 falha', async () => {
      const order = await createSellOrder('MATCHED');
      await createTx(order.id, payer.id);

      const results = await Promise.allSettled([
        svc.cancelOrder(order.id, creator.id, cancelArgs.reason, cancelArgs.note),
        svc.cancelOrder(order.id, creator.id, cancelArgs.reason, cancelArgs.note),
      ]);

      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect((failed[0] as PromiseRejectedResult).reason.message).toMatch(
        /não pode ser cancelado no status atual/,
      );

      const final = await prisma.order.findUnique({ where: { id: order.id } });
      expect(final.status).toBe('CANCELLED');
    }, 30_000);
  });

  // ─── cancelOrderByPayer ───────────────────────────────────────────────────────

  describe('cancelOrderByPayer (pelo comprador que aceitou SELL)', () => {
    it('a) caminho feliz: MATCHED → PENDING (volta ao marketplace)', async () => {
      const order = await createSellOrder('MATCHED');
      await createTx(order.id, payer.id);

      const result = await svc.cancelOrderByPayer(order.id, payer.id, cancelArgs.reason, cancelArgs.note);
      expect(result.penaltyApplied).toBe(false);

      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated.status).toBe('PENDING');

      // Transaction deve ter sido deletada
      const txs = await prisma.transaction.findMany({ where: { orderId: order.id, payerId: payer.id } });
      expect(txs).toHaveLength(0);
    });

    it('b) estado inválido: PENDING não aceita cancelamento por payer', async () => {
      const order = await createSellOrder('PENDING');
      await createTx(order.id, payer.id);

      await expect(
        svc.cancelOrderByPayer(order.id, payer.id, cancelArgs.reason, cancelArgs.note),
      ).rejects.toThrow('não pode ser cancelado no status atual');
    });

    it('c) não autorizado: payerId errado lança erro', async () => {
      const order = await createSellOrder('MATCHED');
      await createTx(order.id, payer.id);

      await expect(
        svc.cancelOrderByPayer(order.id, `${suffix}-intruder`, cancelArgs.reason, cancelArgs.note),
      ).rejects.toThrow(/não tem permissão|não encontrado|não pode ser cancelado/);
    });

    it('d) não encontrado: orderId inexistente lança erro', async () => {
      await expect(
        svc.cancelOrderByPayer('non-existent-id', payer.id, cancelArgs.reason, cancelArgs.note),
      ).rejects.toThrow('não encontrado');
    });

    it('e) atomicidade: Promise.all → exatamente 1 sucesso + 1 falha', async () => {
      const order = await createSellOrder('MATCHED');
      await createTx(order.id, payer.id);

      const results = await Promise.allSettled([
        svc.cancelOrderByPayer(order.id, payer.id, cancelArgs.reason, cancelArgs.note),
        svc.cancelOrderByPayer(order.id, payer.id, cancelArgs.reason, cancelArgs.note),
      ]);

      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      const final = await prisma.order.findUnique({ where: { id: order.id } });
      expect(final.status).toBe('PENDING');
    }, 30_000);
  });

  // ─── cancelOrderByProvider ────────────────────────────────────────────────────

  describe('cancelOrderByProvider (pelo provedor de BUY)', () => {
    it('a) caminho feliz: MATCHED → PENDING (volta ao marketplace)', async () => {
      const order = await createBuyOrder('MATCHED');
      await createTx(order.id, payer.id);

      const result = await svc.cancelOrderByProvider(order.id, provider.id, cancelArgs.reason, cancelArgs.note);
      expect(result.penaltyApplied).toBe(false);

      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated.status).toBe('PENDING');
      expect(updated.providerId).toBeNull();

      const txs = await prisma.transaction.findMany({ where: { orderId: order.id } });
      expect(txs).toHaveLength(0);
    });

    it('b) estado inválido: PENDING não aceita cancelamento por provider', async () => {
      const order = await createBuyOrder('PENDING');

      await expect(
        svc.cancelOrderByProvider(order.id, provider.id, cancelArgs.reason, cancelArgs.note),
      ).rejects.toThrow('não pode ser cancelado no status atual');
    });

    it('c) não autorizado: providerId errado lança erro', async () => {
      const order = await createBuyOrder('MATCHED');

      await expect(
        svc.cancelOrderByProvider(order.id, `${suffix}-intruder`, cancelArgs.reason, cancelArgs.note),
      ).rejects.toThrow(/não é o provedor|não pode ser cancelado/);
    });

    it('d) não encontrado: orderId inexistente lança erro', async () => {
      await expect(
        svc.cancelOrderByProvider('non-existent-id', provider.id, cancelArgs.reason, cancelArgs.note),
      ).rejects.toThrow('não encontrado');
    });

    it('e) atomicidade: Promise.all → exatamente 1 sucesso + 1 falha', async () => {
      const order = await createBuyOrder('MATCHED');
      await createTx(order.id, payer.id);

      const results = await Promise.allSettled([
        svc.cancelOrderByProvider(order.id, provider.id, cancelArgs.reason, cancelArgs.note),
        svc.cancelOrderByProvider(order.id, provider.id, cancelArgs.reason, cancelArgs.note),
      ]);

      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      const final = await prisma.order.findUnique({ where: { id: order.id } });
      expect(final.status).toBe('PENDING');
      expect(final.providerId).toBeNull();
    }, 30_000);
  });
});
