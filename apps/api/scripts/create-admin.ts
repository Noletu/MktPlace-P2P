import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@mktplace.com';
  const password = 'Admin@123456';

  // Verificar se já existe
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    console.log('✅ Usuário admin já existe!');
    console.log('Email:', email);
    console.log('Senha:', password);
    console.log('Role:', existing.role);

    // Atualizar para admin se não for
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({
        where: { email },
        data: { role: 'ADMIN' }
      });
      console.log('✅ Role atualizada para ADMIN');
    }
    return;
  }

  // Hash da senha
  const hashedPassword = await bcrypt.hash(password, 10);

  // Criar usuário admin
  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Administrador',
      role: 'ADMIN',
      kycLevel: 'LEVEL_4' // Admin com KYC máximo
    }
  });

  console.log('✅ Usuário admin criado com sucesso!');
  console.log('');
  console.log('=================================');
  console.log('📧 Email:', email);
  console.log('🔑 Senha:', password);
  console.log('👤 Role: ADMIN');
  console.log('=================================');
  console.log('');
  console.log('Use estas credenciais para fazer login no sistema.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
