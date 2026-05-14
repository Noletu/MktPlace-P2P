import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para promover usuários iniciais aos roles corretos
 *
 * Mapeia usuários específicos para roles administrativos baseado no email
 */

const roleAssignments = [
  { email: 'master@mktplace.com', roleSlug: 'master' },
  { email: 'admin@mktplace.com', roleSlug: 'admin' },
  { email: 'admin@test.com', roleSlug: 'admin' },
  { email: 'gerente@test.com', roleSlug: 'gerente' },
  // user@test.com permanece como USER
];

async function promoteInitialAdmins() {
  console.log('👑 [Promote] Promovendo usuários iniciais para roles administrativos...\n');

  try {
    let successCount = 0;
    let errorCount = 0;

    for (const assignment of roleAssignments) {
      try {
        // Buscar role RBAC
        const role = await prisma.role.findUnique({
          where: { slug: assignment.roleSlug },
        });

        if (!role) {
          console.log(`   ❌ ${assignment.email}: Role "${assignment.roleSlug}" não encontrado`);
          errorCount++;
          continue;
        }

        // Buscar usuário
        const user = await prisma.user.findUnique({
          where: { email: assignment.email },
        });

        if (!user) {
          console.log(`   ⚠️  ${assignment.email}: Usuário não encontrado (pular)`);
          continue;
        }

        // Atualizar usuário
        await prisma.user.update({
          where: { email: assignment.email },
          data: {
            roleId: role.id,
            legacyRole: assignment.roleSlug.toUpperCase(),
          },
        });

        successCount++;
        console.log(`   ✅ ${assignment.email}: Promovido para ${role.name} (${assignment.roleSlug})`);
      } catch (error: any) {
        errorCount++;
        console.log(`   ❌ ${assignment.email}: Erro - ${error.message}`);
      }
    }

    console.log('');
    console.log('📊 [Promote] Estatísticas:');
    console.log(`   ✅ Promovidos: ${successCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log('');

    if (successCount > 0) {
      console.log('🎉 [Promote] Promoções concluídas com sucesso!');
    }
  } catch (error) {
    console.error('❌ [Promote] Erro ao promover usuários:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  promoteInitialAdmins()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { promoteInitialAdmins };
