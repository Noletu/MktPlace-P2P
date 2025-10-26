import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Usuários no banco ===');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      kycLevel: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  });

  console.log(`\nTotal: ${users.length} usuários\n`);

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`);
    console.log(`   Nome: ${user.name || 'N/A'}`);
    console.log(`   KYC: ${user.kycLevel}`);
    console.log(`   ID: ${user.id.substring(0, 12)}...`);
    console.log(`   Criado: ${user.createdAt.toISOString().split('T')[0]}`);
    console.log('');
  });

  // Verificar KYC
  console.log('=== KYC Verifications ===');
  const kycs = await prisma.kYCVerification.findMany({
    select: {
      id: true,
      userId: true,
      level: true,
      status: true,
      fullName: true,
      cpf: true,
      phone: true,
    },
  });

  console.log(`\nTotal: ${kycs.length} KYC submissions\n`);

  kycs.forEach((kyc, index) => {
    console.log(`${index + 1}. ${kyc.fullName}`);
    console.log(`   CPF: ${kyc.cpf}`);
    console.log(`   Phone: ${kyc.phone}`);
    console.log(`   Level: ${kyc.level}`);
    console.log(`   Status: ${kyc.status}`);
    console.log('');
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
