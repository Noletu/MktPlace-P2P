// CRIT-07: TOTP replay protection.
//
// RFC 6238 §5.2: implementações DEVEM rejeitar reuso do mesmo token TOTP
// dentro da janela de validade. Antes deste fix, speakeasy.totp.verify
// retornava true para o mesmo código múltiplas vezes em ~30-90s.
//
// Estratégia dos testes:
// - Integration test contra Postgres real (skipa sem DATABASE_URL postgres).
// - Cria um usuário com secret TOTP conhecido + 2FA habilitado.
// - Gera tokens TOTP via speakeasy direto, com `time` controlado, para
//   simular steps específicos sem aguardar 30s reais.
// - Mock spy em securityLogger.totpReplay para verificar logging.
jest.unmock('@prisma/client');

// O setup.ts global mocka `../utils/logger` exportando apenas { logger }.
// Aqui re-mockamos para incluir também `securityLogger` (que o service usa
// agora pelo CRIT-07) sem disparar transports de winston em testes.
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  securityLogger: {
    totpReplay: jest.fn(),
    twoFactor: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    unauthorized: jest.fn(),
    rateLimit: jest.fn(),
    suspiciousActivity: jest.fn(),
  },
  auditLogger: {
    orderCreated: jest.fn(),
    orderMatched: jest.fn(),
    transactionCompleted: jest.fn(),
    kycUpdated: jest.fn(),
    withdrawal: jest.fn(),
  },
}));

import speakeasy from 'speakeasy';
import { securityLogger } from '../../utils/logger';

const RUN_INTEGRATION = (process.env.DATABASE_URL ?? '').startsWith('postgresql://');
const describeIfPg = RUN_INTEGRATION ? describe : describe.skip;

let prisma: any;
let twoFactorService: any;
if (RUN_INTEGRATION) {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  ({ twoFactorService } = require('../twoFactor.service'));
}

const TOTP_STEP_SECONDS = 30;

// Gera um secret base32 para 2FA — mesmo que speakeasy.generateSecret faria.
function makeSecret(): string {
  return speakeasy.generateSecret({ length: 32 }).base32;
}

// Gera um token TOTP para um step específico (ms-epoch / 30 = step).
// Permite testar "próximo step" sem aguardar 30s reais.
function generateTokenAt(secret: string, atStepSec: number): string {
  return speakeasy.totp({
    secret,
    encoding: 'base32',
    time: atStepSec, // speakeasy aceita segundos absolutos via `time`
  });
}

describeIfPg('CRIT-07: TOTP replay protection', () => {
  const baseId = `test-crit07-${Date.now()}`;
  let userId: string;
  let secret: string;
  // Step "agora" capturado no início do teste — testes geram tokens nesse step.
  // floor(Date.now()/1000/30) com unidade pra speakeasy é segundos: passamos
  // `time` em segundos. Aqui calculamos uma vez para consistência.
  let nowSec: number;
  let nowStep: number;

  beforeEach(async () => {
    // Limpa todos os mocks (incluindo jest.fn() de securityLogger declarados
    // no jest.mock acima) — testes anteriores deixam histórico de chamadas
    // que confunde spies do teste atual.
    jest.clearAllMocks();

    userId = `${baseId}-${Math.random().toString(36).slice(2, 8)}`;
    secret = makeSecret();
    nowSec = Math.floor(Date.now() / 1000);
    nowStep = Math.floor(nowSec / TOTP_STEP_SECONDS);

    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@crit07.test`,
        password: 'test-hash',
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorLastUsedStep: null,
      },
    });
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('a) Token TOTP válido novo é aceito', async () => {
    const token = generateTokenAt(secret, nowSec);
    const ok = await twoFactorService.verifyToken(userId, token);
    expect(ok).toBe(true);

    const after = await prisma.user.findUnique({ where: { id: userId } });
    // Após sucesso, twoFactorLastUsedStep deve estar marcado com o step atual.
    expect(after.twoFactorLastUsedStep).not.toBeNull();
    expect(Number(after.twoFactorLastUsedStep)).toBe(nowStep);
  });

  it('b) Mesmo token reusado em segundos é rejeitado (replay)', async () => {
    const token = generateTokenAt(secret, nowSec);

    const first = await twoFactorService.verifyToken(userId, token);
    expect(first).toBe(true);

    const second = await twoFactorService.verifyToken(userId, token);
    expect(second).toBe(false);

    // Sanity: o step gravado permanece o mesmo, não regrediu.
    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(Number(after.twoFactorLastUsedStep)).toBe(nowStep);
  });

  it('c) Token novo gerado no próximo step de 30s é aceito', async () => {
    const tokenNow = generateTokenAt(secret, nowSec);
    const tokenNext = generateTokenAt(secret, nowSec + TOTP_STEP_SECONDS);
    // Sanity: tokens são diferentes (steps distintos)
    expect(tokenNow).not.toBe(tokenNext);

    expect(await twoFactorService.verifyToken(userId, tokenNow)).toBe(true);

    // Quando o "agora" do servidor avança um step, tokenNext entra na janela
    // window=1. Como não podemos avançar Date.now real, simulamos congelando
    // Date.now no step seguinte para esta verificação.
    const spy = jest.spyOn(Date, 'now').mockReturnValue((nowSec + TOTP_STEP_SECONDS) * 1000);
    try {
      expect(await twoFactorService.verifyToken(userId, tokenNext)).toBe(true);
    } finally {
      spy.mockRestore();
    }

    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(Number(after.twoFactorLastUsedStep)).toBe(nowStep + 1);
  });

  it('d) Token de step passado (delta=-1) é aceito uma vez, rejeitado se reusado', async () => {
    // Token assinado para step anterior (entra na window=1 como delta=-1).
    const tokenPrev = generateTokenAt(secret, nowSec - TOTP_STEP_SECONDS);
    expect(await twoFactorService.verifyToken(userId, tokenPrev)).toBe(true);

    // Confere que o step marcado é o anterior (nowStep - 1), não o atual.
    const mid = await prisma.user.findUnique({ where: { id: userId } });
    expect(Number(mid.twoFactorLastUsedStep)).toBe(nowStep - 1);

    // Replay do mesmo token agora deve falhar.
    expect(await twoFactorService.verifyToken(userId, tokenPrev)).toBe(false);

    // Mas o token atual ainda funciona (step atual > step anterior).
    const tokenNow = generateTokenAt(secret, nowSec);
    expect(await twoFactorService.verifyToken(userId, tokenNow)).toBe(true);

    const final = await prisma.user.findUnique({ where: { id: userId } });
    expect(Number(final.twoFactorLastUsedStep)).toBe(nowStep);
  });

  it('e) securityLogger.totpReplay é chamado em tentativa de replay', async () => {
    const spy = jest.spyOn(securityLogger, 'totpReplay').mockImplementation(() => undefined);
    const token = generateTokenAt(secret, nowSec);

    await twoFactorService.verifyToken(userId, token); // 1ª — passa
    expect(spy).not.toHaveBeenCalled();

    await twoFactorService.verifyToken(userId, token); // 2ª — replay
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        currentStep: nowStep,
        lastUsed: String(nowStep),
        reason: 'step_already_consumed',
      }),
    );
  });

  it('f) Update de twoFactorLastUsedStep é atômico: 2 requests concorrentes → 1 sucesso, 1 falha', async () => {
    const token = generateTokenAt(secret, nowSec);

    // Dispara 2 verifyToken paralelos com o MESMO token e MESMO userId.
    // Ambos veem twoFactorLastUsedStep=null no findUnique, ambos passam pelo
    // replay check, ambos tentam updateMany. Apenas a primeira UPDATE
    // satisfaz a condição WHERE (porque a segunda chega num momento em que
    // já foi atualizado). count=1 vs count=0 distinguidos pelo banco.
    const results = await Promise.all([
      twoFactorService.verifyToken(userId, token),
      twoFactorService.verifyToken(userId, token),
    ]);

    const successes = results.filter(r => r === true).length;
    const failures = results.filter(r => r === false).length;
    expect(successes).toBe(1);
    expect(failures).toBe(1);

    // Estado final: step marcado corretamente, não há corrupção.
    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(Number(after.twoFactorLastUsedStep)).toBe(nowStep);
  });
});
