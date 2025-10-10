import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // ============ CRIAR USUÁRIO MASTER ============
  const masterEmail = 'master@mktplace.com';
  const masterCPF = '99999999999';
  const masterPassword = 'Master@2025!'; // MUDAR EM PRODUÇÃO!

  const existingMaster = await prisma.user.findFirst({
    where: {
      OR: [
        { email: masterEmail },
        { cpf: masterCPF },
      ],
    },
  });

  if (existingMaster) {
    console.log('⚠️ Usuário MASTER já existe, atualizando...');

    const hashedMasterPassword = await bcrypt.hash(masterPassword, 12);

    await prisma.user.update({
      where: { id: existingMaster.id },
      data: {
        role: 'MASTER',
        password: hashedMasterPassword,
        email: masterEmail,
        cpf: masterCPF,
        name: 'Master Administrator',
        kycLevel: 'LEVEL_4',
      },
    });

    console.log('✅ Usuário MASTER atualizado');
  } else {
    console.log('📝 Criando usuário MASTER...');

    const hashedMasterPassword = await bcrypt.hash(masterPassword, 12);

    const master = await prisma.user.create({
      data: {
        email: masterEmail,
        cpf: masterCPF,
        password: hashedMasterPassword,
        name: 'Master Administrator',
        role: 'MASTER',
        kycLevel: 'LEVEL_4',
      },
    });

    console.log('✅ Usuário MASTER criado:', master.email);
  }

  // ============ CRIAR USUÁRIO ADMIN ============
  const adminEmail = 'admin@mktplace.com';
  const adminCPF = '00000000000';
  const adminPassword = 'Admin@123'; // MUDAR EM PRODUÇÃO!

  // Verificar se admin já existe (por email ou CPF)
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { cpf: adminCPF },
      ],
    },
  });

  if (existingAdmin) {
    console.log('⚠️ Usuário admin já existe, atualizando role...');

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        role: 'ADMIN',
        password: hashedPassword,
        email: adminEmail,
        cpf: adminCPF,
      },
    });

    console.log('✅ Usuário admin atualizado');
  } else {
    console.log('📝 Criando usuário admin...');

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        cpf: adminCPF, // CPF placeholder para admin
        password: hashedPassword,
        name: 'Administrador',
        role: 'ADMIN',
        kycLevel: 'LEVEL_4', // Admin já tem KYC máximo
      },
    });

    console.log('✅ Usuário admin criado:', admin.email);
  }

  // Criar endereços da plataforma de exemplo (OPCIONAL - apenas para testes)
  console.log('\n📝 Verificando endereços de exemplo...');

  const platformWallets = [
    {
      cryptoType: 'USDT',
      network: 'TRC20',
      address: 'TExampleTRC20Address123456789012345',
      label: 'Carteira Principal USDT TRC20 (EXEMPLO)',
    },
    {
      cryptoType: 'USDC',
      network: 'BASE',
      address: '0xExampleBaseAddress1234567890123456789012',
      label: 'Carteira Principal USDC Base (EXEMPLO)',
    },
    {
      cryptoType: 'BTC',
      network: 'BITCOIN',
      address: 'bc1qExampleBitcoinAddress123456789012',
      label: 'Carteira Principal Bitcoin (EXEMPLO)',
    },
  ];

  for (const wallet of platformWallets) {
    const existing = await prisma.platformWallet.findUnique({
      where: { address: wallet.address },
    });

    if (!existing) {
      await prisma.platformWallet.create({
        data: {
          ...wallet,
          isActive: true,
        },
      });
      console.log(`✅ Criado: ${wallet.label}`);
    } else {
      console.log(`⚠️ Já existe: ${wallet.label}`);
    }
  }

  console.log('\n✅ Seed completo!');
  console.log('\n📋 CREDENCIAIS DO MASTER:');
  console.log(`   Email: ${masterEmail}`);
  console.log(`   Senha: ${masterPassword}`);
  console.log(`   Role: MASTER (Acesso Total)`);
  console.log('\n📋 CREDENCIAIS DO ADMIN:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Senha: ${adminPassword}`);
  console.log(`   Role: ADMIN`);
  console.log('\n⚠️ IMPORTANTE: Altere as senhas padrão em produção!');
  console.log('⚠️ IMPORTANTE: Substitua os endereços de exemplo por endereços reais no painel admin!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
