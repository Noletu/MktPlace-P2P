# Guia de Setup - Branch feature/v5.1-security-frozen-audit

## O que foi implementado nesta branch

### 1. Bloqueio de Criação de Pedido para Contas Suspensas
- `FloatingActionButton` recebe prop `accountFrozen` — exibe alerta em vez de navegar
- Página `/orders/create` exibe `FrozenAccountBanner` em vez do formulário quando conta está suspensa
- Race condition corrigida: `loadingAccountStatus` impede que o formulário apareça antes da verificação
- Correção crítica: endpoint estava chamando `/users/me` (não existe) → corrigido para `/auth/me`

### 2. Fluxo de Apelação de Conta Suspensa
- `FrozenAccountBanner` redireciona para `/support/ticket/new?appeal=true`
- Página de novo ticket pré-preenchida com categoria e texto de recurso quando `?appeal=true`
- Todos os `appealUrl` do backend atualizados para o novo path
- Botão de ação na notificação do sino agora navega corretamente

### 3. Audit Log — Melhorias
- Campo `name` adicionado ao modelo `AuditLog` (schema + migration)
- `logFromRequest()` passa automaticamente o nome do usuário
- Filtro de ações dinâmico: busca ações distintas no banco em vez de lista hardcoded
- `CREATE_COUPON` e `DELETE_COUPON` corrigidos para usar `logFromRequest`

### 4. Workers — CollateralReleaseWorker
- Card do segundo worker adicionado na página `/admin/workers`
- Botões "Processar Agora" e "Verificar Órfãos" funcionais

### 5. Segurança — npm audit fix
- `handlebars` critical → 4.7.9
- `path-to-regexp` high → 0.1.13
- `flatted` high → 3.4.2
- `picomatch` high → 2.3.2 / 4.0.4
- `brace-expansion` → 1.1.13
- `nodemailer` → 8.0.4
- `next.js` moderate → 15.5.14

---

## Setup do projeto

### 1. Clone e checkout

```bash
git clone https://github.com/Noletu/MktPlace-P2P.git
cd MktPlace-P2P
git checkout feature/v5.1-security-frozen-audit
```

### 2. Instale as dependências (raiz — instala tudo via workspaces)

```bash
npm install
```

### 3. Configure o .env do backend

```bash
cp apps/api/.env.example apps/api/.env
```

Edite `apps/api/.env` e preencha obrigatoriamente:

```env
JWT_SECRET=<gerar com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
MASTER_SEED_ENCRYPTION_KEY=<chave de 32+ chars para criptografar a master seed>
```

O `apps/web/.env.example` já contém o valor correto para desenvolvimento local:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Copie-o:
```bash
cp apps/web/.env.example apps/web/.env.local
```

### 4. Banco de dados

O `apps/api/prisma/dev.db` já está no repositório com dados de teste prontos. Basta gerar o Prisma client:

```bash
cd apps/api
npx prisma generate
```

> Se preferir um banco limpo: `npx prisma migrate reset`

### 5. Rode o projeto

**Terminal 1 — Backend (porta 3001)**
```bash
cd apps/api
npm run dev
```

**Terminal 2 — Frontend (porta 3000)**
```bash
cd apps/web
npm run dev
```

**No Windows**, se o build de produção falhar com erro de React duplicado, use:
```bash
cd apps/web
NODE_OPTIONS="--require ./scripts/normalize-require.js" npx next build
```

---

## Usuários de teste (já no dev.db)

Use o Prisma Studio para ver os usuários cadastrados:

```bash
cd apps/api && npx prisma studio
# Abre http://localhost:5555 — tabela User
```

---

## Vulnerabilidades conhecidas (aceitas intencionalmente)

| Pacote | Severidade | Motivo para não corrigir |
|--------|-----------|--------------------------|
| `bigint-buffer` | HIGH | Fix exige downgrade de `@solana/spl-token` para v0.1.8 — quebra toda a integração Solana |
| `jest-environment-jsdom` | LOW x4 | Fix exige upgrade para v30 que pode quebrar configuração de testes |

---

## Checklist antes de começar

- [ ] `npm install` na raiz executado
- [ ] `apps/api/.env` configurado (JWT_SECRET + MASTER_SEED_ENCRYPTION_KEY)
- [ ] `apps/web/.env.local` com `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`
- [ ] `npx prisma generate` executado em `apps/api`
- [ ] Backend rodando na porta 3001
- [ ] Frontend rodando na porta 3000
- [ ] Login no painel admin funcionando
