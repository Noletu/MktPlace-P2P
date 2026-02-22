# Changelog: Banner de Identificacao de Papel

**Data:** 2026-01-27
**Commit:** `feat(orders): adiciona banner de identificacao de papel (comprador/vendedor)`
**Arquivo modificado:** `apps/web/app/orders/[orderId]/page.tsx`

---

## Problema Identificado

Na tela de detalhes do pedido (`/orders/[orderId]`), ambos os lados (comprador e vendedor) viam informacoes confusas. Nao ficava claro qual era o papel de cada usuario na negociacao.

**Situacao anterior:**
- O codigo diferenciava `isCreator` (vendedor) de `isPayer` (comprador)
- Mas a UI nao mostrava claramente "VOCE E O COMPRADOR" ou "VOCE E O VENDEDOR"
- As secoes de "Resumo Financeiro" eram tecnicas demais

---

## Solucao Implementada

### Banner de Identificacao de Papel

Adicionado um banner proeminente logo apos o header do pedido (antes das abas) que mostra claramente o papel do usuario.

### Para COMPRADOR (isPayer):
```
+----------------------------------------------------------+
|  🛒 VOCE E O COMPRADOR                                   |
|  Voce paga R$ X,XX no PIX e recebe Y.XXXXXXXX BTC       |
|  (inclui 1% cashback)                                    |
+----------------------------------------------------------+
```
- **Cor:** Azul (`bg-blue-50`, `border-blue-300`)
- **Icone:** 🛒
- **Informacoes:** Valor a pagar + cripto a receber com cashback

### Para VENDEDOR (isCreator):
```
+----------------------------------------------------------+
|  💰 VOCE E O VENDEDOR                                    |
|  Voce recebera R$ X,XX via PIX                          |
|  Seu colateral de Y BTC sera liberado                   |
|  (inclui 2.5% fee: 1.5% plataforma + 1% cashback)       |
+----------------------------------------------------------+
```
- **Cor:** Verde (`bg-green-50`, `border-green-300`)
- **Icone:** 💰
- **Informacoes:** Valor a receber + detalhes do colateral e fees

---

## Codigo Adicionado

Localizado nas linhas 1186-1216 do arquivo `page.tsx`:

```tsx
{/* Banner de Identificacao de Papel */}
{order && currentUserId && (isCreator || isPayer) && (
  <div className={`mb-6 p-4 rounded-lg border-2 ${
    isPayer
      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
      : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
  }`}>
    <div className="flex items-center gap-3">
      <span className="text-3xl">{isPayer ? '🛒' : '💰'}</span>
      <div>
        <h2 className={`text-xl font-bold ${
          isPayer
            ? 'text-blue-800 dark:text-blue-200'
            : 'text-green-800 dark:text-green-200'
        }`}>
          {isPayer ? 'VOCE E O COMPRADOR' : 'VOCE E O VENDEDOR'}
        </h2>
        <p className={`text-sm ${
          isPayer
            ? 'text-blue-700 dark:text-blue-300'
            : 'text-green-700 dark:text-green-300'
        }`}>
          {isPayer
            ? `Voce paga ${formatBRL(order.brlAmount)} no ${paymentMethod} e recebe ${(parseFloat(order.cryptoAmount) + parseFloat(order.payerReward)).toFixed(8)} ${order.cryptoType} (inclui 1% cashback)`
            : `Voce recebera ${formatBRL(order.brlAmount)} via ${paymentMethod}. Seu colateral de ${(parseFloat(order.cryptoAmount) + parseFloat(order.totalFee)).toFixed(8)} ${order.cryptoType} sera liberado (inclui 2.5% fee: 1.5% plataforma + 1% cashback)`
          }
        </p>
      </div>
    </div>
  </div>
)}
```

---

## Condicoes de Exibicao

O banner so aparece quando:
1. `order` existe (pedido carregado)
2. `currentUserId` esta definido (usuario logado, carregado do localStorage)
3. Usuario e `isCreator` OU `isPayer` (participante da transacao)

---

## Temas Suportados

### Light Mode:
- Comprador: `bg-blue-50`, `border-blue-300`, texto `blue-700/800`
- Vendedor: `bg-green-50`, `border-green-300`, texto `green-700/800`

### Dark Mode:
- Comprador: `bg-blue-900/20`, `border-blue-700`, texto `blue-200/300`
- Vendedor: `bg-green-900/20`, `border-green-700`, texto `green-200/300`

---

## Verificacao

Para testar:

1. **Logar como Comprador** (usuario que aceitou o pedido):
   - Deve ver banner azul "VOCE E O COMPRADOR"
   - Mensagem: "Voce paga R$ X no PIX e recebe Y BTC (inclui 1% cashback)"

2. **Logar como Vendedor** (usuario que criou o pedido):
   - Deve ver banner verde "VOCE E O VENDEDOR"
   - Mensagem: "Voce recebera R$ X via PIX. Seu colateral de Y BTC sera liberado..."

3. **Verificar** que o banner aparece apos o match (status MATCHED ou posterior)

---

## Glossario

- `isCreator` = vendedor (quem criou o pedido e depositou colateral)
- `isPayer` = comprador (quem aceitou o pedido e vai pagar o PIX)
- `payerReward` = cashback de 1% que o comprador recebe
- `totalFee` = taxa total de 2.5% (1.5% plataforma + 1% cashback)
