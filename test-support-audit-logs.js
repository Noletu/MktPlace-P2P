/**
 * Teste de Audit Logs para Sistema de Tickets de Suporte
 */

const API_BASE = 'http://localhost:3001/api/v1';

const USER_CREDENTIALS = {
  email: 'user@mktplace.com',
  password: 'User@123'
};

const ADMIN_CREDENTIALS = {
  email: 'admin@mktplace.com',
  password: 'Admin@123'
};

async function testSupportAuditLogs() {
  console.log('\n🧪 TESTE: Audit Logs do Sistema de Tickets de Suporte\n');

  try {
    // 1. Login como usuário comum
    console.log('1️⃣ Login como USER...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(USER_CREDENTIALS),
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      console.error('❌ Erro no login:', loginData.error);
      return;
    }

    const userToken = loginData.data.accessToken;
    const userId = loginData.data.user.id;
    console.log('✅ Login OK');
    console.log('   User ID:', userId);

    // 2. Criar ticket de suporte
    console.log('\n2️⃣ Criando ticket de suporte...');
    const createTicketResponse = await fetch(`${API_BASE}/support`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        category: 'ACCOUNT_ISSUE',
        subject: 'Teste de Audit Log - Ticket de Suporte',
        description: 'Este é um ticket de teste para verificar se os audit logs estão funcionando corretamente.',
      }),
    });

    const createTicketData = await createTicketResponse.json();

    if (!createTicketData.success) {
      console.error('❌ Erro ao criar ticket:', createTicketData.error);
      return;
    }

    const ticketId = createTicketData.data.id;
    console.log('✅ Ticket criado com sucesso');
    console.log('   Ticket ID:', ticketId);

    // Aguardar um pouco para o log ser processado
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Verificar se o log de criação apareceu
    console.log('\n3️⃣ Verificando log de criação no audit...');

    // Login como admin para ver os logs
    const adminLoginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ADMIN_CREDENTIALS),
    });

    const adminLoginData = await adminLoginResponse.json();
    if (!adminLoginData.success) {
      console.error('❌ Erro no login admin:', adminLoginData.error);
      return;
    }

    const adminToken = adminLoginData.data.accessToken;

    const auditLogsResponse = await fetch(`${API_BASE}/admin/audit-logs?limit=10`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const auditLogsData = await auditLogsResponse.json();

    if (auditLogsData.success) {
      const createLog = auditLogsData.data.logs.find(
        log => log.action === 'SUPPORT_TICKET_CREATE' && log.resourceId === ticketId
      );

      if (createLog) {
        console.log('✅ Log de criação encontrado!');
        console.log('   Action:', createLog.action);
        console.log('   Resource:', createLog.resource);
        console.log('   Metadata:', createLog.metadata);
      } else {
        console.log('❌ Log de criação NÃO encontrado');
      }
    } else {
      console.log('❌ Erro ao buscar audit logs:', auditLogsData.error);
    }

    // 4. Resolver o ticket como admin
    console.log('\n4️⃣ Resolvendo ticket como ADMIN...');
    const resolveResponse = await fetch(`${API_BASE}/support/${ticketId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        resolution: 'Ticket de teste resolvido com sucesso. Audit logs estão funcionando corretamente.',
      }),
    });

    const resolveData = await resolveResponse.json();

    if (resolveData.success) {
      console.log('✅ Ticket resolvido com sucesso');
    } else {
      console.log('❌ Erro ao resolver ticket:', resolveData.error);
    }

    // Aguardar um pouco para o log ser processado
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. Verificar se o log de resolução apareceu
    console.log('\n5️⃣ Verificando log de resolução no audit...');
    const auditLogsResponse2 = await fetch(`${API_BASE}/admin/audit-logs?limit=10`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const auditLogsData2 = await auditLogsResponse2.json();

    if (auditLogsData2.success) {
      const resolveLog = auditLogsData2.data.logs.find(
        log => log.action === 'SUPPORT_TICKET_RESOLVE' && log.resourceId === ticketId
      );

      if (resolveLog) {
        console.log('✅ Log de resolução encontrado!');
        console.log('   Action:', resolveLog.action);
        console.log('   Resource:', resolveLog.resource);
        console.log('   Metadata:', resolveLog.metadata);
      } else {
        console.log('❌ Log de resolução NÃO encontrado');
      }
    } else {
      console.log('❌ Erro ao buscar audit logs:', auditLogsData2.error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TESTE CONCLUÍDO');
    console.log('='.repeat(60));
    console.log('\n📊 Para ver os logs no painel admin:');
    console.log('   http://localhost:5173/admin/audit');
    console.log('\n🔍 Filtrar por:');
    console.log('   - Action: SUPPORT_TICKET_CREATE ou SUPPORT_TICKET_RESOLVE');
    console.log('   - Resource: SUPPORT_TICKET');
    console.log('');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
}

testSupportAuditLogs();
