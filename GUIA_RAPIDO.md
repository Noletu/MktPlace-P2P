# 🚀 Guia Rápido - MktPlace P2P

## ⚡ Start Rápido

### 1. Iniciar Servidores

```bash
# Terminal 1 - Backend
cd /home/nicode/MktPlace-P2P/apps/api
npm run dev
# Aguardar: ✅ Server started on port 3001

# Terminal 2 - Frontend
cd /home/nicode/MktPlace-P2P/apps/web
npm run dev
# Aguardar: ✅ Ready on http://localhost:3000
```

### 2. Login Admin

```
URL: http://localhost:3000/login
Email: admin@mktplace.com
Senha: Admin@123456
```

### 3. Adicionar Primeira Carteira da Plataforma

1. Após login, clique "Meu Perfil" (auto-redirect para `/admin`)
2. Clique "Gerenciar Carteiras da Plataforma"
3. Clique "Adicionar Nova Carteira"
4. Preencha:
   - **Crypto Type:** BTC
   - **Network:** BITCOIN
   - **Address:** `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh` (exemplo)
   - **Label:** Carteira Principal BTC
5. Salvar

Agora usuários podem criar pedidos de compra BTC!

---

## 🔑 Credenciais

### Admin Master
```
Email: admin@mktplace.com
Senha: Admin@123456
Role: ADMIN
KYC: LEVEL_4
```

### Recriar Admin
```bash
cd /home/nicode/MktPlace-P2P/apps/api
npx tsx scripts/create-admin.ts
```

---

## 📊 Níveis KYC

| Nível | Limite/dia | Requisitos |
|-------|------------|------------|
| NONE | R$ 1.000 | Email + Senha |
| LEVEL_1 | R$ 10.000 | CPF + Telefone + SMS |
| LEVEL_2 | R$ 50.000 | Dados Pessoais + Endereço |
| LEVEL_3 | R$ 100.000 | Selfie + Documento |
| LEVEL_4 | Ilimitado | Comprovante de Renda |

**KYC é OPCIONAL** - usuários começam com NONE e podem usar imediatamente.

---

## 💰 Taxas

```
Taxa Total: 2.5%
├─ Plataforma: 1.5%
└─ Recompensa (quem paga primeiro): 1.0%

IMPORTANTE: Taxa aplicada sobre CRIPTO, não BRL
```

**Exemplo:**
- Compra de 0.01 BTC por R$ 3.000
- Usuário recebe: 0.00975 BTC (0.01 - 2.5%)
- Paga em PIX: R$ 3.000 (sem taxa adicional no BRL)

---

## 🎯 Funcionalidades Principais

### ✅ Implementado
- [x] Autenticação JWT (Access + Refresh Token)
- [x] Registro simplificado (email + senha)
- [x] Sistema KYC progressivo (4 níveis)
- [x] Dashboard administrativo completo
- [x] Gestão de carteiras da plataforma
- [x] Gestão de usuários (admin)
- [x] Gestão de pedidos (admin)
- [x] Criar pedidos de compra/venda
- [x] Matching automático
- [x] Sistema de collateral
- [x] Logs de auditoria
- [x] Validação CPF
- [x] Verificação SMS (Twilio)
- [x] Busca CEP (ViaCEP)

### 🚧 Pendente
- [ ] Notificações em tempo real
- [ ] Chat entre usuários
- [ ] Sistema de disputas
- [ ] Validação blockchain automática
- [ ] OCR para documentos (Level 3/4)
- [ ] Face matching (Level 3)
- [ ] 2FA

---

## 📁 Estrutura Resumida

```
MktPlace-P2P/
├── apps/
│   ├── api/                    # Backend Express + Prisma
│   │   ├── src/
│   │   │   ├── controllers/    # Auth, KYC, Order, Admin
│   │   │   ├── services/       # Lógica de negócio
│   │   │   ├── middleware/     # Auth, Admin, Rate Limit
│   │   │   └── types/          # TypeScript types
│   │   ├── scripts/
│   │   │   └── create-admin.ts # Criar admin
│   │   └── prisma/
│   │       └── schema.prisma   # Database schema
│   │
│   └── web/                    # Frontend Next.js
│       ├── app/
│       │   ├── (auth)/         # Login, Register
│       │   ├── dashboard/      # Dashboard usuário
│       │   ├── admin/          # Dashboard admin
│       │   ├── kyc/            # Fluxos KYC
│       │   └── orders/         # Criar pedidos
│       └── components/
│
├── DOCUMENTACAO_COMPLETA.md   # Documentação detalhada
└── GUIA_RAPIDO.md             # Este arquivo
```

---

## 🔌 Endpoints Principais

### Autenticação
```
POST /api/v1/auth/register     # Criar conta
POST /api/v1/auth/login        # Login
POST /api/v1/auth/refresh      # Refresh token
GET  /api/v1/auth/check-email  # Verificar email disponível
```

### KYC
```
POST /api/v1/kyc/level1        # CPF + Tel
POST /api/v1/kyc/level1/verify # Verificar SMS
POST /api/v1/kyc/level2        # Dados pessoais
POST /api/v1/kyc/level3        # Selfie + Doc
POST /api/v1/kyc/level4        # Comprovante renda
GET  /api/v1/kyc/status        # Status KYC
```

### Pedidos
```
GET    /api/v1/orders          # Meus pedidos
POST   /api/v1/orders          # Criar pedido
GET    /api/v1/orders/:id      # Detalhes
PATCH  /api/v1/orders/:id/cancel
```

### Admin
```
GET    /api/v1/admin/stats                     # Dashboard
GET    /api/v1/admin/platform-wallets          # Listar carteiras
POST   /api/v1/admin/platform-wallets          # Criar carteira
PATCH  /api/v1/admin/platform-wallets/:id      # Atualizar
DELETE /api/v1/admin/platform-wallets/:id      # Deletar
GET    /api/v1/admin/users                     # Listar usuários
GET    /api/v1/admin/orders                    # Todos pedidos
GET    /api/v1/admin/actions                   # Logs
```

---

## 🔧 Problemas Resolvidos

### ✅ API não conecta
**Solução:** Corrigidos imports do Prisma em 3 arquivos
- `src/services/sms.service.ts`
- `src/controllers/admin.controller.ts`
- `src/middleware/admin.middleware.ts`

### ✅ KYC obrigatório após registro
**Solução:** Alterado redirect para `/dashboard` em `RegisterForm.tsx:109`

### ✅ "Nenhum endereço da plataforma encontrado"
**Solução:** Admin deve adicionar carteira via painel `/admin/platform-wallets`

### ✅ Taxas de 2.5%
**Confirmado:** Taxa aplicada corretamente sobre CRIPTO, não BRL

---

## 🛠 Comandos Úteis

```bash
# Gerar Prisma Client
cd apps/api
npx prisma generate

# Ver banco de dados (UI)
npx prisma studio

# Criar admin
npx tsx scripts/create-admin.ts

# Type check
npm run type-check

# Reset database
npx prisma migrate reset
```

---

## 🚨 Troubleshooting

### Problema: tsx travado
```bash
# Matar processos tsx
pkill -f tsx

# Reiniciar API
cd /home/nicode/MktPlace-P2P/apps/api
npm run dev
```

### Problema: Módulo não encontrado
```bash
# Reinstalar dependências
cd apps/api
rm -rf node_modules
npm install
npx prisma generate
```

### Problema: Token expirado
- Fazer logout
- Fazer login novamente
- Sistema gera novos tokens

### Problema: SMS não chega
- Verificar credenciais Twilio no `.env`
- Verificar saldo Twilio
- Verificar formato telefone: `+55 (XX) XXXXX-XXXX`

---

## 📍 URLs Importantes

```
Frontend:  http://localhost:3000
Backend:   http://localhost:3001
Admin:     http://localhost:3000/admin
Prisma UI: http://localhost:5555 (npx prisma studio)
```

---

## 🎯 Fluxo Usuário Normal

```
1. Registro em /register
   ↓
2. Acesso imediato ao /dashboard
   ↓ (OPCIONAL)
3. Aumentar limite em /profile → Upgrade KYC
   ↓
4. Criar pedido em /orders/create
   ↓
5. Sistema faz matching automático
   ↓
6. Transação completada
```

---

## 👨‍💼 Fluxo Admin

```
1. Login com admin@mktplace.com
   ↓
2. Clicar "Meu Perfil" → Auto-redirect /admin
   ↓
3. Ver dashboard com métricas
   ↓
4. Gerenciar:
   - Carteiras da plataforma
   - Usuários
   - Pedidos
   - Logs de auditoria
```

---

## 🔐 Variáveis de Ambiente

### Backend (.env)
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="sua-chave-secreta-aqui"
JWT_REFRESH_SECRET="sua-chave-refresh-aqui"
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="token-aqui"
TWILIO_PHONE_NUMBER="+5511..."
PORT=3001
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 📦 Redes Suportadas

### Bitcoin (BTC)
- BITCOIN

### USDC
- ETHEREUM
- POLYGON
- ARBITRUM
- OPTIMISM

### USDT
- ETHEREUM
- TRON
- POLYGON

---

## ✅ Checklist Diário

- [ ] Backend rodando em :3001
- [ ] Frontend rodando em :3000
- [ ] Pelo menos 1 carteira BTC ativa
- [ ] Pelo menos 1 carteira USDC ativa
- [ ] Logs de erro verificados
- [ ] Backups do banco criados

---

## 📞 Para Mais Informações

Consulte: `DOCUMENTACAO_COMPLETA.md` para detalhes técnicos aprofundados.

---

**Última atualização:** 10/10/2025
**Status:** ✅ Sistema Operacional
