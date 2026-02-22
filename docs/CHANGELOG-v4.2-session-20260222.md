# Changelog - Sessao v4.2 (22/02/2026)

## Branch: `feature/v4.2-buy-swap`

---

## Resumo da Sessao

Nesta sessao foram feitos ajustes na pagina de collateral-balance e uma auditoria completa do fluxo de fees da plataforma.

---

## 1. FIX: Totais da pagina /collateral-balance convertidos para BRL

**Arquivo:** `apps/web/app/collateral-balance/page.tsx`

### Problema
Os 3 cards de resumo no topo (Total Disponivel, Total Bloqueado, Saldo Total) somavam valores brutos de criptos diferentes diretamente (ex: `10000 USDC + 0.0985 BTC = 10000.09850739`), o que nao faz sentido financeiro.

### Solucao
Convertidos os totais para BRL usando cotacoes da API `/prices`, seguindo o mesmo padrao que ja funciona no `CollateralSummaryWidget` do dashboard.

### Mudancas:
1. **Novo state `prices`** - Armazena cotacoes BRL de cada crypto
2. **Nova funcao `fetchPrices()`** - Busca cotacoes da API `/api/v1/prices`, chamada no `useEffect` inicial
3. **Calculo de totais convertido para BRL** - Cada wallet agora multiplica seu saldo pela cotacao da crypto correspondente antes de somar
4. **Display com `formatBRL()`** - Cards mostram valores formatados como `R$ 86.131,90` em vez de `10000.09850739`

### Resultado:
- "Total Disponivel" -> `R$ 86.131,90` (em vez de `10000.09850739`)
- "Total Bloqueado" -> `R$ 0,00` (em vez de `0.00000000`)
- "Saldo Total" = Total Disponivel + Total Bloqueado
- Cards individuais por crypto (USDC, BTC) continuam mostrando valores em crypto (sem alteracao)

### Bonus: Correcao de porta
- URLs hardcoded corrigidas de `localhost:3001` para `localhost:3002` (porta correta da API)

---

## 2. AUDITORIA: Fluxo de Fees entre Partes -> Platform Wallet

### Resultado: FEES CORRETAS - Funcionando como esperado

### Fluxo SELL Order (Vendedor -> Plataforma)

| Etapa | Acao | Arquivo | Linhas |
|-------|------|---------|--------|
| Criacao | `platformFee = 1.5%`, `payerReward = 1%`, `totalFee = 2.5%` | `order.service.ts` | 27-64 |
| Colateral | Vendedor locka `cryptoAmount + 1% (cashback)` | `order.service.ts` | 73-78 |
| Completion | Deduz `crypto + reward` do vendedor, credita no comprador | `transaction.service.ts` | 213-304 |
| Fee | Deduz `1.5%` do vendedor -> credita na `platformWallet` | `transaction.service.ts` | 309-413 |
| Audit | Registra `WalletTransaction` tipo `PLATFORM_FEE` | `transaction.service.ts` | 390-409 |

**Resultado liquido SELL:**
- Vendedor perde: `cryptoAmount + 2.5%`
- Comprador ganha: `cryptoAmount + 1%` (cashback)
- Plataforma ganha: `1.5%` em crypto

### Fluxo BUY Order (Provedor -> Plataforma)

| Etapa | Acao | Arquivo | Linhas |
|-------|------|---------|--------|
| Criacao | `platformFee = 1.5%`, `payerReward = 0`, BRL com markup `2.5%` | `order.service.ts` | 101-116 |
| Colateral | Provider locka `cryptoAmount + 1.5%` | `order.service.ts` | 88-93 |
| Completion | Mesmo fluxo - transfere crypto, depois deduz fee | `transaction.service.ts` | 213-413 |

**Resultado liquido BUY:**
- Provider perde: `cryptoAmount + 1.5%` em crypto, ganha BRL com `2.5%` markup (~1% lucro)
- Comprador ganha: `cryptoAmount` exato (sem cashback)
- Plataforma ganha: `1.5%` em crypto

### Pontos Fortes Verificados
- Usa `BigNumber` para precisao decimal (sem erros de floating point)
- Tudo roda em transacao Prisma atomica (timeout 60s)
- WalletTransaction tipo `PLATFORM_FEE` registrado para auditoria
- `totalFeesCollected` atualizado na `platformWallet`
- Desconto de cupom e respeitado (salvo no Order na criacao, usado na completion)

### Constantes de Fees

```typescript
// apps/api/src/types/order.types.ts
FEE_CONFIG = {
  PLATFORM_FEE_PERCENTAGE: 0.015,  // 1.5%
  PAYER_REWARD_PERCENTAGE: 0.01,   // 1%
  TOTAL_FEE_PERCENTAGE: 0.025,     // 2.5%
};

BUY_ORDER_CONFIG = {
  BRL_MARKUP_PERCENTAGE: 0.025,     // 2.5% markup no BRL
  PROVIDER_COLLATERAL_FEE: 0.015,   // 1.5% extra no colateral
};
```

### Observacoes (nao sao bugs)
1. **`paidByPlatform`**: Campo existe no schema mas nunca e ativado (feature de timeout futura - TODO)
2. **BUY order markup vs fee**: Provider paga 1.5% crypto, recebe 2.5% BRL markup. O ~1% de lucro e intencional (incentivo de liquidez)

---

## Arquivos Chave de Referencia

| Funcionalidade | Arquivo |
|----------------|---------|
| Calculo de fees SELL | `apps/api/src/services/order.service.ts:27-64` |
| Calculo de fees BUY | `apps/api/src/services/order.service.ts:101-116` |
| Colateral SELL | `apps/api/src/services/order.service.ts:73-78` |
| Colateral BUY | `apps/api/src/services/order.service.ts:88-93` |
| Settlement completo | `apps/api/src/services/transaction.service.ts:213-413` |
| Platform wallet service | `apps/api/src/services/platformWallet.service.ts` |
| Finance stats | `apps/api/src/services/finance.service.ts` |
| Fee constants | `apps/api/src/types/order.types.ts:64-77` |
| Collateral page (BRL fix) | `apps/web/app/collateral-balance/page.tsx` |
| Dashboard widget (referencia) | `apps/web/components/dashboard/CollateralSummaryWidget.tsx` |
