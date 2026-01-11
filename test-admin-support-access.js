/**
 * Teste de acesso ADMIN ao sistema de suporte
 */

const API_BASE = 'http://localhost:3001/api/v1';

const ADMIN_CREDENTIALS = {
  email: 'admin@mktplace.com',
  password: 'Admin@123'
};

async function testAdminSupportAccess() {
  console.log('\n🧪 TESTE: Acesso ADMIN ao sistema de suporte\n');

  try {
    // 1. Login como admin
    console.log('1️⃣ Login como ADMIN...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ADMIN_CREDENTIALS),
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      console.error('❌ Erro no login:', loginData.error);
      return;
    }

    const adminToken = loginData.data.accessToken;
    console.log('✅ Login OK');
    console.log('   Role:', loginData.data.user.role);
    console.log('   Level:', loginData.data.user.level || 'UNDEFINED (PROBLEMA!)');

    // 2. Tentar buscar lista de tickets (GET)
    console.log('\n2️⃣ Buscando lista de tickets...');
    const ticketsResponse = await fetch(`${API_BASE}/support`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const ticketsData = await ticketsResponse.json();

    if (ticketsResponse.status === 200 && ticketsData.success) {
      console.log('✅ SUCESSO! ADMIN conseguiu acessar tickets');
      console.log('   Total de tickets:', ticketsData.data.length);
    } else {
      console.log('❌ FALHOU! Status:', ticketsResponse.status);
      console.log('   Error:', ticketsData.error);
    }

    // 3. Tentar buscar estatísticas
    console.log('\n3️⃣ Buscando estatísticas...');
    const statsResponse = await fetch(`${API_BASE}/support/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const statsData = await statsResponse.json();

    if (statsResponse.status === 200 && statsData.success) {
      console.log('✅ SUCESSO! Estatísticas carregadas');
      console.log('   Total:', statsData.data.total);
      console.log('   Abertos:', statsData.data.byStatus.open);
    } else {
      console.log('❌ FALHOU! Status:', statsResponse.status);
      console.log('   Error:', statsData.error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TESTE CONCLUÍDO');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
}

testAdminSupportAccess();
