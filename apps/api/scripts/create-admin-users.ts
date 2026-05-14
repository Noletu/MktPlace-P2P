import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/bcrypt';

const prisma = new PrismaClient();

async function createAdmins() {
  try {
    // Limpar usuários existentes
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: 'master@mktplace.com' },
          { email: 'admin@mktplace.com' },
          { email: 'nkoutroularis@gmail.com' }
        ]
      }
    });

    console.log('🗑️  Usuários antigos removidos');

    // Hash das senhas
    const masterPassword = await hashPassword('Master@2025!');
    const adminPassword = await hashPassword('Admin@123');

    // Criar usuário MASTER (super admin)
    const master = await prisma.user.create({
      data: {
        email: 'master@mktplace.com',
        password: masterPassword,
        name: 'Master Admin',
        role: 'MASTER',
        kycLevel: 'LEVEL_4',
      },
    });

    console.log('✅ Usuário MASTER criado:', master.email);

    // Criar usuário ADMIN
    const admin = await prisma.user.create({
      data: {
        email: 'admin@mktplace.com',
        password: adminPassword,
        name: 'Admin',
        role: 'ADMIN',
        kycLevel: 'LEVEL_4',
      },
    });

    console.log('✅ Usuário ADMIN criado:', admin.email);
    console.log('\n📝 Credenciais:');
    console.log('MASTER:');
    console.log('  Email: master@mktplace.com');
    console.log('  Senha: Master@2025!');
    console.log('\nADMIN:');
    console.log('  Email: admin@mktplace.com');
    console.log('  Senha: Admin@123');
  } catch (error) {
    console.error('❌ Erro ao criar usuários:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmins();
