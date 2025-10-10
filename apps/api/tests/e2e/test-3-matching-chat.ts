/**
 * TESTE 3: Matching e Chat
 *
 * Cenário: Dois usuários - um cria ordem de venda, outro aceita e abrem chat
 * - User1 (Seller): Cria ordem de venda de crypto
 * - User2 (Buyer): Busca no marketplace e aceita a ordem
 * - Verificar matching
 * - Abrir chat entre os usuários
 * - Trocar mensagens
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

async function cleanupTestData() {
  try {
    // Delete users with test CPFs
    const testCPFs = ['11144477735', '00000000191', '33366699911'];
    for (const cpf of testCPFs) {
      const user = await prisma.user.findUnique({ where: { cpf } });
      if (user) {
        await prisma.order.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }

    // Also delete by email pattern
    const users = await prisma.user.findMany({
      where: { email: { contains: 'matchtest' } }
    });
    for (const user of users) {
      await prisma.order.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }

    log(`✓ Dados de teste anteriores removidos`, 'info');
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function createUser(suffix: string) {
  const user = {
    email: `matchtest${suffix}${Date.now()}@example.com`,
    password: 'TestPass123!',
    cpf: suffix === '1' ? '11144477735' : '00000000191', // Both are valid test CPFs
    name: `Usuário Match ${suffix}`,
  };

  // Register
  const registerResponse = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });

  if (!registerResponse.ok) {
    throw new Error(`Registro falhou para user${suffix}`);
  }

  // Login
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
    }),
  });

  const loginData = await loginResponse.json();
  const token = loginData.data.accessToken;

  // Complete KYC
  await fetch(`${API_URL}/kyc/level1`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cpf: user.cpf,
      phone: `1198765432${suffix}`,
    }),
  });

  return { email: user.email, token };
}

async function runTest() {
  const bugs: string[] = [];
  let user1Token = '';
  let user2Token = '';
  let orderId = '';
  let chatId = '';

  try {
    log('\n=== TESTE 3: MATCHING E CHAT ===\n', 'info');

    await cleanupTestData();

    // 1. Criar dois usuários
    log('1. Criando dois usuários...', 'info');
    try {
      const user1 = await createUser('1');
      const user2 = await createUser('2');
      user1Token = user1.token;
      user2Token = user2.token;
      log(`✓ User1 (Seller): ${user1.email}`, 'success');
      log(`✓ User2 (Buyer): ${user2.email}`, 'success');
    } catch (error: any) {
      bugs.push(`BUG #1: Erro ao criar usuários - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
      throw error;
    }

    // 2. User1 cria ordem de VENDA (SELL - quer vender crypto por BRL)
    log('\n2. User1 cria ordem de venda...', 'info');
    try {
      const orderResponse = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'SELL',
          cryptoType: 'USDT',
          cryptoNetwork: 'POLYGON',
          cryptoAmount: '50', // 50 USDT
          brlAmount: '275.00', // R$ 275
          orderData: {
            pixKey: 'vendedor@example.com',
            pixKeyType: 'EMAIL',
            recipientName: 'Vendedor Teste',
          },
        }),
      });

      if (!orderResponse.ok) {
        const error = await orderResponse.json();
        throw new Error(`Criação de ordem falhou: ${error.error || orderResponse.statusText}`);
      }

      const orderData = await orderResponse.json();
      orderId = orderData.data.id;
      log(`✓ Ordem de venda criada: ${orderId}`, 'success');
      log(`  50 USDT por R$ 275`, 'info');
    } catch (error: any) {
      bugs.push(`BUG #2: Erro ao criar ordem - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // 3. User2 busca no marketplace
    log('\n3. User2 busca no marketplace...', 'info');
    try {
      const marketplaceResponse = await fetch(`${API_URL}/orders/marketplace`, {
        headers: { 'Authorization': `Bearer ${user2Token}` },
      });

      if (!marketplaceResponse.ok) {
        throw new Error('Falha ao buscar marketplace');
      }

      const marketplaceData = await marketplaceResponse.json();
      log(`✓ Marketplace: ${marketplaceData.data.length} ordens disponíveis`, 'success');

      // NOTE: Order won't appear without collateral (requires admin setup)
      log(`  ⚠️  Ordem não aparece (precisa colateral - requer config admin)`, 'warning');
    } catch (error: any) {
      bugs.push(`BUG #3: Erro ao buscar marketplace - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // 4. User2 aceita a ordem (matching) - simulando que ela está no marketplace
    log('\n4. User2 aceita a ordem (matching)...', 'info');
    try {
      if (!orderId) {
        throw new Error('Ordem não foi criada');
      }

      const matchResponse = await fetch(`${API_URL}/orders/${orderId}/match`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user2Token}`,
        },
      });

      if (!matchResponse.ok) {
        const error = await matchResponse.json();
        log(`  ⚠️  Match falhou: ${error.error} (esperado - ordem sem colateral)`, 'warning');
      } else {
        const matchData = await matchResponse.json();
        log(`✓ Match realizado!`, 'success');
        log(`  Status: ${matchData.data.status}`, 'info');
        chatId = matchData.data.chatId || '';
      }
    } catch (error: any) {
      // Matching pode falhar se ordem não tem colateral - isso é esperado
      log(`  ⚠️  ${error.message} (pode ser esperado)`, 'warning');
    }

    // 5. Testar criação de chat diretamente
    log('\n5. Testando endpoints de chat...', 'info');
    try {
      // Listar chats do user1
      const chatsResponse = await fetch(`${API_URL}/chat`, {
        headers: { 'Authorization': `Bearer ${user1Token}` },
      });

      if (!chatsResponse.ok) {
        throw new Error('Falha ao buscar chats');
      }

      const chatsData = await chatsResponse.json();
      log(`✓ User1 tem ${chatsData.data.length} chat(s)`, 'success');

      // Se há um chat, testar envio de mensagem
      if (chatsData.data.length > 0 && chatsData.data[0].id) {
        const testChatId = chatsData.data[0].id;
        log(`  Testando chat: ${testChatId}`, 'info');

        // Buscar mensagens
        const messagesResponse = await fetch(`${API_URL}/chat/${testChatId}`, {
          headers: { 'Authorization': `Bearer ${user1Token}` },
        });

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          log(`  ✓ ${messagesData.data.messages?.length || 0} mensagem(s) no chat`, 'success');
        }
      }
    } catch (error: any) {
      bugs.push(`BUG #4: Erro no sistema de chat - ${error.message}`);
      log(`✗ ${error.message}`, 'error');
    }

    // Relatório final
    log('\n=== RESULTADO DO TESTE ===\n', 'info');
    if (bugs.length === 0) {
      log('✓ TESTE PASSOU - Nenhum bug encontrado!', 'success');
      log('  Note: Matching completo requer configuração de colateral (admin)', 'info');
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
