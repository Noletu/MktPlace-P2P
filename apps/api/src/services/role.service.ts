import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Service para gerenciamento de Roles e Permissões (RBAC)
 *
 * SECURITY:
 * - Todas as operações requerem role MASTER
 * - Roles de sistema (isSystem: true) não podem ser deletados
 * - Ao deletar role customizado, usuários são movidos para USER automaticamente
 */

export class RoleService {
  /**
   * Listar todos os roles
   */
  async listRoles(includeInactive = false) {
    const roles = await prisma.role.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true, // Quantos usuários têm este role
          },
        },
      },
      orderBy: [
        { level: 'desc' }, // Ordenar por nível (MASTER primeiro)
        { name: 'asc' },
      ],
    });

    // Formatar resposta
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      color: role.color,
      icon: role.icon,
      level: role.level,
      isSystem: role.isSystem,
      isActive: role.isActive,
      userCount: role._count.users,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        displayName: rp.permission.displayName,
        category: rp.permission.category,
        isCritical: rp.permission.isCritical,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  /**
   * Buscar role por ID ou slug
   */
  async getRoleById(idOrSlug: string) {
    const role = await prisma.role.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      throw new Error('Role não encontrado');
    }

    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      color: role.color,
      icon: role.icon,
      level: role.level,
      isSystem: role.isSystem,
      isActive: role.isActive,
      userCount: role._count.users,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        displayName: rp.permission.displayName,
        category: rp.permission.category,
        description: rp.permission.description,
        isCritical: rp.permission.isCritical,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * Criar novo role customizado
   * SECURITY: Apenas MASTER pode criar roles
   */
  async createRole(data: {
    name: string;
    slug?: string;
    description?: string;
    color?: string;
    icon?: string;
    level?: number;
    permissionIds?: string[];
  }) {
    // Validação básica
    if (!data.name || data.name.length < 3) {
      throw new Error('Nome do role deve ter pelo menos 3 caracteres');
    }

    // Gerar slug automático se não fornecido
    const slug =
      data.slug ||
      data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]+/g, '_') // Substitui caracteres especiais por _
        .replace(/^_+|_+$/g, ''); // Remove _ do início e fim

    // Verificar se slug já existe
    const existingRole = await prisma.role.findUnique({ where: { slug } });
    if (existingRole) {
      throw new Error(`Já existe um role com o slug "${slug}"`);
    }

    // Validar nível (não pode criar role com nível >= MASTER)
    const level = data.level || 50; // Default: entre SUPPORT (40) e GERENTE (60)
    if (level >= 100) {
      throw new Error('Não é permitido criar role com nível 100 ou superior (reservado para MASTER)');
    }

    // Criar role
    const newRole = await prisma.role.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        color: data.color || '#6B7280',
        icon: data.icon || '👤',
        level,
        isSystem: false, // Roles customizados NUNCA são de sistema
        isActive: true,
      },
    });

    // Associar permissões se fornecidas
    if (data.permissionIds && data.permissionIds.length > 0) {
      await Promise.all(
        data.permissionIds.map((permissionId) =>
          prisma.rolePermission.create({
            data: {
              roleId: newRole.id,
              permissionId,
            },
          })
        )
      );
    }

    return await this.getRoleById(newRole.id);
  }

  /**
   * Atualizar role existente
   * SECURITY: Apenas MASTER pode atualizar roles
   * SECURITY: Roles de sistema não podem ter isSystem ou level alterados
   */
  async updateRole(
    roleId: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      level?: number;
      isActive?: boolean;
    }
  ) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });

    if (!role) {
      throw new Error('Role não encontrado');
    }

    // SECURITY: Roles de sistema não podem ter o nível alterado
    if (role.isSystem && data.level !== undefined && data.level !== role.level) {
      throw new Error('Não é permitido alterar o nível de roles de sistema');
    }

    // SECURITY: Não pode criar role com nível >= MASTER
    if (data.level !== undefined && data.level >= 100) {
      throw new Error('Não é permitido definir nível 100 ou superior (reservado para MASTER)');
    }

    // Atualizar role
    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        level: data.level,
        isActive: data.isActive,
      },
    });

    return await this.getRoleById(updatedRole.id);
  }

  /**
   * Deletar role customizado
   * SECURITY: Apenas MASTER pode deletar roles
   * SECURITY: Roles de sistema NÃO podem ser deletados
   * SECURITY: Ao deletar role, usuários são movidos para USER automaticamente
   */
  async deleteRole(roleId: string) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      throw new Error('Role não encontrado');
    }

    // SECURITY: Roles de sistema não podem ser deletados
    if (role.isSystem) {
      throw new Error('Não é permitido deletar roles de sistema (USER, SUPPORT, GERENTE, ADMIN, MASTER)');
    }

    // Buscar role USER para mover usuários
    const userRole = await prisma.role.findUnique({ where: { slug: 'user' } });
    if (!userRole) {
      throw new Error('Role USER não encontrado. Execute o seed RBAC primeiro.');
    }

    // Mover todos os usuários deste role para USER
    if (role._count.users > 0) {
      await prisma.user.updateMany({
        where: { roleId },
        data: { roleId: userRole.id },
      });
    }

    // Deletar role (cascata deletará rolePermissions automaticamente)
    await prisma.role.delete({ where: { id: roleId } });

    return {
      success: true,
      message: `Role "${role.name}" deletado com sucesso`,
      usersMovedToUser: role._count.users,
    };
  }

  /**
   * Listar todas as permissões disponíveis (agrupadas por categoria)
   */
  async listPermissions() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Agrupar por categoria
    const grouped = permissions.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push({
        id: permission.id,
        name: permission.name,
        displayName: permission.displayName,
        description: permission.description,
        isCritical: permission.isCritical,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  }

  /**
   * Atribuir permissão a role
   * SECURITY: Apenas MASTER pode modificar permissões
   */
  async assignPermissionToRole(roleId: string, permissionId: string, grantedBy?: string) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new Error('Role não encontrado');
    }

    const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) {
      throw new Error('Permissão não encontrada');
    }

    // Verificar se já existe
    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (existing) {
      throw new Error('Esta permissão já está atribuída a este role');
    }

    // Criar associação
    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
        grantedBy,
      },
    });

    return {
      success: true,
      message: `Permissão "${permission.displayName}" atribuída ao role "${role.name}"`,
    };
  }

  /**
   * Remover permissão de role
   * SECURITY: Apenas MASTER pode modificar permissões
   */
  async removePermissionFromRole(roleId: string, permissionId: string) {
    const rolePermission = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
      include: {
        role: true,
        permission: true,
      },
    });

    if (!rolePermission) {
      throw new Error('Associação role-permissão não encontrada');
    }

    // Deletar associação
    await prisma.rolePermission.delete({
      where: {
        id: rolePermission.id,
      },
    });

    return {
      success: true,
      message: `Permissão "${rolePermission.permission.displayName}" removida do role "${rolePermission.role.name}"`,
    };
  }

  /**
   * Atualizar permissões de um role (substituir todas)
   * SECURITY: Apenas MASTER pode modificar permissões
   */
  async updateRolePermissions(roleId: string, permissionIds: string[], grantedBy?: string) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new Error('Role não encontrado');
    }

    // Verificar se todas as permissões existem
    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new Error('Uma ou mais permissões não foram encontradas');
    }

    // Deletar todas as permissões atuais
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Criar novas associações
    await Promise.all(
      permissionIds.map((permissionId) =>
        prisma.rolePermission.create({
          data: {
            roleId,
            permissionId,
            grantedBy,
          },
        })
      )
    );

    return {
      success: true,
      message: `Permissões do role "${role.name}" atualizadas com sucesso`,
      permissionsCount: permissionIds.length,
    };
  }

  /**
   * Verificar se usuário tem permissão específica
   * Usado pelo middleware dinâmico
   */
  async userHasPermission(userId: string, permissionName: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.role) {
      return false;
    }

    // Verificar se o role do usuário tem a permissão
    return user.role.rolePermissions.some((rp) => rp.permission.name === permissionName);
  }

  /**
   * Verificar se usuário tem qualquer uma das permissões listadas
   */
  async userHasAnyPermission(userId: string, permissionNames: string[]): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.role) {
      return false;
    }

    // Verificar se o role do usuário tem alguma das permissões
    const userPermissions = user.role.rolePermissions.map((rp) => rp.permission.name);
    return permissionNames.some((permission) => userPermissions.includes(permission));
  }
}

export const roleService = new RoleService();
