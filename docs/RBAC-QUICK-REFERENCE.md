# RBAC - Guia Rápido de Referência

**Data:** 04/01/2026
**Versão:** 1.0.0

Este documento serve como referência rápida para desenvolvedores trabalhando com o sistema RBAC.

---

## 🚀 Quick Start

### 1. Verificar role do usuário atual

```typescript
// No middleware (após authMiddleware)
const userRole = req.user.role; // "MASTER", "ADMIN", "GERENTE", etc
const userLevel = req.user.roleLevel; // 100, 80, 60, etc
```

### 2. Verificar se usuário tem permissão

```typescript
// Método 1: Middleware (recomendado)
router.put('/users/:id',
  authMiddleware,
  requirePermission('users.edit'), // ← Adicionar aqui
  userController.updateUser
);

// Método 2: Programaticamente
import { roleService } from '@/services/role.service';

const hasPermission = await roleService.userHasPermission(userId, 'users.edit');
if (!hasPermission) {
  throw new Error('Acesso negado');
}
```

### 3. Proteger rota para MASTER apenas

```typescript
import { masterMiddleware } from '@/middleware/master.middleware';

router.get('/admin/sensitive-data',
  authMiddleware,
  masterMiddleware, // ← Apenas MASTER passa
  controller.getSensitiveData
);
```

---

## 📋 Permissões Disponíveis

### Users (6)
```typescript
'users.view'           // Ver lista de usuários
'users.view_details'   // Ver detalhes de usuário
'users.edit'           // Editar usuário
'users.change_role'    // Mudar role de usuário (⚠️ CRÍTICA)
'users.freeze'         // Bloquear conta (⚠️ CRÍTICA)
'users.delete'         // Deletar usuário (⚠️ CRÍTICA)
```

### Orders (4)
```typescript
'orders.view'          // Ver lista de pedidos
'orders.view_details'  // Ver detalhes de pedido
'orders.edit'          // Editar pedido
'orders.cancel'        // Cancelar pedido
```

### Disputes (3)
```typescript
'disputes.view'        // Ver disputas
'disputes.resolve'     // Resolver disputas
'disputes.analytics'   // Ver analytics de disputas
```

### Finance (5) - CRÍTICAS
```typescript
'finance.view_stats'             // Ver estatísticas financeiras
'finance.view_platform_balance'  // Ver saldo da plataforma
'finance.view_wallets'           // Ver carteiras (⚠️ CRÍTICA)
'finance.internal_transfer'      // Transferências internas (⚠️⚠️ MASTER ONLY)
'finance.adjust_balance'         // Ajustar saldos (⚠️⚠️ MASTER ONLY)
```

### KYC (4)
```typescript
'kyc.view'             // Ver KYC
'kyc.view_details'     // Ver detalhes de KYC
'kyc.approve'          // Aprovar KYC (⚠️ CRÍTICA)
'kyc.reject'           // Rejeitar KYC (⚠️ CRÍTICA)
```

### Reports (3)
```typescript
'reports.view_audit'           // Ver audit log
'reports.export_audit'         // Exportar audit log
'reports.generate_authority'   // Gerar relatório para autoridades (⚠️ CRÍTICA)
```

### System (5) - CRÍTICAS
```typescript
'system.dashboard'                  // Acessar dashboard admin
'system.manage_roles'               // Gerenciar roles (⚠️⚠️ MASTER ONLY)
'system.manage_permissions'         // Gerenciar permissões (⚠️⚠️ MASTER ONLY)
'system.access_master_seed'         // Acessar master seed (⚠️⚠️⚠️ MASTER ONLY + 2FA)
'system.manage_platform_wallets'    // Gerenciar carteiras plataforma (⚠️⚠️ MASTER ONLY)
```

---

## 🎯 Roles Disponíveis

| Role    | Level | Usuários | Permissões | Uso Típico |
|---------|-------|----------|------------|------------|
| USER    | 0     | Todos    | 0          | Usuário comum da plataforma |
| SUPPORT | 40    | Suporte  | 9          | Atendimento ao cliente |
| GERENTE | 60    | Managers | 19         | Operações diárias (disputas, pedidos) |
| ADMIN   | 80    | Admins   | 25         | Gestão administrativa completa |
| MASTER  | 100   | Masters  | 30 (TODAS) | Controle total incluindo finanças |

---

## 💻 Exemplos de Código

### Criar rota protegida por permissão

```typescript
// routes/user.routes.ts
import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { requirePermission } from '@/middleware/permission.middleware';
import { userController } from '@/controllers/user.controller';

const router = Router();

// Rota que requer permissão específica
router.get('/users',
  authMiddleware,                    // 1. Validar JWT
  requirePermission('users.view'),   // 2. Verificar permissão
  userController.listUsers           // 3. Executar controller
);

router.put('/users/:id',
  authMiddleware,
  requirePermission('users.edit'),
  userController.updateUser
);

export default router;
```

### Verificar permissão no controller

```typescript
// controllers/user.controller.ts
import { Request, Response } from 'express';
import { roleService } from '@/services/role.service';

export class UserController {
  async deleteUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const adminId = req.user.userId;

      // Verificar permissão programaticamente (caso não use middleware)
      const canDelete = await roleService.userHasPermission(adminId, 'users.delete');

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para deletar usuários'
        });
      }

      // ... lógica de deleção

      res.json({ success: true, message: 'Usuário deletado' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
```

### Verificar role no frontend

```typescript
// app/admin/users/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function UsersPage() {
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    setUserRole(role || 'USER');
  }, []);

  const canEditUsers = ['GERENTE', 'ADMIN', 'MASTER'].includes(userRole);
  const canDeleteUsers = ['ADMIN', 'MASTER'].includes(userRole);
  const canManageRoles = userRole === 'MASTER';

  return (
    <div>
      {canEditUsers && (
        <button onClick={handleEdit}>✏️ Editar</button>
      )}

      {canDeleteUsers && (
        <button onClick={handleDelete}>🗑️ Deletar</button>
      )}

      {canManageRoles && (
        <button onClick={handleChangeRole}>👑 Mudar Role</button>
      )}
    </div>
  );
}
```

### Chamar API de roles

```typescript
// Listar todos os roles
const response = await fetch('http://localhost:3001/api/v1/roles', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log(data.data); // Array de roles

// Criar novo role
const newRole = await fetch('http://localhost:3001/api/v1/roles', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Moderador',
    description: 'Moderador de conteúdo',
    level: 45,
    color: '#10B981',
    icon: '🛡️',
    permissionIds: ['perm_users_view', 'perm_disputes_view']
  })
});

// Atualizar permissões de um role
await fetch(`http://localhost:3001/api/v1/roles/${roleId}/permissions`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    permissionIds: ['perm_users_view', 'perm_users_edit', 'perm_orders_view']
  })
});
```

---

## 🔧 Cache de Permissões

### Como funciona

```typescript
// Request 1 (Cache MISS)
getUserPermissions(userId) → Query DB → 150ms

// Request 2-N (Cache HIT por 5 minutos)
getUserPermissions(userId) → Retorna do cache → 0.5ms (300x mais rápido!)

// Após 5 minutos (TTL expirado)
getUserPermissions(userId) → Query DB novamente → 150ms
```

### Invalidar cache manualmente

```typescript
import { invalidatePermissionCache } from '@/middleware/permission.middleware';

// Invalidar quando:
// 1. Usuário muda de role
await updateUserRole(userId, newRoleId);
invalidatePermissionCache(userId);

// 2. Role tem permissões alteradas
await updateRolePermissions(roleId, permissionIds);
// Invalidar cache de TODOS os usuários com este role
const usersWithRole = await getUsersByRole(roleId);
usersWithRole.forEach(user => invalidatePermissionCache(user.id));

// 3. Logout
await logout();
invalidatePermissionCache(userId);
```

---

## 🛡️ Hierarquia de Segurança

### Regras de Mudança de Role

```typescript
// Exemplo de validação automática em updateUser()

MASTER (100) pode:
  ✅ Promover qualquer um para qualquer role (inclusive MASTER)
  ✅ Rebaixar qualquer um (inclusive outro MASTER)

ADMIN (80) pode:
  ✅ Promover USER → SUPPORT, GERENTE
  ✅ Rebaixar GERENTE → USER, SUPPORT
  ❌ Promover para ADMIN ou MASTER
  ❌ Alterar outro ADMIN ou MASTER

GERENTE (60) pode:
  ✅ Promover USER → SUPPORT
  ❌ Promover para GERENTE, ADMIN ou MASTER
  ❌ Alterar SUPPORT, GERENTE, ADMIN ou MASTER

Regras gerais:
  ❌ Ninguém pode alterar o próprio role
  ❌ Não pode promover alguém para nível >= próprio nível
  ❌ Não pode alterar alguém de nível >= próprio nível
```

### Exemplo de erro

```typescript
// ADMIN (nível 80) tenta promover USER para MASTER (nível 100)
await adminService.updateUser(userId, { role: 'MASTER' }, adminId);

// ❌ Error: "Apenas usuários MASTER podem promover para MASTER"
```

---

## 📊 Endpoints da API

### GET `/api/v1/roles`
**Descrição:** Lista todos os roles
**Auth:** MASTER
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "role_123",
      "name": "MASTER",
      "slug": "master",
      "level": 100,
      "permissions": [...],
      "userCount": 2
    }
  ]
}
```

### POST `/api/v1/roles`
**Descrição:** Cria novo role customizado
**Auth:** MASTER
**Body:**
```json
{
  "name": "Moderador",
  "description": "Moderador de conteúdo",
  "level": 45,
  "color": "#10B981",
  "icon": "🛡️",
  "permissionIds": ["perm_1", "perm_2"]
}
```

### PUT `/api/v1/roles/:id/permissions`
**Descrição:** Substitui todas as permissões de um role
**Auth:** MASTER
**Body:**
```json
{
  "permissionIds": ["perm_1", "perm_2", "perm_3"]
}
```

### DELETE `/api/v1/roles/:id`
**Descrição:** Deleta role customizado (move usuários para USER)
**Auth:** MASTER
**Validações:**
- ❌ Não pode deletar roles de sistema (`isSystem: true`)

---

## 🐛 Troubleshooting

### "Acesso negado" mesmo com permissão

```typescript
// Solução 1: Invalidar cache
import { invalidatePermissionCache } from '@/middleware/permission.middleware';
invalidatePermissionCache(userId);

// Solução 2: Verificar se permissão existe no role
const roles = await fetch('/api/v1/roles').then(r => r.json());
const userRole = roles.data.find(r => r.slug === 'gerente');
console.log(userRole.permissions); // Verificar se permissão está aqui
```

### Role customizado não aparece

```typescript
// Verificar se role está ativo
const role = await prisma.role.findUnique({
  where: { id: roleId }
});
console.log(role.isActive); // Deve ser true

// Reativar se necessário
await prisma.role.update({
  where: { id: roleId },
  data: { isActive: true }
});
```

### Usuário sem roleId após migração

```typescript
// Verificar usuário
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { role: true }
});

console.log(user.roleId);     // Deve ter um ID
console.log(user.role);       // Deve retornar objeto Role
console.log(user.legacyRole); // Deve ter valor de fallback

// Se roleId for NULL, rodar migração manualmente
const userRole = await prisma.role.findUnique({
  where: { slug: user.legacyRole.toLowerCase() }
});

await prisma.user.update({
  where: { id: userId },
  data: { roleId: userRole.id }
});
```

---

## 📝 Checklist para Nova Feature

Ao implementar nova funcionalidade que requer controle de acesso:

- [ ] **1. Definir permissões necessárias**
  - Ex: `feature.view`, `feature.create`, `feature.edit`, `feature.delete`

- [ ] **2. Adicionar permissões ao banco**
  ```typescript
  await prisma.permission.createMany({
    data: [
      {
        name: 'feature.view',
        displayName: 'Ver Feature',
        category: 'feature',
        description: 'Permite visualizar a feature',
        isCritical: false
      }
    ]
  });
  ```

- [ ] **3. Associar permissões aos roles**
  ```typescript
  // GERENTE, ADMIN, MASTER devem ter feature.view
  const roles = await prisma.role.findMany({
    where: { slug: { in: ['gerente', 'admin', 'master'] } }
  });

  for (const role of roles) {
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: 'perm_feature_view'
      }
    });
  }
  ```

- [ ] **4. Proteger rotas com middleware**
  ```typescript
  router.get('/feature',
    authMiddleware,
    requirePermission('feature.view'),
    controller.getFeature
  );
  ```

- [ ] **5. Proteger UI no frontend**
  ```typescript
  const canViewFeature = ['GERENTE', 'ADMIN', 'MASTER'].includes(userRole);

  {canViewFeature && (
    <Link href="/feature">Ver Feature</Link>
  )}
  ```

- [ ] **6. Testar com diferentes roles**
  - Login como USER → deve ser bloqueado
  - Login como GERENTE → deve ter acesso
  - Login como ADMIN → deve ter acesso
  - Login como MASTER → deve ter acesso

- [ ] **7. Documentar permissões**
  - Atualizar `/docs/RBAC-IMPLEMENTATION.md`
  - Adicionar à tabela de permissões

---

## 🔗 Links Úteis

- **Documentação Completa:** `/docs/RBAC-IMPLEMENTATION.md`
- **Changelog:** `/CHANGELOG-RBAC.md`
- **Prisma Schema:** `/apps/api/prisma/schema.prisma`
- **Role Service:** `/apps/api/src/services/role.service.ts`
- **Permission Middleware:** `/apps/api/src/middleware/permission.middleware.ts`
- **Admin Roles Page:** `/apps/web/app/admin/roles/page.tsx`

---

## 📞 Suporte

**Dúvidas?** Consultar documentação ou inspecionar código comentado nos arquivos principais.

**Arquivos de referência:**
```
/apps/api/src/services/role.service.ts         ← Lógica de negócio
/apps/api/src/middleware/permission.middleware.ts  ← Cache e verificação
/apps/web/app/admin/roles/page.tsx             ← Interface admin
```

---

**Última atualização:** 04/01/2026
**Versão:** 1.0.0
