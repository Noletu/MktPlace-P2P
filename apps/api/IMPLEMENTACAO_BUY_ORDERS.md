# Implementacao de Ordens BUY (Segunda Via do Marketplace)

**Data:** 2026-01-28
**Última Atualização:** 2026-01-28 15:30
**Status:** Funcional - Testado e Validado ✅

---

## Resumo da Implementacao

Sistema de ordens de compra (BUY) onde usuarios sem cripto podem criar pedidos para comprar, e provedores de liquidez aceitam fornecendo o colateral.

### Fluxo BUY Order:
1. Usuario cria ordem BUY especificando quanto cripto quer comprar
2. Sistema calcula valor em BRL (com 2.5% markup)
3. Provedor aceita e deposita colateral (crypto + 1.5% fee)
4. Provedor informa dados PIX para receber pagamento
5. Comprador paga via PIX
6. Provedor confirma recebimento
7. Cripto e liberada para o comprador, fee vai para plataforma

---

## Arquivos Modificados

### Backend (apps/api)

#### 1. prisma/schema.prisma
- Adicionado campo `orderType` (String, default "SELL")
- Separa tipo de ordem (BUY/SELL) do metodo de pagamento (PIX/BOLETO)

#### 2. src/services/order.service.ts
- `createBuyOrder()` - Cria ordens de compra sem exigir colateral do criador
- `acceptBuyOrder()` - Provedor aceita ordem e deposita colateral
- `getAvailableOrders()` - Filtro por orderType (BUY/SELL/ALL)
- `calculateBuyOrderFees()` - Calculo de fees para BUY (1.5% plataforma, sem cashback)
- `calculateBuyOrderCollateral()` - Colateral = crypto * 1.015
- Corrigido typo linha 898: `orderType` -> `orderTypeFilter`

#### 3. src/services/transaction.service.ts
- `validateProof()` - Logica de transferencia para BUY orders
  - Seller = providerId (nao userId)
  - Buyer = userId (nao payerId)
- **NOVO:** Transferencia de platformFee para PlatformWallet (linhas ~306-380)
  - Deduz fee do vendedor
  - Credita na carteira da plataforma
  - Registra transacao tipo PLATFORM_FEE

#### 4. src/services/chat.service.ts
- Corrigido participantes do chat para BUY orders:
  - BUY: participant1 = userId (comprador), participant2 = providerId (provedor)
  - SELL: participant1 = userId (vendedor), participant2 = payerId (comprador)

#### 5. src/controllers/order.controller.ts
- `getOrderById()` - Adicionado `isProvider` na verificacao de acesso (linha 244)
- Permite provedor acessar ordens BUY que aceitou

#### 6. src/controllers/transaction.controller.ts
- `confirmPaymentReceived()` - Corrigido para BUY orders (linhas 327-338)
  - BUY: provedor confirma (providerId)
  - SELL: vendedor confirma (userId)

#### 7. src/routes/order.routes.ts
- POST `/:orderId/accept-buy` - Endpoint para aceitar ordens BUY

### Frontend (apps/web)

#### 1. app/marketplace/page.tsx
- Interface Order com `orderType` field
- Filtros por tipo de ordem (Todas/Vendendo/Comprando)
- Cards diferenciados para BUY orders (badge "QUER COMPRAR")
- Botao "Fornecer Liquidez" para BUY orders

#### 2. app/orders/create/page.tsx
- Toggle SELL/BUY para criar ordem
- Formulario BUY com campos simplificados
- Calculo automatico de BRL com markup 2.5%

#### 3. app/orders/[orderId]/page.tsx
- Interface Order com orderType e provider fields
- Deteccao de BUY orders via `order.orderType === 'BUY'`
- Modal para aceitar BUY orders (form PIX do provedor)
- Botoes de acao diferenciados para BUY

#### 4. app/orders/[orderId]/preview/page.tsx
- Suporte completo para preview de BUY orders
- Formulario PIX para provedor aceitar
- Resumo financeiro adaptado (colateral, BRL a receber)
- Handler `handleAcceptBuyOrder()`

#### 5. app/orders/[orderId]/dispute/new/page.tsx
- Interface Order com orderType
- Categorias de disputa adaptadas para BUY/SELL

#### 6. app/admin/orders/page.tsx
- Interface Order com orderType
- Status badges usando orderType

---

## Matematica das Fees

### SELL Order (existente):
- Colateral = cryptoAmount * 1.01 (inclui 1% cashback)
- Platform Fee = 1.5%
- Payer Reward = 1% (cashback para comprador)

### BUY Order (novo):
- Colateral = cryptoAmount * 1.015 (inclui 1.5% fee)
- Platform Fee = 1.5%
- Payer Reward = 0 (provedor ja recebe ~1% lucro no BRL)

### Exemplo BUY:
- Comprador quer: 0.01 BTC
- Cotacao: R$ 500.000/BTC
- BRL base: R$ 5.000
- BRL com markup 2.5%: R$ 5.125
- Provedor deposita: 0.01015 BTC (crypto + fee)
- Comprador recebe: 0.01 BTC
- Plataforma recebe: 0.00015 BTC (1.5%)
- Provedor recebe: R$ 5.125 (~1% lucro liquido)

---

## Bugs Corrigidos

1. **orderType vs type confusion** - Campo `type` era usado para BUY/SELL e PIX/BOLETO
2. **Marketplace 500 error** - Typo em console.log (`orderType` vs `orderTypeFilter`)
3. **403 ao acessar ordem** - Provider nao tinha permissao de acesso
4. **403 ao confirmar pagamento** - Provider nao podia confirmar recebimento
5. **Chat nao funcionava** - Participantes duplicados para BUY orders
6. **Platform fee nao transferida** - Fee ficava "perdida" no colateral
7. **totalFeesCollected nao atualizado** - Campo `totalFeesCollected` na PlatformWallet não era incrementado ao processar fees (corrigido em transaction.service.ts linha 365-372)

---

## Testes Realizados

1. ✅ Criar ordem BUY
2. ✅ Visualizar no marketplace
3. ✅ Aceitar como provedor (fornecer liquidez)
4. ✅ Enviar comprovante de pagamento
5. ✅ Confirmar recebimento como provedor
6. ✅ Completar ordem
7. ✅ Chat funcionando corretamente
8. ✅ Platform fee creditada corretamente na PlatformWallet
9. ✅ totalFeesCollected incrementado corretamente
10. ✅ Movimentação de fundos validada (comprador, provedor, plataforma)

---

## Validação de Movimentação de Fundos (28/01/2026)

### Ordem Testada: cmkyci2e30009fve23jx9n0z2
| Campo | Valor |
|-------|-------|
| Tipo | BUY |
| Crypto | 0.00199999 BTC |
| Platform Fee | 0.00003000 BTC (1.5%) |
| Colateral | 0.00202999 BTC |

### Transações Registradas:
| # | Tipo | Valor | Descrição |
|---|------|-------|-----------|
| 1 | DEDUCT | -0.00199999 | Crypto do provedor → comprador |
| 2 | CREDIT | +0.00199999 | Comprador recebeu crypto |
| 3 | PLATFORM_FEE | -0.00003000 | Fee deduzida do provedor |

### Saldos Finais:
| Carteira | Saldo BTC | Status |
|----------|-----------|--------|
| Comprador (cmkk6b9a...) | 0.10459599 | ✅ |
| Provedor (cmkk6cue...) | 0.00606702 | ✅ |
| Plataforma | 0.00003000 | ✅ |
| totalFeesCollected | 0.00003000 | ✅ |

---

## Proximos Passos

1. ~~Testar chat em novo pedido BUY~~ ✅
2. ~~Verificar platform fee sendo creditada~~ ✅
3. Testar fluxo de cancelamento para BUY orders
4. Testar disputas em BUY orders
5. Testar múltiplas ordens BUY consecutivas

---

## Comandos para Iniciar

```bash
# Terminal 1 - API
cd /home/nicode/MktPlace-P2P/apps/api
npx tsx src/index.ts

# Terminal 2 - Frontend
cd /home/nicode/MktPlace-P2P/apps/web
npm run dev
```

---

## Usuarios de Teste

- **Infinity X** (infx@gmail.com) - cmkk6b9ac00058rmx97uzzpkg
- **Infinity Y** (infy@gmail.com) - cmkk6cues000i8rmxqj64qem6
