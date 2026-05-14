import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Singleton
 *
 * IMPORTANTE: Use SEMPRE este singleton em vez de criar novas instâncias.
 * Isso reduz contenção de conexões e melhora performance do SQLite.
 *
 * @example
 * import { prisma } from '../utils/prisma';
 *
 * const users = await prisma.user.findMany();
 */

// Singleton global para evitar múltiplas instâncias
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  });

// Em desenvolvimento, preservar a instância entre hot-reloads
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Configurar SQLite para melhor concorrência
 *
 * - busy_timeout: Tempo de espera quando banco está locked (30s)
 * - journal_mode=WAL: Write-Ahead Logging para melhor concorrência
 * - synchronous=NORMAL: Balance entre segurança e performance
 */
async function configureSQLite() {
  try {
    // Aumentar timeout para 30 segundos
    await prisma.$queryRaw`PRAGMA busy_timeout = 30000`;

    // Habilitar Write-Ahead Logging (permite leituras durante writes)
    await prisma.$queryRaw`PRAGMA journal_mode = WAL`;

    // Configurar sincronização normal (mais rápido que FULL, seguro o suficiente)
    await prisma.$queryRaw`PRAGMA synchronous = NORMAL`;

    console.log('✅ SQLite configured for better concurrency');
  } catch (error) {
    console.error('⚠️ Failed to configure SQLite:', error);
  }
}

// Configurar na inicialização
if (process.env.DATABASE_URL?.includes('file:')) {
  configureSQLite();
}

/**
 * Graceful shutdown do Prisma
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
  console.log('🔌 Prisma disconnected');
}

// Cleanup ao encerrar processo
process.on('beforeExit', async () => {
  await disconnectPrisma();
});
