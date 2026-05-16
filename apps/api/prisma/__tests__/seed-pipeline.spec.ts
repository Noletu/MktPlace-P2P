// TECH-DEBT-DEV01: seed pipeline one-shot.
//
// Antes: prisma/seed.ts falhava cripticamente se prisma/seeds/rbac-seed.ts
// não fosse executado em comando separado. Agora seed.ts chama seedRBAC()
// internamente, e a stack inteira (RBAC + users) é idempotente.
//
// Estratégia: roda `npx prisma db seed` via spawn várias vezes em estados
// distintos do banco, e confere contagens via Prisma direto. Requer Postgres
// real — skipa em ambiente CI sem DATABASE_URL postgresql.
jest.unmock('@prisma/client');

import { spawnSync } from 'child_process';
import path from 'path';

const RUN_INTEGRATION = (process.env.DATABASE_URL ?? '').startsWith('postgresql://');
const describeIfPg = RUN_INTEGRATION ? describe : describe.skip;
const API_DIR = path.join(__dirname, '..', '..');

let prisma: any;
if (RUN_INTEGRATION) {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
}

function runSeed() {
  const result = spawnSync('npx', ['prisma', 'db', 'seed'], {
    cwd: API_DIR,
    env: { ...process.env, NODE_ENV: 'development' },
    encoding: 'utf-8',
    shell: true,
    timeout: 60_000,
  });
  return {
    status: result.status ?? -1,
    out: (result.stdout ?? '') + (result.stderr ?? ''),
  };
}

function runMigrateReset() {
  const result = spawnSync('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-seed'], {
    cwd: API_DIR,
    env: { ...process.env },
    encoding: 'utf-8',
    shell: true,
    timeout: 120_000,
  });
  return result.status ?? -1;
}

async function counts() {
  const [roles, permissions, rolePermissions, users] = await Promise.all([
    prisma.role.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    prisma.user.count(),
  ]);
  return { roles, permissions, rolePermissions, users };
}

describeIfPg('TECH-DEBT-DEV01: seed pipeline one-shot', () => {
  beforeAll(async () => {
    // DB virgem: drop completo + recria schema sem rodar seed
    expect(runMigrateReset()).toBe(0);
    const initial = await counts();
    expect(initial).toEqual({ roles: 0, permissions: 0, rolePermissions: 0, users: 0 });
  }, 180_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('DB virgem + db seed: cria roles RBAC E users na mesma invocação', async () => {
    const r = runSeed();
    expect(r.status).toBe(0);

    // seedRBAC rodou e populou a base RBAC
    expect(r.out).toMatch(/RBAC Seed/);
    expect(r.out).toMatch(/Seed RBAC concluído com sucesso/);

    // seed.ts rodou em seguida e populou os users
    expect(r.out).toMatch(/Iniciando seed do banco de dados/);
    expect(r.out).toMatch(/Usuário MASTER criado/);
    expect(r.out).toMatch(/Usuário admin criado/);

    const c = await counts();
    expect(c).toEqual({ roles: 5, permissions: 30, rolePermissions: 83, users: 2 });
  }, 120_000);

  it('DB já populado + db seed: idempotente (mesmas contagens, sem duplicar)', async () => {
    const before = await counts();
    expect(before).toEqual({ roles: 5, permissions: 30, rolePermissions: 83, users: 2 });

    const r = runSeed();
    expect(r.status).toBe(0);

    // Apesar de logs falando "criado", upsert por slug/name + update do user
    // mantém contagem estável.
    const after = await counts();
    expect(after).toEqual(before);
  }, 120_000);

  it('Apaga users (mantém RBAC) + db seed: recria users sem duplicar roles', async () => {
    // Limpa só os users; RBAC permanece intacto.
    await prisma.user.deleteMany({ where: { email: { in: ['master@mktplace.com', 'admin@mktplace.com'] } } });
    const mid = await counts();
    expect(mid).toEqual({ roles: 5, permissions: 30, rolePermissions: 83, users: 0 });

    const r = runSeed();
    expect(r.status).toBe(0);

    // seedRBAC roda mas todos os upserts são no-op (já existem) — RBAC counts
    // permanecem 5/30/83. Os usuários são recriados de zero.
    const final = await counts();
    expect(final).toEqual({ roles: 5, permissions: 30, rolePermissions: 83, users: 2 });
  }, 120_000);

  it('seed.ts NÃO depende mais de rbac-seed.ts ter sido executado antes (TECH-DEBT-DEV01)', async () => {
    // Cenário do bug original: alguém apaga roles e tenta só `db seed`.
    // Antes do fix: errava com "Roles RBAC não encontrados! Execute primeiro..."
    // Depois do fix: seedRBAC é orquestrado internamente, roda transparente.
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    const purged = await counts();
    expect(purged.roles).toBe(0);
    expect(purged.permissions).toBe(0);

    const r = runSeed();
    expect(r.status).toBe(0);
    expect(r.out).not.toMatch(/Execute primeiro/);  // mensagem antiga sumiu
    expect(r.out).not.toMatch(/Roles RBAC não encontrados/);

    const after = await counts();
    expect(after.roles).toBe(5);
    expect(after.permissions).toBe(30);
    expect(after.rolePermissions).toBe(83);
  }, 120_000);
});
