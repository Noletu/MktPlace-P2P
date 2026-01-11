import { Request, Response } from 'express';
import { roleService } from '../services/role.service';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditLog.service';

/**
 * Controller para gerenciamento de Roles e Permissões
 *
 * SECURITY: Todas as rotas requerem role MASTER
 */

export class RoleController {
  /**
   * GET /api/v1/roles
   * Listar todos os roles
   */
  async listRoles(req: Request, res: Response) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const roles = await roleService.listRoles(includeInactive);

      res.json({
        success: true,
        data: roles,
      });
    } catch (error: any) {
      console.error('Erro ao listar roles:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar roles',
      });
    }
  }

  /**
   * GET /api/v1/roles/:id
   * Buscar role por ID
   */
  async getRoleById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const role = await roleService.getRoleById(id);

      res.json({
        success: true,
        data: role,
      });
    } catch (error: any) {
      console.error('Erro ao buscar role:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Role não encontrado',
      });
    }
  }

  /**
   * POST /api/v1/roles
   * Criar novo role customizado
   */
  async createRole(req: Request, res: Response) {
    try {
      const { name, slug, description, color, icon, level, permissionIds } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Nome do role é obrigatório',
        });
      }

      const newRole = await roleService.createRole({
        name,
        slug,
        description,
        color,
        icon,
        level,
        permissionIds,
      });

      // AUDIT LOG: Registrar criação de role
      await auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ROLE_CREATE,
        AUDIT_RESOURCES.ROLE,
        newRole.id,
        {
          description: `Role criado: ${newRole.name} (${newRole.slug})`,
          roleId: newRole.id,
          roleName: newRole.name,
          roleSlug: newRole.slug,
          roleLevel: newRole.level,
          permissionsCount: permissionIds?.length || 0,
        }
      );

      res.status(201).json({
        success: true,
        data: newRole,
        message: `Role "${name}" criado com sucesso`,
      });
    } catch (error: any) {
      console.error('Erro ao criar role:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao criar role',
      });
    }
  }

  /**
   * PUT /api/v1/roles/:id
   * Atualizar role existente
   */
  async updateRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, color, icon, level, isActive } = req.body;

      const updatedRole = await roleService.updateRole(id, {
        name,
        description,
        color,
        icon,
        level,
        isActive,
      });

      // AUDIT LOG: Registrar atualização de role
      await auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ROLE_UPDATE,
        AUDIT_RESOURCES.ROLE,
        id,
        {
          description: `Role atualizado: ${updatedRole.name} (${updatedRole.slug})`,
          roleId: updatedRole.id,
          roleName: updatedRole.name,
          roleSlug: updatedRole.slug,
          changes: { name, description, color, icon, level, isActive },
        }
      );

      res.json({
        success: true,
        data: updatedRole,
        message: 'Role atualizado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao atualizar role:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao atualizar role',
      });
    }
  }

  /**
   * DELETE /api/v1/roles/:id
   * Deletar role customizado
   */
  async deleteRole(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Buscar role antes de deletar para ter os dados no audit log
      const roleToDelete = await roleService.getRoleById(id);

      const result = await roleService.deleteRole(id);

      // AUDIT LOG: Registrar deleção de role
      await auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ROLE_DELETE,
        AUDIT_RESOURCES.ROLE,
        id,
        {
          description: `Role deletado: ${roleToDelete.name} (${roleToDelete.slug})`,
          roleId: roleToDelete.id,
          roleName: roleToDelete.name,
          roleSlug: roleToDelete.slug,
          roleLevel: roleToDelete.level,
          usersMovedToUser: result.usersMovedToUser,
        }
      );

      res.json({
        ...result,
      });
    } catch (error: any) {
      console.error('Erro ao deletar role:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao deletar role',
      });
    }
  }

  /**
   * GET /api/v1/permissions
   * Listar todas as permissões disponíveis (agrupadas por categoria)
   */
  async listPermissions(req: Request, res: Response) {
    try {
      const permissions = await roleService.listPermissions();

      res.json({
        success: true,
        data: permissions,
      });
    } catch (error: any) {
      console.error('Erro ao listar permissões:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar permissões',
      });
    }
  }

  /**
   * POST /api/v1/roles/:id/permissions
   * Atribuir permissão a role
   */
  async assignPermission(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { permissionId } = req.body;
      const grantedBy = req.user?.userId;

      if (!permissionId) {
        return res.status(400).json({
          success: false,
          error: 'permissionId é obrigatório',
        });
      }

      const result = await roleService.assignPermissionToRole(id, permissionId, grantedBy);

      // Buscar dados para audit log
      const role = await roleService.getRoleById(id);
      const permissionsGrouped = await roleService.listPermissions();
      const allPermissions = Object.values(permissionsGrouped).flat();
      const permission = allPermissions.find((p: any) => p.id === permissionId);

      // AUDIT LOG: Registrar associação de permissão
      await auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ROLE_PERMISSION_ASSIGN,
        AUDIT_RESOURCES.ROLE,
        id,
        {
          description: `Permissão associada ao role: ${permission?.name || permissionId}`,
          roleId: id,
          roleName: role.name,
          permissionId,
          permissionName: permission?.name,
        }
      );

      res.json({
        ...result,
      });
    } catch (error: any) {
      console.error('Erro ao atribuir permissão:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao atribuir permissão',
      });
    }
  }

  /**
   * DELETE /api/v1/roles/:id/permissions/:permissionId
   * Remover permissão de role
   */
  async removePermission(req: Request, res: Response) {
    try {
      const { id, permissionId } = req.params;

      // Buscar dados para audit log antes de remover
      const role = await roleService.getRoleById(id);
      const permissionsGrouped = await roleService.listPermissions();
      const allPermissions = Object.values(permissionsGrouped).flat();
      const permission = allPermissions.find((p: any) => p.id === permissionId);

      const result = await roleService.removePermissionFromRole(id, permissionId);

      // AUDIT LOG: Registrar remoção de permissão
      await auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ROLE_PERMISSION_REMOVE,
        AUDIT_RESOURCES.ROLE,
        id,
        {
          description: `Permissão removida do role: ${permission?.name || permissionId}`,
          roleId: id,
          roleName: role.name,
          permissionId,
          permissionName: permission?.name,
        }
      );

      res.json({
        ...result,
      });
    } catch (error: any) {
      console.error('Erro ao remover permissão:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao remover permissão',
      });
    }
  }

  /**
   * PUT /api/v1/roles/:id/permissions
   * Atualizar todas as permissões de um role (substituir)
   */
  async updateRolePermissions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { permissionIds } = req.body;
      const grantedBy = req.user?.userId;

      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({
          success: false,
          error: 'permissionIds deve ser um array',
        });
      }

      const result = await roleService.updateRolePermissions(id, permissionIds, grantedBy);

      // Buscar role para audit log
      const role = await roleService.getRoleById(id);

      // AUDIT LOG: Registrar atualização em lote de permissões
      await auditLogService.logFromRequest(
        req,
        AUDIT_ACTIONS.ROLE_PERMISSION_UPDATE,
        AUDIT_RESOURCES.ROLE,
        id,
        {
          description: `Permissões do role atualizadas: ${permissionIds.length} permissões`,
          roleId: id,
          roleName: role.name,
          newPermissionsCount: permissionIds.length,
          permissionIds,
        }
      );

      res.json({
        ...result,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar permissões:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao atualizar permissões',
      });
    }
  }
}

export const roleController = new RoleController();
