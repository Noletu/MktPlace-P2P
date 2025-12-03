import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // ============ CRIAR USUÁRIO MASTER ============
  const masterEmail = 'master@mktplace.com';
  const masterPassword = 'Master@2025!'; // MUDAR EM PRODUÇÃO!

  const existingMaster = await prisma.user.findUnique({
    where: { email: masterEmail },
  });

  if (existingMaster) {
    console.log('⚠️ Usuário MASTER já existe, atualizando...');

    const hashedMasterPassword = await bcrypt.hash(masterPassword, 12);

    await prisma.user.update({
      where: { id: existingMaster.id },
      data: {
        role: 'MASTER',
        password: hashedMasterPassword,
        name: 'Master Administrator',
      },
    });

    console.log('✅ Usuário MASTER atualizado');
  } else {
    console.log('📝 Criando usuário MASTER...');

    const hashedMasterPassword = await bcrypt.hash(masterPassword, 12);

    const master = await prisma.user.create({
      data: {
        email: masterEmail,
        password: hashedMasterPassword,
        name: 'Master Administrator',
        role: 'MASTER',
      },
    });

    console.log('✅ Usuário MASTER criado:', master.email);
  }

  // ============ CRIAR USUÁRIO ADMIN ============
  const adminEmail = 'admin@mktplace.com';
  const adminPassword = 'Admin@123'; // MUDAR EM PRODUÇÃO!

  // Verificar se admin já existe
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('⚠️ Usuário admin já existe, atualizando role...');

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        role: 'ADMIN',
        password: hashedPassword,
      },
    });

    console.log('✅ Usuário admin atualizado');
  } else {
    console.log('📝 Criando usuário admin...');

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Administrador',
        role: 'ADMIN',
      },
    });

    console.log('✅ Usuário admin criado:', admin.email);
  }

  // Criar endereços da plataforma de exemplo (OPCIONAL - apenas para testes)
  console.log('\n📝 Verificando endereços de exemplo...');

  // Endereços válidos para TESTE (NÃO enviar fundos reais!)
  const BITCOIN_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
  const EVM_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const TRON_ADDRESS = 'TRX9sW6qJjhPNaPKjUbVKMNqvz4RqDfWjM';
  const SOLANA_ADDRESS = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

  const platformWallets = [
    // Bitcoin
    {
      cryptoType: 'BTC',
      network: 'BITCOIN',
      address: BITCOIN_ADDRESS,
      label: 'Carteira Principal Bitcoin',
    },
    // USDT - Múltiplas redes
    {
      cryptoType: 'USDT',
      network: 'TRC20',
      address: TRON_ADDRESS,
      label: 'Carteira Principal USDT TRC20',
    },
    {
      cryptoType: 'USDT',
      network: 'ETHEREUM',
      address: EVM_ADDRESS,
      label: 'Carteira Principal USDT Ethereum',
    },
    {
      cryptoType: 'USDT',
      network: 'BASE',
      address: EVM_ADDRESS,
      label: 'Carteira Principal USDT Base',
    },
    {
      cryptoType: 'USDT',
      network: 'ARBITRUM',
      address: EVM_ADDRESS,
      label: 'Carteira Principal USDT Arbitrum',
    },
    {
      cryptoType: 'USDT',
      network: 'SOLANA',
      address: SOLANA_ADDRESS,
      label: 'Carteira Principal USDT Solana',
    },
    // USDC - Múltiplas redes
    {
      cryptoType: 'USDC',
      network: 'ETHEREUM',
      address: EVM_ADDRESS,
      label: 'Carteira Principal USDC Ethereum',
    },
    {
      cryptoType: 'USDC',
      network: 'BASE',
      address: EVM_ADDRESS,
      label: 'Carteira Principal USDC Base',
    },
    {
      cryptoType: 'USDC',
      network: 'ARBITRUM',
      address: EVM_ADDRESS,
      label: 'Carteira Principal USDC Arbitrum',
    },
    {
      cryptoType: 'USDC',
      network: 'TRC20',
      address: TRON_ADDRESS,
      label: 'Carteira Principal USDC TRC20',
    },
    {
      cryptoType: 'USDC',
      network: 'SOLANA',
      address: SOLANA_ADDRESS,
      label: 'Carteira Principal USDC Solana',
    },
  ];

  for (const wallet of platformWallets) {
    // Check by cryptoType + network (not just address, since EVM addresses are reused)
    const existing = await prisma.platformWallet.findFirst({
      where: {
        cryptoType: wallet.cryptoType,
        network: wallet.network,
      },
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
