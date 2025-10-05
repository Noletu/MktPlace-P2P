# 🧪 GUIA DE TESTE MANUAL - MktPlace P2P v0.3.0

**Data:** 2025-10-05
**Status:** Correções de Cookies Aplicadas ✅

---

## ✅ CORREÇÕES IMPLEMENTADAS

Foram corrigidos **8 arquivos frontend** que estavam usando `localStorage` em vez de **HttpOnly cookies**:

1. ✅ `apps/web/app/dashboard/page.tsx`
2. ✅ `apps/web/app/wallets/page.tsx`
3. ✅ `apps/web/app/marketplace/page.tsx`
4. ✅ `apps/web/app/orders/create/page.tsx`
5. ✅ `apps/web/components/forms/KYCLevel1Form.tsx`
6. ✅ `apps/web/app/orders/my-orders/page.tsx`
7. ✅ `apps/web/app/orders/[orderId]/page.tsx`
8. ✅ `apps/web/app/profile/page.tsx`

**Mudanças aplicadas:**
- ❌ REMOVIDO: `localStorage.getItem('token')` + `Authorization: Bearer ${token}`
- ✅ ADICIONADO: `credentials: 'include'` (envia cookies HttpOnly automaticamente)

---

## 🚀 PASSO 1: Iniciar Servidores

### Terminal 1 - Backend API

```bash
cd "C:\Projects\MktPlace-P2P\apps\api"
npm run dev
```

**Resposta esperada:**
```
⚡️ [server]: Server is running at http://localhost:3001
🚀 [server]: Mktplace da Liberdade API v0.1.0
```

**Verificar Health:**
```bash
curl http://localhost:3001/health
```

**Resposta:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-05...",
  "service": "Mktplace da Liberdade API"
}
```

### Terminal 2 - Frontend Next.js

```bash
cd "C:\Projects\MktPlace-P2P\apps\web"
npm run dev
```

**Acessar:** http://localhost:3000

---

## 🧪 PASSO 2: Teste Completo do Fluxo

### Teste 1: Criar Conta

1. Abrir http://localhost:3000
2. Clicar em **"Criar Conta"** ou acessar http://localhost:3000/register
3. Preencher formulário:
   - **Nome:** João da Silva
   - **Email:** joao@teste.com
   - **CPF:** `11144477735` (CPF válido)
   - **Telefone:** 11987654321 (opcional)
   - **Senha:** `MinhaSenha@123!` (senha forte obrigatória)

**Resultado esperado:**
- ✅ Mensagem: "Usuário registrado com sucesso"
- ✅ Redirecionamento para `/dashboard`
- ✅ DevTools → Application → Cookies → Deve ver:
  - `accessToken` (HttpOnly ✅, Secure ⚠️ apenas em prod, SameSite=Lax)
  - `refreshToken` (HttpOnly ✅)

### Teste 2: Verificar Cookies (Segurança)

**Abrir DevTools → Console:**
```javascript
document.cookie
```

**Resultado esperado:**
- ✅ String vazia ou outros cookies (NÃO deve mostrar `accessToken` ou `refreshToken`)
- ✅ Isso prova que os cookies são **HttpOnly** (JavaScript não consegue acessá-los)

### Teste 3: Dashboard

**Verificar que aparece:**
- ✅ Nome do usuário
- ✅ Email
- ✅ CPF
- ✅ Nível KYC: `NONE`
- ✅ Botão "Completar KYC Level 1"
- ✅ Opções: Ver Carteiras, Ver Marketplace, Criar Pedido

**Abrir DevTools → Network:**
- ✅ Requisição para `/api/v1/auth/me`
- ✅ Request Headers → `Cookie: accessToken=...` (enviado automaticamente)
- ✅ NÃO deve ter `Authorization: Bearer ...` no header

### Teste 4: Completar KYC Level 1

1. Clicar em **"Completar KYC Level 1"**
2. Preencher:
   - **Nome Completo:** João da Silva
   - **Data de Nascimento:** 01/01/1990
   - **CEP:** `01001-000` (deve buscar endereço automaticamente)
   - **Rua, Número, Bairro, Cidade, UF:** (preenchidos automaticamente)
   - **Número:** 123
   - **Complemento:** Apto 45 (opcional)

**Resultado esperado:**
- ✅ Mensagem: "KYC Level 1 Enviado com Sucesso!"
- ✅ "Seu limite de transação agora é de R$ 500,00"
- ✅ Redirecionamento para `/dashboard`
- ✅ Dashboard mostra **Nível KYC: LEVEL_1**

### Teste 5: Adicionar Carteira BTC

1. Clicar em **"Ver Carteiras"**
2. Clicar em **"+ Nova Carteira"**
3. Preencher:
   - **Criptomoeda:** Bitcoin (BTC)
   - **Rede:** BITCOIN
   - **Endereço:** `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh`

**Resultado esperado:**
- ✅ Carteira adicionada com sucesso
- ✅ Lista mostra a carteira BTC
- ✅ Saldo: 0.00000000 BTC

### Teste 6: Criar Pedido PIX

1. Clicar em **"Criar Pedido"** ou **"Ver Marketplace"** → **"+ Criar Pedido"**
2. Selecionar **"PIX"**
3. Preencher:
   - **Valor em BRL:** 100.00
   - **Criptomoeda:** Bitcoin (BTC)
   - **Rede:** BITCOIN
   - **Tipo de Chave PIX:** CPF
   - **Chave PIX:** `11144477735` (seu CPF)
   - **Nome do Beneficiário:** João da Silva

**Resumo esperado:**
- Valor em BRL: R$ 100.00
- Você receberá (bruto): ~0.0003 BTC (varia com cotação)
- Taxa da plataforma (1.5%): ~0.0000045 BTC
- Recompensa do pagador (1%): ~0.000003 BTC
- Taxa total (2.5%): ~0.0000075 BTC
- **Você receberá (líquido):** ~0.0002925 BTC

**Clicar em "Criar Pedido":**
- ✅ Mensagem: "Pedido criado com sucesso! Aguardando matching..."
- ✅ Redirecionamento para `/orders/my-orders`

### Teste 7: Ver Pedido no Marketplace

1. Voltar ao **Dashboard**
2. Clicar em **"Ver Marketplace"**

**Resultado esperado:**
- ✅ Lista mostra o pedido criado (se estiver PENDING)
- ✅ Mostra:
  - Tipo: PIX
  - Valor: R$ 100.00
  - Você receberá: ~0.000003 BTC (recompensa de 1%)
  - Vendedor: João da Silva
  - Score: 0
  - Botão "Aceitar e Pagar"

### Teste 8: Criar Segundo Usuário (Matching)

**Para testar matching completo:**

1. Abrir aba anônima/privada
2. Acessar http://localhost:3000/register
3. Criar segundo usuário:
   - Email: `maria@teste.com`
   - CPF: `52599927003` (CPF válido diferente)
   - Senha: `SenhaForte@456!`
4. Completar KYC Level 1
5. Acessar Marketplace
6. **Aceitar pedido** de João
7. Fazer pagamento PIX para a chave `11144477735`
8. Voltar para página do pedido: `/orders/[orderId]`
9. **Upload de comprovante** (imagem PNG/JPG do PIX)

**Resultado esperado:**
- ✅ Status muda de PENDING → MATCHED → PAYMENT_SENT → VALIDATING

### Teste 9: Meus Pedidos

1. Voltar ao Dashboard
2. Clicar em **"Meus Pedidos"**

**Resultado esperado:**
- ✅ Lista mostra todos os pedidos criados
- ✅ Filtros: TODOS | ATIVOS | COMPLETOS
- ✅ Status coloridos:
  - Amarelo: PENDING
  - Azul: MATCHED
  - Roxo: PAYMENT_SENT
  - Laranja: VALIDATING
  - Verde: COMPLETED
  - Vermelho: DISPUTED
  - Cinza: CANCELLED/TIMEOUT

### Teste 10: Logout

1. Voltar ao Dashboard
2. Clicar em **"Sair"**

**Resultado esperado:**
- ✅ Redirecionamento para página inicial `/`
- ✅ DevTools → Application → Cookies → Cookies `accessToken` e `refreshToken` foram **limpos**
- ✅ Tentar acessar `/dashboard` redireciona para `/login`

### Teste 11: Login Novamente

1. Acessar http://localhost:3000/login
2. Logar com:
   - Email: `joao@teste.com`
   - Senha: `MinhaSenha@123!`

**Resultado esperado:**
- ✅ Login bem-sucedido
- ✅ Redirecionamento para `/dashboard`
- ✅ Todos os dados do usuário carregados
- ✅ Novos cookies `accessToken` e `refreshToken` gerados

---

## 🔍 PASSO 3: Verificação de Segurança

### 1. HttpOnly Cookies (CRÍTICO)

**DevTools → Application → Cookies → localhost:3000**

| Cookie | Value | HttpOnly | Secure (Prod) | SameSite |
|--------|-------|----------|---------------|----------|
| `accessToken` | `eyJhbG...` | ✅ Yes | ⚠️ No (dev) | Lax |
| `refreshToken` | `eyJhbG...` | ✅ Yes | ⚠️ No (dev) | Lax |

**Teste XSS (DevTools → Console):**
```javascript
document.cookie
```
**Resultado esperado:** NÃO deve mostrar `accessToken` ou `refreshToken`

### 2. CORS Whitelist

**Teste com origem não autorizada:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://site-malicioso.com" \
  -d '{"email":"joao@teste.com","password":"MinhaSenha@123!"}'
```

**Resultado esperado:**
```
Error: Not allowed by CORS
```

### 3. Senha Forte

**Teste senha fraca:**
1. Tentar registrar com senha: `senha123`

**Resultado esperado:**
```json
{
  "success": false,
  "error": "Dados inválidos",
  "details": [
    {"message": "Senha deve conter pelo menos uma letra maiúscula"},
    {"message": "Senha deve conter pelo menos um caractere especial"}
  ]
}
```

### 4. CPF Válido

**Teste CPF inválido:**
1. Tentar registrar com CPF: `12345678900` (dígitos verificadores errados)

**Resultado esperado:**
```json
{
  "success": false,
  "error": "Dados inválidos",
  "details": [
    {"message": "CPF inválido (dígitos verificadores incorretos)"}
  ]
}
```

---

## ✅ CHECKLIST DE FUNCIONALIDADES

### Autenticação
- [ ] Registro de usuário com senha forte
- [ ] Validação de CPF completa (dígitos verificadores)
- [ ] Login com HttpOnly cookies
- [ ] Dashboard autenticado
- [ ] Logout com revogação de cookies
- [ ] Proteção contra XSS (cookies inacessíveis via JS)

### KYC
- [ ] KYC Level 1 (endereço completo)
- [ ] Busca automática de CEP (ViaCEP API)
- [ ] Limite de transação atualizado (R$500)

### Carteiras
- [ ] Adicionar carteira (BTC, ETH, USDC, USDT, XMR, ZEC)
- [ ] Listar carteiras
- [ ] Desativar carteira
- [ ] Saldo exibido corretamente

### Pedidos (Orders)
- [ ] Criar pedido PIX
- [ ] Criar pedido Boleto
- [ ] Listar marketplace (pedidos disponíveis)
- [ ] Filtros (PIX, Boleto, Todos)
- [ ] Cálculo de fees (plataforma 1.5%, pagador 1%)
- [ ] Listar meus pedidos
- [ ] Filtros (Ativos, Completos, Todos)

### Matching
- [ ] Aceitar pedido (match)
- [ ] Status muda para MATCHED
- [ ] Upload de comprovante
- [ ] Status muda para PAYMENT_SENT → VALIDATING

### Profile
- [ ] Ver perfil completo
- [ ] Ver status KYC
- [ ] Ver limite de transação

---

## 🐛 TROUBLESHOOTING

### Erro: Dashboard não carrega

**Causa:** Cookies não estão sendo enviados

**Solução:**
1. Verificar se `credentials: 'include'` está no fetch
2. Limpar cookies: DevTools → Application → Clear all cookies
3. Fazer logout e login novamente

### Erro: "Token não fornecido"

**Causa:** Request não está enviando cookies

**Solução:**
1. Verificar Network tab → Request Headers → Cookie
2. Se não tiver cookie, fazer logout e login
3. Verificar se backend retornou Set-Cookie no login

### Erro: CORS blocked

**Causa:** Frontend rodando em porta diferente de 3000

**Solução:**
1. Backend aceita apenas `http://localhost:3000` e `http://127.0.0.1:3000`
2. Adicionar nova origem em `apps/api/.env` → `ALLOWED_ORIGINS`
3. Reiniciar backend

### Erro: CPF/Senha inválido

**Causa:** Validações fortes implementadas

**Solução:**
- **CPF:** Use CPF válido (11144477735, 52599927003, etc)
- **Senha:** Mínimo 8 chars + maiúscula + minúscula + número + especial
- **Exemplo válido:** `MinhaSenha@123!`

---

## 📊 RESULTADO ESPERADO

Ao final dos testes, o sistema deve:

✅ **Autenticação segura** com HttpOnly cookies
✅ **Todas as páginas autenticadas** funcionando sem localStorage
✅ **KYC Level 1** completo
✅ **Carteiras** gerenciadas
✅ **Pedidos** criados e listados
✅ **Marketplace** funcional
✅ **Proteção contra XSS** (cookies inacessíveis via JavaScript)
✅ **CORS whitelist** bloqueando origens não autorizadas
✅ **Validações** fortes (CPF + senha)

---

## 🎉 SUCESSO!

Se todos os testes passaram, o sistema está:
- ✅ **100% funcional**
- ✅ **Seguro** (8 vulnerabilidades críticas corrigidas)
- ✅ **Pronto para uso**

**Versão:** 0.3.0 (com correções de cookies)
**Data:** 2025-10-05
