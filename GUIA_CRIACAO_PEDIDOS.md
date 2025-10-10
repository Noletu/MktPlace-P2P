# 📝 Guia de Criação de Pedidos - MktPlace P2P

## ❌ Problema: "Dados inválidos"

Você está recebendo este erro porque a API espera um formato específico de dados. Este guia mostra exatamente como criar pedidos corretamente.

---

## 📋 Estrutura Básica do Pedido

Todos os pedidos devem conter:

```json
{
  "type": "BUY" ou "SELL",
  "cryptoType": "BTC" | "ETH" | "USDT" | "USDC" | "XMR" | "ZEC",
  "cryptoNetwork": "BITCOIN" | "ETHEREUM" | "POLYGON" | "BASE" | "ARBITRUM" | "TRC20" | "MONERO" | "ZCASH",
  "cryptoAmount": "100",  // String com quantidade de crypto
  "brlAmount": "550.00",   // String com valor em BRL
  "orderData": { ... },    // Dados do boleto OU PIX (veja abaixo)
  "collateralAddressId": "opcional"  // ID do colateral (opcional)
}
```

---

## 💳 Pedido com BOLETO

### Campos Obrigatórios:

| Campo | Tipo | Validação | Descrição |
|-------|------|-----------|-----------|
| `barcode` | string | mínimo 44 caracteres | Código de barras do boleto |
| `dueDate` | string | formato YYYY-MM-DD | Data de vencimento |
| `recipientName` | string | mínimo 3 caracteres | Nome do beneficiário |
| `recipientDocument` | string | mínimo 11 caracteres | CPF/CNPJ do beneficiário |

### ✅ Exemplo Correto - Boleto:

```json
{
  "type": "BUY",
  "cryptoType": "USDT",
  "cryptoNetwork": "POLYGON",
  "cryptoAmount": "100",
  "brlAmount": "550.00",
  "orderData": {
    "barcode": "34191790010104351004791020150008291070026000",
    "dueDate": "2025-10-16",
    "recipientName": "João Silva",
    "recipientDocument": "12345678901"
  }
}
```

### ❌ Exemplo Incorreto - Boleto:

```json
{
  "type": "BUY",
  "cryptoType": "USDT",
  "cryptoAmount": "100",
  "brlAmount": "550.00",
  "paymentMethod": {  // ❌ ERRADO! Deve ser "orderData"
    "type": "BOLETO",
    "barcode": "123456"  // ❌ ERRADO! Muito curto (< 44 chars)
  }
}
```

**Problemas:**
1. Campo `paymentMethod` não existe - deve ser `orderData`
2. Código de barras muito curto (< 44 caracteres)
3. Falta `cryptoNetwork`
4. Falta `dueDate`
5. Falta `recipientName`
6. Falta `recipientDocument`

---

## 🔑 Pedido com PIX

### Campos Obrigatórios:

| Campo | Tipo | Validação | Descrição |
|-------|------|-----------|-----------|
| `pixKey` | string | mínimo 3 caracteres | Chave PIX |
| `pixKeyType` | string | CPF, CNPJ, EMAIL, PHONE, RANDOM | Tipo da chave PIX |
| `recipientName` | string | mínimo 3 caracteres | Nome do beneficiário |

### ✅ Exemplo Correto - PIX:

```json
{
  "type": "SELL",
  "cryptoType": "USDT",
  "cryptoNetwork": "POLYGON",
  "cryptoAmount": "50",
  "brlAmount": "275.00",
  "orderData": {
    "pixKey": "11999999999",
    "pixKeyType": "PHONE",
    "recipientName": "Maria Santos"
  }
}
```

### ❌ Exemplo Incorreto - PIX:

```json
{
  "type": "SELL",
  "cryptoAmount": "50",
  "brlAmount": "275.00",
  "orderData": {
    "pixKey": "11999999999",
    "pixKeyType": "CELULAR"  // ❌ ERRADO! Deve ser "PHONE"
  }
}
```

**Problemas:**
1. Falta `cryptoType`
2. Falta `cryptoNetwork`
3. Valor de `pixKeyType` inválido - deve ser um de: CPF, CNPJ, EMAIL, PHONE, RANDOM
4. Falta `recipientName`

---

## 🔐 Tipos de Chave PIX Válidos

```typescript
'CPF'    // Ex: "12345678901"
'CNPJ'   // Ex: "12345678000190"
'EMAIL'  // Ex: "usuario@example.com"
'PHONE'  // Ex: "11999999999"
'RANDOM' // Ex: "550e8400-e29b-41d4-a716-446655440000"
```

---

## 💰 Tipos de Pedido

### BUY (Compra)
```json
{
  "type": "BUY",
  // Usuário quer comprar crypto com BRL
  // Vai RECEBER crypto após pagar via boleto/PIX
  ...
}
```

### SELL (Venda)
```json
{
  "type": "SELL",
  // Usuário quer vender crypto por BRL
  // Vai RECEBER BRL via boleto/PIX após entregar crypto
  ...
}
```

---

## 🌐 Redes Suportadas

| Crypto | Redes Válidas |
|--------|---------------|
| BTC | BITCOIN |
| ETH | ETHEREUM, BASE, ARBITRUM |
| USDT | ETHEREUM, POLYGON, BASE, ARBITRUM, TRC20 |
| USDC | ETHEREUM, POLYGON, BASE, ARBITRUM |
| XMR | MONERO |
| ZEC | ZCASH |

---

## 📡 Como Fazer a Requisição

### cURL:

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "type": "BUY",
    "cryptoType": "USDT",
    "cryptoNetwork": "POLYGON",
    "cryptoAmount": "100",
    "brlAmount": "550.00",
    "orderData": {
      "barcode": "34191790010104351004791020150008291070026000",
      "dueDate": "2025-10-16",
      "recipientName": "João Silva",
      "recipientDocument": "12345678901"
    }
  }'
```

### JavaScript/TypeScript:

```typescript
const createOrder = async (token: string) => {
  const response = await fetch('http://localhost:3001/api/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'BUY',
      cryptoType: 'USDT',
      cryptoNetwork: 'POLYGON',
      cryptoAmount: '100',
      brlAmount: '550.00',
      orderData: {
        barcode: '34191790010104351004791020150008291070026000',
        dueDate: '2025-10-16',
        recipientName: 'João Silva',
        recipientDocument: '12345678901'
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Erro:', error);
    return;
  }

  const data = await response.json();
  console.log('Pedido criado:', data);
};
```

---

## ⚠️ Erros Comuns e Soluções

### Erro: "Código de barras do boleto deve ter no mínimo 44 caracteres"
**Solução:** Verifique se o código de barras tem exatamente 44 ou 47 dígitos

### Erro: "Data de vencimento inválida"
**Solução:** Use o formato `YYYY-MM-DD` (ex: `2025-10-16`)

### Erro: "Chave PIX é obrigatória"
**Solução:** Adicione o campo `pixKey` no `orderData`

### Erro: "Nome do beneficiário é obrigatório"
**Solução:** Adicione o campo `recipientName` com pelo menos 3 caracteres

### Erro: "Invalid enum value"
**Solução:** Verifique se `pixKeyType` é um dos valores válidos: CPF, CNPJ, EMAIL, PHONE, RANDOM

---

## 🎯 Checklist de Validação

Antes de enviar sua requisição, verifique:

- [ ] Campo `type` é "BUY" ou "SELL"
- [ ] Campo `cryptoType` está correto (BTC, ETH, USDT, etc)
- [ ] Campo `cryptoNetwork` corresponde ao crypto escolhido
- [ ] Campos `cryptoAmount` e `brlAmount` são strings (não numbers!)
- [ ] Campo `orderData` existe (não `paymentMethod`!)
- [ ] Para Boleto:
  - [ ] `barcode` tem 44+ caracteres
  - [ ] `dueDate` está no formato YYYY-MM-DD
  - [ ] `recipientName` tem 3+ caracteres
  - [ ] `recipientDocument` tem 11+ caracteres
- [ ] Para PIX:
  - [ ] `pixKey` tem 3+ caracteres
  - [ ] `pixKeyType` é CPF, CNPJ, EMAIL, PHONE ou RANDOM
  - [ ] `recipientName` tem 3+ caracteres
- [ ] Token JWT está no header Authorization
- [ ] Content-Type é application/json

---

## 🧪 Testando no Terminal

### 1. Faça login e pegue o token:

```bash
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "seu@email.com", "password": "SuaSenha123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')
echo "Token: $TOKEN"
```

### 2. Crie um pedido:

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "BUY",
    "cryptoType": "USDT",
    "cryptoNetwork": "POLYGON",
    "cryptoAmount": "100",
    "brlAmount": "550.00",
    "orderData": {
      "barcode": "34191790010104351004791020150008291070026000",
      "dueDate": "2025-10-16",
      "recipientName": "João Silva",
      "recipientDocument": "12345678901"
    }
  }' | jq
```

---

## 📞 Ainda com Problemas?

Se você ainda está recebendo "dados inválidos", copie a resposta de erro completa. A API retorna detalhes do erro Zod:

```json
{
  "error": "Dados inválidos",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["orderData", "barcode"],
      "message": "Required"
    }
  ]
}
```

O campo `details` mostra exatamente qual campo está faltando ou inválido!

---

**💡 Dica:** Use o campo `details` da resposta de erro para identificar exatamente o que está errado com seus dados.
