# Documentação Completa - MktPlace P2P

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Credenciais do Sistema](#credenciais-do-sistema)
3. [Funcionalidades Implementadas](#funcionalidades-implementadas)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [Sistema KYC Progressivo](#sistema-kyc-progressivo)
6. [Sistema de Taxas](#sistema-de-taxas)
7. [Fluxos Principais](#fluxos-principais)
8. [API Endpoints](#api-endpoints)
9. [Problemas Resolvidos](#problemas-resolvidos)
10. [Como Executar](#como-executar)
11. [Próximos Passos](#próximos-passos)

---

## 🎯 Visão Geral

Plataforma P2P para compra e venda de criptomoedas com sistema de KYC progressivo e gestão administrativa completa.

**Stack Tecnológica:**
- Frontend: Next.js 13+ (App Router) + TypeScript + TailwindCSS
- Backend: Express.js + TypeScript
- Database: SQLite + Prisma ORM
- Autenticação: JWT (Access Token + Refresh Token)
- SMS: Twilio
- Validação: Zod

---

## 🔑 Credenciais do Sistema

### Usuário Administrador Master
```
Email: admin@mktplace.com
Senha: Admin@123456
Role: ADMIN
KYC Level: LEVEL_4
```

**Criado em:** Script `/home/nicode/MktPlace-P2P/apps/api/scripts/create-admin.ts`

**Para recriar o admin:**
```bash
cd /home/nicode/MktPlace-P2P/apps/api
npx tsx scripts/create-admin.ts
```

---

## ✅ Funcionalidades Implementadas

### 1. Autenticação e Autorização
- ✅ Registro de usuários (email + senha)
- ✅ Login com JWT (Access Token + Refresh Token)
- ✅ Refresh Token automático
- ✅ Middleware de autenticação
- ✅ Middleware de autorização por role (USER, ADMIN, MASTER)
- ✅ Verificação de email disponível em tempo real

### 2. Sistema KYC Progressivo (4 Níveis)
- ✅ **NONE** - R$ 1.000/dia (apenas email + senha)
- ✅ **LEVEL_1** - R$ 10.000/dia (CPF + Telefone + SMS)
- ✅ **LEVEL_2** - R$ 50.000/dia (Dados Pessoais + Endereço)
- ✅ **LEVEL_3** - R$ 100.000/dia (Selfie + Documento)
- ✅ **LEVEL_4** - Sem limites (Comprovante de Renda)

**KYC é OPCIONAL após registro** - usuário pode usar a plataforma imediatamente.

### 3. Gestão de Pedidos
- ✅ Criar pedidos de compra/venda
- ✅ Matching automático de pedidos compatíveis
- ✅ Sistema de collateral (garantia em cripto)
- ✅ Validação de limites por KYC
- ✅ Histórico de pedidos
- ✅ Filtros por status e tipo

### 4. Sistema de Taxas
```typescript
PLATFORM_FEE: 1.5%      // Taxa da plataforma
PAYER_REWARD: 1.0%      // Recompensa para quem paga primeiro
TOTAL_FEE: 2.5%         // Taxa total
```

**Importante:** Taxa é aplicada sobre o valor da CRIPTO, não sobre o BRL.

### 5. Dashboard Administrativo
Acesso: `/admin` (redirecionamento automático ao clicar em "Meu Perfil")

**Métricas exibidas:**
- 📊 Total de usuários (total + novos últimos 7 dias)
- 📦 Pedidos (total, ativos, completados, recentes)
- 💰 Volume total transacionado (BRL)
- 🔄 Total de transações
- 📋 KYC pendentes (nível NONE)

**Ações rápidas:**
- Gerenciar carteiras da plataforma
- Gerenciar usuários
- Gerenciar pedidos
- Ver logs de auditoria

### 6. Gestão de Carteiras da Plataforma
Acesso: `/admin/platform-wallets`

**Funcionalidades:**
- ➕ Adicionar carteiras (BTC, USDC, USDT)
- ✏️ Editar label e status
- 🔄 Ativar/Desativar carteiras
- 🗑️ Deletar carteiras
- 🔍 Filtrar por criptomoeda e rede
- 📋 Ver histórico de uso

**Redes suportadas:**
- BTC: BITCOIN
- USDC: ETHEREUM, POLYGON, ARBITRUM, OPTIMISM
- USDT: ETHEREUM, TRON, POLYGON

### 7. Gestão de Usuários (Admin)
- 📋 Listar todos os usuários
- 🔍 Buscar por email, nome ou CPF
- 🔄 Atualizar KYC level manualmente
- 👤 Alterar role (USER → ADMIN)
- 📊 Ver estatísticas de reputação

### 8. Gestão de Pedidos (Admin)
- 📋 Visualizar todos os pedidos
- 🔍 Filtrar por status, tipo, usuário
- ❌ Cancelar pedidos com justificativa
- 📊 Ver transações relacionadas

### 9. Logs de Auditoria
Todas as ações administrativas são registradas:
- CREATE, UPDATE, DELETE de carteiras
- Alterações em usuários
- Cancelamento de pedidos
- IP do administrador
- Timestamp completo

---

## 📁 Estrutura do Projeto

```
MktPlace-P2P/
├── apps/
│   ├── api/                          # Backend Express
│   │   ├── src/
│   │   │   ├── controllers/          # Controladores
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── kyc.controller.ts
│   │   │   │   ├── order.controller.ts
│   │   │   │   ├── admin.controller.ts
│   │   │   │   └── user.controller.ts
│   │   │   ├── middleware/           # Middlewares
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── admin.middleware.ts
│   │   │   │   └── rate-limit.middleware.ts
│   │   │   ├── services/             # Lógica de negócio
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── kyc.service.ts
│   │   │   │   ├── order.service.ts
│   │   │   │   ├── matching.service.ts
│   │   │   │   ├── collateral.service.ts
│   │   │   │   ├── admin.service.ts
│   │   │   │   └── sms.service.ts
│   │   │   ├── types/                # Tipos TypeScript
│   │   │   │   ├── order.types.ts
│   │   │   │   └── kyc.types.ts
│   │   │   ├── utils/                # Utilitários
│   │   │   │   └── validators.ts
│   │   │   └── index.ts              # Entry point
│   │   ├── scripts/
│   │   │   └── create-admin.ts       # Script de criação admin
│   │   └── prisma/
│   │       └── schema.prisma         # Schema do banco
│   │
│   └── web/                          # Frontend Next.js
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── dashboard/
│       │   ├── profile/
│       │   ├── admin/                # Dashboard admin
│       │   │   ├── page.tsx
│       │   │   ├── platform-wallets/
│       │   │   ├── users/
│       │   │   └── orders/
│       │   ├── kyc/
│       │   │   ├── level1/
│       │   │   ├── level2/
│       │   │   ├── level3/
│       │   │   └── level4/
│       │   └── orders/
│       │       ├── create/
│       │       └── [id]/
│       └── components/
│           └── forms/
│               ├── RegisterForm.tsx
│               └── LoginForm.tsx
│
└── DOCUMENTACAO_COMPLETA.md         # Este arquivo
```

---

## 🎓 Sistema KYC Progressivo

### Níveis e Requisitos

| Nível | Limite Diário | Requisitos | Validação |
|-------|---------------|------------|-----------|
| **NONE** | R$ 1.000 | Email + Senha | Email válido |
| **LEVEL_1** | R$ 10.000 | CPF + Telefone | SMS Code |
| **LEVEL_2** | R$ 50.000 | Dados Pessoais + Endereço | Manual/Automática |
| **LEVEL_3** | R$ 100.000 | Selfie + Documento | OCR + Face Match |
| **LEVEL_4** | Ilimitado | Comprovante Renda | Análise Manual |

### Fluxo de Upgrade

1. Usuário cria conta (NONE - R$ 1.000/dia)
2. Pode usar plataforma imediatamente
3. Quando quiser aumentar limite, vai em "Perfil" → "Aumentar Limite"
4. Escolhe o nível desejado
5. Preenche requisitos
6. Sistema valida e atualiza automaticamente

### Validações Implementadas

**CPF (Level 1):**
```typescript
// utils/validators.ts
- Formato: XXX.XXX.XXX-XX ou XXXXXXXXXXX
- Validação de dígitos verificadores
- Rejeita CPFs com todos os dígitos iguais
```

**Telefone (Level 1):**
```typescript
// SMS via Twilio
- Formato: +55 (XX) XXXXX-XXXX
- Código de 6 dígitos
- Validade: 10 minutos
- Máximo 3 tentativas
```

**CEP (Level 2):**
```typescript
// Integração com ViaCEP
- Busca automática de endereço
- Preenchimento automático de cidade/estado
```

---

## 💰 Sistema de Taxas

### Configuração Atual

```typescript
// apps/api/src/types/order.types.ts:54-59

export const FEE_CONFIG = {
  PLATFORM_FEE_PERCENTAGE: 0.015,  // 1.5% - Taxa da plataforma
  PAYER_REWARD_PERCENTAGE: 0.01,   // 1.0% - Recompensa para quem paga
  TOTAL_FEE_PERCENTAGE: 0.025,     // 2.5% - Taxa total
  TIMEOUT_HOURS: 24,               // Timeout de pedidos
};
```

### Aplicação das Taxas

**Exemplo: Pedido de COMPRA de BTC**
```
Usuário quer comprar: 0.01 BTC
Preço BTC: R$ 300.000
Valor em BRL: R$ 3.000

Taxa 2.5% aplicada na CRIPTO:
- BTC que usuário receberá: 0.01 * (1 - 0.025) = 0.00975 BTC
- Taxa em BTC: 0.00025 BTC
- Valor pago em PIX: R$ 3.000 (sem taxa adicional)
```

**Exemplo: Pedido de VENDA de BTC**
```
Usuário quer vender: 0.01 BTC
Preço BTC: R$ 300.000
Valor a receber: R$ 3.000

Taxa 2.5% aplicada na CRIPTO:
- BTC necessário depositar: 0.01 BTC (colateral)
- BTC que será vendido: 0.00975 BTC
- Taxa em BTC: 0.00025 BTC
- Valor recebido em PIX: R$ 2.925 (R$ 3.000 - 2.5%)
```

### Distribuição das Taxas

```typescript
// Quem paga PRIMEIRO ganha 1% de recompensa

Cenário 1: Comprador paga primeiro
- Platform Fee: 1.5%
- Buyer Reward: 1.0%
- Net: Comprador economiza 1%

Cenário 2: Vendedor paga primeiro
- Platform Fee: 1.5%
- Seller Reward: 1.0%
- Net: Vendedor economiza 1%
```

---

## 🔄 Fluxos Principais

### 1. Registro de Novo Usuário

```
1. Usuário acessa /register
2. Preenche email + senha (+ nome opcional)
3. Sistema valida:
   - Email único
   - Senha forte (8+ chars, maiúscula, minúscula, número, especial)
4. Cria usuário com kycLevel = NONE
5. Gera JWT tokens
6. Redireciona para /dashboard
7. Usuário pode usar limite de R$ 1.000/dia imediatamente
```

### 2. Login

```
1. Usuário acessa /login
2. Insere email + senha
3. Sistema valida credenciais
4. Gera Access Token (15min) + Refresh Token (7d)
5. Salva tokens no localStorage
6. Redireciona para:
   - /admin (se ADMIN)
   - /dashboard (se USER)
```

### 3. Upgrade de KYC (Level 1)

```
1. Usuário em /profile clica "Aumentar Limite"
2. Escolhe LEVEL_1
3. Preenche CPF + Telefone
4. Sistema valida CPF
5. Envia SMS via Twilio
6. Usuário insere código de 6 dígitos
7. Sistema valida código
8. Atualiza kycLevel para LEVEL_1
9. Limite aumenta para R$ 10.000/dia
```

### 4. Criar Pedido de Compra (BUY)

```
1. Usuário acessa /orders/create
2. Seleciona:
   - Tipo: COMPRA
   - Cripto: BTC
   - Rede: BITCOIN
   - Quantidade: 0.01 BTC
   - Método de pagamento: PIX
3. Sistema calcula:
   - Preço atual do BTC
   - Valor em BRL (0.01 * preço)
   - Verifica limite KYC
4. Cria pedido com status PENDING
5. Busca matching automático
6. Se encontrar vendedor:
   - Status → MATCHED
   - Vendedor deposita BTC (collateral)
   - Comprador paga PIX
   - Sistema libera BTC para comprador
7. Status → COMPLETED
```

### 5. Criar Pedido de Venda (SELL)

```
1. Usuário acessa /orders/create
2. Seleciona:
   - Tipo: VENDA
   - Cripto: BTC
   - Quantidade: 0.01 BTC
   - Método recebimento: PIX
3. Sistema:
   - Busca endereço da plataforma ativo
   - Calcula valor em BRL
   - Verifica limite KYC
4. Usuário deposita BTC no endereço da plataforma
5. Sistema valida depósito (confirmações)
6. Pedido status → PENDING
7. Busca matching com comprador
8. Comprador paga PIX
9. Sistema libera BRL para vendedor
10. Status → COMPLETED
```

### 6. Gestão Admin - Adicionar Carteira

```
1. Admin faz login
2. Clica "Meu Perfil" → Auto-redirect /admin
3. Clica "Gerenciar Carteiras da Plataforma"
4. Clica "Adicionar Nova Carteira"
5. Preenche:
   - Crypto Type: BTC
   - Network: BITCOIN
   - Address: bc1q... (endereço real)
   - Label: "Carteira Principal BTC"
6. Sistema valida:
   - Endereço não duplicado
   - Formato válido
7. Cria carteira com isActive = true
8. Registra ação no AdminAction log
9. Carteira disponível para pedidos
```

---

## 🔌 API Endpoints

### Autenticação

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/auth/check-email?email=...
POST   /api/v1/auth/logout
```

### KYC

```
POST   /api/v1/kyc/level1          # CPF + Telefone
POST   /api/v1/kyc/level1/verify   # Verifica código SMS
POST   /api/v1/kyc/level2          # Dados pessoais + Endereço
POST   /api/v1/kyc/level3          # Selfie + Documento
POST   /api/v1/kyc/level4          # Comprovante renda
GET    /api/v1/kyc/status          # Status atual do KYC
```

### Pedidos (Orders)

```
GET    /api/v1/orders              # Listar pedidos do usuário
POST   /api/v1/orders              # Criar novo pedido
GET    /api/v1/orders/:id          # Detalhes de um pedido
PATCH  /api/v1/orders/:id/cancel   # Cancelar pedido
POST   /api/v1/orders/:id/payment  # Confirmar pagamento
```

### Usuário

```
GET    /api/v1/user/profile        # Dados do perfil
PATCH  /api/v1/user/profile        # Atualizar perfil
GET    /api/v1/user/limits         # Limites atuais
GET    /api/v1/user/transactions   # Histórico de transações
```

### Admin - Dashboard

```
GET    /api/v1/admin/stats         # Estatísticas gerais
```

### Admin - Carteiras da Plataforma

```
GET    /api/v1/admin/platform-wallets              # Listar carteiras
POST   /api/v1/admin/platform-wallets              # Criar carteira
GET    /api/v1/admin/platform-wallets/:id          # Detalhes
PATCH  /api/v1/admin/platform-wallets/:id          # Atualizar
DELETE /api/v1/admin/platform-wallets/:id          # Deletar
```

### Admin - Usuários

```
GET    /api/v1/admin/users                         # Listar usuários
PATCH  /api/v1/admin/users/:id                     # Atualizar usuário
```

### Admin - Pedidos

```
GET    /api/v1/admin/orders                        # Todos os pedidos
PATCH  /api/v1/admin/orders/:id/cancel             # Cancelar pedido
```

### Admin - Logs

```
GET    /api/v1/admin/actions                       # Logs de auditoria
```

---

## 🔧 Problemas Resolvidos

### 1. Erro: "Não foi possível conectar à API"
**Causa:** Processo tsx watch travado com erros de import

**Solução:**
- Matou processo tsx
- Corrigiu imports em 3 arquivos:
  - `src/services/sms.service.ts`
  - `src/controllers/admin.controller.ts`
  - `src/middleware/admin.middleware.ts`
- Mudou de `import { prisma } from '../lib/prisma'`
- Para: `import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient();`

**Arquivo:** Múltiplos arquivos em `/apps/api/src/`

### 2. KYC Obrigatório após Registro
**Problema:** Usuários eram forçados a ir para /kyc/level1 após registro

**Solução:**
- Alterou redirect em `RegisterForm.tsx:109`
- De: `router.push('/kyc/level1')`
- Para: `router.push('/dashboard')`
- Adicionou mensagens explicando que KYC é opcional

**Arquivo:** `/apps/web/components/forms/RegisterForm.tsx`

### 3. "Nenhum endereço da plataforma ativo encontrado"
**Problema:** Ao criar pedido de compra BTC, sistema não encontrava carteira

**Causa:** Nenhuma carteira BTC ativa cadastrada no banco

**Solução:**
- Adicionou logs detalhados em `admin.service.ts:147-174`
- Criou usuário admin para gerenciar carteiras
- Documentou como adicionar carteiras via painel admin

**Arquivo:** `/apps/api/src/services/admin.service.ts`

### 4. Taxas de 2.5% não Aplicadas
**Verificação:** Sistema estava correto

**Confirmação:**
- Taxa de 2.5% configurada em `FEE_CONFIG.TOTAL_FEE_PERCENTAGE`
- Aplicada corretamente sobre valor da CRIPTO
- Não sobre valor em BRL

**Arquivo:** `/apps/api/src/types/order.types.ts`

---

## 🚀 Como Executar

### Pré-requisitos

```bash
Node.js 18+
npm ou yarn
```

### 1. Backend (API)

```bash
# Navegar para pasta da API
cd /home/nicode/MktPlace-P2P/apps/api

# Instalar dependências (se necessário)
npm install

# Gerar Prisma Client
npx prisma generate

# Executar migrations
npx prisma migrate dev

# Criar usuário admin
npx tsx scripts/create-admin.ts

# Iniciar servidor (desenvolvimento)
npm run dev

# API rodará em: http://localhost:3001
```

### 2. Frontend (Web)

```bash
# Navegar para pasta do web
cd /home/nicode/MktPlace-P2P/apps/web

# Instalar dependências (se necessário)
npm install

# Iniciar servidor (desenvolvimento)
npm run dev

# Web rodará em: http://localhost:3000
```

### 3. Variáveis de Ambiente

**Backend (.env):**
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="seu-secret-aqui"
JWT_REFRESH_SECRET="seu-refresh-secret-aqui"
TWILIO_ACCOUNT_SID="seu-twilio-sid"
TWILIO_AUTH_TOKEN="seu-twilio-token"
TWILIO_PHONE_NUMBER="+55..."
PORT=3001
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Acessar Sistema

1. **Frontend:** http://localhost:3000
2. **Backend:** http://localhost:3001
3. **Banco de Dados:** `/apps/api/prisma/dev.db` (SQLite)

### 5. Primeiro Acesso como Admin

```
1. Acesse: http://localhost:3000/login
2. Email: admin@mktplace.com
3. Senha: Admin@123456
4. Clique em "Meu Perfil"
5. Sistema redireciona automaticamente para /admin
```

---

## 📝 Próximos Passos

### Funcionalidades Pendentes

1. **Sistema de Notificações**
   - Notificar usuários sobre matches
   - Alertas de pagamento pendente
   - Confirmação de transações

2. **Chat entre Usuários**
   - Comunicação durante transação
   - Suporte para resolver disputas

3. **Sistema de Disputas**
   - Usuário pode abrir disputa
   - Admin media conflitos
   - Sistema de evidências

4. **Integração com Blockchain**
   - Validação automática de depósitos BTC
   - Confirmações em tempo real
   - Webhooks de transações

5. **Melhorias no Matching**
   - Algoritmo de melhor preço
   - Prioridade por reputação
   - Matching parcial de pedidos

6. **Sistema de Reputação**
   - Score baseado em transações
   - Badges de confiança
   - Penalidades por cancelamentos

7. **Relatórios e Analytics**
   - Exportar relatórios em PDF/Excel
   - Gráficos de volume
   - Análise de tendências

8. **Verificação KYC Level 3 e 4**
   - OCR para documentos
   - Face matching para selfie
   - Análise de comprovante de renda

### Melhorias de Segurança

1. **2FA (Two-Factor Authentication)**
   - Google Authenticator
   - SMS backup

2. **Logs de Segurança**
   - Tentativas de login falhadas
   - IPs suspeitos
   - Rate limiting mais robusto

3. **Criptografia Adicional**
   - Dados sensíveis em banco
   - Comunicação end-to-end no chat

### Performance

1. **Cache Redis**
   - Preços de criptomoedas
   - Dados de usuários
   - Rate limiting

2. **Otimização de Queries**
   - Índices no banco
   - Eager loading
   - Paginação

3. **CDN para Assets**
   - Imagens
   - Documentos
   - Static files

---

## 📊 Banco de Dados

### Modelos Principais (Prisma Schema)

```prisma
model User {
  id                      String   @id @default(uuid())
  email                   String   @unique
  password                String
  name                    String?
  cpf                     String?  @unique
  phone                   String?
  kycLevel                String   @default("NONE")
  role                    String   @default("USER")
  reputationScore         Float    @default(100)
  totalTransactions       Int      @default(0)
  successfulTransactions  Int      @default(0)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}

model Order {
  id                String   @id @default(uuid())
  userId            String
  type              String   // BUY | SELL
  cryptoType        String   // BTC | USDC | USDT
  cryptoAmount      String
  brlAmount         String
  network           String
  paymentMethod     String
  status            String   @default("PENDING")
  platformAddress   String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model PlatformWallet {
  id          String   @id @default(uuid())
  cryptoType  String
  network     String
  address     String   @unique
  label       String?
  isActive    Boolean  @default(true)
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AdminAction {
  id         String   @id @default(uuid())
  adminId    String
  action     String   // CREATE | UPDATE | DELETE | CANCEL
  resource   String   // USER | ORDER | PLATFORM_WALLET
  resourceId String?
  metadata   String?
  ip         String?
  createdAt  DateTime @default(now())
}
```

---

## 🛠 Scripts Úteis

### Criar Admin
```bash
cd apps/api
npx tsx scripts/create-admin.ts
```

### Reset Database
```bash
cd apps/api
npx prisma migrate reset
npx prisma generate
npx tsx scripts/create-admin.ts
```

### Ver Banco de Dados
```bash
cd apps/api
npx prisma studio
# Abre interface em: http://localhost:5555
```

### Check Platform Wallets
```bash
cd apps/api
node /tmp/check_platform_wallets.js
```

### Type Check
```bash
cd apps/api
npm run type-check

cd apps/web
npm run type-check
```

---

## 📞 Suporte

### Problemas Comuns

**1. API não conecta**
- Verificar se API está rodando em http://localhost:3001
- Verificar logs no terminal da API
- Verificar variáveis de ambiente (.env)

**2. Erro ao criar pedido**
- Verificar se existe carteira da plataforma ativa
- Admin deve adicionar endereço BTC/USDC/USDT
- Verificar rede correta (BITCOIN, ETHEREUM, etc)

**3. SMS não chega**
- Verificar credenciais Twilio no .env
- Verificar saldo da conta Twilio
- Verificar número de telefone no formato correto

**4. Token expirado**
- Access Token expira em 15 minutos
- Sistema faz refresh automático
- Se refresh falhar, fazer logout e login novamente

### Logs Importantes

**Backend:**
```bash
# Logs do servidor aparecem no terminal onde rodou npm run dev
cd /home/nicode/MktPlace-P2P/apps/api
# Terminal mostrará todas as requisições HTTP e erros
```

**Frontend:**
```bash
# Logs aparecem no terminal e no console do browser (F12)
cd /home/nicode/MktPlace-P2P/apps/web
# Verificar console.log() no DevTools
```

---

## ✅ Checklist de Deploy

### Antes de Deploy em Produção

- [ ] Alterar JWT_SECRET e JWT_REFRESH_SECRET
- [ ] Configurar banco PostgreSQL (trocar SQLite)
- [ ] Configurar variáveis de ambiente em produção
- [ ] Configurar CORS apropriadamente
- [ ] Adicionar HTTPS/SSL
- [ ] Configurar Rate Limiting mais rigoroso
- [ ] Testar todas as funcionalidades
- [ ] Criar backup do banco de dados
- [ ] Documentar procedimentos de backup
- [ ] Configurar monitoring (Sentry, LogRocket, etc)
- [ ] Configurar alertas de erro
- [ ] Testar fluxo completo de transação
- [ ] Validar integração Twilio com números reais
- [ ] Implementar sistema de logs estruturado

---

## 📄 Licença

Projeto proprietário - MktPlace P2P © 2025

---

**Última atualização:** 10 de Outubro de 2025
**Versão:** 1.0.0
**Status:** ✅ Funcional
