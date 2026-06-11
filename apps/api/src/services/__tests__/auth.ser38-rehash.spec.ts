// SER-38: teste de integração do rehash transparente no login (verifyCredentials).
jest.unmock('@prisma/client');

jest.mock('../../utils/logger', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return {
    logger,
    default: logger,
    securityLogger: {
      login: jest.fn(),
      register: jest.fn(),
      unauthorized: jest.fn(),
      rateLimit: jest.fn(),
      suspiciousActivity: jest.fn(),
      twoFactor: jest.fn(),
      totpReplay: jest.fn(),
    },
    auditLogger: {
      orderCreated: jest.fn(),
      orderMatched: jest.fn(),
      transactionCompleted: jest.fn(),
      kycUpdated: jest.fn(),
      withdrawal: jest.fn(),
    },
  };
});

import bcrypt from 'bcryptjs';

const RUN_INTEGRATION = (process.env.DATABASE_URL ?? '').startsWith('postgresql://');
const describeIfPg = RUN_INTEGRATION ? describe : describe.skip;

let prisma: any;
let authService: any;
if (RUN_INTEGRATION) {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  ({ authService } = require('../auth.service'));
}

describeIfPg('SER-38: rehash transparente no login', () => {
  const baseId = `test-ser38-${Date.now()}`;
  let userId: string;

  afterEach(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('usuário cost-10 é migrado para cost-12 no login bem-sucedido', async () => {
    userId = `${baseId}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `${userId}@ser38.test`;
    const senha = 'senha-correta-123';
    const hashCost10 = await bcrypt.hash(senha, 10);

    await prisma.user.create({
      data: { id: userId, email, password: hashCost10, twoFactorEnabled: false },
    });

    const result = await authService.verifyCredentials({ email, password: senha });

    expect(result).not.toBeNull();
    expect(result.userId).toBe(userId);

    const updated = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    expect(bcrypt.getRounds(updated.password)).toBe(12);
    expect(await bcrypt.compare(senha, updated.password)).toBe(true);
  });

  it('usuário cost-12 não tem o hash alterado no login', async () => {
    userId = `${baseId}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `${userId}@ser38.test`;
    const senha = 'senha-correta-456';
    const hashCost12 = await bcrypt.hash(senha, 12);

    await prisma.user.create({
      data: { id: userId, email, password: hashCost12, twoFactorEnabled: false },
    });

    const result = await authService.verifyCredentials({ email, password: senha });

    expect(result).not.toBeNull();

    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    expect(after.password).toBe(hashCost12);
  });
});
