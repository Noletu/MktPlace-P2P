#!/bin/bash

# Script para commit da implementação RBAC
# Data: 04/01/2026

echo "🚀 Preparando commit da implementação RBAC..."
echo ""

# Verificar se estamos em um repositório git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Erro: Não está em um repositório git"
  exit 1
fi

echo "📋 Arquivos que serão commitados:"
echo ""

# Documentação
echo "📚 Documentação:"
git add docs/RBAC-IMPLEMENTATION.md
git add docs/RBAC-QUICK-REFERENCE.md
git add docs/RBAC-FILES-SUMMARY.md
git add CHANGELOG-RBAC.md
git add COMMIT-MESSAGE-RBAC.txt
echo "  ✓ 5 arquivos de documentação"

# Database
echo ""
echo "🗄️ Database:"
git add apps/api/prisma/schema.prisma
git add apps/api/prisma/seeds/rbac-seed.ts
git add apps/api/prisma/seeds/migrate-users-to-rbac.ts
echo "  ✓ Schema + 2 seeds"

# Backend - Services
echo ""
echo "⚙️ Backend - Services:"
git add apps/api/src/services/role.service.ts
git add apps/api/src/services/auth.service.ts
git add apps/api/src/services/admin.service.ts
echo "  ✓ 1 novo + 2 modificados"

# Backend - Controllers
echo ""
echo "🎮 Backend - Controllers:"
git add apps/api/src/controllers/role.controller.ts
echo "  ✓ 1 novo"

# Backend - Routes
echo ""
echo "🛣️ Backend - Routes:"
git add apps/api/src/routes/role.routes.ts
git add apps/api/src/index.ts
echo "  ✓ 1 novo + index.ts"

# Backend - Middleware
echo ""
echo "🛡️ Backend - Middleware:"
git add apps/api/src/middleware/permission.middleware.ts
git add apps/api/src/middleware/master.middleware.ts
git add apps/api/src/middleware/auth.middleware.ts
echo "  ✓ 2 novos + 1 modificado"

# Frontend - Pages
echo ""
echo "🎨 Frontend - Pages:"
git add apps/web/app/admin/roles/
git add apps/web/app/admin/layout.tsx
echo "  ✓ 1 página nova + layout modificado"

# Frontend - Components
echo ""
echo "🧩 Frontend - Components:"
git add apps/web/components/admin/modals/CreateRoleModal.tsx
git add apps/web/components/admin/modals/EditRolePermissionsModal.tsx
echo "  ✓ 2 modais novos"

echo ""
echo "✅ Todos os arquivos adicionados ao staging!"
echo ""
echo "📝 Status do git:"
git status --short

echo ""
echo "💡 Próximo passo:"
echo "   Execute: git commit -F COMMIT-MESSAGE-RBAC.txt"
echo ""
echo "   Ou edite a mensagem primeiro:"
echo "   Execute: git commit"
echo ""
