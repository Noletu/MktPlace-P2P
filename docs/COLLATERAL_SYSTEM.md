# Sistema de Colateral - Documentação Técnica

## Visão Geral

O sistema de colateral é responsável por gerenciar o bloqueio e liberação de criptomoedas usadas como garantia em pedidos de compra/venda no marketplace P2P.

## Arquitetura

### Componentes Principais

1. **InternalBalance** (Model do Prisma)
   - Gerencia saldos de usuários
   - Rastreia valor total, bloqueado e disponível
   - Localização: `apps/api/prisma/schema.prisma`

2. **InternalBalanceService**
   - Lógica de negócio para bloqueio/desbloqueio
   - Métodos: `lockBalance()`, `unlockBalance()`
   - Localização: `apps/api/src/services/internal-balance.service.ts`

3. **CollateralReleaseWorker**
   - Processamento automático de liberação
   - Executa a cada 60 segundos
   - Localização: `apps/api/src/workers/collateral-release.worker.ts`

## Fluxo de Colateral

### 1. Criação de Pedido

```typescript
// Usuário cria pedido SELL
Order.create({
  cryptoAmount: "0.01",
  collateralSource: "INTERNAL_BALANCE",
  collateralLocked: true,
  collateralLockedAmount: "0.01025", // Inclui taxas
})

// InternalBalance é atualizado
InternalBalance.update({
  lockedAmount: previousLocked + 0.01025,
  availableAmount: balance - (previousLocked + 0.01025)
})
```

### 2. Estados do Pedido e Colateral

| Status do Pedido | Colateral | Descrição |
|-----------------|-----------|-----------|
| PENDING | Bloqueado | Aguardando comprador |
| MATCHED | Bloqueado | Comprador aceitou, aguardando pagamento |
| PAYMENT_SENT | Bloqueado | Aguardando confirmação do vendedor |
| COMPLETED | **Liberado** | Transferido para o comprador |
| CANCELLED | **Liberado** | Devolvido ao vendedor |
| EXPIRED | **Liberado** | Devolvido ao vendedor |

### 3. Liberação de Colateral

#### Liberação Manual (no código)

```typescript
// Em order.service.ts:cancelOrder()
if (order.collateralSource === 'INTERNAL_BALANCE' &&
    order.collateralLocked &&
    order.collateralLockedAmount) {

  await internalBalanceService.unlockBalance(
    order.userId,
    order.cryptoType,
    order.cryptoNetwork,
    order.collateralLockedAmount,
    orderId
  );
}
```

#### Liberação Automática (Worker)

```typescript
// Busca pedidos finalizados com colateral ainda bloqueado
const finishedOrders = await prisma.order.findMany({
  where: {
    collateralSource: 'INTERNAL_BALANCE',
    collateralLocked: true,
    status: { in: ['COMPLETED', 'CANCELLED', 'TIMEOUT', 'EXPIRED'] },
    collateralUnlockedAt: null,
  },
});

// Processa cada pedido
for (const order of finishedOrders) {
  await unlockBalance(...);
  await prisma.order.update({
    where: { id: order.id },
    data: {
      collateralLocked: false,
      collateralUnlockedAt: new Date(),
    },
  });
}
```

## Worker de Liberação de Colateral

### Configuração

- **Intervalo de Execução**: 60 segundos
- **Alerta de Órfãos**: A cada 6 horas
- **Threshold de Órfãos**: 24 horas

### Logs

```
= [COLLATERAL WORKER] Starting...
= [COLLATERAL WORKER] Execution #1 at 2025-11-12T14:56:00.433Z
= [COLLATERAL WORKER] Found 2 orders with collateral to release
 [COLLATERAL WORKER] Processing completed: 2 released, 0 errors
```

### Monitoramento

```bash
# Verificar status do worker
npx tsx apps/api/scripts/check-worker-status.ts

# Endpoint API (apenas ADMIN)
GET /api/v1/workers/status
Authorization: Bearer <admin-token>
```

## Campos Importantes

### Model Order

```prisma
model Order {
  // Fonte do colateral
  collateralSource        String? // "INTERNAL_BALANCE" | "DEPOSIT"

  // Status de bloqueio
  collateralLocked        Boolean @default(false)
  collateralLockedAmount  String? // Valor bloqueado (com taxas)

  // Rastreamento de liberação
  collateralUnlockedAt    DateTime?

  // Referência ao saldo interno
  internalBalanceId       String?
  internalBalance         InternalBalance? @relation(...)
}
```

### Model InternalBalance

```prisma
model InternalBalance {
  // Controle de saldo
  balance         String @default("0") // Total
  lockedAmount    String @default("0") // Bloqueado
  availableAmount String @default("0") // Disponível

  // Estatísticas
  totalDeposited String @default("0")
  totalUsed      String @default("0")
  totalWithdrawn String @default("0")
}
```

## Cálculo de Taxas

```typescript
// Taxas sobre o valor do pedido
const platformFee = cryptoAmount * 0.015  // 1.5%
const payerReward = cryptoAmount * 0.01   // 1.0%
const totalFee = platformFee + payerReward // 2.5%

// Valor total a ser bloqueado
const collateralLockedAmount = cryptoAmount + totalFee
```

## Casos de Erro Comuns

### 1. Saldo Bloqueado Após Cancelamento

**Sintoma**: Pedido está CANCELLED mas `collateralLocked = true`

**Causa**: Falha na execução de `unlockBalance()` durante cancelamento

**Solução**:
```bash
# Diagnóstico
npx tsx apps/api/scripts/check-nicolas-balance.ts

# Correção
npx tsx apps/api/scripts/fix-nicolas-stuck-balance.ts
```

### 2. Worker Não Está Liberando

**Sintoma**: Pedidos finalizados mas saldo não liberado após 60s

**Diagnóstico**:
```bash
# Verificar se worker está rodando
npx tsx apps/api/scripts/check-worker-status.ts

# Verificar logs do servidor
tail -f logs/api.log | grep "COLLATERAL WORKER"
```

**Possíveis Causas**:
- Worker não iniciou (verificar `src/index.ts` linha 212)
- Erro no método `processLockedCollateral()`
- Campo `collateralUnlockedAt` já preenchido

### 3. Colaterais Órfãos (>24h)

**Sintoma**: Alerta no log indicando pedidos com colateral bloqueado há mais de 24h

**Verificação**:
```bash
# Forçar verificação manual
POST /api/v1/workers/collateral-release/check-orphaned
Authorization: Bearer <admin-token>
```

**Análise**:
```sql
-- Buscar pedidos órfãos no banco
SELECT id, status, createdAt, collateralLockedAmount, collateralLocked
FROM Order
WHERE collateralSource = 'INTERNAL_BALANCE'
  AND collateralLocked = true
  AND createdAt < datetime('now', '-24 hours')
  AND status IN ('PENDING', 'MATCHED');
```

## Scripts de Manutenção

### 1. check-nicolas-balance.ts

Diagnóstico completo de saldos:
```bash
npx tsx apps/api/scripts/check-nicolas-balance.ts
```

**Saída**:
- Lista saldos internos (total, disponível, bloqueado)
- Lista últimos 10 pedidos
- Identifica pedidos ativos vs saldo bloqueado
- Alerta sobre inconsistências

### 2. fix-nicolas-stuck-balance.ts

Correção automática:
```bash
npx tsx apps/api/scripts/fix-nicolas-stuck-balance.ts
```

**Ações**:
- Busca pedidos CANCELLED/COMPLETED com `collateralLocked = true`
- Atualiza `collateralLocked = false` em cada pedido
- Desbloqueia saldo em `InternalBalance`
- Tudo em transação atômica (rollback em caso de erro)

### 3. check-worker-status.ts

Verificação de worker:
```bash
npx tsx apps/api/scripts/check-worker-status.ts
```

**Informações**:
- Status (running/stopped)
- Número de execuções
- Última execução
- Forçar execução manual para teste

## Melhores Práticas

### Para Desenvolvedores

1. **Sempre usar transações** ao manipular colateral:
```typescript
await prisma.$transaction(async (tx) => {
  await tx.order.update(...);
  await tx.internalBalance.update(...);
});
```

2. **Sempre logar operações de colateral**:
```typescript
console.log(`= Desbloqueando: ${amount} ${crypto} para pedido ${orderId}`);
```

3. **Verificar estado antes de desbloquear**:
```typescript
if (!order.collateralLocked) {
  console.log('  Colateral já foi desbloqueado');
  return;
}
```

### Para Administradores

1. **Monitorar logs regularmente**:
```bash
grep "COLLATERAL WORKER" logs/api.log
```

2. **Verificar alertas de órfãos**:
```bash
grep "ALERT.*collateral" logs/api.log
```

3. **Executar diagnóstico semanalmente**:
```bash
npx tsx apps/api/scripts/check-nicolas-balance.ts
```

## Endpoints Administrativos

### GET /api/v1/workers/status

Retorna status de todos os workers:
```json
{
  "success": true,
  "data": {
    "collateralRelease": {
      "isRunning": true,
      "executionCount": 150,
      "lastExecution": "2025-11-12T14:56:00.433Z",
      "checkInterval": 60000
    }
  }
}
```

### POST /api/v1/workers/collateral-release/process-now

Força processamento imediato:
```bash
curl -X POST http://localhost:3001/api/v1/workers/collateral-release/process-now \
  -H "Authorization: Bearer <admin-token>"
```

### POST /api/v1/workers/collateral-release/check-orphaned

Força verificação de órfãos:
```bash
curl -X POST http://localhost:3001/api/v1/workers/collateral-release/check-orphaned \
  -H "Authorization: Bearer <admin-token>"
```

## Audit Log

Todas as operações de colateral são registradas no AuditLog:

```typescript
await prisma.auditLog.create({
  data: {
    userId: order.userId,
    action: 'COLLATERAL_RELEASED',
    resource: 'ORDER',
    resourceId: order.id,
    description: `Colateral liberado automaticamente: ${amount} ${crypto}`,
    metadata: JSON.stringify({
      orderId,
      orderStatus,
      cryptoType,
      network,
      amount,
      releasedAt: new Date().toISOString(),
    }),
    success: true,
  },
});
```

## Referências

- Schema do Prisma: `apps/api/prisma/schema.prisma`
- Service: `apps/api/src/services/internal-balance.service.ts`
- Worker: `apps/api/src/workers/collateral-release.worker.ts`
- Rotas: `apps/api/src/routes/workers.routes.ts`
- Scripts: `apps/api/scripts/`

---

**Última Atualização**: 2025-11-12
**Versão**: 1.0.0
