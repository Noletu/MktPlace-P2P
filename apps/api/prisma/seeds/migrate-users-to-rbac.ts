import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script de migração: Associar usuários existentes aos roles RBAC
 *
 * Este script:
 * 1. Busca todos os usuários que ainda não têm roleId (roleId = null)
 * 2. Para cada usuário, busca o role RBAC correspondente ao seu legacyRole
 * 3. Associa o usuário ao role RBAC correto
 */

async function migrateUsersToRBAC() {
  console.log('🔄 [Migration] Iniciando migração de usuários para RBAC...\n');

  try {
    // 1. Buscar todos os usuários sem roleId
    const usersWithoutRole = await prisma.user.findMany({
      where: { roleId: null },
      select: {
        id: true,
        email: true,
        legacyRole: true,
      },
    });

    console.log(`📊 Encontrados ${usersWithoutRole.length} usuários para migrar\n`);

    if (usersWithoutRole.length === 0) {
      console.log('✅ Todos os usuários já estão associados a roles RBAC!\n');
      return;
    }

    // 2. Buscar todos os roles RBAC disponíveis
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    // Criar mapa slug -> roleId
    const roleMap = new Map<string, string>();
    for (const role of roles) {
      roleMap.set(role.slug.toUpperCase(), role.id);
      roleMap.set(role.slug.toLowerCase(), role.id);
    }

    console.log('📋 Roles RBAC disponíveis:');
    roles.forEach((role) => {
      console.log(`   - ${role.name} (${role.slug})`);
    });
    console.log('');

    // 3. Migrar cada usuário
    let successCount = 0;
    let errorCount = 0;
    const errors: { email: string; error: string }[] = [];

    for (const user of usersWithoutRole) {
      try {
        // Normalizar legacyRole
        const legacyRoleNormalized = user.legacyRole.toLowerCase();

        // Buscar roleId correspondente
        const roleId = roleMap.get(legacyRoleNormalized);

        if (!roleId) {
          const error = `Role RBAC não encontrado para legacyRole "${user.legacyRole}"`;
          errors.push({ email: user.email, error });
          errorCount++;
          console.log(`   ❌ ${user.email}: ${error}`);
          continue;
        }

        // Atualizar usuário
        await prisma.user.update({
          where: { id: user.id },
          data: { roleId },
        });

        successCount++;
        console.log(`   ✅ ${user.email}: ${user.legacyRole} → Role RBAC associado`);
      } catch (error: any) {
        errorCount++;
        errors.push({ email: user.email, error: error.message });
        console.log(`   ❌ ${user.email}: Erro - ${error.message}`);
      }
    }

    console.log('');
    console.log('📊 [Migration] Estatísticas:');
    console.log(`   ✅ Sucesso: ${successCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log('');

    if (errors.length > 0) {
      console.log('❌ [Migration] Erros encontrados:');
      errors.forEach((err) => {
        console.log(`   - ${err.email}: ${err.error}`);
      });
      console.log('');
    }

    if (successCount > 0) {
      console.log('🎉 [Migration] Migração concluída com sucesso!');
      console.log(`   ${successCount} usuários migrados para RBAC`);
    } else {
      console.log('⚠️  [Migration] Nenhum usuário foi migrado.');
    }
  } catch (error) {
    console.error('❌ [Migration] Erro fatal ao migrar usuários:', error);
    throw error;
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateUsersToRBAC()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { migrateUsersToRBAC };
