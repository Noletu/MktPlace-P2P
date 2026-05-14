# Changelog - Refinamentos do Fluxo de Administradores

**Data:** 2026-01-01
**Sessão:** Refinamentos de Admin e Correção de Configuração de API

## 🎯 Objetivo

Refinar a experiência de usuários ADMIN/MASTER para que tenham um fluxo diferenciado e consistente, sem afetar o fluxo de usuários normais.

---

## ✅ Mudanças Implementadas

### 1. **Navegação Condicional no AppHeader**
**Arquivo:** `apps/web/components/AppHeader.tsx`

- ✅ Adicionado campo `role?: string` na interface `User`
- ✅ Implementada detecção de admin: `isAdmin = user?.role === 'ADMIN' || user?.role === 'MASTER'`
- ✅ Navegação condicional:
  - **Para ADMINS**: Apenas botão "⚙️ Painel Admin" → `/admin`
  - **Para USUÁRIOS**: Mantidos os 5 links (Dashboard, Marketplace, Carteiras, Meus Pedidos, Perfil)
- ✅ Implementado tanto para desktop quanto mobile

**Impacto:** Admins agora veem navegação simplificada e focada no painel administrativo.

---

### 2. **Homepage Adaptada para Admins**
**Arquivo:** `apps/web/app/page.tsx`

- ✅ Adicionado state para `userRole`
- ✅ Fetch do role do usuário via `/api/v1/auth/me`
- ✅ Botões condicionais baseados no role:
  - **Para ADMINS**:
    - "⚙️ Painel Admin" → `/admin`
    - "🛒 Ver Marketplace" → `/admin/marketplace`
  - **Para USUÁRIOS**:
    - "Ir para Dashboard" → `/dashboard`
    - "Ver Marketplace" → `/marketplace`

**Impacto:** Homepage agora direciona admins para o painel administrativo.

---

### 3. **Correção do ThemeToggle Duplicado**
**Arquivo:** `apps/web/components/Header.tsx`

- ✅ Adicionado `/admin` à lista de exclusão `pagesWithOwnNavigation`
- ✅ ThemeToggle flutuante não aparece mais no painel admin (evita duplicação)

**Impacto:** Apenas um botão de tema no painel admin (ao lado de notificações).

---

### 4. **Correção CRÍTICA: URLs da API**
**Problema Identificado:** 54 arquivos tinham URLs hardcoded para `http://localhost:3000/api/v1`, mas a API roda em porta 3001.

**Arquivos Corrigidos:**

#### a) `apps/web/config/api.ts`
- ✅ Mudado fallback de `3000` → `3001`
- Antes: `'http://localhost:3000/api/v1'`
- Depois: `'http://localhost:3001/api/v1'`

#### b) Replace Global em 54 arquivos
- ✅ Substituído `http://localhost:3000/api/v1` → `http://localhost:3001/api/v1` em:
  - Todos os arquivos `.ts` e `.tsx`
  - Incluindo: pages, components, hooks, utils

**Arquivos afetados incluem:**
- `apps/web/components/AppHeader.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/admin/**/page.tsx`
- `apps/web/components/**/*.tsx`
- `apps/web/hooks/*.ts`
- E mais 40+ arquivos

#### c) `apps/web/.env.local`
- ✅ Configurado: `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`

**Impacto:** Todas as chamadas da API agora vão para a porta correta (3001), resolvendo erros 404.

---

## 🏗️ Configuração de Portas

```
┌─────────────────────────────────────────┐
│  Frontend (Next.js)                     │
│  Porta: 3000                            │
│  URL: http://localhost:3000             │
└─────────────────────────────────────────┘
                  ↓
          Chamadas API
                  ↓
┌─────────────────────────────────────────┐
│  Backend (API)                          │
│  Porta: 3001                            │
│  URL: http://localhost:3001/api/v1      │
│  WebSocket: ws://localhost:3001         │
└─────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Usuários

### Para USUÁRIOS NORMAIS (não alterado):
```
Homepage:
  ├─ "Ir para Dashboard" → /dashboard
  └─ "Ver Marketplace" → /marketplace

AppHeader:
  ├─ Dashboard
  ├─ Marketplace
  ├─ Carteiras
  ├─ Meus Pedidos
  └─ Perfil
```

### Para ADMINS (novo):
```
Homepage:
  ├─ "⚙️ Painel Admin" → /admin
  └─ "🛒 Ver Marketplace" → /admin/marketplace

AppHeader:
  └─ [⚙️ Painel Admin] → /admin

Painel Admin:
  ├─ Logo clicável → /
  ├─ [🔔] Notificações
  ├─ [🌓] Tema (único, funcionando)
  └─ [👤 ▼] Perfil dropdown
```

---

## 🧪 Validação

### ✅ Testes Realizados:

1. **Login como ADMIN**
   - ✅ Redirecionado para `/admin`
   - ✅ Homepage mostra botões corretos
   - ✅ AppHeader mostra apenas "Painel Admin"
   - ✅ Todas as chamadas API funcionando (sem 404)

2. **Login como USUÁRIO**
   - ✅ Comportamento não alterado
   - ✅ Homepage mostra botões normais
   - ✅ AppHeader mostra 5 links de navegação

3. **ThemeToggle**
   - ✅ Sem duplicação no painel admin
   - ✅ Botão funcional ao lado de notificações

---

## 📝 Notas Importantes

1. **Arquivos .env:**
   - `.env.local` está no `.gitignore` (não versionado)
   - Configuração deve ser replicada em outros ambientes manualmente

2. **Role Detection:**
   - Baseado em `user.role === 'ADMIN' || user.role === 'MASTER'`
   - Vem da API via endpoint `/api/v1/auth/me`

3. **Tema Escuro:**
   - Permanece como estava (não foi alterado nesta sessão)
   - `className="dark"` mantido no `<html>` tag

---

## 🚀 Como Iniciar os Servidores

```bash
# Terminal 1 - API (porta 3001)
cd apps/api
npm run dev

# Terminal 2 - Frontend (porta 3000)
cd apps/web
npm run dev
```

Acessar: `http://localhost:3000`

---

## 🔍 Troubleshooting

### Se aparecer erros 404 nas chamadas da API:

1. Verificar se API está rodando na porta 3001:
   ```bash
   lsof -i:3001
   ```

2. Verificar se `.env.local` está correto:
   ```bash
   cat apps/web/.env.local
   # Deve ter: NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
   ```

3. Limpar cache do Next.js e reiniciar:
   ```bash
   rm -rf apps/web/.next
   cd apps/web && npm run dev
   ```

4. Hard refresh no navegador: `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (Mac)

---

## 👤 Autor

Sessão de refinamentos realizada com Claude Code (Sonnet 4.5)
Data: 2026-01-01
