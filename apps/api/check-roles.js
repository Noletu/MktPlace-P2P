const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoles() {
  const roles = await prisma.role.findMany();
  console.log(`Total de roles: ${roles.length}`);
  roles.forEach(role => {
    console.log(`- ${role.slug} (${role.name})`);
  });
  await prisma.$disconnect();
}

checkRoles().catch(console.error);
