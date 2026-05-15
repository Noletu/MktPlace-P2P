// Defense-in-depth: ambos os seeds (prisma/seed.ts e prisma/seeds/rbac-seed.ts)
// têm guard NODE_ENV=production que lança ANTES de qualquer query.
//
// Estratégia: spawn dos scripts reais via tsx, com env customizado.
// Vantagens:
//  - Testa o binário real do jeito que CI / operador chamariam.
//  - Não importa o módulo direto (evita rodar main() em import e contaminar
//    mocks globais do setup.ts).
//  - DATABASE_URL aponta para destino inválido — quando o guard NÃO dispara,
//    a falha vem da conexão (assertiva: mensagem do guard nunca aparece).
import { spawnSync } from 'child_process';
import path from 'path';

const SEED = path.join(__dirname, '..', 'seed.ts');
const RBAC_SEED = path.join(__dirname, '..', 'seeds', 'rbac-seed.ts');
const INVALID_DSN = 'postgresql://invalid:invalid@127.0.0.1:1/nonexistent';

function runWithEnv(script: string, extraEnv: Record<string, string>) {
  const result = spawnSync('npx', ['tsx', script], {
    env: { ...process.env, ...extraEnv },
    encoding: 'utf-8',
    shell: true,
    timeout: 30_000,
  });
  return {
    status: result.status ?? -1,
    out: (result.stdout ?? '') + (result.stderr ?? ''),
  };
}

describe('Seed prod-guard (defense-in-depth)', () => {
  describe('prisma/seed.ts', () => {
    it('NODE_ENV=production: lança com mensagem citando TECH-DEBT-OP02, sem tocar Prisma', () => {
      const { status, out } = runWithEnv(SEED, {
        NODE_ENV: 'production',
        DATABASE_URL: INVALID_DSN,
      });

      expect(status).not.toBe(0);
      expect(out).toMatch(/seed\.ts contains hardcoded dev credentials/);
      expect(out).toMatch(/TECH-DEBT-OP02/);
      // Asserção forte: o guard disparou ANTES de qualquer chamada Prisma.
      // Se tivesse passado, veríamos erro de conexão (P1001 / ECONNREFUSED).
      expect(out).not.toMatch(/ECONNREFUSED|P1001|P1000/);
    }, 60_000);

    it('NODE_ENV=development: guard NÃO dispara (falha em outro lugar — DB ou roles)', () => {
      const { out } = runWithEnv(SEED, {
        NODE_ENV: 'development',
        DATABASE_URL: INVALID_DSN,
      });

      // Não importa o exit code aqui — sem DB real ele falha de qualquer jeito.
      // O que importa é que a MENSAGEM do guard de prod não aparece.
      expect(out).not.toMatch(/must NEVER run in production/);
      expect(out).not.toMatch(/seed\.ts contains hardcoded dev credentials/);
    }, 60_000);
  });

  describe('prisma/seeds/rbac-seed.ts', () => {
    it('NODE_ENV=production: lança com mensagem citando TECH-DEBT-OP02', () => {
      const { status, out } = runWithEnv(RBAC_SEED, {
        NODE_ENV: 'production',
        DATABASE_URL: INVALID_DSN,
      });

      expect(status).not.toBe(0);
      expect(out).toMatch(/rbac-seed\.ts must NEVER run in production/);
      expect(out).toMatch(/TECH-DEBT-OP02/);
      expect(out).not.toMatch(/ECONNREFUSED|P1001|P1000/);
    }, 60_000);

    it('NODE_ENV=development: guard NÃO dispara', () => {
      const { out } = runWithEnv(RBAC_SEED, {
        NODE_ENV: 'development',
        DATABASE_URL: INVALID_DSN,
      });

      expect(out).not.toMatch(/must NEVER run in production/);
    }, 60_000);
  });
});
