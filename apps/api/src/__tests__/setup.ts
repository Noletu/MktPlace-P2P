// Setup file para testes
import { PrismaClient } from '@prisma/client';

// Configurar variáveis de ambiente para testes
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

// Mock do Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    notification: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Mock do logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Aumentar timeout para testes
jest.setTimeout(10000);
