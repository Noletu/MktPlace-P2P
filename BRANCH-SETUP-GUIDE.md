# Guia de Setup - Branch feature/admin-2fa-and-funds-dashboard-phase5

## 📋 O que foi implementado nesta branch

Esta branch contém duas implementações principais:

### 1. Sistema 2FA para Administradores
- ✅ Página `/admin/security` para configuração de 2FA
- ✅ QR Code generation (Google Authenticator, Authy, Microsoft Authenticator)
- ✅ Backup codes (10 códigos de emergência)
- ✅ Gerenciamento completo (habilitar, desabilitar, regenerar)
- ✅ Integração com endpoints backend existentes

### 2. Admin Funds Dashboard (FASE 5/7)
- ✅ 3 novos endpoints backend:
  - `GET /api/v1/admin/funds/partners` - Fundos da plataforma
  - `GET /api/v1/admin/funds/users-funds` - Fundos dos usuários
  - `GET /api/v1/admin/funds/total` - Total consolidado
- ✅ 3 componentes frontend:
  - PartnersView.tsx (Platform Wallets - Account 0)
  - UsersView.tsx (User Wallets - Account >= 1)
  - TotalView.tsx (Visão consolidada)
- ✅ Bug crítico corrigido: `prisma.hDWallet` → `prisma.userWallet`

---

## 🚀 Como fazer o setup do projeto

### 1. Clone o repositório (se ainda não tiver)
```bash
git clone https://github.com/Noletu/MktPlace-P2P.git
cd MktPlace-P2P
```

### 2. Checkout desta branch
```bash
git checkout feature/admin-2fa-and-funds-dashboard-phase5
```

### 3. Instale as dependências

#### Backend (API)
```bash
cd apps/api
npm install
```

#### Frontend (Web)
```bash
cd apps/web
npm install
```

### 4. Configure o arquivo .env

Certifique-se de ter o arquivo `.env` no diretório `apps/api/` com as seguintes variáveis:

```env
# Database
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="your-secret-here"
JWT_EXPIRES_IN="7d"

# HD Wallet (Master Seed)
MASTER_SEED_ENCRYPTION_KEY="sua-encryption-key-aqui"
HD_WALLET_MNEMONIC_ENCRYPTED="seu-mnemonic-encrypted-aqui"

# Se ainda não tiver gerado a master seed, rode:
# npm run setup:hd-wallet
```

### 5. Execute as migrations do Prisma
```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
```

### 6. Rode o projeto

#### Terminal 1 - Backend (porta 3001)
```bash
cd apps/api
npm run dev
```

#### Terminal 2 - Frontend (porta 3000)
```bash
cd apps/web
npm run dev
```

---

## 🧪 Como testar as funcionalidades

### Testando 2FA

1. **Acesse o painel admin:**
   ```
   http://localhost:3000/admin
   ```

2. **Faça login com uma conta ADMIN ou MASTER**

3. **Acesse a página de segurança:**
   ```
   http://localhost:3000/admin/security
   ```

4. **Configure 2FA:**
   - Clique em "Ativar 2FA"
   - Escaneie o QR Code com Google Authenticator/Authy
   - Digite o código de 6 dígitos
   - **IMPORTANTE:** Salve os backup codes mostrados (única vez!)

5. **Teste o 2FA:**
   - Tente acessar `/admin/master-seed`
   - Sistema deve solicitar código 2FA

### Testando Admin Funds Dashboard

1. **Acesse o controle de fundos:**
   ```
   http://localhost:3000/admin/funds
   ```

2. **Teste cada aba:**

   **💼 Aba Sócios (Partners):**
   - Mostra platform wallets (Account 0)
   - Balance, fees, deposits, withdrawals
   - Breakdown por rede (Bitcoin, Ethereum, Base, etc)
   - Copy-to-clipboard para endereços

   **👥 Aba Usuários (Users):**
   - Mostra user wallets (Account >= 1)
   - Total de usuários, wallets, média
   - Cards expandíveis por usuário
   - Lista todas as wallets de cada usuário

   **🌍 Aba Total:**
   - 4 summary cards
   - Barras de progresso visuais
   - Comparação lado a lado (Partners vs Users)
   - Percentuais de distribuição

---

## 📁 Arquivos importantes modificados/criados

### Backend
```
apps/api/
├── src/
│   ├── services/
│   │   └── adminFunds.service.ts (MODIFICADO - 3 novos métodos)
│   ├── controllers/
│   │   └── adminFunds.controller.ts (MODIFICADO - 3 novos controllers)
│   └── routes/
│       └── adminFunds.routes.ts (MODIFICADO - 3 novas rotas)
```

### Frontend
```
apps/web/
├── app/
│   └── admin/
│       ├── security/
│       │   └── page.tsx (NOVO - 443 linhas)
│       ├── funds/
│       │   └── page.tsx (MODIFICADO - sistema de abas)
│       └── layout.tsx (MODIFICADO - link segurança)
└── components/
    └── admin/
        └── funds/
            ├── PartnersView.tsx (NOVO - 195 linhas)
            ├── UsersView.tsx (NOVO - 251 linhas)
            └── TotalView.tsx (NOVO - 267 linhas)
```

### Documentação
```
docs/
└── SESSION-2025-12-12-2FA-AND-ADMIN-FUNDS.md (NOVO - 982 linhas)
```

---

## 🔍 Endpoints da API

### 2FA (já existiam)
```
GET  /api/v1/2fa/status
POST /api/v1/2fa/generate
POST /api/v1/2fa/enable
POST /api/v1/2fa/disable
POST /api/v1/2fa/regenerate-backup-codes
```

### Admin Funds (novos nesta branch)
```
GET /api/v1/admin/funds/partners
GET /api/v1/admin/funds/users-funds
GET /api/v1/admin/funds/total
```

---

## 🛠️ Comandos úteis

### Git
```bash
# Ver status
git status

# Ver commits
git log --oneline -10

# Ver diff
git diff

# Criar nova branch a partir desta
git checkout -b feature/sua-nova-feature
```

### Banco de dados (Prisma)
```bash
# Ver dados no Prisma Studio
cd apps/api
npx prisma studio

# Resetar banco (CUIDADO!)
npx prisma migrate reset

# Criar nova migration
npx prisma migrate dev --name nome_da_migration
```

### Backend
```bash
# Rodar em modo dev
npm run dev

# Build
npm run build

# Rodar testes
npm test

# Ver logs
# Os logs aparecem no terminal onde você rodou npm run dev
```

### Frontend
```bash
# Rodar em modo dev
npm run dev

# Build
npm run build

# Rodar build de produção
npm start
```

---

## 🐛 Troubleshooting

### Problema: "erro ao carregar dados" nas abas de fundos

**Solução:** Verifique se o backend está rodando na porta 3001:
```bash
lsof -ti:3001
# Se não retornar nada, rode:
cd apps/api && npm run dev
```

### Problema: 2FA não aparece para admin

**Solução:** Certifique-se de que está logado com uma conta de role `ADMIN` ou `MASTER`:
```sql
-- No Prisma Studio, verifique o campo 'role' do seu usuário
-- Deve ser 'ADMIN' ou 'MASTER', não 'USER'
```

### Problema: QR Code não carrega

**Solução:** Verifique se a biblioteca `qrcode` está instalada:
```bash
cd apps/api
npm list qrcode
# Se não aparecer, instale:
npm install qrcode @types/qrcode
```

### Problema: Master seed não foi gerada

**Solução:** Execute o script de setup:
```bash
cd apps/api
npm run setup:hd-wallet

# Siga as instruções e GUARDE as 24 palavras em local seguro!
```

### Problema: Prisma client desatualizado

**Solução:** Regenere o Prisma client:
```bash
cd apps/api
npx prisma generate
```

---

## 📚 Documentação detalhada

Para uma documentação completa e detalhada de tudo que foi implementado, veja:

```
docs/SESSION-2025-12-12-2FA-AND-ADMIN-FUNDS.md
```

Este arquivo contém:
- Explicação técnica completa
- Código fonte comentado
- Problemas encontrados e soluções
- Conceitos de HD Wallet (BIP32/BIP44)
- Arquitetura do sistema
- Próximos passos sugeridos

---

## 🚧 Próximos passos sugeridos

### Curto prazo
1. ⚙️ Configurar 2FA para todos os admins MASTER
2. 🔐 Gerar master seed com 2FA ativado
3. 📊 Popular dados de teste nas wallets
4. 🧪 Testar todas as funcionalidades

### Médio prazo
4. 📁 Implementar abas restantes do Admin Funds:
   - Freeze Funds
   - Transfer Funds
   - Adjust Balance
   - Audit Log
   - Analytics

5. 🔍 Adicionar filtros e busca:
   - Filtrar por período
   - Buscar usuários específicos
   - Filtrar por crypto/rede

6. 📤 Export de dados:
   - CSV export
   - PDF reports
   - Excel sheets

### Longo prazo
7. 📈 Dashboard avançado com gráficos
8. 🔔 Sistema de alertas
9. 📊 Analytics e métricas
10. 🔄 Real-time updates via WebSocket

---

## 🔐 Segurança

### IMPORTANTE: Master Seed

A master seed é a chave mestra que deriva TODAS as carteiras do sistema. Se perdida ou comprometida, todo o sistema está em risco.

**NUNCA:**
- ❌ Commitar a master seed no git
- ❌ Compartilhar as 24 palavras por email/chat
- ❌ Guardar em arquivo texto não criptografado
- ❌ Fazer backup apenas digital

**SEMPRE:**
- ✅ Guardar as 24 palavras em papel em cofre físico
- ✅ Ter backup em local separado
- ✅ Usar 2FA para todas operações com master seed
- ✅ Limitar acesso apenas a roles MASTER

### 2FA Backup Codes

Os backup codes são exibidos apenas UMA VEZ após habilitar 2FA. Se perder o acesso ao app autenticador e não tiver os códigos, será necessário pedir ajuda ao time técnico para resetar 2FA.

---

## 📞 Contato

**Branch criada por:** Claude (Anthropic)
**Co-Author:** Nicode9 <nkoutroularis@protonmail.com>
**Data:** 12/12/2025
**Commits principais:**
- `a459dff` - feat: add 2FA for admins and fix admin funds dashboard
- `68788a3` - docs: add comprehensive session documentation

**GitHub:** https://github.com/Noletu/MktPlace-P2P
**Branch:** feature/admin-2fa-and-funds-dashboard-phase5

---

## ✅ Checklist antes de começar

- [ ] Git clone do repositório feito
- [ ] Checkout da branch `feature/admin-2fa-and-funds-dashboard-phase5`
- [ ] `npm install` rodado em `apps/api` e `apps/web`
- [ ] Arquivo `.env` configurado
- [ ] Prisma migrations executadas (`npx prisma migrate dev`)
- [ ] Backend rodando na porta 3001 (`cd apps/api && npm run dev`)
- [ ] Frontend rodando na porta 3000 (`cd apps/web && npm run dev`)
- [ ] Testado login no admin panel
- [ ] Testado 2FA funcionando
- [ ] Testado 3 abas do Admin Funds
- [ ] Lido a documentação completa em `docs/SESSION-2025-12-12-2FA-AND-ADMIN-FUNDS.md`

---

**Boa sorte com o desenvolvimento, Lucas! 🚀**

Se tiver qualquer dúvida, consulte a documentação completa ou entre em contato com o time.
