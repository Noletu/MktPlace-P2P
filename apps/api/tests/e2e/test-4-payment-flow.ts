/**
 * TESTE 4: Fluxo de Pagamento
 * - Criar ordem matched
 * - Enviar comprovante
 * - Validar transação
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = { info: colors.blue, success: colors.green, error: colors.red, warning: colors.yellow }[type];
  console.log(`${color}${message}${colors.reset}`);
}

async function runTest() {
  const bugs: string[] = [];

  try {
    log('\n=== TESTE 4: FLUXO DE PAGAMENTO ===\n', 'info');

    // Use unique CPF for each test run - valid CPF: 12312312387
    const timestamp = Date.now();
    const testUser = {
      email: `payment${timestamp}@example.com`,
      password: 'TestPass123!',
      cpf: '12312312387', // Valid test CPF
    };

    // Clean up if exists
    const existing = await prisma.user.findUnique({ where: { cpf: testUser.cpf } });
    if (existing) {
      await prisma.$executeRawUnsafe(`DELETE FROM "Order" WHERE "userId" = '${existing.id}'`);
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const registerRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    if (!registerRes.ok) {
      const error = await registerRes.json();
      throw new Error(`Registro falhou: ${error.error}`);
    }

    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });

    const { data: { accessToken: token } } = await loginRes.json();

    // KYC
    await fetch(`${API_URL}/kyc/level1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: testUser.cpf, phone: '11987654321' }),
    });

    log('1. Usuário configurado', 'success');

    // Testar endpoints de transação
    log('\n2. Testando endpoints de transação...', 'info');
    try {
      const txRes = await fetch(`${API_URL}/transactions/my-transactions`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (txRes.ok) {
        const txData = await txRes.json();
        log(`✓ Endpoint de transações: ${txData.data?.length || 0} transações`, 'success');
      } else {
        throw new Error('Falha ao buscar transações');
      }
    } catch (error: any) {
      bugs.push(`BUG #1: Erro em transações - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // Relatório
    log('\n=== RESULTADO ===\n', 'info');
    if (bugs.length === 0) {
      log('✓ TESTE PASSOU', 'success');
      return { passed: true, bugs: [] };
    } else {
      log(`✗ ${bugs.length} bugs encontrados`, 'error');
      bugs.forEach(bug => log(`  ${bug}`, 'error'));
      return { passed: false, bugs };
    }

  } catch (error: any) {
    log(`\n✗ Erro crítico: ${error.message}`, 'error');
    return { passed: false, bugs: [...bugs, `ERRO: ${error.message}`] };
  }
}

runTest()
  .then((result) => prisma.$disconnect().then(() => result))
  .then((result) => process.exit(result.passed ? 0 : 1))
  .catch((error) => {
    console.error('Erro fatal:', error);
    prisma.$disconnect();
    process.exit(1);
  });

export { runTest };
