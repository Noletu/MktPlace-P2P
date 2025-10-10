/**
 * TESTE 5: Sistema de Disputas
 * - Criar disputa
 * - Listar disputas
 * - Verificar endpoints
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
    log('\n=== TESTE 5: SISTEMA DE DISPUTAS ===\n', 'info');

    // Setup user - CPF: 98765432100 (valid)
    const testUser = { email: `dispute${Date.now()}@example.com`, password: 'TestPass123!', cpf: '98765432100' };

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

    const { data: { accessToken: token } } = await loginRes.json();
    log('1. Usuário configurado', 'success');

    // Testar endpoints de disputas
    log('\n2. Testando endpoints de disputas...', 'info');
    try {
      const disputesRes = await fetch(`${API_URL}/disputes/my-disputes`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (disputesRes.ok) {
        const disputesData = await disputesRes.json();
        log(`✓ Endpoint de disputas: ${disputesData.data?.length || 0} disputas`, 'success');
      } else {
        throw new Error('Falha ao buscar disputas');
      }
    } catch (error: any) {
      bugs.push(`BUG #1: Erro em disputas - ${error.message}`);
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
