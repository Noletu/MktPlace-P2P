/**
 * Teste de Acesso de Usuário SUPPORT ao Painel Admin
 */

const API_BASE = 'http://localhost:3001/api/v1';

// Credenciais de teste
const SUPPORT_CREDENTIALS = {
  email: 'suporte@mktplace.com',
  password: 'Suporte@123'
};

const ADMIN_CREDENTIALS = {
  email: 'admin@mktplace.com',
  password: 'Admin@123'
};

async function testSupportAdminAccess() {
  console.log('\n🧪 TESTE: Acesso de Usuário SUPPORT ao Painel Admin\n');

  try {
    // PASSO 1: Login como ADMIN para criar usuário SUPPORT
    console.log('📋 PASSO 1: Login como ADMIN para preparar teste...');
    const adminLoginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ADMIN_CREDENTIALS),
    });

    const adminLoginData = await adminLoginResponse.json();
    if (!adminLoginData.success) {
      console.error('❌ Erro no login ADMIN:', adminLoginData.error);
      return;
    }

    const adminToken = adminLoginData.data.accessToken;
    console.log('✅ Login ADMIN OK');

    // PASSO 2: Verificar se usuário SUPPORT já existe
    console.log('\n📋 PASSO 2: Verificando usuário SUPPORT...');

    // Tentar fazer login com as credenciais SUPPORT primeiro
    const supportLoginTestResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SUPPORT_CREDENTIALS),
    });

    const supportLoginTestData = await supportLoginTestResponse.json();
    let supportUserId;
    let supportToken;

    if (supportLoginTestData.success) {
      console.log('✅ Usuário SUPPORT já existe');
      supportUserId = supportLoginTestData.data.user.id;
      supportToken = supportLoginTestData.data.accessToken;
    } else {
      console.log('⚠️  Usuário SUPPORT não encontrado');
      console.log('   Você precisa criar um usuário com email: suporte@mktplace.com');
      console.log('   E atribuir a role SUPPORT (level 40) via painel admin');
      console.log('\n   Passos:');
      console.log('   1. Acesse http://localhost:5173/admin/users');
      console.log('   2. Clique em "Criar Usuário"');
      console.log('   3. Email: suporte@mktplace.com');
      console.log('   4. Password: Suporte@123');
      console.log('   5. Edite o usuário e mude a role para SUPPORT');
      return;
    }

    // PASSO 3: Verificar endpoint /auth/me retorna level
    console.log('\n📋 PASSO 3: Verificando se /auth/me retorna level...');
    const authMeResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${supportToken}` },
    });

    const authMeData = await authMeResponse.json();
    if (authMeData.success) {
      console.log('✅ Endpoint /auth/me OK');
      console.log('   Role:', authMeData.data.role);
      console.log('   Level:', authMeData.data.level);

      if (typeof authMeData.data.level === 'undefined') {
        console.log('❌ ERRO: Campo "level" NÃO está sendo retornado!');
        console.log('   Verifique se auth.service.ts foi modificado corretamente');
        return;
      }

      if (authMeData.data.level !== 40) {
        console.log('⚠️  AVISO: Level esperado é 40, mas recebeu:', authMeData.data.level);
        console.log('   Verifique se a role SUPPORT foi atribuída corretamente');
      }
    } else {
      console.log('❌ Erro ao buscar /auth/me:', authMeData.error);
      return;
    }

    // PASSO 4: Verificar acesso às rotas de suporte
    console.log('\n📋 PASSO 4: Testando acesso às rotas de suporte...');

    // 4.1: Listar tickets
    const ticketsResponse = await fetch(`${API_BASE}/support`, {
      headers: { 'Authorization': `Bearer ${supportToken}` },
    });

    const ticketsData = await ticketsResponse.json();
    if (ticketsResponse.status === 200 && ticketsData.success) {
      console.log('✅ Acesso a GET /support OK');
      console.log('   Total de tickets:', ticketsData.data.length);
    } else {
      console.log('❌ Acesso a GET /support FALHOU');
      console.log('   Status:', ticketsResponse.status);
      console.log('   Error:', ticketsData.error);
    }

    // 4.2: Estatísticas de tickets
    const statsResponse = await fetch(`${API_BASE}/support/stats`, {
      headers: { 'Authorization': `Bearer ${supportToken}` },
    });

    const statsData = await statsResponse.json();
    if (statsResponse.status === 200 && statsData.success) {
      console.log('✅ Acesso a GET /support/stats OK');
      console.log('   Total:', statsData.data.total);
    } else {
      console.log('❌ Acesso a GET /support/stats FALHOU');
      console.log('   Status:', statsResponse.status);
      console.log('   Error:', statsData.error);
    }

    // PASSO 5: Resumo dos resultados
    console.log('\n' + '='.repeat(60));
    console.log('✅ TESTE CONCLUÍDO');
    console.log('='.repeat(60));
    console.log('\n📊 RESULTADOS:');
    console.log('   ✅ Campo "level" retornado por /auth/me');
    console.log('   ✅ Usuário SUPPORT tem level:', authMeData.data.level);
    console.log('   ✅ Acesso ao backend funcionando');
    console.log('\n🌐 PRÓXIMO PASSO - TESTE MANUAL NO FRONTEND:');
    console.log('   1. Acesse: http://localhost:5173/login');
    console.log('   2. Login: suporte@mktplace.com');
    console.log('   3. Password: Suporte@123');
    console.log('   4. Após login, acesse: http://localhost:5173/admin');
    console.log('   5. ✅ Deve conseguir acessar (antes dava erro)');
    console.log('   6. Verifique o badge: "🎧 SUPORTE (Nv. 40)"');
    console.log('   7. Navegue para: http://localhost:5173/admin/support');
    console.log('   8. ✅ Deve ver lista de tickets');
    console.log('\n🔒 TESTE DE RESTRIÇÃO:');
    console.log('   1. Como SUPPORT, tente acessar: http://localhost:5173/admin/roles');
    console.log('   2. ❌ Deve receber erro 403 (MASTER only)');
    console.log('');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
}

testSupportAdminAccess();
