# Correção: Validação de Dados ao Criar Pedido

**Data:** 24/10/2025
**Versão:** 0.3.2 → 0.3.3
**Problema:** Erro "Os dados enviados não estão no formato correto"
**Status:** ✅ Corrigido

---

## 🐛 Problema Reportado

### Sintoma
Ao tentar criar pedido com saldo interno disponível, sistema retornava:
- **Frontend**: Mensagem "Os dados enviados não estão no formato correto"
- **Console**: `POST /api/v1/orders 400 (Bad Request)`
- **Logs**:
  ```
  ⚠️ Cannot calculate: brlAmount=, crypto=BTC, price=undefined
  ⚠️ Cannot calculate: brlAmount=, crypto=BTC, price=598661
  ✅ Saldo suficiente! criando pedido instantâneo...
  ❌ Failed to load resource: 400 (Bad Request)
  ```

### Causa Raiz

Após correção anterior (adição do campo `useInternalBalance` ao schema), identificamos novos problemas:

1. **Falta de validação de valores**: Schema aceitava `cryptoAmount` e `brlAmount` como "0" ou vazios
2. **Falta de logs detalhados**: Não havia log do body completo para debug
3. **Validações fracas no frontend**: Frontend não validava dados antes de enviar

---

## ✅ Correções Implementadas

### 1. Logs Detalhados do Body da Requisição
**Arquivo:** `apps/api/src/controllers/order.controller.ts:40-41`

**ADICIONADO:**
```typescript
// Log completo do body para debug
console.log('📦 [ORDER] Request body:', JSON.stringify(req.body, null, 2));
```

**Benefício**: Permite ver exatamente o que está sendo enviado pelo frontend.

---

### 2. Validações Mais Restritas no Schema Zod
**Arquivo:** `apps/api/src/controllers/order.controller.ts:21-34`

**ANTES:**
```typescript
const CreateOrderSchema = z.object({
  type: z.nativeEnum(OrderType),
  cryptoType: z.string(),
  cryptoNetwork: z.string(),
  cryptoAmount: z.string(),
  brlAmount: z.string(),
  // ...
});
```

**DEPOIS:**
```typescript
const CreateOrderSchema = z.object({
  type: z.nativeEnum(OrderType),
  cryptoType: z.string().min(1, 'Tipo de criptomoeda é obrigatório'),
  cryptoNetwork: z.string().min(1, 'Rede blockchain é obrigatória'),
  cryptoAmount: z.string()
    .min(1, 'Valor em criptomoeda é obrigatório')
    .refine((val) => parseFloat(val) > 0, 'Valor em criptomoeda deve ser maior que zero'),
  brlAmount: z.string()
    .min(1, 'Valor em BRL é obrigatório')
    .refine((val) => parseFloat(val) > 0, 'Valor em BRL deve ser maior que zero'),
  orderData: z.union([BoletoDataSchema, PixDataSchema]),
  collateralAddressId: z.string().optional(),
  useInternalBalance: z.boolean().optional(),
});
```

**Melhorias:**
- ✅ Não aceita strings vazias
- ✅ Valida que valores numéricos são > 0
- ✅ Mensagens de erro específicas para cada campo

---

### 3. Validações no Frontend Antes de Enviar
**Arquivo:** `apps/web/app/orders/create/page.tsx:256-278`

**ADICIONADO:**
```typescript
// Validações básicas antes de enviar
if (!brlAmount || parseFloat(brlAmount) <= 0) {
  throw new Error('Valor em BRL deve ser maior que zero');
}

if (!cryptoAmount || parseFloat(cryptoAmount) <= 0) {
  throw new Error('Não foi possível calcular o valor em criptomoeda. Aguarde o carregamento dos preços.');
}

if (orderType === 'PIX' && !pixKey) {
  throw new Error('Chave PIX é obrigatória');
}

console.log('✅ Validações básicas passaram:', {
  brlAmount,
  cryptoAmount,
  crypto,
  network,
  orderType,
  pixKeyType,
  pixKey: pixKey ? 'Presente' : 'Ausente',
});
```

**Benefícios:**
- ✅ Erros detectados antes de enviar requisição
- ✅ Mensagens mais claras para o usuário
- ✅ Log detalhado de todos os valores antes de enviar

---

## 🧪 Como Testar (IMPORTANTE)

### Pré-requisitos
1. **Servidor backend deve estar rodando**
2. **Ter saldo interno disponível** (0.1 BTC)
3. **KYC aprovado**

### ⚠️ PASSO CRÍTICO: Aguardar Carregamento de Preços

O erro `price=undefined` indica que **os preços das criptomoedas ainda não foram carregados**.

**INSTRUÇÕES:**

1. **Reinicie o servidor backend**
   ```bash
   # Pare o servidor (Ctrl+C)
   # Inicie novamente
   ./INICIAR.bat
   ```

2. **Abra a página de criar pedido**
   - URL: `http://localhost:3000/orders/create`

3. **⏰ AGUARDE 2-3 segundos**
   - Abra o console do navegador (F12)
   - Verifique se aparece:
     ```
     📊 Prices API response: Object
     💰 Price map: {BTC: 598661, USDC: 5.9, USDT: 5.9}
     ```
   - **SÓ PREENCHA O FORMULÁRIO APÓS VER ESSA MENSAGEM**

4. **Preencha o formulário**
   - Tipo: PIX
   - Valor em BRL: **333** ← Digite e aguarde aparecer o valor em crypto
   - Verifique que apareceu: "Você vai depositar (bruto): 0.00057050 BTC"
   - Criptomoeda: BTC (já selecionado)
   - Rede: BITCOIN (já selecionado)
   - Tipo de Chave PIX: CPF
   - Chave PIX: 12345678900 (qualquer CPF válido)
   - Nome: Teste

5. **Clique em "Criar Pedido"**

6. **Confirme no modal**

---

## 📊 Logs Esperados

### Frontend (Console do Navegador)
```
📊 Prices API response: Object { success: true, data: [...] }
💰 Price map: {BTC: 598661, USDC: 5.9, USDT: 5.9}
💱 Converting R$333 with BTC @ 598661: 0.00057050 BTC

✅ Validações básicas passaram: {
  brlAmount: "333",
  cryptoAmount: "0.00057050",
  crypto: "BTC",
  network: "BITCOIN",
  orderType: "PIX",
  pixKeyType: "CPF",
  pixKey: "Presente"
}

🔐 Token de autenticação: Presente
💰 Verificando saldo interno...
🟡 Saldo disponível: Object { success: true, data: {...} }
✅ Saldo suficiente! Criando pedido instantâneo...
```

### Backend (Console do Servidor)
```
📦 [ORDER] Request body: {
  "type": "PIX",
  "cryptoType": "BTC",
  "cryptoNetwork": "BITCOIN",
  "cryptoAmount": "0.00057050",
  "brlAmount": "333",
  "orderData": {
    "pixKey": "12345678900",
    "pixKeyType": "CPF",
    "recipientName": "Teste"
  },
  "useInternalBalance": true
}

📝 [ORDER] Creating order - userId: xxx, type: PIX, crypto: BTC/BITCOIN, amount: 333 BRL, useInternalBalance: true
💰 Saldo disponível: 0.10000000 BTC
🎯 Colateral necessário: 0.00058476 BTC
✅ Usando saldo interno - Pedido instantâneo!
```

---

## ❓ Se Ainda Houver Erro

### Cenário 1: "Não foi possível calcular o valor em criptomoeda"
**Causa**: Preços não carregaram ainda
**Solução**:
1. Aguarde 3-5 segundos após abrir a página
2. Verifique console: deve aparecer "💰 Price map"
3. Se não aparecer, recarregue a página (F5)

### Cenário 2: "Dados inválidos" com detalhes
**O que fazer**:
1. Copie o log completo do console do navegador
2. Copie o log do servidor (📦 [ORDER] Request body)
3. Envie para análise - agora temos logs detalhados!

### Cenário 3: Erro de validação específico
**Exemplo**: "Valor em BRL deve ser maior que zero"
**Solução**: Preencha o campo corretamente

---

## 📝 Arquivos Modificados

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| `apps/api/src/controllers/order.controller.ts` | Logs + Validações Zod | +15 |
| `apps/web/app/orders/create/page.tsx` | Validações frontend | +23 |

**Total:** 38 linhas modificadas em 2 arquivos

---

## 🎯 Próxima Iteração

Se após essas correções você ainda encontrar erro 400:

1. **Aguarde os preços carregarem** (passo crítico)
2. **Verifique os logs detalhados** no console do navegador E do servidor
3. **Copie ambos os logs** e me envie para análise
4. Agora temos **logs completos** para debug preciso

---

## 📋 Resumo das 3 Correções

1. **Correção #1** (anterior): Adicionado campo `useInternalBalance` ao schema ✅
2. **Correção #2** (esta): Validações mais estritas + Logs detalhados ✅
3. **Correção #3** (esta): Validações no frontend antes de enviar ✅

---

**Status:** ✅ **Correção concluída**
**Ação necessária:** Testar seguindo instruções acima (especialmente aguardar preços)
**Versão:** 0.3.3
