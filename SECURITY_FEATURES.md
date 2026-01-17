# 🔒 Funcionalidades de Segurança - MktPlace P2P

**Data da Implementação**: 08/10/2025
**Última Atualização**: 17/01/2026
**Status**: ✅ Todas as funcionalidades implementadas e testadas

---

## 📋 Índice

1. [Rate Limiting](#1-rate-limiting)
2. [Logs de Auditoria](#2-logs-de-auditoria)
3. [Autenticação de Dois Fatores (2FA)](#3-autenticação-de-dois-fatores-2fa)
4. [Outras Medidas de Segurança](#4-outras-medidas-de-segurança)
5. [Como Testar](#5-como-testar)
6. [Endpoints de Segurança](#6-endpoints-de-segurança)

---

## 1. Rate Limiting

### 🎯 Objetivo
Proteger a API contra ataques de força bruta, spam e uso excessivo de recursos.

### 🛡️ Implementações

#### 1.1. Rate Limiters Configurados

| Limitador | Janela de Tempo | Máximo | Aplicado em |
|-----------|----------------|--------|-------------|
| **authLimiter** | 15 minutos | 5 tentativas | Login |
| **registerLimiter** | 1 hora | 3 contas (prod) / 100 (dev) | Registro |
| **apiLimiter** | 15 minutos | 100 requests (prod) / 1000 (dev) | API global |
| **orderCreationLimiter** | 1 hora | 10 pedidos | Criação de pedidos |
| **proofUploadLimiter** | 5 minutos | 10 uploads | Upload de comprovantes |
| **kycSubmissionLimiter** | 1 hora | 3 tentativas | Submissão de KYC |
| **disputeLimiter** | 24 horas | 5 disputas | Criação de disputas |
| **adminActionLimiter** | 1 minuto | 30 ações | Ações administrativas |
| **twoFactorLimiter** | 15 minutos | 5 tentativas | Verificação 2FA |

#### 1.2. Recursos Avançados

- ✅ **Handler customizado**: Mensagens informativas com tempo de retry
- ✅ **Headers informativos**: `RateLimit-*` headers
- ✅ **Skip de sucessos**: Login bem-sucedido não conta no limite (previne bloqueio de usuários legítimos)
- ✅ **Validação de IP**: Proteção contra falsificação de IP via proxy
- ✅ **Mensagens personalizadas**: Diferentes mensagens para cada tipo de limite

#### 1.3. Arquivos Modificados

- `/apps/api/src/middleware/rateLimiter.middleware.ts`
- `/apps/api/src/routes/auth.routes.ts`
- `/apps/api/src/routes/order.routes.ts`
- `/apps/api/src/routes/kyc.routes.ts`
- `/apps/api/src/routes/transaction.routes.ts`
- `/apps/api/src/routes/admin.routes.ts`
- `/apps/api/src/routes/twoFactor.routes.ts`

---

## 2. Logs de Auditoria

### 🎯 Objetivo
Rastreabilidade completa de todas as ações críticas do sistema para monitoramento, investigação e conformidade.

### 🛡️ Implementações

#### 2.1. Model AuditLog

**Schema Prisma** (`/apps/api/prisma/schema.prisma`):

```prisma
model AuditLog {
  id           String   @id @default(cuid())

  // Quem fez a ação
  userId       String?
  email        String?
  role         String?

  // Ação executada
  action       String
  resource     String
  resourceId   String?
  description  String?

  // Detalhes
  metadata     String?

  // Contexto
  ipAddress    String?
  userAgent    String?
  success      Boolean  @default(true)
  errorMessage String?

  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([action])
  @@index([resource])
  @@index([createdAt])
  @@index([success])
  @@index([ipAddress])
}
```

#### 2.2. Eventos Auditados

**Autenticação**:
- `LOGIN` - Login bem-sucedido
- `LOGOUT` - Logout
- `LOGIN_FAILED` - Tentativa de login falhada
- `REGISTER` - Registro de novo usuário
- `REFRESH_TOKEN` - Renovação de token
- `2FA_ENABLED` - Habilitação de 2FA
- `2FA_DISABLED` - Desabilitação de 2FA

**Pedidos**:
- `ORDER_CREATE` - Criação de pedido
- `ORDER_MATCH` - Match de pedido
- `ORDER_CANCEL` - Cancelamento de pedido
- `ORDER_COMPLETE` - Conclusão de pedido

**Transações**:
- `TRANSACTION_SUBMIT_PROOF` - Envio de comprovante
- `TRANSACTION_VALIDATE` - Validação de comprovante
- `TRANSACTION_DISPUTE` - Criação de disputa

**Carteiras**:
- `WALLET_CREATE` - Criação de carteira
- `WALLET_DEPOSIT` - Depósito
- `WALLET_WITHDRAWAL` - Saque
- `WALLET_DELETE` - Exclusão de carteira

**KYC**:
- `KYC_SUBMIT` - Submissão de KYC
- `KYC_APPROVE` - Aprovação de KYC
- `KYC_REJECT` - Rejeição de KYC

**Admin**:
- `ADMIN_ACTION` - Ações administrativas genéricas

#### 2.3. Service de Auditoria

**Arquivo**: `/apps/api/src/services/auditLog.service.ts`

**Métodos principais**:

```typescript
// Criar log genérico
auditLogService.log({
  userId: 'user_id',
  email: 'user@example.com',
  role: 'USER',
  action: 'LOGIN',
  resource: 'AUTH',
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0...',
  success: true,
});

// Helper para criar log a partir de Request
auditLogService.logFromRequest(
  req,
  'ORDER_CREATE',
  'ORDER',
  'order_id',
  { amount: 10000 }
);

// Buscar logs com filtros
const result = await auditLogService.getLogs({
  userId: 'user_id',
  action: 'LOGIN',
  startDate: new Date('2025-10-01'),
  limit: 50,
});

// Estatísticas de auditoria
const stats = await auditLogService.getStats({
  startDate: new Date('2025-10-01'),
  endDate: new Date('2025-10-31'),
});
```

#### 2.4. Endpoints Admin

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/v1/admin/audit-logs` | GET | Buscar logs com filtros |
| `/api/v1/admin/audit-logs/stats` | GET | Estatísticas de auditoria |
| `/api/v1/admin/audit-logs/export` | GET | Exportar logs em CSV |

**Query params para `/audit-logs`**:
- `userId` - Filtrar por usuário
- `action` - Filtrar por ação
- `resource` - Filtrar por recurso
- `ipAddress` - Filtrar por IP
- `startDate` - Data inicial (ISO 8601)
- `endDate` - Data final (ISO 8601)
- `success` - Filtrar por sucesso (true/false)
- `limit` - Limite de resultados (padrão: 50)
- `offset` - Offset para paginação (padrão: 0)

**Exemplo de resposta**:

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log_123",
        "userId": "user_456",
        "email": "user@example.com",
        "role": "USER",
        "action": "LOGIN",
        "resource": "AUTH",
        "ipAddress": "127.0.0.1",
        "userAgent": "Mozilla/5.0...",
        "success": true,
        "createdAt": "2025-10-08T12:00:00Z"
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

#### 2.5. Retenção de Logs

- **Método**: `auditLogService.cleanupOldLogs(daysToKeep: number)`
- **Padrão**: 90 dias
- **Recomendação**: Executar periodicamente via cron job

---

## 3. Autenticação de Dois Fatores (2FA)

### 🎯 Objetivo
Adicionar camada extra de segurança às contas de usuários usando códigos TOTP (Time-based One-Time Password).

### 🛡️ Implementações

#### 3.1. Tecnologias

- **Speakeasy**: Geração e validação de códigos TOTP
- **QRCode**: Geração de QR Code para apps autenticadores
- **Apps compatíveis**: Google Authenticator, Authy, Microsoft Authenticator, etc.

#### 3.2. Fluxo de Habilitação

1. **Usuário solicita ativação**:
   ```bash
   POST /api/v1/2fa/generate
   ```

   **Resposta**:
   ```json
   {
     "success": true,
     "data": {
       "secret": "BASE32_SECRET",
       "qrCode": "data:image/png;base64,..."
     }
   }
   ```

2. **Usuário escaneia QR Code** no app autenticador (Google Authenticator, etc.)

3. **Usuário confirma com código**:
   ```bash
   POST /api/v1/2fa/enable
   {
     "token": "123456"
   }
   ```

4. **2FA ativado** ✅

#### 3.3. Fluxo de Login com 2FA

1. **Login normal** (email + senha):
   ```bash
   POST /api/v1/auth/login
   {
     "email": "user@example.com",
     "password": "senha123"
   }
   ```

2. **Se 2FA habilitado**, retorna erro:
   ```json
   {
     "success": false,
     "error": "2FA_REQUIRED"
   }
   ```

3. **Reenviar com código 2FA**:
   ```bash
   POST /api/v1/auth/login
   {
     "email": "user@example.com",
     "password": "senha123",
     "twoFactorToken": "123456"
   }
   ```

4. **Login bem-sucedido** ✅

#### 3.4. Endpoints Disponíveis

| Endpoint | Método | Descrição | Rate Limit |
|----------|--------|-----------|------------|
| `/api/v1/2fa/status` | GET | Verificar se 2FA está ativo | - |
| `/api/v1/2fa/generate` | POST | Gerar secret e QR Code | - |
| `/api/v1/2fa/enable` | POST | Ativar 2FA | 5/15min |
| `/api/v1/2fa/disable` | POST | Desativar 2FA | 5/15min |

#### 3.5. Segurança do 2FA

- ✅ **Rate limiting**: Máximo 5 tentativas a cada 15 minutos (previne brute force)
- ✅ **Skip de sucessos**: Tentativas corretas não contam no limite
- ✅ **Auditoria**: Habilitação e desabilitação são auditadas
- ✅ **Validação no login**: Código é validado antes de emitir tokens
- ✅ **Window**: Aceita códigos com 30s de tolerância (±1 window)

#### 3.6. Códigos de Backup

**Status**: Gerador implementado, armazenamento pendente

**Método disponível**:
```typescript
const backupCodes = twoFactorService.generateBackupCodes(10);
// Retorna: ['ABC123DEF', 'GHI456JKL', ...]
```

**TODO**: Adicionar campo `backupCodes` no model `User` para armazenamento.

---

## 4. Outras Medidas de Segurança

### 4.1. Bloqueio de Usuários Congelados (v4.1.2/v4.1.3)

**Implementado em**: 17/01/2026

#### Objetivo
Impedir que usuários com conta congelada (bloqueados pelo admin) realizem operações críticas na plataforma.

#### Validações em 3 Camadas (Defense in Depth)

| Camada | Arquivo | Descrição |
|--------|---------|-----------|
| **1. Service** | `order.service.ts` | Verificação em `validateOrderCreation()` e `matchOrder()` |
| **2. Controller** | `order.controller.ts` | Verificação rápida via `req.user.accountFrozen` |
| **3. Frontend** | `orders/create/page.tsx` | Banner vermelho + botão desabilitado |

#### Campos do Sistema de Bloqueio

```prisma
model User {
  accountFrozen   Boolean   @default(false)  // Conta está bloqueada?
  frozenReason    String?                     // Motivo do bloqueio
  frozenUntil     DateTime?                   // Data de expiração (null = permanente)
  frozenBy        String?                     // ID do admin que bloqueou
}
```

#### Operações Bloqueadas

- **Criar pedidos** (v4.1.2)
- **Aceitar pedidos no marketplace** (v4.1.3)

#### Desbloqueio Automático

Quando `frozenUntil` expira, o sistema desbloqueia automaticamente a conta:

```typescript
if (user?.accountFrozen) {
  if (user.frozenUntil && new Date(user.frozenUntil) < new Date()) {
    // Bloqueio expirou - desbloquear automaticamente
    await prisma.user.update({
      where: { id: userId },
      data: {
        accountFrozen: false,
        frozenReason: null,
        frozenUntil: null,
        frozenBy: null,
      },
    });
  }
}
```

#### Mensagens de Erro

- **Bloqueio temporário**: "Sua conta está suspensa até {data}. Motivo: {motivo}."
- **Bloqueio permanente**: "Sua conta está suspensa permanentemente. Motivo: {motivo}. Entre em contato com o suporte."

### 4.2. Headers de Segurança (Helmet)

**Configurado em**: `/apps/api/src/index.ts`

- ✅ **HSTS**: Force HTTPS por 1 ano
- ✅ **Content Security Policy**: Previne XSS
- ✅ **Frame Guard**: Previne clickjacking
- ✅ **No Sniff**: Previne MIME sniffing
- ✅ **Hide Powered By**: Oculta tecnologia do servidor

### 4.3. CORS Whitelist

**Configurado em**: `/apps/api/src/index.ts`

- ✅ **Whitelist de origens**: Apenas origens autorizadas
- ✅ **Credentials**: Suporte a cookies HttpOnly
- ✅ **Methods**: Apenas métodos necessários (GET, POST, PUT, DELETE, PATCH)
- ✅ **Headers**: Headers permitidos definidos explicitamente

### 4.4. Cookies HttpOnly

**Configurado em**: `/apps/api/src/utils/cookies.ts`

- ✅ **Access Token**: HttpOnly + Secure (produção) + SameSite
- ✅ **Refresh Token**: HttpOnly + Secure (produção) + SameSite
- ✅ **Proteção XSS**: Cookies não acessíveis via JavaScript

### 4.5. Validação de Inputs

- ✅ **Zod schemas**: Validação tipada de todos os inputs
- ✅ **Sanitização**: Prevenção de SQL Injection e XSS
- ✅ **Limite de payload**: Máximo 10MB para uploads

### 4.6. Senhas

- ✅ **Bcrypt**: Hash com salt de 10 rounds
- ✅ **Validação forte**: Mínimo 8 caracteres, maiúscula, minúscula, número

---

## 5. Como Testar

### 5.1. Testar Rate Limiting

```bash
# Testar limite de login (5 tentativas em 15min)
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"wrong@email.com","password":"wrong"}' \
    -v
done

# Após 5 tentativas, deve retornar 429 Too Many Requests
```

### 5.2. Testar Logs de Auditoria

```bash
# Login como ADMIN/MASTER
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"master@mktplace.com","password":"Master@2025!"}'

# Buscar logs (precisa do token de admin)
curl -X GET "http://localhost:3001/api/v1/admin/audit-logs?limit=10" \
  -H "Cookie: accessToken=SEU_TOKEN" \
  -v

# Exportar logs em CSV
curl -X GET "http://localhost:3001/api/v1/admin/audit-logs/export" \
  -H "Cookie: accessToken=SEU_TOKEN" \
  -o audit-logs.csv
```

### 5.3. Testar 2FA

```bash
# 1. Login como usuário normal
LOGIN_RESPONSE=$(curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"senha123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')

# 2. Gerar secret e QR Code
curl -X POST http://localhost:3001/api/v1/2fa/generate \
  -H "Cookie: accessToken=$TOKEN" \
  -v

# 3. Escanear QR Code retornado (qrCode em base64)
#    com Google Authenticator

# 4. Habilitar 2FA com código do app
curl -X POST http://localhost:3001/api/v1/2fa/enable \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=$TOKEN" \
  -d '{"token":"123456"}'

# 5. Fazer logout
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Cookie: accessToken=$TOKEN"

# 6. Tentar login SEM código 2FA (deve falhar)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"senha123"}'
# Retorna: {"error":"2FA_REQUIRED"}

# 7. Login COM código 2FA (deve funcionar)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"senha123","twoFactorToken":"654321"}'
```

---

## 6. Endpoints de Segurança

### 6.1. Autenticação

| Endpoint | Rate Limit | Descrição |
|----------|------------|-----------|
| `POST /api/v1/auth/register` | 3/hora | Registro de usuário |
| `POST /api/v1/auth/login` | 5/15min | Login (suporta 2FA) |
| `POST /api/v1/auth/logout` | - | Logout |
| `POST /api/v1/auth/refresh` | - | Renovar access token |
| `GET /api/v1/auth/me` | - | Dados do usuário |

### 6.2. 2FA

| Endpoint | Rate Limit | Descrição |
|----------|------------|-----------|
| `GET /api/v1/2fa/status` | - | Status do 2FA |
| `POST /api/v1/2fa/generate` | - | Gerar QR Code |
| `POST /api/v1/2fa/enable` | 5/15min | Habilitar 2FA |
| `POST /api/v1/2fa/disable` | 5/15min | Desabilitar 2FA |

### 6.3. Auditoria (Admin)

| Endpoint | Rate Limit | Descrição |
|----------|------------|-----------|
| `GET /api/v1/admin/audit-logs` | - | Buscar logs |
| `GET /api/v1/admin/audit-logs/stats` | - | Estatísticas |
| `GET /api/v1/admin/audit-logs/export` | - | Exportar CSV |

---

## 📊 Estatísticas de Implementação

### Arquivos Criados
- Nenhum (todos os arquivos já existiam)

### Arquivos Modificados
- `/apps/api/src/middleware/rateLimiter.middleware.ts` - Rate limiters melhorados
- `/apps/api/src/services/auditLog.service.ts` - Métodos avançados de busca e stats
- `/apps/api/src/controllers/admin.controller.ts` - Endpoints de auditoria
- `/apps/api/src/routes/admin.routes.ts` - Rotas de auditoria
- `/apps/api/src/controllers/twoFactor.controller.ts` - Auditoria de 2FA
- `/apps/api/src/routes/twoFactor.routes.ts` - Rate limiting de 2FA
- `/apps/api/src/routes/kyc.routes.ts` - Rate limiting de KYC
- `/apps/api/src/routes/transaction.routes.ts` - Rate limiting de disputas
- `/apps/api/prisma/schema.prisma` - Model AuditLog melhorado

### Schema Changes
- ✅ `AuditLog` model atualizado com campos `email`, `role`, `description`

### Bibliotecas Instaladas
- ✅ `express-rate-limit` (já estava instalado)
- ✅ `speakeasy` (já estava instalado)
- ✅ `qrcode` (já estava instalado)

---

## ⚠️ Avisos de Segurança

### Produção

Antes de colocar em produção:

1. ✅ **Alterar senhas padrão** (master@mktplace.com, admin@mktplace.com)
2. ✅ **Configurar HTTPS** (SSL/TLS)
3. ✅ **Definir ALLOWED_ORIGINS** no `.env`
4. ✅ **Configurar COOKIE_SECRET** no `.env`
5. ✅ **Habilitar rate limiting** em produção (já configurado)
6. ✅ **Monitorar logs de auditoria** regularmente
7. ✅ **Configurar limpeza automática de logs** (cron job)
8. ✅ **Backup do banco de dados** (incluindo AuditLog)

### Monitoramento

Configurar alertas para:
- ✅ Múltiplas tentativas de login falhadas (possível brute force)
- ✅ Muitas requisições de um mesmo IP (possível DDoS)
- ✅ Criação de múltiplas contas de um mesmo IP (possível spam)
- ✅ Desabilitação de 2FA (possível conta comprometida)
- ✅ Ações administrativas fora do horário (possível comprometimento)

---

## 🎯 Próximos Passos Recomendados

1. **Backup Codes para 2FA**
   - Adicionar campo no model User
   - Implementar geração e validação
   - Interface web para visualizar códigos

2. **Notificações de Segurança**
   - Email ao habilitar/desabilitar 2FA
   - Email ao detectar login de novo IP
   - Email ao alterar senha

3. **IP Whitelist/Blacklist**
   - Bloquear IPs maliciosos automaticamente
   - Whitelist para IPs confiáveis

4. **Session Management**
   - Listar sessões ativas
   - Revogar sessões remotamente
   - Limite de sessões simultâneas

5. **Webhook de Segurança**
   - Integração com Slack/Discord
   - Alertas em tempo real
   - Dashboard de segurança

---

**Documentação completa! Sistema de segurança robusto implementado.** 🔒✅
