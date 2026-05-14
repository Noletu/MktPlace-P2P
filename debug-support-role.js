/**
 * Debug: Verificar configuração do role SUPPORT
 */

const API_BASE = 'http://localhost:3001/api/v1';

const SUPPORT_CREDENTIALS = {
  email: 'suporte@mktplace.com',
  password: 'Suporte@123'
};

async function debugSupportRole() {
  console.log('\n🔍 DEBUG: Verificando configuração do role SUPPORT\n');

  try {
    // 1. Login como SUPPORT
    console.log('1️⃣ Fazendo login como SUPPORT...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SUPPORT_CREDENTIALS),
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      console.error('❌ Erro no login:', loginData.error);
      console.log('\n💡 Verifique se o usuário existe e a senha está correta');
      return;
    }

    console.log('✅ Login OK');
    const token = loginData.data.accessToken;

    // 2. Buscar dados do usuário via /auth/me
    console.log('\n2️⃣ Buscando dados via /auth/me...');
    const meResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const meData = await meResponse.json();

    if (!meData.success) {
      console.error('❌ Erro ao buscar /auth/me:', meData.error);
      return;
    }

    console.log('✅ Dados recebidos:');
    console.log('\n📊 INFORMAÇÕES DO USUÁRIO:');
    console.log('   Email:', meData.data.email);
    console.log('   Nome:', meData.data.name || 'N/A');
    console.log('   Role:', meData.data.role);
    console.log('   Level:', meData.data.level);
    console.log('   Level Type:', typeof meData.data.level);

    // 3. Análise do problema
    console.log('\n🔍 ANÁLISE:');

    if (typeof meData.data.level === 'undefined') {
      console.log('❌ PROBLEMA: Campo "level" está UNDEFINED');
      console.log('   Causa provável: Backend não está retornando o campo level');
      console.log('   Solução: Verificar se auth.service.ts foi modificado e servidor reiniciado');
    } else if (meData.data.level === null) {
      console.log('❌ PROBLEMA: Campo "level" está NULL');
      console.log('   Causa provável: Role SUPPORT no banco não tem level configurado');
      console.log('   Solução: Executar seed RBAC ou atualizar role manualmente');
    } else if (meData.data.level === 0) {
      console.log('❌ PROBLEMA: Campo "level" é ZERO');
      console.log('   Causa provável: user.role?.level retorna undefined (role não foi incluído no query)');
      console.log('   Solução: Verificar se o include da role tem level: true');
    } else if (meData.data.level < 40) {
      console.log(`❌ PROBLEMA: Level é ${meData.data.level}, menor que 40`);
      console.log('   Causa provável: Role atribuído incorretamente');
      console.log('   Solução: Verificar qual role está atribuído ao usuário');
    } else {
      console.log(`✅ Level está correto: ${meData.data.level} (>= 40)`);
      console.log('   O usuário DEVERIA conseguir acessar /admin');
    }

    // 4. Verificar objeto completo
    console.log('\n📦 OBJETO COMPLETO RETORNADO:');
    console.log(JSON.stringify(meData.data, null, 2));

    // 5. Testar acesso a uma rota admin
    console.log('\n3️⃣ Testando acesso à rota /support...');
    const supportResponse = await fetch(`${API_BASE}/support`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const supportData = await supportResponse.json();

    if (supportResponse.status === 200 && supportData.success) {
      console.log('✅ Acesso ao backend /support OK');
      console.log('   Total de tickets:', supportData.data.length);
    } else {
      console.log('❌ Acesso ao backend /support FALHOU');
      console.log('   Status:', supportResponse.status);
      console.log('   Error:', supportData.error);
    }

    // 6. Recomendações
    console.log('\n' + '='.repeat(60));
    console.log('📋 RECOMENDAÇÕES:');
    console.log('='.repeat(60));

    if (meData.data.level >= 40) {
      console.log('\n✅ Backend está OK! O problema pode estar no FRONTEND.');
      console.log('\n🔧 SOLUÇÕES:');
      console.log('   1. Faça LOGOUT completo do usuário');
      console.log('   2. Limpe o localStorage:');
      console.log('      - Abra Console (F12)');
      console.log('      - Digite: localStorage.clear()');
      console.log('      - Pressione Enter');
      console.log('   3. Recarregue a página (Ctrl+Shift+R)');
      console.log('   4. Faça LOGIN novamente');
      console.log('   5. Tente acessar /admin novamente');
    } else {
      console.log('\n❌ Backend NÃO está retornando level correto!');
      console.log('\n🔧 SOLUÇÕES:');
      console.log('   1. Verifique se auth.service.ts tem level: true no include');
      console.log('   2. REINICIE o servidor backend:');
      console.log('      cd C:\\Projects\\MktPlace-P2P\\apps\\api');
      console.log('      npm run dev');
      console.log('   3. Verifique se o role SUPPORT existe no banco:');
      console.log('      Acesse /admin/roles como MASTER');
      console.log('   4. Se role não existir, execute a seed:');
      console.log('      npx prisma db seed');
    }

    console.log('');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
}

debugSupportRole();
