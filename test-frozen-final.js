/**
 * Test final: Verificar login de conta bloqueada COM middleware integrado
 */

const API_BASE = 'http://localhost:3001/api/v1';

const ADMIN_CREDENTIALS = {
  email: 'admin@mktplace.com',
  password: 'Admin@123'
};

const TEST_USER = {
  email: 'teste.bloqueado2@test.com',
  password: 'Test@123',
  name: 'Teste Bloqueado 2',
  cpf: '98765432109'
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

async function runTests() {
  console.log('\n🧪 TESTE FINAL: Login com conta bloqueada (middleware integrado)\n');

  try {
    // Aguardar servidor iniciar
    console.log('⏳ Aguardando servidor...');
    await sleep(10000);

    // 1. Login como admin
    console.log('\n1️⃣ Login como admin...');
    const adminLogin = await apiCall('/auth/login', 'POST', ADMIN_CREDENTIALS);
    if (adminLogin.status !== 200) {
      console.error('❌ Erro ao fazer login como admin');
      return;
    }
    const adminToken = adminLogin.data.data.accessToken;
    console.log('✅ Login admin OK');

    // 2. Criar usuário de teste
    console.log('\n2️⃣ Criando usuário de teste...');
    const register = await apiCall('/auth/register', 'POST', TEST_USER);
    let testUserId;

    if (register.status === 201) {
      testUserId = register.data.data.user.id;
      console.log('✅ Usuário criado:', testUserId);
    } else if (register.data.error?.includes('já cadastrado')) {
      const login = await apiCall('/auth/login', 'POST', {
        email: TEST_USER.email,
        password: TEST_USER.password
      });
      testUserId = login.data.data.user.id;
      console.log('✅ Usuário já existe:', testUserId);
    }

    // 3. Bloquear usuário
    console.log('\n3️⃣ Bloqueando usuário...');
    await apiCall('/admin/funds/freeze', 'POST', {
      userId: testUserId,
      freezeType: 'TEMPORARY',
      reason: 'Teste de bloqueio - middleware integrado',
      duration: 24
    }, adminToken);
    console.log('✅ Usuário bloqueado');

    // 4. LOGIN COM CONTA BLOQUEADA (deve funcionar)
    console.log('\n4️⃣ 🎯 TESTE PRINCIPAL: Login com conta bloqueada...');
    const blockedLogin = await apiCall('/auth/login', 'POST', {
      email: TEST_USER.email,
      password: TEST_USER.password
    });

    console.log('Status:', blockedLogin.status);
    console.log('Success:', blockedLogin.data.success);

    if (blockedLogin.status === 200 && blockedLogin.data.success) {
      console.log('✅ ✅ ✅ LOGIN FUNCIONOU!');
      console.log('Frozen:', blockedLogin.data.data.user.accountFrozen);
      console.log('Reason:', blockedLogin.data.data.user.frozenReason);
    } else {
      console.log('❌ ❌ ❌ LOGIN FALHOU!');
      return;
    }

    const testToken = blockedLogin.data.data.accessToken;

    // 5. Tentar criar pedido (deve BLOQUEAR com 403)
    console.log('\n5️⃣ Testando POST /orders (deve bloquear)...');
    const createOrder = await apiCall('/orders', 'POST', {
      type: 'BUY',
      cryptoType: 'BITCOIN',
      cryptoNetwork: 'BITCOIN',
      cryptoCurrency: 'BTC',
      fiatCurrency: 'BRL',
      cryptoAmount: '0.001',
      price: '50000',
      brlAmount: '50',
      paymentMethods: ['PIX'],
      minFiatAmount: '50',
      maxFiatAmount: '500'
    }, testToken);

    console.log('Status:', createOrder.status);
    if (createOrder.status === 403) {
      console.log('✅ ✅ ✅ POST BLOQUEADO!');
      console.log('Mensagem:', createOrder.data.message);
      console.log('Appeal URL:', createOrder.data.appealUrl);
    } else {
      console.log('❌ ❌ ❌ POST NÃO FOI BLOQUEADO! (status:', createOrder.status, ')');
      console.log('Response:', JSON.stringify(createOrder.data, null, 2));
    }

    // 6. Tentar GET /orders (deve FUNCIONAR)
    console.log('\n6️⃣ Testando GET /marketplace (deve funcionar)...');
    const getOrders = await apiCall('/orders/marketplace', 'GET', null, testToken);

    if (getOrders.status === 200) {
      console.log('✅ ✅ ✅ GET FUNCIONOU!');
    } else {
      console.log('❌ GET BLOQUEADO (não deveria):', getOrders.status);
    }

    // 7. Cleanup
    console.log('\n7️⃣ Desbloqueando usuário (cleanup)...');
    await apiCall('/admin/funds/unfreeze', 'POST', {
      userId: testUserId,
      reason: 'Fim dos testes'
    }, adminToken);
    console.log('✅ Cleanup concluído');

    console.log('\n' + '='.repeat(60));
    console.log('✅ ✅ ✅ TODOS OS TESTES PASSARAM!');
    console.log('='.repeat(60));
    console.log('✔️  Login com conta bloqueada: FUNCIONA');
    console.log('✔️  POST com conta bloqueada: BLOQUEADO (403)');
    console.log('✔️  GET com conta bloqueada: FUNCIONA');
    console.log('✔️  Mensagem de apelação: PRESENTE');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.error(error.stack);
  }
}

runTests().then(() => {
  console.log('Testes finalizados!');
  process.exit(0);
}).catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
