import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * RBAC Seed - Cria roles de sistema e permissões granulares
 *
 * Estrutura:
 * 1. Criar permissões granulares por categoria
 * 2. Criar roles de sistema (USER, SUPPORT, GERENTE, ADMIN, MASTER)
 * 3. Associar permissões aos roles
 */

// ============================================
// PERMISSÕES GRANULARES
// ============================================

const permissions = [
  // CATEGORIA: users
  {
    name: 'users.view',
    displayName: 'Visualizar Usuários',
    category: 'users',
    description: 'Visualizar lista de usuários e detalhes básicos',
    isCritical: false,
  },
  {
    name: 'users.view_details',
    displayName: 'Ver Detalhes Completos de Usuários',
    category: 'users',
    description: 'Ver todas as informações de um usuário (wallets, transações, etc)',
    isCritical: false,
  },
  {
    name: 'users.edit',
    displayName: 'Editar Usuários',
    category: 'users',
    description: 'Editar informações de usuários (nome, email, etc)',
    isCritical: true,
  },
  {
    name: 'users.change_role',
    displayName: 'Alterar Role de Usuários',
    category: 'users',
    description: 'Promover ou rebaixar usuários (seguindo hierarquia)',
    isCritical: true,
  },
  {
    name: 'users.freeze',
    displayName: 'Bloquear Contas',
    category: 'users',
    description: 'Bloquear e desbloquear contas de usuários',
    isCritical: true,
  },
  {
    name: 'users.delete',
    displayName: 'Deletar Usuários',
    category: 'users',
    description: 'Deletar permanentemente contas de usuários',
    isCritical: true,
  },

  // CATEGORIA: orders
  {
    name: 'orders.view',
    displayName: 'Visualizar Pedidos',
    category: 'orders',
    description: 'Ver lista de pedidos da plataforma',
    isCritical: false,
  },
  {
    name: 'orders.view_details',
    displayName: 'Ver Detalhes de Pedidos',
    category: 'orders',
    description: 'Ver todos os detalhes de um pedido',
    isCritical: false,
  },
  {
    name: 'orders.edit',
    displayName: 'Editar Pedidos',
    category: 'orders',
    description: 'Editar pedidos existentes (God Mode)',
    isCritical: true,
  },
  {
    name: 'orders.cancel',
    displayName: 'Cancelar Pedidos',
    category: 'orders',
    description: 'Cancelar pedidos de qualquer usuário',
    isCritical: true,
  },

  // CATEGORIA: disputes
  {
    name: 'disputes.view',
    displayName: 'Visualizar Disputas',
    category: 'disputes',
    description: 'Ver lista de disputas da plataforma',
    isCritical: false,
  },
  {
    name: 'disputes.resolve',
    displayName: 'Resolver Disputas',
    category: 'disputes',
    description: 'Resolver disputas entre usuários',
    isCritical: true,
  },
  {
    name: 'disputes.analytics',
    displayName: 'Analytics de Disputas',
    category: 'disputes',
    description: 'Ver estatísticas e analytics de disputas',
    isCritical: false,
  },

  // CATEGORIA: finance
  {
    name: 'finance.view_stats',
    displayName: 'Ver Estatísticas Financeiras',
    category: 'finance',
    description: 'Ver dashboard financeiro e estatísticas',
    isCritical: false,
  },
  {
    name: 'finance.view_platform_balance',
    displayName: 'Ver Saldo da Plataforma',
    category: 'finance',
    description: 'Ver saldo total das carteiras da plataforma',
    isCritical: true,
  },
  {
    name: 'finance.view_wallets',
    displayName: 'Ver Carteiras da Plataforma',
    category: 'finance',
    description: 'Ver detalhes das carteiras MASTER',
    isCritical: true,
  },
  {
    name: 'finance.internal_transfer',
    displayName: 'Transferências Internas',
    category: 'finance',
    description: 'Realizar transferências entre usuários (God Mode Financeiro)',
    isCritical: true,
  },
  {
    name: 'finance.adjust_balance',
    displayName: 'Ajustar Saldo',
    category: 'finance',
    description: 'Ajustar saldo de usuários manualmente (God Mode Financeiro)',
    isCritical: true,
  },

  // CATEGORIA: kyc
  {
    name: 'kyc.view',
    displayName: 'Visualizar KYC',
    category: 'kyc',
    description: 'Ver lista de verificações KYC pendentes',
    isCritical: false,
  },
  {
    name: 'kyc.view_details',
    displayName: 'Ver Detalhes de KYC',
    category: 'kyc',
    description: 'Ver documentos e informações completas de KYC',
    isCritical: false,
  },
  {
    name: 'kyc.approve',
    displayName: 'Aprovar KYC',
    category: 'kyc',
    description: 'Aprovar verificações KYC de usuários',
    isCritical: true,
  },
  {
    name: 'kyc.reject',
    displayName: 'Rejeitar KYC',
    category: 'kyc',
    description: 'Rejeitar verificações KYC de usuários',
    isCritical: true,
  },

  // CATEGORIA: reports
  {
    name: 'reports.view_audit',
    displayName: 'Ver Audit Logs',
    category: 'reports',
    description: 'Ver logs de auditoria da plataforma',
    isCritical: false,
  },
  {
    name: 'reports.export_audit',
    displayName: 'Exportar Audit Logs',
    category: 'reports',
    description: 'Exportar logs de auditoria',
    isCritical: false,
  },
  {
    name: 'reports.generate_authority',
    displayName: 'Gerar Relatórios para Autoridades',
    category: 'reports',
    description: 'Gerar relatórios completos de usuários para autoridades',
    isCritical: true,
  },

  // CATEGORIA: system
  {
    name: 'system.dashboard',
    displayName: 'Acessar Dashboard Admin',
    category: 'system',
    description: 'Acessar painel administrativo',
    isCritical: false,
  },
  {
    name: 'system.manage_roles',
    displayName: 'Gerenciar Roles',
    category: 'system',
    description: 'Criar, editar e deletar roles customizados (MASTER only)',
    isCritical: true,
  },
  {
    name: 'system.manage_permissions',
    displayName: 'Gerenciar Permissões',
    category: 'system',
    description: 'Atribuir/remover permissões de roles (MASTER only)',
    isCritical: true,
  },
  {
    name: 'system.access_master_seed',
    displayName: 'Acessar Master Seed',
    category: 'system',
    description: 'Acessar e recuperar master seed da plataforma (MASTER only)',
    isCritical: true,
  },
  {
    name: 'system.manage_platform_wallets',
    displayName: 'Gerenciar Carteiras da Plataforma',
    category: 'system',
    description: 'Criar e gerenciar carteiras da plataforma',
    isCritical: true,
  },
];

// ============================================
// ROLES DE SISTEMA
// ============================================

const systemRoles = [
  {
    name: 'USER',
    slug: 'user',
    description: 'Usuário padrão da plataforma',
    color: '#6B7280', // gray-500
    icon: '👤',
    isSystem: true,
    level: 0,
    permissions: [], // Usuário não tem permissões admin
  },
  {
    name: 'SUPPORT',
    slug: 'support',
    description: 'Suporte básico ao cliente',
    color: '#F59E0B', // yellow-500
    icon: '🎧',
    isSystem: true,
    level: 40,
    permissions: [
      'users.view',
      'users.view_details',
      'orders.view',
      'orders.view_details',
      'disputes.view',
      'kyc.view',
      'kyc.view_details',
      'reports.view_audit',
      'system.dashboard',
    ],
  },
  {
    name: 'GERENTE',
    slug: 'gerente',
    description: 'Gerente operacional - disputas, pedidos, freeze (SEM acesso financeiro)',
    color: '#10B981', // green-500
    icon: '👔',
    isSystem: true,
    level: 60,
    permissions: [
      // Users
      'users.view',
      'users.view_details',
      'users.freeze',

      // Orders
      'orders.view',
      'orders.view_details',
      'orders.cancel',
      'orders.edit',

      // Disputes
      'disputes.view',
      'disputes.resolve',
      'disputes.analytics',

      // Finance (APENAS visualização de stats, SEM operações)
      'finance.view_stats',

      // KYC
      'kyc.view',
      'kyc.view_details',
      'kyc.approve',
      'kyc.reject',

      // Reports
      'reports.view_audit',
      'reports.export_audit',
      'reports.generate_authority',

      // System
      'system.dashboard',
    ],
  },
  {
    name: 'ADMIN',
    slug: 'admin',
    description: 'Administrador com god mode operacional e financeiro',
    color: '#3B82F6', // blue-500
    icon: '⚡',
    isSystem: true,
    level: 80,
    permissions: [
      // Users (TUDO exceto gerenciar roles)
      'users.view',
      'users.view_details',
      'users.edit',
      'users.change_role',
      'users.freeze',
      'users.delete',

      // Orders
      'orders.view',
      'orders.view_details',
      'orders.edit',
      'orders.cancel',

      // Disputes
      'disputes.view',
      'disputes.resolve',
      'disputes.analytics',

      // Finance (TUDO exceto operações financeiras críticas)
      'finance.view_stats',
      'finance.view_platform_balance',
      'finance.view_wallets',
      // NÃO TEM: finance.internal_transfer, finance.adjust_balance

      // KYC
      'kyc.view',
      'kyc.view_details',
      'kyc.approve',
      'kyc.reject',

      // Reports
      'reports.view_audit',
      'reports.export_audit',
      'reports.generate_authority',

      // System
      'system.dashboard',
      'system.manage_platform_wallets',
      // NÃO TEM: system.manage_roles, system.manage_permissions, system.access_master_seed
    ],
  },
  {
    name: 'MASTER',
    slug: 'master',
    description: 'Super administrador com controle total da plataforma',
    color: '#9333EA', // purple-600
    icon: '👑',
    isSystem: true,
    level: 100,
    permissions: 'ALL', // MASTER tem TODAS as permissões
  },
];

// ============================================
// FUNÇÃO PRINCIPAL DE SEED
// ============================================

export async function seedRBAC() {
  console.log('🌱 [RBAC Seed] Iniciando seed do sistema RBAC...');

  try {
    // 1. Criar permissões
    console.log('📋 [RBAC Seed] Criando permissões...');

    const createdPermissions = await Promise.all(
      permissions.map(async (permission) => {
        return await prisma.permission.upsert({
          where: { name: permission.name },
          update: permission,
          create: permission,
        });
      })
    );

    console.log(`✅ [RBAC Seed] ${createdPermissions.length} permissões criadas/atualizadas`);

    // 2. Criar roles e associar permissões
    console.log('👥 [RBAC Seed] Criando roles de sistema...');

    for (const roleData of systemRoles) {
      const { permissions: rolePermissions, ...roleInfo } = roleData;

      // Criar/atualizar role
      const role = await prisma.role.upsert({
        where: { slug: roleInfo.slug },
        update: roleInfo,
        create: roleInfo,
      });

      console.log(`   ✓ Role criado: ${role.name} (nível ${role.level})`);

      // Associar permissões
      if (rolePermissions === 'ALL') {
        // MASTER tem todas as permissões
        const allPermissions = await prisma.permission.findMany();

        await Promise.all(
          allPermissions.map(async (permission) => {
            return await prisma.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: permission.id,
                },
              },
              update: {},
              create: {
                roleId: role.id,
                permissionId: permission.id,
              },
            });
          })
        );

        console.log(`     → ${allPermissions.length} permissões associadas (TODAS)`);
      } else if (Array.isArray(rolePermissions) && rolePermissions.length > 0) {
        // Roles específicos têm permissões listadas
        const permissionsToAssign = await prisma.permission.findMany({
          where: {
            name: {
              in: rolePermissions,
            },
          },
        });

        await Promise.all(
          permissionsToAssign.map(async (permission) => {
            return await prisma.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: permission.id,
                },
              },
              update: {},
              create: {
                roleId: role.id,
                permissionId: permission.id,
              },
            });
          })
        );

        console.log(`     → ${permissionsToAssign.length} permissões associadas`);
      }
    }

    console.log('✅ [RBAC Seed] Todos os roles de sistema criados com sucesso!');

    // 3. Estatísticas finais
    const totalRoles = await prisma.role.count();
    const totalPermissions = await prisma.permission.count();
    const totalAssociations = await prisma.rolePermission.count();

    console.log('');
    console.log('📊 [RBAC Seed] Estatísticas:');
    console.log(`   - Roles: ${totalRoles}`);
    console.log(`   - Permissões: ${totalPermissions}`);
    console.log(`   - Associações: ${totalAssociations}`);
    console.log('');
    console.log('🎉 [RBAC Seed] Seed RBAC concluído com sucesso!');

  } catch (error) {
    console.error('❌ [RBAC Seed] Erro ao criar seed:', error);
    throw error;
  }
}

// Executar seed se chamado diretamente
if (require.main === module) {
  seedRBAC()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
