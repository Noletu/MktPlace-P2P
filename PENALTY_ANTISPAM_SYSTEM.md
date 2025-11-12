# Sistema de Penalidades e Anti-Spam - Documentação Completa

**Data de Implementação:** 12 de Novembro de 2025
**Versão:** 1.0.0
**Status:** ✅ Produção

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Problema Resolvido](#problema-resolvido)
3. [Arquitetura do Sistema](#arquitetura-do-sistema)
4. [Sistema de Penalidades](#sistema-de-penalidades)
5. [Sistema Anti-Spam](#sistema-anti-spam)
6. [Banco de Dados](#banco-de-dados)
7. [Backend - Implementação](#backend---implementação)
8. [Frontend - Implementação](#frontend---implementação)
9. [Fluxos de Uso](#fluxos-de-uso)
10. [Testes e Validação](#testes-e-validação)
11. [Configurações e Parâmetros](#configurações-e-parâmetros)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O **Sistema de Penalidades e Anti-Spam** foi desenvolvido para proteger o marketplace P2P de comportamentos maliciosos, como:

- Cancelamentos recorrentes sem justificativa
- Criação e cancelamento massivo de pedidos (spam)
- Vendedores que cancelam após alguém aceitar
- Compradores que aceitam e desistem repetidamente

### Princípios de Design

1. **Justiça**: Não penalizar cancelamentos legítimos (pedidos PENDING sem comprador)
2. **Progressive Disclosure**: Avisar usuário antes de aplicar penalidades severas
3. **Transparência**: Histórico completo de todas as ações
4. **Equilíbrio**: Permitir flexibilidade (3 cancelamentos/dia) mas coibir abuso

---

## 🔍 Problema Resolvido

### Antes da Implementação

❌ Usuários podiam cancelar pedidos infinitamente sem consequências
❌ Spam de criação/cancelamento de pedidos (manipulação de preços)
❌ Má experiência para compradores sérios
❌ Sem rastreamento de motivos de cancelamento
❌ Reputação não refletia comportamento real

### Depois da Implementação

✅ Penalidades proporcionais ao histórico de cancelamentos
✅ Rate limiting de 3 cancelamentos PENDING/dia
✅ Cooldown de 15 minutos entre criação e cancelamento
✅ Soft warnings antes de penalidades severas
✅ Histórico completo de cancelamentos
✅ Badges visuais para usuários com histórico ruim

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE CANCELAMENTO                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Usuário tenta  │
                    │  cancelar ordem │
                    └────────┬────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  Status = PENDING?     │
                └───────┬────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
           SIM                     NÃO (MATCHED)
            │                       │
            ▼                       ▼
┌──────────────────────┐   ┌──────────────────────┐
│   ANTI-SPAM CHECK    │   │   PENALTY CHECK      │
│  1. Cooldown (15min) │   │  1. Calcular penalty │
│  2. Rate Limit (3/d) │   │  2. Aplicar na       │
│  3. Soft Warning     │   │     reputação        │
└──────────┬───────────┘   └──────────┬───────────┘
           │                           │
           └───────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │  Criar histórico de    │
          │  cancelamento          │
          └────────────┬───────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │  Atualizar contadores  │
          │  do usuário            │
          └────────────┬───────────┘
                       │
                       ▼
                  ✅ SUCESSO
```

---

## ⚖️ Sistema de Penalidades

### Cálculo Híbrido

O sistema usa **dois algoritmos simultâneos** e aplica o **maior valor**:

#### 1. Penalidade Progressiva (Baseada no Total)

| Cancelamento | Penalidade |
|--------------|------------|
| 1º           | 0 pontos   |
| 2º           | 5 pontos   |
| 3º           | 10 pontos  |
| 4º-5º        | 15 pontos  |
| 6º+          | 20 pontos  |

#### 2. Penalidade por Frequência (Últimos 30 dias)

| Cancelamentos | Penalidade |
|---------------|------------|
| 1-2           | 0 pontos   |
| 3-4           | 15 pontos  |
| 5+            | 30 pontos  |

#### Exemplo de Cálculo

**Caso 1: Usuário com 3 cancelamentos totais, sendo 2 nos últimos 30 dias**
- Progressivo: 10 pontos (3º cancelamento)
- Frequência: 0 pontos (apenas 2 em 30 dias)
- **Resultado: 10 pontos** (maior valor)

**Caso 2: Usuário com 2 cancelamentos totais, mas 5 nos últimos 30 dias**
- Progressivo: 5 pontos (2º cancelamento)
- Frequência: 30 pontos (5 em 30 dias)
- **Resultado: 30 pontos** (maior valor)

### Quando Penalidades São Aplicadas

✅ **COM PENALIDADE**:
- Pedido em status **MATCHED** (comprador já aceitou)
- Tanto vendedor quanto comprador são penalizados

❌ **SEM PENALIDADE**:
- Pedido em status **PENDING** (ninguém aceitou ainda)
- Nenhum usuário foi prejudicado

### Penalidades em Disputas

Quando uma disputa é resolvida com `resolutionType = 'PENALTY_SELLER'`:
- Vendedor perde **-20 pontos** de reputação imediatamente
- Registro é feito no histórico de disputas

---

## 🛡️ Sistema Anti-Spam

### 1. Rate Limiting

**Regra**: Máximo de **3 cancelamentos de pedidos PENDING por dia**

**Como funciona**:
1. Conta cancelamentos nas últimas 24 horas
2. Se >= 3, bloqueia novos cancelamentos por 24h
3. Aviso visual quando atinge 2/3

**Mensagem de Bloqueio**:
> "Você atingiu o limite de 3 cancelamentos por dia. Tente novamente em 24 horas. Isso evita spam no marketplace."

---

### 2. Cooldown de Criação

**Regra**: Pedido só pode ser cancelado **15 minutos após criação**

**Como funciona**:
1. Compara `Date.now()` com `order.createdAt`
2. Se < 15min, bloqueia cancelamento
3. Mostra tempo restante ao usuário

**Mensagem de Bloqueio**:
> "Por favor, aguarde X minuto(s) antes de cancelar este pedido. Isso evita cancelamentos impulsivos."

**Benefícios**:
- Evita cancelamentos por impulso
- Dificulta bots automatizados
- Reduz volatilidade do marketplace

---

### 3. Soft Warning Progressivo

Sistema de **3 níveis** baseado em cancelamentos PENDING nos últimos **7 dias**:

#### Nível 1: Warning (5-9 cancelamentos)
- ⚠️ Aviso amarelo no modal
- ✅ Ainda pode cancelar
- 💬 "Você cancelou X pedidos nos últimos 7 dias. Continue assim e poderá sofrer restrições."

#### Nível 2: Restricted (10-14 cancelamentos)
- 🚫 Bloqueio de 24h para cancelamentos
- 🔴 Aviso vermelho no modal
- 💬 "Você precisa aguardar 24 horas antes de cancelar mais pedidos."

#### Nível 3: Penalized (15+ cancelamentos)
- 🚨 Penalidade de **-5 pontos** de reputação
- 🔴 Bloqueio de 24h
- 📝 Registro especial: `orderId = 'SPAM_DETECTION'`
- 💬 "Comportamento de spam detectado. Penalidade aplicada."

**Proteção contra Penalidade Dupla**:
- Só aplica penalidade uma vez a cada 24h
- Verifica histórico antes de aplicar novamente

---

## 🗄️ Banco de Dados

### Migration: `20251112071715_add_cancellation_penalty_system`

#### Tabela `User` (Campos Adicionados)

```prisma
model User {
  // ... campos existentes
  totalCancellations  Int       @default(0)     // Total de cancelamentos (lifetime)
  recentCancellations Int       @default(0)     // Cancelamentos nos últimos 30 dias
  lastCancellationAt  DateTime?                 // Timestamp do último cancelamento
}
```

#### Tabela `Order` (Campos Adicionados)

```prisma
model Order {
  // ... campos existentes
  cancelledBy         String?   // ID do usuário que cancelou
  cancellationReason  String?   // Enum: USER_CHANGED_MIND, PAYMENT_ISSUE, etc.
  cancellationNote    String?   // Justificativa livre (min 20 chars)
}
```

#### Nova Tabela: `CancellationHistory`

```prisma
model CancellationHistory {
  id                String   @id @default(cuid())
  userId            String   // Quem cancelou
  orderId           String   // Pedido cancelado (ou 'SPAM_DETECTION')
  role              String   // SELLER ou BUYER
  reason            String   // Motivo do cancelamento
  note              String?  // Justificativa detalhada
  penaltyApplied    Boolean  @default(false)
  penaltyPoints     Int      @default(0)
  reputationBefore  Int?     // Reputação antes da penalidade
  reputationAfter   Int?     // Reputação depois da penalidade
  orderStatus       String   // PENDING ou MATCHED
  orderValue        String   // Valor do pedido em BRL
  createdAt         DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

**Queries Importantes**:

```typescript
// Contar cancelamentos PENDING nas últimas 24h
await prisma.cancellationHistory.count({
  where: {
    userId: 'xxx',
    createdAt: { gte: last24Hours },
    orderStatus: 'PENDING',
  }
});

// Buscar histórico do usuário
await prisma.cancellationHistory.findMany({
  where: { userId: 'xxx' },
  orderBy: { createdAt: 'desc' },
  take: 20,
});

// Detectar penalidade recente de spam
await prisma.cancellationHistory.findFirst({
  where: {
    userId: 'xxx',
    createdAt: { gte: last24Hours },
    note: { contains: 'SPAM_PENALTY' },
  }
});
```

---

## 🔧 Backend - Implementação

### Arquivos Criados

#### 1. `apps/api/src/services/penalty.service.ts`

**Responsabilidade**: Cálculo e aplicação de penalidades

**Principais Métodos**:

```typescript
class PenaltyService {
  // Calcular penalidade para um cancelamento
  async calculateCancellationPenalty(
    userId: string,
    role: UserRole
  ): Promise<PenaltyCalculation>

  // Aplicar penalidade na reputação do usuário
  async applyReputationPenalty(
    userId: string,
    penaltyPoints: number,
    reason: string
  ): Promise<{ oldReputation: number; newReputation: number }>

  // Métodos privados
  private calculateProgressivePenalty(totalCount: number): number
  private calculateFrequencyPenalty(recentCount: number): number
}
```

**Configuração**:

```typescript
const DEFAULT_PENALTY_CONFIG = {
  progressive: {
    first: 0,
    second: 5,
    third: 10,
    fourthFifth: 15,
    sixth: 20,
  },
  frequency: {
    low: { threshold: 2, points: 0 },
    medium: { threshold: 4, points: 15 },
    high: { threshold: 5, points: 30 },
  },
  recentWindowDays: 30,
};
```

---

#### 2. `apps/api/src/services/antiSpam.service.ts`

**Responsabilidade**: Proteção anti-spam (rate limit, cooldown, soft warning)

**Principais Métodos**:

```typescript
class AntiSpamService {
  // Verificar se pode cancelar pedido PENDING
  async canCancelPendingOrder(
    userId: string,
    orderId: string
  ): Promise<AntiSpamCheckResult>

  // Obter estatísticas do usuário
  async getUserCancellationStats(userId: string): Promise<{
    pendingCancellationsToday: number;
    pendingCancellationsLast7Days: number;
    totalCancellations: number;
    canCancel: boolean;
    warningLevel: 'none' | 'warning' | 'restricted' | 'penalized';
  }>

  // Métodos privados
  private checkCreationCooldown(orderId: string): Promise<AntiSpamCheckResult>
  private checkRateLimit(userId: string): Promise<AntiSpamCheckResult>
  private checkSoftWarning(userId: string): Promise<AntiSpamCheckResult>
  private applySpamPenalty(userId: string, count: number): Promise<void>
}
```

**Configuração**:

```typescript
const CONFIG = {
  MAX_PENDING_CANCELLATIONS_PER_DAY: 3,
  RATE_LIMIT_WINDOW_HOURS: 24,
  MIN_MINUTES_BEFORE_CANCEL: 15,
  WARNING_THRESHOLD: 5,
  RESTRICTION_THRESHOLD: 10,
  PENALTY_THRESHOLD: 15,
  WARNING_WINDOW_DAYS: 7,
  RESTRICTION_COOLDOWN_HOURS: 24,
  PENALTY_POINTS: 5,
};
```

---

#### 3. `apps/api/src/services/cancellationHistory.service.ts`

**Responsabilidade**: CRUD do histórico de cancelamentos

**Principais Métodos**:

```typescript
class CancellationHistoryService {
  // Criar registro no histórico
  async create(data: CreateCancellationHistoryInput): Promise<CancellationHistory>

  // Buscar histórico do usuário (paginado)
  async getUserHistory(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<CancellationHistory[]>

  // Contar cancelamentos recentes
  async getRecentCancellations(
    userId: string,
    windowDays: number
  ): Promise<number>

  // Detectar padrões suspeitos
  async hasSuspiciousCancellationPattern(userId: string): Promise<boolean>
}
```

---

#### 4. `apps/api/src/types/cancellation.types.ts`

**Enums e Tipos**:

```typescript
export enum CancellationReason {
  USER_CHANGED_MIND = 'USER_CHANGED_MIND',
  FOUND_BETTER_PRICE = 'FOUND_BETTER_PRICE',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  SELLER_UNRESPONSIVE = 'SELLER_UNRESPONSIVE',
  BUYER_SUSPICIOUS = 'BUYER_SUSPICIOUS',
  BUYER_UNRESPONSIVE = 'BUYER_UNRESPONSIVE',
  NO_LONGER_AVAILABLE = 'NO_LONGER_AVAILABLE',
  TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',
  PERSONAL_EMERGENCY = 'PERSONAL_EMERGENCY',
  OTHER = 'OTHER',
}

export enum UserRole {
  SELLER = 'SELLER',
  BUYER = 'BUYER',
}

export interface PenaltyCalculation {
  shouldApplyPenalty: boolean;
  penaltyPoints: number;
  message: string;
  recentCancellations: number;
  totalCancellations: number;
}

export interface AntiSpamCheckResult {
  allowed: boolean;
  reason?: string;
  warningMessage?: string;
  cooldownUntil?: Date;
  pendingCancellationsToday?: number;
  recentCancellationsCount?: number;
}
```

---

### Modificações em Arquivos Existentes

#### `apps/api/src/services/order.service.ts`

**Mudanças no método `cancelOrder()`**:

```typescript
async cancelOrder(
  orderId: string,
  userId: string,
  reason: string,    // NOVO: obrigatório
  note: string       // NOVO: obrigatório
): Promise<{ message: string; penaltyApplied: boolean; penaltyPoints: number }> {

  // 1. ANTI-SPAM: Verificar se pode cancelar PENDING
  if (order.status === OrderStatus.PENDING) {
    const antiSpamCheck = await antiSpamService.canCancelPendingOrder(userId, orderId);
    if (!antiSpamCheck.allowed) {
      throw new Error(antiSpamCheck.reason);
    }
  }

  // 2. PENALTY: Só aplicar se MATCHED
  const shouldCalculatePenalty = order.status === OrderStatus.MATCHED;
  let penalty;

  if (shouldCalculatePenalty) {
    penalty = await penaltyService.calculateCancellationPenalty(userId, UserRole.SELLER);
  } else {
    penalty = {
      shouldApplyPenalty: false,
      penaltyPoints: 0,
      message: 'Pedido cancelado sem penalidade (nenhum comprador foi prejudicado)',
    };
  }

  // 3. Aplicar penalidade se necessário
  if (penalty.shouldApplyPenalty) {
    await penaltyService.applyReputationPenalty(userId, penalty.penaltyPoints, reason);
  }

  // 4. Criar histórico
  await cancellationHistoryService.create({ userId, orderId, role: UserRole.SELLER, ... });

  // 5. Atualizar pedido
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
      cancelledBy: userId,
      cancellationReason: reason,
      cancellationNote: note,
    },
  });

  return { message: penalty.message, penaltyApplied, penaltyPoints };
}
```

**Mudanças no método `cancelOrderByPayer()`**:
- Similar ao `cancelOrder()`, mas com `UserRole.BUYER`
- Pedido volta para `PENDING` ao invés de `CANCELLED`

---

#### `apps/api/src/controllers/order.controller.ts`

**Validação no endpoint `/cancel`**:

```typescript
async cancelOrder(req: Request, res: Response) {
  const { reason, note } = req.body;

  // Validação de reason
  if (!reason || typeof reason !== 'string') {
    return res.status(400).json({
      error: 'Motivo do cancelamento é obrigatório'
    });
  }

  // Validação de note (mínimo 20 caracteres)
  if (!note || typeof note !== 'string' || note.trim().length < 20) {
    return res.status(400).json({
      error: 'Por favor, forneça uma justificativa com pelo menos 20 caracteres'
    });
  }

  const result = await orderService.cancelOrder(orderId, userId, reason, note);

  res.json({
    success: true,
    message: result.message,
    penaltyApplied: result.penaltyApplied,
    penaltyPoints: result.penaltyPoints,
  });
}
```

**Novo Endpoint: `getAntiSpamStats()`**:

```typescript
async getAntiSpamStats(req: Request, res: Response) {
  const userId = req.user?.userId;
  const stats = await antiSpamService.getUserCancellationStats(userId);

  res.json({
    success: true,
    data: stats,
  });
}
```

---

#### `apps/api/src/routes/order.routes.ts`

**Nova Rota**:

```typescript
// ANTI-SPAM: Obter estatísticas de proteção anti-spam
router.get('/anti-spam/stats', orderController.getAntiSpamStats.bind(orderController));
```

---

#### `apps/api/src/services/dispute.service.ts`

**Aplicar Penalidades em Disputas**:

```typescript
async resolveDispute(disputeId: string, input: ResolveDisputeInput) {
  // ... código existente

  // NOVO: Aplicar penalidade ao vendedor se PENALTY_SELLER
  if (input.resolutionType === 'PENALTY_SELLER' && sellerId) {
    const currentReputation = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { reputationScore: true },
    });

    const penaltyPoints = DISPUTE_REPUTATION.LOSE_PENALTY; // -20
    const newReputation = Math.max(0, currentReputation.reputationScore + penaltyPoints);

    await prisma.user.update({
      where: { id: sellerId },
      data: { reputationScore: newReputation },
    });
  }
}
```

---

## 🎨 Frontend - Implementação

### Arquivos Criados

#### 1. `apps/web/components/CancellationModal.tsx`

**Responsabilidade**: Modal profissional para cancelamento com validação

**Props**:

```typescript
interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: CancellationReason, note: string) => Promise<void>;
  isSeller: boolean;  // true = vendedor, false = comprador
  orderId: string;
}
```

**Funcionalidades**:
- ✅ Dropdown com 10 motivos de cancelamento (categorias diferentes para vendedor/comprador)
- ✅ Textarea com validação de 20 caracteres mínimos
- ✅ Contador de caracteres em tempo real
- ✅ Carrega warnings de penalidade automaticamente
- ✅ Carrega estatísticas anti-spam
- ✅ Avisos visuais progressivos (amarelo → laranja → vermelho)
- ✅ Dark mode completo
- ✅ Loading state durante submit

**Avisos Exibidos**:
- 🟡 Warning de penalidade (quando `warning.shouldWarn === true`)
- 🟠 Rate limiting (quando `pendingCancellationsToday >= 2`)
- 🟡 Soft warning (quando `warningLevel === 'warning'`)
- 🔴 Restricted (quando `warningLevel === 'restricted'`)
- 🔴 Penalized (quando `warningLevel === 'penalized'`)

---

#### 2. `apps/web/components/CancellationBadge.tsx`

**Responsabilidade**: Badge visual de histórico de cancelamentos

**Props**:

```typescript
interface CancellationBadgeProps {
  recentCancellations: number;
  totalCancellations: number;
  className?: string;
}
```

**Cores Progressivas**:
- 🟡 Amarelo: 1-2 cancelamentos recentes
- 🟠 Laranja: 3-4 cancelamentos recentes
- 🔴 Vermelho: 5+ cancelamentos recentes

**Texto Exibido**:
- "⚠️ X cancelamento(s) recente(s)"
- Tooltip com total de cancelamentos

---

#### 3. `apps/web/types/cancellation.ts`

**Tipos Frontend**:

```typescript
export enum CancellationReason {
  USER_CHANGED_MIND = 'USER_CHANGED_MIND',
  FOUND_BETTER_PRICE = 'FOUND_BETTER_PRICE',
  // ... todos os enum
}

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  [CancellationReason.USER_CHANGED_MIND]: 'Mudei de ideia',
  [CancellationReason.FOUND_BETTER_PRICE]: 'Encontrei preço melhor',
  // ... todos os labels em português
};

export interface CancellationWarning {
  shouldWarn: boolean;
  warningMessage?: string;
  cancellationCount: number;
  nextPenaltyPoints: number;
}

export interface AntiSpamStats {
  pendingCancellationsToday: number;
  pendingCancellationsLast7Days: number;
  totalCancellations: number;
  canCancel: boolean;
  warningLevel: 'none' | 'warning' | 'restricted' | 'penalized';
}

export interface CancellationResponse {
  success: boolean;
  message: string;
  penaltyApplied: boolean;
  penaltyPoints: number;
}
```

---

### Integrações em Páginas Existentes

#### `apps/web/app/orders/[orderId]/page.tsx`

**Substituição dos Modais Antigos**:

```typescript
// ANTES:
<button onClick={() => setShowCancelModal(true)}>Cancelar</button>
{showCancelModal && (
  <div>Tem certeza? <button onClick={handleCancelOrder}>Sim</button></div>
)}

// DEPOIS:
import CancellationModal from '@/components/CancellationModal';

<button onClick={() => setShowCancelModal(true)}>Cancelar</button>

<CancellationModal
  isOpen={showCancelModal}
  onClose={() => setShowCancelModal(false)}
  onConfirm={handleCancelOrder}
  isSeller={true}
  orderId={orderId as string}
/>
```

**Nova Assinatura do Handler**:

```typescript
// ANTES:
const handleCancelOrder = async () => {
  await fetch(`/api/v1/orders/${orderId}/cancel`, { method: 'POST' });
}

// DEPOIS:
const handleCancelOrder = async (reason: CancellationReason, note: string) => {
  const response = await fetch(`/api/v1/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason, note }),
  });

  const data = await response.json();

  if (data.penaltyApplied) {
    alert(`Pedido cancelado! Penalidade: -${data.penaltyPoints} pontos de reputação.`);
  } else {
    alert('Pedido cancelado com sucesso!');
  }
}
```

---

#### `apps/web/app/orders/[orderId]/preview/page.tsx`

**Adicionar Warning para Vendedores com Histórico Ruim**:

```typescript
import CancellationBadge from '@/components/CancellationBadge';
import { AlertTriangle } from 'lucide-react';

// Dentro do componente:
{order.user.recentCancellations > 0 && (
  <div className="mt-6">
    <CancellationBadge
      recentCancellations={order.user.recentCancellations}
      totalCancellations={order.user.totalCancellations}
    />
  </div>
)}

{order.user.recentCancellations >= 3 && (
  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
    <div className="flex items-start gap-2">
      <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={18} />
      <p className="text-xs text-yellow-800 dark:text-yellow-200">
        <strong>Atenção:</strong> Este vendedor tem histórico de cancelamentos recentes.
        Recomendamos verificar o perfil completo antes de aceitar.
      </p>
    </div>
  </div>
)}
```

---

#### `apps/web/app/user/[userId]/page.tsx`

**Adicionar Badge no Perfil Público**:

```typescript
import CancellationBadge from '@/components/CancellationBadge';

// Atualizar interface:
interface PublicProfile {
  // ... campos existentes
  totalCancellations: number;
  recentCancellations: number;
}

// Exibir badge:
{profile.recentCancellations > 0 && (
  <div className="mt-6">
    <CancellationBadge
      recentCancellations={profile.recentCancellations}
      totalCancellations={profile.totalCancellations}
      className="w-full justify-center"
    />
  </div>
)}
```

---

## 🔄 Fluxos de Uso

### Fluxo 1: Cancelamento de Pedido PENDING (Vendedor)

```
1. Vendedor cria pedido às 10:00
2. Vendedor tenta cancelar às 10:05
   └─> ❌ BLOQUEADO: "Aguarde 10 minutos" (cooldown)
3. Vendedor tenta cancelar às 10:16
   └─> ✅ PERMITIDO (modal abre)
4. Vendedor seleciona motivo: "NO_LONGER_AVAILABLE"
5. Vendedor escreve justificativa: "Crypto não disponível no momento..."
6. Sistema verifica:
   - Cooldown: ✅ 16 minutos (> 15min)
   - Rate limit: ✅ 0 cancelamentos hoje
   - Soft warning: ✅ Nenhum aviso
7. Cancelamento aprovado SEM penalidade
8. Histórico criado com `penaltyApplied: false`
```

---

### Fluxo 2: Cancelamento de Pedido MATCHED (Comprador)

```
1. Comprador aceita pedido às 14:00
2. Pedido muda para MATCHED
3. Comprador tenta cancelar às 14:20
   └─> ✅ Modal abre (sem cooldown para MATCHED)
4. Modal mostra warning:
   "⚠️ Este é seu 3º cancelamento. Penalidade: -10 pontos"
5. Comprador seleciona motivo: "PAYMENT_ISSUE"
6. Comprador escreve justificativa: "Meu banco está com problemas..."
7. Sistema calcula penalidade:
   - Total: 3 cancelamentos → 10 pontos (progressivo)
   - Recente: 1 em 30 dias → 0 pontos (frequência)
   - **Resultado: 10 pontos**
8. Reputação: 100 → 90
9. Pedido volta para PENDING
10. Histórico criado com `penaltyApplied: true, penaltyPoints: 10`
```

---

### Fluxo 3: Bloqueio por Rate Limiting

```
1. Usuário cancela 3 pedidos PENDING no mesmo dia:
   - 09:00: 1º cancelamento ✅
   - 12:00: 2º cancelamento ✅ (aviso: "2/3")
   - 15:00: 3º cancelamento ✅ (aviso: "3/3 - último permitido")
2. Usuário tenta cancelar 4º pedido às 18:00
   └─> ❌ BLOQUEADO: "Limite de 3 por dia atingido"
3. Usuário aguarda até 09:01 do dia seguinte
4. Tenta cancelar novamente
   └─> ✅ PERMITIDO (contador resetou)
```

---

### Fluxo 4: Soft Warning Progressivo

```
1. Usuário cancela 6 pedidos PENDING em 7 dias
2. No 7º cancelamento, modal mostra:
   "⚠️ Você cancelou 6 pedidos em 7 dias. Continue e sofrerá restrições."
3. Usuário cancela mais 4 pedidos (total: 10 em 7 dias)
4. No 11º cancelamento:
   └─> 🚫 BLOQUEADO: "10 cancelamentos em 7 dias. Aguarde 24h."
5. Usuário aguarda 24 horas
6. Tenta cancelar novamente
   └─> ✅ PERMITIDO (mas ainda em warning se < 10)
7. Se chegar a 15 cancelamentos:
   └─> 🚨 PENALIDADE: -5 pontos + bloqueio 24h
```

---

## 🧪 Testes e Validação

### Testes Manuais Realizados

#### Teste 1: Cooldown de 15 Minutos
```bash
# 1. Criar pedido
POST /api/v1/orders
# Anotar orderId e createdAt

# 2. Tentar cancelar imediatamente (< 15min)
POST /api/v1/orders/{orderId}/cancel
# Esperado: Erro 400 - "Aguarde X minutos"

# 3. Tentar cancelar após 16 minutos
POST /api/v1/orders/{orderId}/cancel
# Esperado: Sucesso 200
```

#### Teste 2: Rate Limiting (3 por dia)
```bash
# 1. Cancelar 3 pedidos PENDING
POST /api/v1/orders/{order1}/cancel
POST /api/v1/orders/{order2}/cancel
POST /api/v1/orders/{order3}/cancel
# Todos esperados: Sucesso 200

# 2. Tentar cancelar 4º
POST /api/v1/orders/{order4}/cancel
# Esperado: Erro 400 - "Limite de 3 por dia"
```

#### Teste 3: Penalidade MATCHED vs PENDING
```bash
# 1. Cancelar pedido PENDING
POST /api/v1/orders/{pendingOrder}/cancel
# Esperado: penaltyApplied: false

# 2. Cancelar pedido MATCHED
POST /api/v1/orders/{matchedOrder}/cancel
# Esperado: penaltyApplied: true, penaltyPoints: X
```

---

### Scripts de Teste Sugeridos

#### Script: Simular Spam
```typescript
// apps/api/scripts/test-spam-protection.ts
async function simulateSpam(userId: string) {
  for (let i = 0; i < 20; i++) {
    // Criar pedido
    const order = await createTestOrder(userId);

    // Aguardar 16 minutos (cooldown)
    await sleep(16 * 60 * 1000);

    // Tentar cancelar
    try {
      await orderService.cancelOrder(order.id, userId, 'USER_CHANGED_MIND', 'Teste de spam'.padEnd(20));
      console.log(`✅ Cancelamento ${i+1} permitido`);
    } catch (error) {
      console.log(`❌ Cancelamento ${i+1} bloqueado: ${error.message}`);
    }
  }
}
```

---

## ⚙️ Configurações e Parâmetros

### Backend: `apps/api/src/services/antiSpam.service.ts`

```typescript
const CONFIG = {
  // Rate Limiting
  MAX_PENDING_CANCELLATIONS_PER_DAY: 3,    // Alterar para 5 se muito restritivo
  RATE_LIMIT_WINDOW_HOURS: 24,

  // Cooldown
  MIN_MINUTES_BEFORE_CANCEL: 15,           // Alterar para 30 se quiser mais tempo

  // Soft Warning
  WARNING_THRESHOLD: 5,                    // Primeiro aviso
  RESTRICTION_THRESHOLD: 10,               // Bloqueio 24h
  PENALTY_THRESHOLD: 15,                   // Penalidade -5 pontos
  WARNING_WINDOW_DAYS: 7,
  RESTRICTION_COOLDOWN_HOURS: 24,
  PENALTY_POINTS: 5,                       // Penalidade por spam
};
```

### Backend: `apps/api/src/services/penalty.service.ts`

```typescript
const DEFAULT_PENALTY_CONFIG = {
  progressive: {
    first: 0,        // Alterar se quiser penalizar desde o 1º
    second: 5,
    third: 10,
    fourthFifth: 15,
    sixth: 20,       // Máximo por progressivo
  },
  frequency: {
    low: { threshold: 2, points: 0 },
    medium: { threshold: 4, points: 15 },
    high: { threshold: 5, points: 30 },  // Máximo por frequência
  },
  recentWindowDays: 30,  // Janela de frequência
};
```

### Frontend: Validação

Em `apps/web/components/CancellationModal.tsx`:

```typescript
const MIN_NOTE_LENGTH = 20;  // Mínimo de caracteres para justificativa
```

---

## 🔧 Troubleshooting

### Problema 1: "Aguarde X minutos antes de cancelar"

**Causa**: Cooldown de 15 minutos não passou
**Solução**: Aguardar o tempo restante ou ajustar `MIN_MINUTES_BEFORE_CANCEL` se muito restritivo

---

### Problema 2: "Limite de 3 cancelamentos por dia"

**Causa**: Rate limit atingido (3 cancelamentos PENDING em 24h)
**Solução**:
- Aguardar 24h desde o primeiro cancelamento
- Ajustar `MAX_PENDING_CANCELLATIONS_PER_DAY` se necessário

---

### Problema 3: Penalidade não aplicada em MATCHED

**Causa**: Possível bug na lógica de verificação de status
**Verificar**:
```typescript
// Em order.service.ts
const shouldCalculatePenalty = order.status === OrderStatus.MATCHED;
```
**Debug**:
```bash
# Verificar histórico
SELECT * FROM CancellationHistory WHERE orderId = 'xxx';
# Verificar se penaltyApplied = true e penaltyPoints > 0
```

---

### Problema 4: Usuário bloqueado injustamente

**Causa**: Possível acúmulo de cancelamentos MATCHED + spam detection
**Investigar**:
```sql
SELECT * FROM CancellationHistory
WHERE userId = 'xxx'
AND createdAt >= datetime('now', '-7 days')
ORDER BY createdAt DESC;
```
**Ação Admin**:
```typescript
// Resetar contadores manualmente se necessário
await prisma.user.update({
  where: { id: 'xxx' },
  data: {
    recentCancellations: 0,
    lastCancellationAt: null,
  }
});
```

---

### Problema 5: Modal não carrega warnings

**Causa**: Endpoint `/anti-spam/stats` não responde
**Verificar**:
```bash
# Testar endpoint
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/v1/orders/anti-spam/stats
```
**Debug Frontend**:
```typescript
// Em CancellationModal.tsx
console.log('Anti-spam stats:', antiSpamStats);
```

---

## 📊 Métricas e Monitoramento

### Queries Úteis para Análise

#### Usuários com Mais Cancelamentos
```sql
SELECT
  u.id,
  u.name,
  u.email,
  u.totalCancellations,
  u.recentCancellations,
  u.reputationScore
FROM User u
WHERE u.totalCancellations > 5
ORDER BY u.totalCancellations DESC
LIMIT 20;
```

#### Cancelamentos por Motivo
```sql
SELECT
  reason,
  COUNT(*) as count,
  AVG(penaltyPoints) as avg_penalty
FROM CancellationHistory
GROUP BY reason
ORDER BY count DESC;
```

#### Taxa de Penalização
```sql
SELECT
  DATE(createdAt) as date,
  COUNT(*) as total_cancellations,
  SUM(CASE WHEN penaltyApplied = 1 THEN 1 ELSE 0 END) as penalized,
  ROUND(SUM(CASE WHEN penaltyApplied = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as penalty_rate
FROM CancellationHistory
WHERE createdAt >= date('now', '-30 days')
GROUP BY DATE(createdAt)
ORDER BY date DESC;
```

#### Detecções de Spam
```sql
SELECT
  userId,
  COUNT(*) as spam_detections,
  SUM(penaltyPoints) as total_penalties
FROM CancellationHistory
WHERE orderId = 'SPAM_DETECTION'
GROUP BY userId
ORDER BY spam_detections DESC;
```

---

## 🚀 Próximas Melhorias (Futuras)

### 1. Decay de Penalidades
- Reduzir `recentCancellations` automaticamente após 60 dias
- Permitir "recuperação" de reputação

### 2. Admin Dashboard
- Visualização de todos os cancelamentos em tempo real
- Gráficos de tendências de spam
- Alertas para comportamentos suspeitos

### 3. Suspensão Automática
- Suspender conta após X detecções de spam
- Revisão manual obrigatória para reativar

### 4. Whitelist
- Usuários verificados (KYC completo) com limites mais altos
- Ex: 5 cancelamentos/dia ao invés de 3

### 5. Machine Learning
- Detectar padrões de bot (horários fixos, valores suspeitos)
- Score de risco dinâmico

---

## 📝 Notas Finais

### Manutenção
- Revisar configurações trimestralmente baseado em métricas
- Ajustar thresholds se taxa de bloqueio > 10%
- Monitorar reclamações de usuários legítimos bloqueados

### Comunicação com Usuários
- Enviar email quando usuário atinge warning level
- Incluir dicas de "boas práticas" no marketplace
- Oferecer FAQ sobre sistema de penalidades

### Compliance
- Histórico completo permite auditorias
- Sistema é reversível (admin pode resetar contadores)
- Transparente (usuário sempre sabe por que foi bloqueado)

---

**Documentação criada em:** 12 de Novembro de 2025
**Última atualização:** 12 de Novembro de 2025
**Versão do Sistema:** 1.0.0
**Status:** ✅ Em Produção
