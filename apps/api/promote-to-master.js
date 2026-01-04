const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function promoteUsers() {
  try {
    // Promover admin@test.com para MASTER
    const admin = await prisma.user.update({
      where: { email: 'admin@test.com' },
      data: { role: 'MASTER' }
    });
    console.log('✅ admin@test.com promovido para MASTER');

    // Promover gerente@test.com para GERENTE
    const gerente = await prisma.user.update({
      where: { email: 'gerente@test.com' },
      data: { role: 'GERENTE' }
    });
    console.log('✅ gerente@test.com promovido para GERENTE');

    console.log('\n📊 Usuários promovidos:');
    console.log(`  - ${admin.email} → ${admin.role}`);
    console.log(`  - ${gerente.email} → ${gerente.role}`);

  } catch (error) {
    console.error('❌ Erro ao promover usuários:', error);
  } finally {
    await prisma.$disconnect();
  }
}

promoteUsers();
