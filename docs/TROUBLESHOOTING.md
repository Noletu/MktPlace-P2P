# Guia de Resolução de Problemas - MktPlace P2P

## Índice

1. [Problemas com Saldo Bloqueado](#problemas-com-saldo-bloqueado)
2. [Problemas com Edição de Pedidos](#problemas-com-edição-de-pedidos)
3. [Problemas com Workers](#problemas-com-workers)
4. [Problemas de Performance](#problemas-de-performance)
5. [Problemas de Banco de Dados](#problemas-de-banco-de-dados)

---

## Problemas com Saldo Bloqueado

### L Saldo bloqueado após cancelar pedido

**Sintomas**:
- Usuário cancela pedido mas saldo continua bloqueado
- `InternalBalance.lockedAmount` maior que zero sem pedidos ativos
- `InternalBalance.availableAmount` menor que deveria

**Diagnóstico**:
```bash
cd apps/api
npx tsx scripts/check-nicolas-balance.ts
```

**Causas Comuns**:
1. Falha durante execução de `unlockBalance()`
2. Exceção não tratada no método `cancelOrder()`
3. Worker de liberação não processou o pedido

**Solução**:

1. **Verificar se há pedidos com problema**:
```bash
npx tsx scripts/check-nicolas-balance.ts
```

Saída esperada:
```
    PROBLEMA IDENTIFICADO!    
Há 0.01520386 de saldo bloqueado mas NENHUM pedido ativo!
```

2. **Aplicar correção automática**:
```bash
npx tsx scripts/fix-nicolas-stuck-balance.ts
```

Saída esperada:
```
= Desbloqueando: cmhukzj1...
   Locked antes: 0.01520386
   Desbloqueando: 0.00570145
    Saldo desbloqueado com sucesso!
```

3. **Verificar correção**:
```bash
npx tsx scripts/check-nicolas-balance.ts
```

Saída esperada:
```
 Nenhum saldo bloqueado - Tudo OK!
```

**Prevenção Futura**:
- Worker de liberação agora detecta automaticamente este problema
- Logs aprimorados facilitam identificação
- Alertas automáticos a cada 24h

---

### L Worker não está liberando colateral automaticamente

**Sintomas**:
- Pedidos finalizados há mais de 60s mas saldo ainda bloqueado
- Nenhum log `[COLLATERAL WORKER]` nos logs do servidor

**Diagnóstico**:
```bash
# Verificar se worker está rodando
npx tsx scripts/check-worker-status.ts
```

**Causas Comuns**:
1. Worker não iniciou (erro no `src/index.ts`)
2. Erro no método `processLockedCollateral()`
3. Prisma não consegue acessar o banco

**Solução**:

1. **Verificar logs de inicialização**:
```bash
grep "COLLATERAL WORKER" logs/api.log | head -5
```

Deve aparecer:
```
= [COLLATERAL WORKER] Starting...
= [COLLATERAL WORKER] Started successfully (interval: 60s)
```

2. **Se não aparecer, verificar importação**:
```typescript
// Em apps/api/src/index.ts:34
import { collateralReleaseWorker } from './workers/collateral-release.worker';

// Worker deve auto-iniciar na linha 212 do arquivo
```

3. **Reiniciar servidor**:
```bash
# Parar servidor
pkill -f "npm run dev" || pkill -f "next dev"

# Iniciar novamente
cd apps/api && npm run dev
```

4. **Forçar processamento manual**:
```bash
curl -X POST http://localhost:3001/api/v1/workers/collateral-release/process-now \
  -H "Authorization: Bearer <admin-token>"
```

---

### L Colaterais órfãos (bloqueados há mais de 24h)

**Sintomas**:
- Alerta no log: `ALERT: 2 orders with collateral locked for >24h!`
- Pedidos em status PENDING/MATCHED há mais de 24h

**Diagnóstico**:
```bash
# Verificar se há alertas
grep "ALERT.*collateral" logs/api.log

# Forçar verificação manual (apenas ADMIN)
curl -X POST http://localhost:3001/api/v1/workers/collateral-release/check-orphaned \
  -H "Authorization: Bearer <admin-token>"
```

**Causas Comuns**:
1. Pedido não está expirando corretamente (worker de expiração com problema)
2. Usuário esqueceu pedido aberto
3. Bug no fluxo de cancelamento

**Solução**:

1. **Verificar status do pedido no banco**:
```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const order = await prisma.order.findUnique({
  where: { id: 'ORDER_ID_AQUI' },
});

console.log(JSON.stringify(order, null, 2));
await prisma.\$disconnect();
"
```

2. **Se pedido deveria ter expirado**:
   - Verificar `timeoutAt` está no passado
   - Verificar worker de expiração está rodando
   - Forçar expiração manualmente se necessário

3. **Se pedido é legítimo**:
   - Deixar como está (usuário vai cancelar eventualmente)
   - Worker vai liberar automaticamente quando cancelado

---

## Problemas com Edição de Pedidos

### L Não consigo editar pedido

**Sintomas**:
- Botão "Editar Pedido" não aparece
- Mensagem de erro ao tentar editar

**Diagnóstico**:
Verificar condições para edição:
```typescript
// 1. Usuário é o criador do pedido?
const isCreator = order.userId === currentUserId;

// 2. Pedido está em status PENDING?
const isPending = order.status === 'PENDING';

// Se ambos são true, botão deveria aparecer
```

**Causas Comuns**:
1. **Pedido já foi aceito** (status MATCHED) ’ Não pode mais editar
2. **Usuário não é o criador** ’ Apenas criador pode editar
3. **Pedido foi cancelado/finalizado** ’ Não pode editar

**Solução**:

Se pedido está MATCHED:
- Não é possível editar
- Usuário deve cancelar e criar novo pedido
- Aviso na interface: "Você só pode editar pedidos que ainda não foram aceitos"

Se usuário não é criador:
- Apenas criador pode editar próprio pedido
- Verificação de segurança no backend impede edição

---

### L Mudanças não estão salvando

**Sintomas**:
- Modal abre e permite editar
- Ao clicar "Salvar", nada acontece ou erro aparece

**Diagnóstico**:
```bash
# Verificar logs do backend
grep "updateOrder" logs/api.log | tail -20

# Verificar console do navegador (F12)
# Procurar por erros de rede ou validação
```

**Causas Comuns**:
1. **Validação falhando** no backend
2. **Token expirado** (401 Unauthorized)
3. **Rede/Conexão** com problema

**Solução**:

1. **Validação de dados**:
```typescript
// Tempo de expiração deve estar entre 1 e 720 horas
if (customExpirationHours < 1 || customExpirationHours > 720) {
  // Erro: "Tempo de expiração deve estar entre 1 e 720 horas"
}

// Chave PIX deve ter pelo menos 3 caracteres
if (pixKey.length < 3) {
  // Erro: "Chave PIX deve ter pelo menos 3 caracteres"
}

// Código de barras deve ter pelo menos 44 caracteres
if (barcode.length < 44) {
  // Erro: "Código de barras deve ter no mínimo 44 caracteres"
}
```

2. **Token expirado**:
```bash
# Fazer logout e login novamente
# Frontend armazena novo token
```

3. **Verificar endpoint**:
```bash
curl -X PATCH http://localhost:3001/api/v1/orders/ORDER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"customExpirationHours": 48}'
```

---

## Problemas com Workers

### L Worker não está executando

**Sintomas**:
- Nenhum log de worker nos últimos minutos
- Endpoint `/api/v1/workers/status` retorna `isRunning: false`

**Diagnóstico**:
```bash
# 1. Verificar se servidor está rodando
curl http://localhost:3001/api/v1/prices

# 2. Verificar status dos workers
npx tsx scripts/check-worker-status.ts

# 3. Verificar logs de erro
grep "error.*worker" logs/api.log -i
```

**Solução**:

1. **Reiniciar servidor**:
```bash
pkill -f "npm run dev"
cd apps/api && npm run dev
```

2. **Verificar inicialização**:
```bash
# Deve aparecer no início dos logs
grep "COLLATERAL WORKER.*Start" logs/api.log
```

3. **Se não iniciar, verificar código**:
```typescript
// Em apps/api/src/workers/collateral-release.worker.ts:211
if (process.env.NODE_ENV !== 'test') {
  collateralReleaseWorker.start();  // Deve executar
}
```

---

### L Worker está executando mas não processando

**Sintomas**:
- Logs mostram `[COLLATERAL WORKER] Execution #X`
- Mas pedidos finalizados não são processados

**Diagnóstico**:
```bash
# Verificar qual query está sendo usada
grep "Found.*orders with collateral" logs/api.log | tail -5
```

**Causas Comuns**:
1. Campo `collateralUnlockedAt` já está preenchido
2. `collateralLocked` é false (já foi desbloqueado)
3. Query está filtrando pedidos incorretamente

**Solução**:

Verificar no banco:
```sql
SELECT
  id,
  status,
  collateralLocked,
  collateralUnlockedAt,
  collateralLockedAmount
FROM Order
WHERE collateralSource = 'INTERNAL_BALANCE'
  AND status IN ('COMPLETED', 'CANCELLED', 'EXPIRED')
LIMIT 10;
```

Se `collateralLocked = true` e `collateralUnlockedAt = null`:
- Worker deveria processar mas não está
- Verificar logs de erro no método `releaseCollateral()`
- Pode haver exceção sendo silenciada

---

## Problemas de Performance

### L Servidor lento ou travando

**Sintomas**:
- Requisições demorando mais de 5s
- CPU em 100%
- Memória alta

**Diagnóstico**:
```bash
# Verificar processos Node
ps aux | grep node

# Verificar uso de memória
free -h

# Verificar logs de erro
tail -100 logs/api.log | grep -i "error\|timeout\|slow"
```

**Causas Comuns**:
1. Múltiplos servidores rodando
2. Workers consumindo muita CPU
3. Query lenta no banco de dados

**Solução**:

1. **Matar processos duplicados**:
```bash
pkill -f "npm run dev"
pkill -f "next dev"
```

2. **Reiniciar limpo**:
```bash
cd apps/api && npm run dev &
cd apps/web && npm run dev &
```

3. **Verificar queries lentas**:
```bash
# Se usando SQLite, verificar tamanho do banco
ls -lh apps/api/prisma/dev.db

# Se maior que 100MB, considerar limpeza
npm run db:clean
```

---

## Problemas de Banco de Dados

### L Erro "database is locked"

**Sintomas**:
- `SqliteError: database is locked`
- Operações falhando aleatoriamente

**Causas**: SQLite não suporta muitas escritas concorrentes

**Solução**:

1. **Temporária** - Aumentar timeout:
```typescript
// Em prisma/schema.prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db?connection_limit=1&socket_timeout=10"
}
```

2. **Definitiva** - Migrar para PostgreSQL (produção)

---

### L Schema desatualizado

**Sintomas**:
- Erro: `Unknown field 'collateralUnlockedAt'`
- Erro: `Table 'Order' does not have column 'X'`

**Solução**:
```bash
cd apps/api

# Aplicar migrações pendentes
npx prisma migrate deploy

# Ou resetar banco (CUIDADO: apaga dados)
npx prisma migrate reset

# Regenerar cliente
npx prisma generate
```

---

## Comandos Úteis

### Diagnóstico Geral
```bash
# Status dos workers
npx tsx scripts/check-worker-status.ts

# Verificar saldo de usuário
npx tsx scripts/check-nicolas-balance.ts

# Logs em tempo real
tail -f logs/api.log
```

### Correção de Problemas
```bash
# Corrigir saldo bloqueado
npx tsx scripts/fix-nicolas-stuck-balance.ts

# Limpar banco de dados
npm run db:clean

# Reiniciar workers
curl -X POST http://localhost:3001/api/v1/workers/collateral-release/process-now \
  -H "Authorization: Bearer <admin-token>"
```

### Monitoramento
```bash
# Ver logs de worker
grep "COLLATERAL WORKER" logs/api.log | tail -20

# Ver alertas
grep "ALERT" logs/api.log

# Ver erros
grep "ERROR\|error" logs/api.log | tail -50
```

---

## Contato para Suporte

Se o problema persistir após seguir este guia:

1. **Coletar informações**:
   - Logs relevantes (`logs/api.log`)
   - Versão do Node.js (`node --version`)
   - Sistema operacional
   - Passos para reproduzir o problema

2. **Criar issue no GitHub**:
   - Descrever problema detalhadamente
   - Anexar logs (remover informações sensíveis)
   - Indicar o que já foi tentado

3. **Informações úteis**:
   - Estado do banco (`du -h prisma/dev.db`)
   - Número de pedidos ativos
   - Última vez que funcionou corretamente

---

**Última Atualização**: 2025-11-12
**Versão**: 1.0.0
