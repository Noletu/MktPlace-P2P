# Endpoints de Auditoria de Saldo Admin

**Data**: 25/10/2025
**Versão**: 0.3.7
**Componente**: Camada 3 - Diagnóstico Manual Admin

---

## 📋 Visão Geral

Endpoints protegidos (apenas admins) para:
- ✅ Diagnosticar inconsistências de saldo
- ✅ Corrigir saldos forçadamente
- ✅ Validar todos os saldos do sistema
- ✅ Identificar pedidos órfãos

---

## 🔐 Autenticação

**Todas as rotas requerem**:
1. Token JWT válido (header `Authorization: Bearer <token>`)
2. Role `ADMIN` no banco de dados

**Como obter token admin**:
```bash
POST http://localhost:3001/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@mktplace.com",
  "password": "Admin@123456"
}
```

---

## 📡 Endpoints

### 1. Auditar Saldo de Usuário

**GET** `/api/v1/admin/balance/audit/:userId`

**Descrição**: Diagnóstico completo do saldo de um usuário específico

**Parâmetros**:
- `userId` (path) - ID do usuário a auditar

**Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cmgnxxx...",
      "email": "usuario@email.com",
      "name": "João Silva"
    },
    "summary": {
      "totalBalances": 2,
      "validBalances": 1,
      "invalidBalances": 1,
      "totalOrphans": 2
    },
    "balances": [
      {
        "cryptoType": "BTC",
        "network": "MAINNET",
        "isValid": false,
        "currentState": {
          "total": "0.10000000",
          "locked": "0.00097001",
          "available": "0.09902999"
        },
        "expectedState": {
          "total": "0.10000000",
          "locked": "0.00000000",
          "available": "0.10000000"
        },
        "difference": {
          "locked": "0.00097001",
          "available": "-0.00097001"
        },
        "orders": {
          "active": {
            "count": 0,
            "totalLocked": "0.00000000",
            "list": []
          },
          "orphan": {
            "count": 2,
            "list": [
              {
                "id": "cmh5poyx8000b5y14mx98qk1o",
                "status": "CANCELLED",
                "amount": "0.00058461",
                "fiatAmount": "100.00",
                "createdAt": "2025-10-25T00:19:56.000Z",
                "updatedAt": "2025-10-25T00:20:12.000Z"
              },
              {
                "id": "cmh6c5qht000ehzidf4qulpyc",
                "status": "COMPLETED",
                "amount": "0.00097001",
                "fiatAmount": "444.00",
                "createdAt": "2025-10-25T10:48:49.000Z",
                "updatedAt": "2025-10-25T10:52:31.000Z"
              }
            ]
          }
        },
        "needsCorrection": true
      }
    ]
  }
}
```

**Response 404 Not Found**:
```json
{
  "success": false,
  "error": "Usuário não encontrado"
}
```

**Interpretação**:
- `isValid: false` → Saldo inconsistente
- `needsCorrection: true` → Precisa correção
- `orphan.count > 0` → Pedidos finalizados com saldo ainda bloqueado
- `difference.locked > 0` → Saldo bloqueado MAIOR que deveria
- `difference.locked < 0` → Saldo bloqueado MENOR que deveria

---

### 2. Corrigir Saldo de Usuário

**POST** `/api/v1/admin/balance/fix/:userId`

**Descrição**: Força recálculo e correção de saldo de um usuário

**Parâmetros**:
- `userId` (path) - ID do usuário a corrigir

**Body (opcional)**:
```json
{
  "cryptoType": "BTC",      // Opcional: Se omitido, corrige todos
  "network": "MAINNET",     // Opcional: Se omitido, corrige todos
  "autoFix": true           // Default: true (auto-corrige diferenças <= 10%)
}
```

**Exemplos de uso**:

**1. Corrigir todos os saldos de um usuário**:
```bash
POST /api/v1/admin/balance/fix/cmgnxxx
Content-Type: application/json

{
  "autoFix": true
}
```

**2. Corrigir apenas BTC MAINNET**:
```bash
POST /api/v1/admin/balance/fix/cmgnxxx
Content-Type: application/json

{
  "cryptoType": "BTC",
  "network": "MAINNET",
  "autoFix": true
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "message": "Correção de saldo executada",
  "data": {
    "user": {
      "id": "cmgnxxx...",
      "email": "usuario@email.com"
    },
    "summary": {
      "totalBalances": 1,
      "totalFixed": 1,
      "totalRecalculated": 1,
      "totalInvalid": 0
    },
    "results": [
      {
        "cryptoType": "BTC",
        "network": "MAINNET",
        "isValid": true,
        "autoFixed": true,
        "recalculated": true,
        "before": {
          "locked": 0.00097001
        },
        "after": {
          "locked": "0.00000000"
        },
        "inconsistencies": []
      }
    ]
  }
}
```

**Response 404 Not Found**:
```json
{
  "success": false,
  "error": "Usuário não encontrado"
}
```

**O que faz internamente**:
1. Valida saldo do usuário com `BalanceValidatorService`
2. Auto-corrige diferenças <= 10% (se `autoFix: true`)
3. Recalcula `lockedAmount` do ZERO baseado em pedidos ativos
4. Atualiza `availableAmount = total - lockedAmount`

---

### 3. Validar Todos os Saldos do Sistema

**GET** `/api/v1/admin/balance/validate-all`

**Descrição**: Valida TODOS os saldos de TODOS os usuários do sistema

**Query Parameters**:
- `autoFix` (opcional, default: `false`) - Se `true`, auto-corrige diferenças <= 10%

**Exemplos**:

**1. Validar sem correção (diagnóstico)**:
```bash
GET /api/v1/admin/balance/validate-all
```

**2. Validar E auto-corrigir**:
```bash
GET /api/v1/admin/balance/validate-all?autoFix=true
```

**Response 200 OK**:
```json
{
  "success": true,
  "message": "Validação de saldos concluída",
  "data": {
    "summary": {
      "total": 15,
      "valid": 12,
      "invalid": 3,
      "autoFixed": 2
    },
    "invalidBalances": [
      {
        "userId": "cmgnxxx...",
        "cryptoType": "BTC",
        "network": "MAINNET",
        "currentLocked": 0.00097001,
        "expectedLocked": 0,
        "difference": 0.00097001,
        "activeOrdersCount": 0,
        "inconsistencies": [
          "Saldo bloqueado MAIOR que esperado: 0.00097001 > 0.00000000",
          "Possível causa: Pedido finalizado mas saldo não foi desbloqueado"
        ],
        "autoFixed": true
      },
      {
        "userId": "cmgnyyy...",
        "cryptoType": "USDT",
        "network": "TRC20",
        "currentLocked": 50.5,
        "expectedLocked": 100.75,
        "difference": -50.25,
        "activeOrdersCount": 3,
        "inconsistencies": [
          "Saldo bloqueado MENOR que esperado: 50.50000000 < 100.75000000",
          "Possível causa: Pedido ativo mas saldo não foi bloqueado corretamente"
        ],
        "autoFixed": false
      }
    ]
  }
}
```

**Interpretação**:
- `total` - Total de saldos no sistema
- `valid` - Saldos consistentes
- `invalid` - Saldos inconsistentes
- `autoFixed` - Quantos foram corrigidos automaticamente
- `invalidBalances` - Lista apenas os saldos inválidos

**⚠️ IMPORTANTE**: Este endpoint pode demorar em sistemas grandes (muitos usuários). Use com cautela.

---

## 🧪 Exemplos de Uso com cURL

### 1. Login como admin
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mktplace.com",
    "password": "Admin@123456"
  }'

# Resposta: { "success": true, "data": { "token": "eyJhbGci..." } }
# Salvar token em variável
TOKEN="eyJhbGci..."
```

### 2. Auditar saldo de usuário
```bash
curl -X GET "http://localhost:3001/api/v1/admin/balance/audit/cmgn3gig..." \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Corrigir saldo de usuário
```bash
curl -X POST "http://localhost:3001/api/v1/admin/balance/fix/cmgn3gig..." \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "autoFix": true
  }'
```

### 4. Validar todos os saldos (com auto-correção)
```bash
curl -X GET "http://localhost:3001/api/v1/admin/balance/validate-all?autoFix=true" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔄 Fluxo de Uso Recomendado

### Cenário 1: Usuário Reporta Saldo Incorreto

1. **Diagnosticar**:
   ```bash
   GET /api/v1/admin/balance/audit/:userId
   ```
   - Verificar `isValid`, `needsCorrection`, `orphan.count`
   - Analisar diferença entre `currentState` e `expectedState`

2. **Corrigir**:
   ```bash
   POST /api/v1/admin/balance/fix/:userId
   Body: { "autoFix": true }
   ```
   - Sistema recalcula do zero baseado em pedidos ativos
   - Processa pedidos órfãos automaticamente

3. **Validar**:
   ```bash
   GET /api/v1/admin/balance/audit/:userId
   ```
   - Confirmar `isValid: true`, `needsCorrection: false`

### Cenário 2: Manutenção Periódica do Sistema

1. **Validar sistema inteiro**:
   ```bash
   GET /api/v1/admin/balance/validate-all
   ```
   - Obter panorama geral (quantos saldos válidos/inválidos)

2. **Auto-corrigir pequenas inconsistências**:
   ```bash
   GET /api/v1/admin/balance/validate-all?autoFix=true
   ```
   - Sistema corrige automaticamente diferenças <= 10%

3. **Corrigir manualmente casos graves**:
   - Para cada usuário em `invalidBalances`:
     ```bash
     POST /api/v1/admin/balance/fix/:userId
     ```

---

## 🛡️ Segurança

### Proteções Implementadas

1. **Autenticação obrigatória**: Token JWT válido
2. **Autorização**: Apenas role `ADMIN` pode acessar
3. **Rate limiting**: Limite de requisições por IP (apiLimiter)
4. **Logs de auditoria**: Todas as operações são logadas
5. **Idempotência**: Endpoints podem ser chamados múltiplas vezes sem efeito colateral

### Middlewares Aplicados

```typescript
router.use(authMiddleware);    // Valida JWT
router.use(adminMiddleware);   // Valida role ADMIN
```

### Como funciona o adminMiddleware

```typescript
// apps/api/src/middlewares/admin.middleware.ts
export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (user?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado: permissões de admin necessárias'
    });
  }

  next();
};
```

---

## 🐛 Troubleshooting

### Erro 401 Unauthorized

**Causa**: Token JWT inválido ou expirado

**Solução**:
1. Fazer login novamente: `POST /api/v1/auth/login`
2. Usar novo token nas requisições

### Erro 403 Forbidden

**Causa**: Usuário não tem role `ADMIN`

**Solução**:
1. Verificar role do usuário no banco:
   ```sql
   SELECT id, email, role FROM User WHERE email = 'seu@email.com';
   ```
2. Atualizar para ADMIN se necessário:
   ```sql
   UPDATE User SET role = 'ADMIN' WHERE email = 'seu@email.com';
   ```

### Erro 404 Not Found

**Causa**: Usuário não existe no banco

**Solução**:
- Verificar ID do usuário está correto
- Listar usuários: `SELECT id, email FROM User LIMIT 10;`

### Erro 500 Internal Server Error

**Causa**: Erro no servidor (banco de dados, lógica, etc.)

**Solução**:
1. Verificar logs do servidor
2. Verificar conexão com banco de dados
3. Verificar se Prisma está sincronizado: `npx prisma generate`

---

## 📊 Casos de Uso

### Caso 1: Pedido Órfão CANCELLED

**Problema**: Pedido foi cancelado mas saldo não foi desbloqueado

**Diagnóstico**:
```bash
GET /api/v1/admin/balance/audit/:userId
```

**Resultado esperado**:
```json
{
  "cryptoType": "BTC",
  "isValid": false,
  "difference": { "locked": "0.00058461" },
  "orders": {
    "active": { "count": 0 },
    "orphan": {
      "count": 1,
      "list": [{
        "id": "cmh5poyx8...",
        "status": "CANCELLED",
        "amount": "0.00058461"
      }]
    }
  }
}
```

**Correção**:
```bash
POST /api/v1/admin/balance/fix/:userId
Body: { "autoFix": true }
```

**O que acontece**:
1. Sistema detecta pedido órfão CANCELLED
2. Recalcula `lockedAmount` = 0 (nenhum pedido ativo)
3. Atualiza `availableAmount` = total - 0
4. Saldo desbloqueado ✅

### Caso 2: Pedido Órfão COMPLETED

**Problema**: Pedido foi concluído mas saldo não foi debitado

**Diagnóstico**:
```bash
GET /api/v1/admin/balance/audit/:userId
```

**Resultado esperado**:
```json
{
  "cryptoType": "BTC",
  "isValid": false,
  "currentState": {
    "total": "0.10000000",
    "locked": "0.00097001"
  },
  "expectedState": {
    "total": "0.09902999",
    "locked": "0.00000000"
  },
  "orders": {
    "orphan": {
      "count": 1,
      "list": [{
        "id": "cmh6c5qht...",
        "status": "COMPLETED",
        "amount": "0.00097001"
      }]
    }
  }
}
```

**Correção**:
```bash
POST /api/v1/admin/balance/fix/:userId
Body: { "autoFix": true }
```

**O que acontece**:
1. Sistema detecta pedido órfão COMPLETED
2. Recalcula `lockedAmount` = 0
3. Processa pedido órfão (desbloqueia + debita do total)
4. Saldo total reduzido ✅

---

## 📝 Logs

### Console do Servidor

Quando endpoints são chamados, logs aparecem no console:

```
🔍 [ADMIN BALANCE] Iniciando validação de todos os saldos (autoFix=true)...
🔧 [BALANCE VALIDATOR] Auto-corrigido saldo de cmgn3gig...:
   BTC/MAINNET
   Bloqueado: 0.00097001 → 0.00000000
✅ [BALANCE VALIDATOR] Recalculado lockedAmount:
   cmgn3gig... - BTC/MAINNET
   0.00097001 → 0.00000000
```

---

## 🔗 Arquivos Relacionados

### Backend
- `apps/api/src/controllers/admin-balance.controller.ts` - Controllers dos endpoints
- `apps/api/src/routes/admin-balance.routes.ts` - Rotas registradas
- `apps/api/src/services/balance-validator.service.ts` - Serviço de validação
- `apps/api/src/middlewares/admin.middleware.ts` - Middleware de autorização
- `apps/api/src/index.ts` - Registro das rotas no app

### Scripts
- `apps/api/scripts/fix-locked-balances-v2.ts` - Script CLI para correção em massa

### Documentação
- `CORRECAO_GESTAO_SALDO_25_10_2025.md` - Documentação da correção Bug #2
- `ENDPOINTS_AUDITORIA_SALDO_25_10_2025.md` - Este arquivo

---

**Desenvolvido por**: Claude Code
**Versão do documento**: 1.0
**Data**: 25/10/2025
