import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedRBAC } from './seeds/rbac-seed';

const prisma = new PrismaClient();

async function main() {
  // SECURITY (CRIT-08 + SER-15 mitigation): este seed contém credenciais
  // fixas (Master@2025!, Admin@123) que SÃO seguras em dev mas NÃO podem
  // rodar em prod. Em prod, usuários master são criados via runbook
  // operacional (dois masters independentes, um por sócio).
  //
  // Ver TECH-DEBT-OP02 na AUDITORIA para o plano completo de provisionamento.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'seed.ts contains hardcoded dev credentials and must NEVER run in production. ' +
      'Production users are provisioned via separate operational runbook (see TECH-DEBT-OP02).',
    );
  }

  console.log('🌱 Iniciando seed do banco de dados...');

  // ============ ORQUESTRAÇÃO RBAC (TECH-DEBT-DEV01) ============
  // Antes: este seed exigia `rbac-seed.ts` ter rodado antes em comando
  // separado. Falha cripticamente se a ordem fosse invertida.
  // Agora: chamamos seedRBAC() aqui. seedRBAC é idempotente (usa upsert
  // por slug/name em tudo) — re-rodar não duplica nem invalida nada.
  // `npx prisma db seed` agora é one-shot.
  await seedRBAC();

  // Após seedRBAC(), os roles 'master' e 'admin' EXISTEM com certeza.
  // findUniqueOrThrow torna o contrato explícito.
  const masterRole = await prisma.role.findUniqueOrThrow({
    where: { slug: 'master' },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { slug: 'admin' },
  });

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
        roleId: masterRole.id,
        legacyRole: 'MASTER',
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
        roleId: masterRole.id,
        legacyRole: 'MASTER',
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
        roleId: adminRole.id,
        legacyRole: 'ADMIN',
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
        roleId: adminRole.id,
        legacyRole: 'ADMIN',
      },
    });

    console.log('✅ Usuário admin criado:', admin.email);
  }

  // NOTA: Carteiras da plataforma devem ser criadas via painel admin HD Wallet
  // Comentado para permitir seed funcionar - criar carteiras manualmente no admin
  console.log('\n⚠️  Carteiras da plataforma devem ser criadas via painel admin');

  // Endereços válidos para TESTE (NÃO enviar fundos reais!)
  const BITCOIN_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
  const EVM_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const SOLANA_ADDRESS = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

  const platformWallets = [
    // Bitcoin
    {
      cryptoType: 'BTC',
      network: 'BITCOIN',
      address: BITCOIN_ADDRESS,
      label: 'Carteira Principal Bitcoin',
      derivationPath: "m/84'/0'/0'/0/0",
    },
    // USDT - Múltiplas redes
    {
      cryptoType: 'USDT',
      network: 'BASE',
      address: EVM_ADDRESS,
      label: 'Carteira Principal USDT Base',
      derivationPath: "m/44'/60'/0'/0/0",
    },
    {
      cryptoType: 'USDT',
      network: 'SOLANA',
      address: SOLANA_ADDRESS,
      label: 'Carteira Principal USDT Solana',
      derivationPath: "m/44'/501'/0'/0'",
    },
    // USDC - Múltiplas redes
    {
      cryptoType: 'USDC',
      network: 'BASE',
      address: EVM_ADDRESS,
      label: 'Carteira Principal USDC Base',
      derivationPath: "m/44'/60'/0'/0/0",
    },
    {
      cryptoType: 'USDC',
      network: 'SOLANA',
      address: SOLANA_ADDRESS,
      label: 'Carteira Principal USDC Solana',
      derivationPath: "m/44'/501'/0'/0'",
    },
  ];

  // COMENTADO: Usar painel admin para criar carteiras com HD Wallet
  // for (const wallet of platformWallets) {
  //   const existing = await prisma.platformWallet.findFirst({
  //     where: {
  //       cryptoType: wallet.cryptoType,
  //       network: wallet.network,
  //     },
  //   });
  //
  //   if (!existing) {
  //     await prisma.platformWallet.create({
  //       data: {
  //         ...wallet,
  //         isActive: true,
  //       },
  //     });
  //     console.log(`✅ Criado: ${wallet.label}`);
  //   } else {
  //     console.log(`⚠️ Já existe: ${wallet.label}`);
  //   }
  // }

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
