/**
 * TESTE 6: Sistema de Avaliações
 * - Testar endpoints de reviews
 * - Verificar reputação
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

const colors = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', blue: '\x1b[34m' };

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = { info: colors.blue, success: colors.green, error: colors.red, warning: colors.yellow }[type];
  console.log(`${color}${message}${colors.reset}`);
}

async function runTest() {
  const bugs: string[] = [];

  try {
    log('\n=== TESTE 6: SISTEMA DE AVALIAÇÕES ===\n', 'info');

    // CPF: 52998224725 (valid)
    const testUser = { email: `review${Date.now()}@example.com`, password: 'TestPass123!', cpf: '52998224725' };

    const existing = await prisma.user.findUnique({ where: { cpf: testUser.cpf } });
    if (existing) {
      await prisma.$executeRawUnsafe(`DELETE FROM "Order" WHERE "userId" = '${existing.id}'`);
      await prisma.user.delete({ where: { id: existing.id } });
    }

    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });

    const { data: { accessToken: token, user } } = await loginRes.json();
    const userId = user.id;
    log('1. Usuário configurado', 'success');

    // Testar endpoints de reviews
    log('\n2. Testando endpoints de reviews...', 'info');
    try {
      const reviewsRes = await fetch(`${API_URL}/reviews/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        log(`✓ Endpoint de reviews: ${reviewsData.data?.length || 0} avaliações`, 'success');
      } else {
        throw new Error('Falha ao buscar reviews');
      }
    } catch (error: any) {
      bugs.push(`BUG #1: Erro em reviews - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // Relatório
    log('\n=== RESULTADO ===\n', 'info');
    if (bugs.length === 0) {
      log('✓ TESTE PASSOU', 'success');
      return { passed: true, bugs: [] };
    } else {
      log(`✗ ${bugs.length} bugs`, 'error');
      return { passed: false, bugs };
    }

  } catch (error: any) {
    log(`\n✗ Erro: ${error.message}`, 'error');
    return { passed: false, bugs: [...bugs, error.message] };
  }
}

runTest()
  .then((result) => prisma.$disconnect().then(() => result))
  .then((result) => process.exit(result.passed ? 0 : 1))
  .catch(() => { prisma.$disconnect(); process.exit(1); });

export { runTest };
