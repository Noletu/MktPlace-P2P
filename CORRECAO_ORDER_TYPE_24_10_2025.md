# Correção: Confusão entre OrderType e PaymentMethod

**Data:** 24/10/2025
**Versão:** 0.3.3 → 0.3.4
**Problema:** Erro "Invalid enum value. Expected 'BUY' | 'SELL', received 'PIX'"
**Status:** ✅ Corrigido

---

## 🐛 Problema Identificado

Após implementar logs detalhados, o erro real foi revelado:

```
❌ Campo: type - Erro: Invalid enum value. Expected 'BUY' | 'SELL', received 'PIX'
```

### Causa Raiz

Havia **confusão conceitual** entre dois enums diferentes:

1. **`OrderType`** (apps/api/src/types/order.types.ts):
   - `BUY` = Usuário quer comprar crypto (pagar BRL)
   - `SELL` = Usuário quer vender crypto (receber BRL) ✅ **Este é o correto!**

2. **`PaymentMethod`** (apps/api/src/types/order.types.ts):
   - `PIX` = Receber via PIX
   - `BOLETO` = Receber via Boleto

### O Que Estava Acontecendo

**Frontend enviava:**
```json
{
  "type": "PIX",  // ❌ ERRADO - Isto é um PaymentMethod, não OrderType!
  ...
}
```

**Backend esperava:**
```json
{
  "type": "SELL",  // ✅ CORRETO - OrderType
  "paymentMethod": "PIX",  // ✅ Método de pagamento
  ...
}
```

---

## ✅ Correção Implementada

### 1. Frontend - Corrigir Envio do Campo `type`
**Arquivo:** `apps/web/app/orders/create/page.tsx:327-345`

**ANTES:**
```typescript
body: JSON.stringify({
  type: orderType, // ❌ orderType é 'PIX' ou 'BOLETO'
  cryptoType: crypto,
  // ...
})
```

**DEPOIS:**
```typescript
body: JSON.stringify({
  type: 'SELL', // ✅ Fixo - usuário sempre VENDE crypto para receber BRL
  paymentMethod: orderType, // ✅ 'PIX' ou 'BOLETO'
  cryptoType: crypto,
  // ...
})
```

**Explicação:**
- No contexto deste marketplace, o usuário **sempre está vendendo crypto**
- Ele deposita colateral em BTC/USDC/USDT
- Recebe BRL via PIX ou Boleto
- Portanto, `type` é sempre `SELL`

---

### 2. Backend - Adicionar Campo `paymentMethod` ao Schema
**Arquivo:** `apps/api/src/controllers/order.controller.ts:23`

**ADICIONADO:**
```typescript
const CreateOrderSchema = z.object({
  type: z.nativeEnum(OrderType),
  paymentMethod: z.enum(['PIX', 'BOLETO']).optional(), // ← NOVO CAMPO
  // ... outros campos
});
```

**Benefício:** Agora o backend aceita e valida o método de pagamento corretamente.

---

## 🎯 Lógica Correta do Sistema

### Fluxo do Marketplace P2P

1. **Criador do Pedido (Seller):**
   - Quer **VENDER** crypto (deposita colateral)
   - Quer **RECEBER** BRL via PIX/Boleto
   - `type: 'SELL'` ✅

2. **Comprador (Buyer - Futuro):**
   - Quer **COMPRAR** crypto
   - Vai **PAGAR** BRL via PIX/Boleto
   - `type: 'BUY'` (não implementado ainda)

### Dados Enviados Agora (Correto)

```json
{
  "type": "SELL",
  "paymentMethod": "PIX",
  "cryptoType": "BTC",
  "cryptoNetwork": "BITCOIN",
  "cryptoAmount": "0.00057048",
  "brlAmount": "333",
  "orderData": {
    "pixKey": "12345678900",
    "pixKeyType": "CPF",
    "recipientName": "Teste"
  },
  "useInternalBalance": true
}
```

---

## 📊 Arquivos Modificados

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| `apps/web/app/orders/create/page.tsx` | Fixar type='SELL' + adicionar paymentMethod | +2 |
| `apps/api/src/controllers/order.controller.ts` | Adicionar paymentMethod ao schema | +1 |

**Total:** 3 linhas modificadas em 2 arquivos

---

## 🧪 Como Testar

### 1. Reinicie o Servidor Backend
```bash
# Pare o servidor (Ctrl+C)
# Inicie novamente
./INICIAR.bat
```

### 2. Abra a Página de Criar Pedido
- URL: `http://localhost:3000/orders/create`
- Aguarde 3 segundos (preços carregarem)

### 3. Preencha o Formulário
- Valor em BRL: **333**
- Chave PIX: **12345678900**
- Nome: **Teste**

### 4. Clique em "Criar Pedido"

### 5. Resultado Esperado ✅

**Console do Servidor:**
```
📦 [ORDER] Request body: {
  "type": "SELL",  // ✅ Agora está correto!
  "paymentMethod": "PIX",
  "cryptoType": "BTC",
  ...
}

📝 [ORDER] Creating order - userId: xxx, type: SELL, crypto: BTC/BITCOIN, amount: 333 BRL, useInternalBalance: true
💰 Saldo disponível: 0.10000000 BTC
✅ Usando saldo interno - Pedido instantâneo!
```

**Navegador:**
- ✅ Alert: "Pedido criado com sucesso usando seu saldo interno!"
- ✅ Redirecionamento para página do pedido
- ✅ Pedido aparece no marketplace

---

## 🔄 Changelog

### [0.3.4] - 2025-10-24

#### 🐛 Bugfix: Confusão entre OrderType e PaymentMethod

**Problema:**
Frontend enviava `type: 'PIX'` mas backend esperava `type: 'SELL'`.

**Causa Raiz:**
Confusão entre dois conceitos:
- `OrderType` = BUY/SELL (quer comprar ou vender crypto)
- `PaymentMethod` = PIX/BOLETO (método de recebimento)

**Correção:**
- Frontend agora envia `type: 'SELL'` (fixo) + `paymentMethod: 'PIX'`
- Backend aceita campo `paymentMethod` no schema

---

## 📝 Lições Aprendidas

1. **Logs detalhados são essenciais**: Os logs implementados na v0.3.3 revelaram o problema exato imediatamente

2. **Naming é crítico**: Ter dois conceitos similares (`type` para OrderType vs `orderType` para método de pagamento) causou confusão

3. **Validação em camadas funciona**:
   - Validação frontend impediu erros óbvios
   - Logs mostraram exatamente onde falhou
   - Validação backend com mensagem clara permitiu fix rápido

4. **Enums devem ter nomes descritivos**:
   - `OrderType` vs `PaymentMethod` deixa claro a diferença
   - Variável `orderType` no frontend deveria se chamar `paymentMethod`

---

## 🎯 Próximas Melhorias Sugeridas

1. **Renomear variável no frontend**:
   ```typescript
   // ANTES
   const [orderType, setOrderType] = useState<'PIX' | 'BOLETO'>('PIX');

   // DEPOIS (sugestão)
   const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'BOLETO'>('PIX');
   ```

2. **Usar enum importado**:
   ```typescript
   import { PaymentMethod } from '@mktplace/shared';
   const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
   ```

3. **Validar paymentMethod no service**:
   - Salvar no banco de dados
   - Usar em lógica de negócio

---

**Status:** ✅ **Correção concluída**
**Teste agora:** Deve funcionar perfeitamente!
**Versão:** 0.3.4
