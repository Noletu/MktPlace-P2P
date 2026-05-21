// CRIT-02: integration test — requer Postgres real rodando.
// Garante que hdAccountIndex é alocado via Postgres SEQUENCE (anti-colisão),
// é imutável após criação, e é ortogonal ao roleId (custódia ≠ papel).
//
// DerivationService é stubado com função determinística para isolar os testes
// do CRIT-02 (DB layer) de bibliotecas de derivação criptográfica (ESM / internals).
// O stub garante a propriedade testada: mesmo hdAccountIndex → mesmo endereço.
jest.unmock('@prisma/client');
jest.mock('../hd-wallet/derivation.service', () => ({
  DerivationService: {
    deriveUserWallet: jest.fn(
      (hdAccountIndex: bigint, cryptoType: string, network: string) => ({
        address: `addr-${hdAccountIndex.toString()}-${cryptoType}-${network}`,
        privateKey: `pk-${hdAccountIndex.toString()}`,
        derivationPath: `m/44'/0'/${hdAccountIndex.toString()}'/0'/0'`,
      }),
    ),
    derivePlatformWallet: jest.fn((cryptoType: string, network: string) => ({
      address: `platform-addr-${cryptoType}-${network}`,
      privateKey: 'platform-pk',
      derivationPath: `m/44'/0'/0'/0'/0'`,
    })),
  },
}));
jest.mock('../hd-wallet/master-seed.service', () => ({
  MasterSeedService: {
    getMasterSeed: jest.fn(() => Buffer.alloc(64, 0x42)),
    validateSetup: jest.fn(),
    initialize: jest.fn(),
  },
}));
// @ethereumjs/wallet é ESM-only (importa @noble/curves via TypeScript source).
// Mock necessário para que jest.requireActual('../hd-wallet/derivation.service')
// não dispare a cadeia ESM ao carregar o módulo real no describe de boundary.
jest.mock('@ethereumjs/wallet', () => ({
  Wallet: {
    fromPrivateKey: jest.fn(() => ({
      getAddressString: () => '0x0000000000000000000000000000000000000001',
      getPrivateKeyString: () => '0x0000000000000000000000000000000000000000000000000000000000000001',
    })),
  },
}));
jest.mock('../email.service', () => ({
  emailService: { sendEmail: jest.fn() },
}));
jest.mock('../notification.service', () => ({
  notificationService: { create: jest.fn() },
}));

export {};

const RUN_INTEGRATION = (process.env.DATABASE_URL ?? '').startsWith('postgresql://');
const describeIfPg = RUN_INTEGRATION ? describe : describe.skip;

let prisma: any;
let DerivationService: any;
if (RUN_INTEGRATION) {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  ({ DerivationService } = require('../hd-wallet/derivation.service'));
}

function sortBigInts(arr: bigint[]): bigint[] {
  return [...arr].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

describeIfPg('CRIT-02: hdAccountIndex persistido via Postgres SEQUENCE', () => {
  const testSuffix = Date.now().toString();
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];

  async function createTestUser(tag: string) {
    const user = await prisma.user.create({
      data: {
        email: `crit02-${tag}-${testSuffix}@test.local`,
        password: 'test-hash',
      },
      select: { id: true, hdAccountIndex: true },
    });
    createdUserIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdRoleIds.length > 0) {
      await prisma.role.deleteMany({ where: { id: { in: createdRoleIds } } });
    }
    await prisma.$disconnect();
  });

  // (a) Dois usuários recebem hdAccountIndex distintos
  it('(a) dois usuários recebem hdAccountIndex distintos', async () => {
    const u1 = await createTestUser('a1');
    const u2 = await createTestUser('a2');

    expect(u1.hdAccountIndex).toBeGreaterThan(0n);
    expect(u2.hdAccountIndex).toBeGreaterThan(0n);
    expect(u1.hdAccountIndex).not.toEqual(u2.hdAccountIndex);
  });

  // (b) Sequence incremental: 3 criações sequenciais produzem 3 índices consecutivos
  it('(b) criações sequenciais produzem índices consecutivos sem lacunas', async () => {
    const u1 = await createTestUser('b1');
    const u2 = await createTestUser('b2');
    const u3 = await createTestUser('b3');

    const indices = [u1.hdAccountIndex, u2.hdAccountIndex, u3.hdAccountIndex];
    const sorted = sortBigInts(indices);

    // Todos distintos
    expect(new Set(indices.map(String)).size).toBe(3);
    // Formam intervalo contíguo: max - min + 1 = 3
    expect(sorted[2] - sorted[0] + 1n).toEqual(3n);
  });

  // (c) Mesmo hdAccountIndex sempre deriva o MESMO endereço (determinístico)
  it('(c) mesmo hdAccountIndex deriva endereço idêntico em chamadas repetidas', () => {
    const idx = 42n;
    const r1 = DerivationService.deriveUserWallet(idx, 'BTC', 'BITCOIN');
    const r2 = DerivationService.deriveUserWallet(idx, 'BTC', 'BITCOIN');

    expect(r1.address).toBe(r2.address);
    expect(r1.derivationPath).toBe(r2.derivationPath);
  });

  // (d) PRINCIPAL: mudar roleId NÃO altera hdAccountIndex nem o endereço derivado.
  // Transforma a decisão conceitual "custódia é ortogonal a papel" em garantia executável.
  it('(d) atualizar roleId não modifica hdAccountIndex nem endereço derivado', async () => {
    const roleA = await prisma.role.create({
      data: { name: `RoleA-${testSuffix}`, slug: `role-a-${testSuffix}` },
    });
    const roleB = await prisma.role.create({
      data: { name: `RoleB-${testSuffix}`, slug: `role-b-${testSuffix}` },
    });
    createdRoleIds.push(roleA.id, roleB.id);

    // Cria usuário com roleA
    const user = await prisma.user.create({
      data: {
        email: `crit02-d-${testSuffix}@test.local`,
        password: 'test-hash',
        roleId: roleA.id,
      },
      select: { id: true, hdAccountIndex: true, roleId: true },
    });
    createdUserIds.push(user.id);

    const indexBefore = user.hdAccountIndex;
    const addressBefore = DerivationService.deriveUserWallet(
      indexBefore,
      'BTC',
      'BITCOIN',
    ).address;

    // Troca roleId para roleB
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { roleId: roleB.id },
      select: { hdAccountIndex: true, roleId: true },
    });

    const indexAfter = updated.hdAccountIndex;
    const addressAfter = DerivationService.deriveUserWallet(
      indexAfter,
      'BTC',
      'BITCOIN',
    ).address;

    // hdAccountIndex é idêntico antes e depois da troca de role
    expect(indexAfter).toEqual(indexBefore);
    // Endereço derivado é idêntico — custódia é ortogonal a papel
    expect(addressAfter).toBe(addressBefore);
    // Role foi de fato alterado (confirma que o update executou)
    expect(updated.roleId).toBe(roleB.id);
  });

  // (e) Account 0 (plataforma) deriva endereço DISTINTO de qualquer usuário
  it('(e) endereço da plataforma (account 0) é distinto de endereços de usuários', () => {
    const platformAddr = DerivationService.derivePlatformWallet('BTC', 'BITCOIN').address;

    for (let idx = 1n; idx <= 5n; idx++) {
      const userAddr = DerivationService.deriveUserWallet(idx, 'BTC', 'BITCOIN').address;
      expect(userAddr).not.toBe(platformAddr);
    }
  });

  // (f) Alocação concorrente: 10 usuários em Promise.all → todos hdAccountIndex únicos
  it('(f) Promise.all com 10 criações concorrentes retorna hdAccountIndex únicos e > 0', async () => {
    const N = 10;
    const users = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        prisma.user.create({
          data: {
            email: `crit02-f${i}-${testSuffix}@test.local`,
            password: 'test-hash',
          },
          select: { id: true, hdAccountIndex: true },
        }),
      ),
    );
    users.forEach(u => createdUserIds.push(u.id));

    const indices = users.map(u => u.hdAccountIndex);

    // Todos > 0 (account 0 reservado para carteira da plataforma)
    indices.forEach(idx => expect(idx).toBeGreaterThan(0n));
    // Todos distintos — a sequence Postgres é atômica sob concorrência
    expect(new Set(indices.map(String)).size).toBe(N);
  }, 30_000);
});

// Teste de fronteira BIP32 — não requer Postgres, exercita o serviço real.
// jest.requireActual carrega o DerivationService real (não o stub do describe acima).
// A guard lança ANTES de qualquer chamada ao bip32/MasterSeedService, então
// ESM e WASM não são invocados — o teste é puro e síncrono.
describe('CRIT-02: guard BIP32 — rejeita índice além do limite hardened', () => {
  const BIP32_HARDENED_MAX = 0x80000000n; // 2^31

  const { DerivationService: RealDerivationService } = jest.requireActual(
    '../hd-wallet/derivation.service',
  );

  it('deriveUserWallet lança RangeError para hdAccountIndex >= 2^31', () => {
    // AT the limit (2^31 = primeiro índice inválido)
    expect(() =>
      RealDerivationService.deriveUserWallet(BIP32_HARDENED_MAX, 'BTC', 'BITCOIN'),
    ).toThrow(RangeError);

    // ABOVE the limit
    expect(() =>
      RealDerivationService.deriveUserWallet(BIP32_HARDENED_MAX + 1n, 'BTC', 'BITCOIN'),
    ).toThrow(RangeError);
  });

  it('deriveNextAddress lança RangeError para hdAccountIndex >= 2^31', () => {
    expect(() =>
      RealDerivationService.deriveNextAddress(BIP32_HARDENED_MAX, 'BTC', 'BITCOIN', 0),
    ).toThrow(RangeError);
  });
});
