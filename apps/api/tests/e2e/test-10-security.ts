/**
 * TESTE 10: Edge Cases e Segurança
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

const colors = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', blue: '\x1b[34m' };
function log(msg: string, type: 'info' | 'success' | 'error' = 'info') {
  console.log(`${colors[type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue']}${msg}${colors.reset}`);
}

async function runTest() {
  const bugs: string[] = [];

  try {
    log('\n=== TESTE 10: SEGURANÇA ===\n', 'info');

    // Test 1: Endpoint sem autenticação
    try {
      const res = await fetch(`${API_URL}/orders/marketplace`);
      if (res.status === 401) {
        log('✓ Proteção de auth funciona (401)', 'success');
      } else {
        throw new Error('Endpoint sem proteção');
      }
    } catch (error: any) {
      bugs.push(`BUG: ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // Test 2: CPF inválido
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.com',
          password: 'TestPass123!',
          cpf: '12345678901', // Invalid
        }),
      });

      const data = await res.json();
      if (res.status === 400 && data.error) {
        log('✓ Validação de CPF funciona', 'success');
      } else {
        throw new Error('CPF inválido aceito');
      }
    } catch (error: any) {
      bugs.push(`BUG: ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // Test 3: Senha fraca
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test2@test.com',
          password: '123', // Weak
          cpf: '11144477735',
        }),
      });

      const data = await res.json();
      if (res.status === 400 && data.error) {
        log('✓ Validação de senha funciona', 'success');
      } else {
        throw new Error('Senha fraca aceita');
      }
    } catch (error: any) {
      bugs.push(`BUG: ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

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
