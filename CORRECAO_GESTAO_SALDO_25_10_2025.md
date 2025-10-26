# Correção: Gestão de Saldo em Pedidos Cancelados e Concluídos

**Data**: 25/10/2025
**Versão**: 3.0.7
**Bug**: #2 - Saldo Bloqueado em Pedidos Finalizados
**Status**: ✅ RESOLVIDO

---

## 🐛 Problemas Identificados

### Problema #1: Pedido CANCELLED Não Desbloqueia Saldo

**Sintoma**:
- Usuário cancela pedido que usou saldo interno
- Saldo permanece bloqueado eternamente
- Usuário não pode usar o saldo para novos pedidos

**Exemplo Real**:
```
Pedido: cmh5poyx8000b5y14mx98qk1o (CANCELLED)
Saldo bloqueado: 0.00058461 BTC
Status esperado: Desbloqueado ❌
Status atual: Bloqueado ❌
```

**Causa raiz**:
- Arquivo: `apps/api/src/services/order.service.ts` (linha 573-615)
- Método `cancelOrder()` apenas atualizava status do pedido
- **NÃO** chamava `unlockBalance()` para desbloquear saldo

### Problema #2: Pedido COMPLETED Não Debita Saldo

**Sintoma**:
- Pedido é concluído (cripto transferida para comprador)
- Saldo do vendedor permanece bloqueado MAS não é debitado
- Saldo total não diminui (inconsistência contábil)

**Exemplo Real**:
```
Pedido: cmh6c5qht000ehzidf4qulpyc (COMPLETED)
Saldo bloqueado: 0.00097001 BTC
Status esperado: Desbloqueado E debitado ❌
Status atual: Bloqueado (não debitado) ❌
```

**Causa raiz**:
- Arquivo: `apps/api/src/services/transaction.service.ts` (linha 65-132)
- Método `validateProof()` marcava pedido como COMPLETED
- **NÃO** desbloqueava nem debitava saldo do vendedor

---

## ✅ Soluções Implementadas

### Solução #1: Desbloquear Saldo ao Cancelar Pedido

**Arquivo**: `apps/api/src/services/order.service.ts` (linha 596-615)

**Código adicionado**:
```typescript
// Desbloquear saldo interno se foi usado (CORREÇÃO v3.0.7)
if (order.collateralSource === 'INTERNAL_BALANCE' &&
    order.collateralLocked &&
    order.collateralLockedAmount) {

  try {
    await internalBalanceService.unlockBalance(
      order.userId,
      order.cryptoType,
      order.cryptoNetwork,
      order.collateralLockedAmount,
      orderId
    );

    console.log(`🔓 Saldo desbloqueado após cancelamento: ${order.collateralLockedAmount} ${order.cryptoType}`);
  } catch (error: any) {
    console.error(`❌ Erro ao desbloquear saldo após cancelamento:`, error);
    // Não falhar o cancelamento se houver erro no desbloqueio
  }
}
```

**Fluxo corrigido**:
```
1. Usuário cancela pedido
2. Status → CANCELLED
3. Verificar se usou saldo interno
4. SIM → Desbloquear saldo ✅
5. Saldo volta a ficar disponível
```

### Solução #2: Desbloquear + Debitar Saldo ao Completar Pedido

**Arquivo**: `apps/api/src/services/transaction.service.ts` (linha 106-137)

**Código adicionado**:
```typescript
// Processar saldo interno do vendedor (CORREÇÃO v3.0.7)
if (transaction.order.collateralSource === 'INTERNAL_BALANCE' &&
    transaction.order.collateralLocked &&
    transaction.order.collateralLockedAmount) {

  try {
    // 1. Desbloquear o saldo
    await internalBalanceService.unlockBalance(
      transaction.order.userId,
      transaction.order.cryptoType,
      transaction.order.cryptoNetwork,
      transaction.order.collateralLockedAmount,
      transaction.orderId
    );

    console.log(`🔓 Saldo desbloqueado após conclusão: ${transaction.order.collateralLockedAmount} ${transaction.order.cryptoType}`);

    // 2. Debitar do saldo total (consumir o colateral)
    await internalBalanceService.deductBalance(
      transaction.order.userId,
      transaction.order.cryptoType,
      transaction.order.cryptoNetwork,
      transaction.order.collateralLockedAmount
    );

    console.log(`💸 Saldo debitado (gasto): ${transaction.order.collateralLockedAmount} ${transaction.order.cryptoType}`);
  } catch (error: any) {
    console.error(`❌ Erro ao processar saldo interno após conclusão:`, error);
    // Não falhar a validação se houver erro no processamento de saldo
  }
}
```

**Fluxo corrigido**:
```
1. Admin valida comprovante (aprova)
2. Transação → APPROVED
3. Pedido → COMPLETED
4. Verificar se usou saldo interno
5. SIM:
   a. Desbloquear saldo ✅
   b. Debitar do saldo total ✅
6. Saldo total reduzido (cripto foi gasta)
```

**Import adicionado** (linha 5):
```typescript
import { internalBalanceService } from './internal-balance.service';
```

---

## 🔧 Script de Correção de Dados Existentes

**Arquivo criado**: `apps/api/scripts/fix-locked-balances.ts`

### Funcionalidade

Corrige pedidos órfãos criados ANTES da correção (v3.0.6 e anteriores):

**Pedidos CANCELLED**:
1. Busca pedidos com status `CANCELLED` e saldo bloqueado
2. Desbloqueia o saldo
3. Marca pedido como `collateralLocked = false`

**Pedidos COMPLETED**:
1. Busca pedidos com status `COMPLETED` e saldo bloqueado
2. Desbloqueia o saldo
3. **Debita do saldo total** (gasta o colateral)
4. Marca pedido como `collateralLocked = false`

### Como Executar

```bash
cd apps/api
npx tsx scripts/fix-locked-balances.ts
```

### Output Esperado

```
🔍 Iniciando correção de saldos bloqueados...

📊 Total de pedidos órfãos encontrados: 2

🔴 Pedidos CANCELLED com saldo bloqueado: 1
✅ Pedidos COMPLETED com saldo bloqueado: 1

🔧 Processando pedidos CANCELLED...

📝 Processando pedido CANCELLED cmh5poyx8000b5y14mx98qk1o...
   Valor bloqueado: 0.00058461 BTC
   Cancelado em: 2025-10-25T00:19:56Z
   ✅ Saldo desbloqueado com sucesso!

🔧 Processando pedidos COMPLETED...

📝 Processando pedido COMPLETED cmh6c5qht000ehzidf4qulpyc...
   Valor bloqueado: 0.00097001 BTC
   Concluído em: 2025-10-25T10:48:49Z
   🔓 Saldo desbloqueado
   💸 Saldo debitado (gasto)
   ✅ Pedido corrigido com sucesso!

📊 Resumo da Correção:
   Pedidos CANCELLED processados: 1
   Pedidos COMPLETED processados: 1
   Total de pedidos corrigidos: 2

✅ Correção concluída!
🎉 Script finalizado com sucesso!
```

---

## 📊 Comparação Antes vs Depois

### Pedido CANCELLED

**Antes (v3.0.6):**
```
Saldo Total: 0.10000000 BTC
Saldo Bloqueado: 0.00058461 BTC
Saldo Disponível: 0.09941539 BTC ❌
```

**Depois (v3.0.7):**
```
Saldo Total: 0.10000000 BTC
Saldo Bloqueado: 0 BTC
Saldo Disponível: 0.10000000 BTC ✅
```

### Pedido COMPLETED

**Antes (v3.0.6):**
```
Saldo Total: 0.10000000 BTC (incorreto!)
Saldo Bloqueado: 0.00097001 BTC
Saldo Disponível: 0.09902999 BTC ❌
```

**Depois (v3.0.7):**
```
Saldo Total: 0.09902999 BTC (correto!)
Saldo Bloqueado: 0 BTC
Saldo Disponível: 0.09902999 BTC ✅
```

### Estado Final Esperado (Após Script)

Considerando os 2 pedidos:
- Pedido CANCELLED: 0.00058461 BTC → Desbloqueado
- Pedido COMPLETED: 0.00097001 BTC → Desbloqueado + Debitado

```
Saldo Total: 0.09902999 BTC (0.1 - 0.00097001)
Saldo Bloqueado: 0 BTC
Saldo Disponível: 0.09902999 BTC ✅
```

---

## 🧪 Como Testar

### 1. Executar Script de Correção

```bash
cd apps/api
npx tsx scripts/fix-locked-balances.ts
```

### 2. Reiniciar Servidor

```cmd
PARAR-SIMPLES.bat
INICIAR-SIMPLES.bat
```

### 3. Verificar Saldo no Frontend

1. Acessar `/collateral-balance`
2. Verificar card de BTC:
   - ✅ Disponível: 0.09902999 BTC
   - ✅ Bloqueado: 0 BTC
   - ✅ Total: 0.09902999 BTC

### 4. Testar Cancelamento de Novo Pedido

1. Criar pedido usando saldo interno (R$ 100)
2. Cancelar pedido
3. **Verificar**: Saldo foi desbloqueado automaticamente ✅

### 5. Testar Conclusão de Novo Pedido

1. Criar pedido usando saldo interno
2. Fazer match
3. Enviar comprovante
4. Admin aprovar comprovante
5. **Verificar**:
   - Saldo desbloqueado ✅
   - Saldo total reduzido ✅

---

## 📝 Arquivos Modificados

### 1. `apps/api/src/services/order.service.ts`
**Linhas**: 596-615
**Mudança**: Adicionar desbloqueio de saldo ao cancelar pedido

### 2. `apps/api/src/services/transaction.service.ts`
**Linhas**: 5, 106-137
**Mudança**:
- Import de `internalBalanceService`
- Desbloquear + debitar saldo ao completar pedido

### 3. `apps/api/scripts/fix-locked-balances.ts` (NOVO)
**Finalidade**: Script de correção de dados históricos

### 4. `package.json`
**Linha 3**: `"version": "3.0.6"` → `"version": "3.0.7"`

### 5. `CORRECAO_GESTAO_SALDO_25_10_2025.md` (NOVO)
**Finalidade**: Documentação completa da correção

---

## ⚠️ Impacto da Correção

### Funcionalidades Restauradas

1. **Liquidez**: Usuários recuperam saldo ao cancelar pedidos
2. **Contabilidade Correta**: Saldo total reflete realidade (gasto = debitado)
3. **Transparência**: Saldo bloqueado sempre correto
4. **Confiança**: Sistema funciona como esperado

### Métricas Esperadas

- **Taxa de sucesso de cancelamento**: 100% (com saldo desbloqueado)
- **Precisão contábil**: 100% (saldo total = realidade)
- **Saldo disponível**: Sempre correto após qualquer operação

---

## 🎯 Casos de Uso Corrigidos

### Caso 1: Usuário Cancela Pedido

**Cenário**: Usuário cria pedido de R$ 100 (0.00016 BTC) mas desiste

**Antes**:
```
1. Criar pedido → Bloqueia 0.00016 BTC
2. Cancelar pedido → Status CANCELLED
3. Saldo: BLOQUEADO ❌ (nunca recupera)
```

**Depois**:
```
1. Criar pedido → Bloqueia 0.00016 BTC
2. Cancelar pedido → Status CANCELLED
3. Saldo: DESBLOQUEADO ✅ (disponível imediatamente)
```

### Caso 2: Pedido Concluído

**Cenário**: Pedido de R$ 444 (0.00077 BTC) concluído com sucesso

**Antes**:
```
1. Criar pedido → Bloqueia 0.00077 BTC
2. Concluir pedido → Status COMPLETED
3. Saldo total: 0.1 BTC ❌ (deveria ser 0.09923)
4. Saldo bloqueado: 0.00077 BTC ❌
```

**Depois**:
```
1. Criar pedido → Bloqueia 0.00077 BTC
2. Concluir pedido → Status COMPLETED
3. Saldo total: 0.09923 BTC ✅ (debitado)
4. Saldo bloqueado: 0 BTC ✅ (desbloqueado)
```

---

## 🚀 Próximos Passos

1. ✅ **Executar script de correção** para limpar pedidos órfãos
2. ✅ **Reiniciar servidor** com código v3.0.7
3. ⏳ **Testar fluxo completo** (criar, cancelar, completar)
4. ⏳ **Monitorar logs** para confirmar desbloqueios/débitos
5. ⏳ **Validar saldo** no frontend `/collateral-balance`

---

## 📞 Troubleshooting

### Saldo Ainda Bloqueado Após Script

**Solução**:
1. Verificar logs do script para erros
2. Executar script novamente (idempotente)
3. Verificar manualmente no banco:
```sql
SELECT id, status, collateralLocked, collateralLockedAmount
FROM Order
WHERE collateralSource = 'INTERNAL_BALANCE'
  AND status IN ('CANCELLED', 'COMPLETED')
  AND collateralLocked = true;
```

### Saldo Total Não Bate

**Solução**:
1. Verificar histórico de transações: `GET /api/v1/collateral-balance/history`
2. Somar DEPOSIT - LOCK - UNLOCK - REFUND
3. Resultado deve bater com saldo atual

---

**Desenvolvido por**: Claude Code
**Revisado por**: Equipe Mktplace-P2P
**Versão do documento**: 1.0
**Data**: 25/10/2025
