/**
 * TESTE 1: Fluxo de Registro e KYC
 *
 * Cenário: Usuário novo se registra e completa KYC Level 1
 * - Registrar novo usuário
 * - Login
 * - Completar KYC Level 1
 * - Verificar limites de transação
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const API_URL = 'http://localhost:3001/api/v1';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
  }[type];

  console.log(`${color}${message}${colors.reset}`);
}

async function cleanupTestUser(cpf: string) {
  try {
    const result = await prisma.user.deleteMany({
      where: { cpf }
    });
    if (result.count > 0) {
      log(`✓ Removidos ${result.count} usuário(s) de teste anteriores`, 'info');
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function runTest() {
  const testUser = {
    email: `test${Date.now()}@example.com`,
    password: 'TestPass123!',
    cpf: '11144477735', // Valid CPF for testing (111.444.777-35)
    name: 'Usuário Teste',
  };

  let token: string = '';
  const bugs: string[] = [];

  try {
    log('\n=== TESTE 1: REGISTRO E KYC ===\n', 'info');

    // Cleanup previous test data
    await cleanupTestUser(testUser.cpf);

    // 1. Registrar usuário
    log('1. Registrando novo usuário...', 'info');
    try {
      const registerResponse = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser),
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json();
        throw new Error(`Registro falhou: ${error.error || registerResponse.statusText}`);
      }

      const registerData = await registerResponse.json();
      log(`✓ Usuário registrado: ${registerData.data.user.email}`, 'success');
    } catch (error: any) {
      bugs.push(`BUG #1: Erro no registro - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
      throw error;
    }

    // 2. Login
    log('\n2. Fazendo login...', 'info');
    try {
      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      if (!loginResponse.ok) {
        const error = await loginResponse.json();
        throw new Error(`Login falhou: ${error.error || loginResponse.statusText}`);
      }

      const loginData = await loginResponse.json();
      token = loginData.data.accessToken;
      log(`✓ Login realizado com sucesso`, 'success');
      log(`  Token: ${token.substring(0, 20)}...`, 'info');
    } catch (error: any) {
      bugs.push(`BUG #2: Erro no login - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
      throw error;
    }

    // 3. Verificar perfil
    log('\n3. Verificando perfil do usuário...', 'info');
    try {
      const meResponse = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!meResponse.ok) {
        throw new Error(`Falha ao buscar perfil: ${meResponse.statusText}`);
      }

      const meData = await meResponse.json();
      log(`✓ Perfil carregado: ${meData.data.email}`, 'success');
      log(`  KYC Level: ${meData.data.kycLevel}`, 'info');
      log(`  Reputação: ${meData.data.reputationScore}`, 'info');
    } catch (error: any) {
      bugs.push(`BUG #3: Erro ao buscar perfil - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // 4. Completar KYC Level 1
    log('\n4. Completando KYC Level 1...', 'info');
    try {
      const kycResponse = await fetch(`${API_URL}/kyc/level1`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: testUser.cpf,
          phone: '11987654321', // 11 digits phone
        }),
      });

      if (!kycResponse.ok) {
        const error = await kycResponse.json();
        throw new Error(`KYC falhou: ${error.error || kycResponse.statusText}`);
      }

      const kycData = await kycResponse.json();
      log(`✓ KYC Level 1 submetido`, 'success');
      log(`  KYC Level: ${kycData.kycLevel}`, 'info');
      log(`  Limite de transação: R$ ${kycData.transactionLimit}`, 'info');
    } catch (error: any) {
      bugs.push(`BUG #4: Erro ao submeter KYC - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // 5. Verificar limite de transação
    log('\n5. Verificando limites de transação...', 'info');
    try {
      const limitResponse = await fetch(`${API_URL}/kyc/check-limit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 5000, // R$ 5000 para testar
        }),
      });

      if (!limitResponse.ok) {
        throw new Error(`Falha ao buscar limite: ${limitResponse.statusText}`);
      }

      const limitData = await limitResponse.json();
      if (limitData.canTransact) {
        log(`✓ Transação de R$ 5000 permitida`, 'success');
        log(`  Limite de transação: R$ ${limitData.limit}`, 'info');
        log(`  Valor solicitado: R$ ${limitData.requestedAmount}`, 'info');
      } else {
        log(`✓ Transação não permitida (limite: R$ ${limitData.limit})`, 'warning');
      }
    } catch (error: any) {
      bugs.push(`BUG #5: Erro ao buscar limite - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // Relatório final
    log('\n=== RESULTADO DO TESTE ===\n', 'info');
    if (bugs.length === 0) {
      log('✓ TESTE PASSOU - Nenhum bug encontrado!', 'success');
      return { passed: true, bugs: [] };
    } else {
      log(`✗ TESTE FALHOU - ${bugs.length} bugs encontrados:`, 'error');
      bugs.forEach((bug, index) => {
        log(`  ${index + 1}. ${bug}`, 'error');
      });
      return { passed: false, bugs };
    }

  } catch (error: any) {
    log(`\n✗ TESTE FALHOU - Erro crítico: ${error.message}`, 'error');
    return { passed: false, bugs: [...bugs, `ERRO CRÍTICO: ${error.message}`] };
  }
}

// Executar teste
runTest()
  .then((result) => {
    return prisma.$disconnect().then(() => result);
  })
  .then((result) => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('Erro fatal:', error);
    prisma.$disconnect();
    process.exit(1);
  });

export { runTest };
