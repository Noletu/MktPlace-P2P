# 🧪 TESTE MANUAL - 5 USUÁRIOS NO MARKETPLACE P2P

**Versão:** 0.3.0 (com correções de segurança)
**Data:** 2025-10-05
**Objetivo:** Simular 5 usuários reais utilizando todas as funcionalidades

---

## ⚠️ PRÉ-REQUISITOS

### 1. Reiniciar Servidor API (OBRIGATÓRIO)

```bash
# Matar processos node antigos
taskkill //F //IM node.exe

# Aguardar 3 segundos
timeout 3

# Iniciar API limpa
cd "C:\Projects\MktPlace-P2P\apps\api"
npm run dev
```

**Verificar se está funcionando:**
```bash
curl http://localhost:3001/health
# Deve retornar: {"status":"ok",...}
```

### 2. Iniciar Frontend

```bash
cd "C:\Projects\MktPlace-P2P\apps\web"
npm run dev
```

**Acessar:** http://localhost:3000

---

## 👥 PERFIS DOS 5 USUÁRIOS

| # | Nome | Email | CPF (válido) | Perfil | Ação Principal |
|---|------|-------|--------------|--------|----------------|
| 1 | João Vendedor | joao@teste.com | `11144477735` | Tem BTC | Criar pedido PIX R$2.000 |
| 2 | Maria Compradora | maria@teste.com | `52998224725` | Quer BTC | Aceitar pedido de João + Upload comprovante |
| 3 | Pedro Trader | pedro@teste.com | `39053344705` | Tem USDT | Criar pedido Boleto R$500 |
| 4 | Ana Investidora | ana@teste.com | `07285192090` | Quer USDT | Aceitar pedido de Pedro + Upload comprovante |
| 5 | Carlos Diverso | carlos@teste.com | `69190787003` | Tem ETH | Criar pedido → Cancelar |

---

## 🔄 FLUXO COMPLETO PASSO A PASSO

### 🟦 USUÁRIO 1 - João Vendedor

#### 1.1 - Criar Conta
1. Abrir http://localhost:3000/register
2. Preencher:
   - **Nome:** João Vendedor Silva
   - **Email:** joao@teste.com
   - **CPF:** `11144477735`
   - **Senha:** `Senha@Joao123!`
3. Clicar em "Registrar"

**✅ Resultado esperado:** Redirecionamento para `/dashboard`

#### 1.2 - Completar KYC Level 1
1. Clicar em "Completar KYC Level 1"
2. Preencher:
   - **Nome Completo:** João Vendedor Silva
   - **Data Nascimento:** 15/03/1985
   - **CEP:** `01310-100`
   - **Número:** 1000
3. Clicar em "Enviar KYC Level 1"

**✅ Resultado esperado:** KYC Level 1 aprovado, limite R$500

#### 1.3 - Adicionar Carteira BTC
1. Clicar em "Ver Carteiras"
2. Clicar em "+ Nova Carteira"
3. Preencher:
   - **Criptomoeda:** Bitcoin (BTC)
   - **Rede:** BITCOIN
   - **Endereço:** `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh`
4. Clicar em "Adicionar Carteira"

**✅ Resultado esperado:** Carteira BTC adicionada, saldo 0.00000000 BTC

#### 1.4 - Criar Pedido PIX R$2.000
1. Clicar em "Criar Pedido"
2. Selecionar **PIX**
3. Preencher:
   - **Valor em BRL:** 2000.00
   - **Criptomoeda:** Bitcoin (BTC)
   - **Tipo de Chave PIX:** CPF
   - **Chave PIX:** `11144477735`
   - **Nome Beneficiário:** João Vendedor Silva
4. Clicar em "Criar Pedido"

**✅ Resultado esperado:** Pedido criado, redirecionamento para "Meus Pedidos"

#### 1.5 - Fazer Logout
1. Clicar em "Sair"

---

### 🟪 USUÁRIO 2 - Maria Compradora

#### 2.1 - Criar Conta
1. Abrir http://localhost:3000/register (ou aba anônima)
2. Preencher:
   - **Nome:** Maria Compradora Santos
   - **Email:** maria@teste.com
   - **CPF:** `52998224725`
   - **Senha:** `Senha@Maria456!`

#### 2.2 - KYC Level 1
1. Preencher:
   - **Nome:** Maria Compradora Santos
   - **Data:** 22/07/1990
   - **CEP:** `01305-000`
   - **Número:** 500

#### 2.3 - Ver Marketplace
1. Clicar em "Ver Marketplace"

**✅ Resultado esperado:** Lista mostra pedido de João (R$2.000 PIX BTC)

#### 2.4 - Aceitar Pedido de João
1. No card do pedido de João, clicar em **"Aceitar e Pagar"**
2. Confirmar aceite

**✅ Resultado esperado:** Match realizado! Status: MATCHED

#### 2.5 - Upload Comprovante PIX
1. Será redirecionado para página do pedido
2. Rolar até "Upload de Comprovante"
3. Selecionar qualquer imagem PNG/JPG
4. Clicar em "Enviar Comprovante"

**✅ Resultado esperado:** "Comprovante enviado! Aguardando validação..."

---

### 🟦 USUÁRIO 3 - Pedro Trader

#### 3.1 - Criar Conta
- **Email:** pedro@teste.com
- **CPF:** `39053344705`
- **Senha:** `Senha@Pedro789!`

#### 3.2 - KYC Level 1
- **Nome:** Pedro Trader Oliveira
- **Data:** 10/11/1988
- **CEP:** `01302-000`

#### 3.3 - Adicionar Carteira USDT (Polygon)
- **Criptomoeda:** Tether (USDT)
- **Rede:** POLYGON
- **Endereço:** `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0`

#### 3.4 - Criar Pedido Boleto R$500
1. Selecionar **BOLETO**
2. Preencher:
   - **Valor:** 500.00
   - **Criptomoeda:** USDT
   - **Rede:** POLYGON
   - **Código de Barras:** `34191790010104351004791020150008291070026000`
   - **Vencimento:** 15/10/2025
   - **Beneficiário:** Pedro Trader LTDA
   - **CPF/CNPJ:** `12345678000190`

---

### 🟨 USUÁRIO 4 - Ana Investidora

#### 4.1 - Criar Conta
- **Email:** ana@teste.com
- **CPF:** `07285192090`
- **Senha:** `Senha@Ana2025!`

#### 4.2 - KYC Level 1
- **Nome:** Ana Investidora Costa
- **Data:** 18/04/1995
- **CEP:** `01452-000`

#### 4.3 - Ver Marketplace
**✅ Deve aparecer:** Pedido de Pedro (R$500 Boleto USDT)

#### 4.4 - Aceitar Pedido de Pedro
1. Clicar em "Aceitar e Pagar"
2. Confirmar

#### 4.5 - Upload Comprovante Boleto
1. Selecionar imagem
2. Enviar comprovante

---

### 🟦 USUÁRIO 5 - Carlos Diversificado

#### 5.1 - Criar Conta
- **Email:** carlos@teste.com
- **CPF:** `69190787003`
- **Senha:** `Senha@Carlos!88`

#### 5.2 - KYC Level 1
- **Nome:** Carlos Diversificado Lima
- **Data:** 05/09/1992
- **CEP:** `01426-000`

#### 5.3 - Adicionar Carteira ETH
- **Criptomoeda:** Ethereum (ETH)
- **Rede:** ETHEREUM
- **Endereço:** `0x71C7656EC7ab88b098defB751B7401B5f6d8976F`

#### 5.4 - Criar Pedido PIX R$1.200
1. Selecionar PIX
2. Preencher:
   - **Valor:** 1200.00
   - **Cripto:** ETH
   - **Chave PIX:** `69190787003`

#### 5.5 - Cancelar Pedido (Teste de Cancelamento)
1. Ir em "Meus Pedidos"
2. Abrir pedido recém-criado
3. Clicar em "Cancelar Pedido"

**✅ Resultado esperado:** Status muda para CANCELLED

---

## ✅ VALIDAÇÕES FINAIS

### 1. Estatísticas do Sistema

**Acessar como qualquer usuário:**
- **Dashboard** → Ver informações pessoais
- **Meus Pedidos** → Ver status dos pedidos
- **Marketplace** → Ver pedidos disponíveis
- **Minhas Transações** → Ver comprovantes enviados

### 2. Verificações Esperadas

| Verificação | Resultado Esperado |
|-------------|-------------------|
| **Total de Usuários** | 5 cadastrados |
| **Total de Pedidos** | 3 criados (João, Pedro, Carlos) |
| **Pedidos Matched** | 2 (João ↔ Maria, Pedro ↔ Ana) |
| **Pedidos Cancelados** | 1 (Carlos) |
| **Comprovantes Enviados** | 2 (Maria, Ana) |
| **Marketplace Ativo** | Vazio (todos matched ou cancelados) |

### 3. Verificar Segurança (DevTools)

**Console → Executar:**
```javascript
document.cookie
```

**✅ Resultado esperado:** String vazia (cookies HttpOnly não acessíveis)

**Network Tab → Ver request para `/api/v1/auth/me`:**
- ✅ Request Headers → Cookie: accessToken=...
- ✅ NÃO deve ter Authorization: Bearer ...

---

## 📊 RESULTADO FINAL ESPERADO

### Estatísticas do Marketplace

**👥 5 Usuários:**
1. ✅ João Vendedor - BTC - Pedido R$2.000 → VALIDATING (matched)
2. ✅ Maria Compradora - Sem cripto - Comprou de João
3. ✅ Pedro Trader - USDT - Pedido R$500 → VALIDATING (matched)
4. ✅ Ana Investidora - Sem cripto - Comprou de Pedro
5. ✅ Carlos Diverso - ETH - Pedido R$1.200 → CANCELLED

**💼 3 Pedidos Criados:**
- João: R$2.000 PIX (BTC) → Status: VALIDATING
- Pedro: R$500 Boleto (USDT) → Status: VALIDATING
- Carlos: R$1.200 PIX (ETH) → Status: CANCELLED

**🔄 2 Transações Completas:**
- Maria → João (R$2.000): Comprovante PIX enviado ✅
- Ana → Pedro (R$500): Comprovante Boleto enviado ✅

**💰 Volume Total Transacionado:**
- **BRL:** R$2.500
- **Fees Plataforma (1.5%):** R$37,50
- **Cashback Pagadores (1%):** R$25,00

---

## 🐛 TROUBLESHOOTING

### Erro: "Erro ao registrar usuário"
**Causa:** Email já existe de teste anterior

**Solução:** Usar emails únicos:
- joao1@teste.com
- maria1@teste.com
- etc.

### Erro: "CPF inválido"
**Causa:** CPF com dígitos verificadores incorretos

**Solução:** Usar APENAS os CPFs listados neste guia (todos válidos)

### Erro: "Token não fornecido"
**Causa:** Cookies não enviados

**Solução:**
1. Limpar cookies: DevTools → Application → Clear cookies
2. Fazer logout e login novamente
3. Verificar se `credentials: 'include'` está no código

### Pedido não aparece no Marketplace
**Causa:** Status diferente de PENDING

**Solução:** Criar novo pedido ou verificar se não foi matched

---

## 🎉 SUCESSO!

Se todos os 5 usuários concluíram seus fluxos:

✅ **Sistema P2P 100% Funcional**
- 5 usuários autenticados (HttpOnly cookies)
- 5 KYC Level 1 completos
- 4 carteiras multi-crypto
- 3 pedidos criados
- 2 transações matched + comprovantes
- 1 cancelamento testado
- Marketplace operacional
- Segurança validada (XSS protection, CORS, senha forte, CPF válido)

**Versão testada:** 0.3.0
**Correções aplicadas:** 8 vulnerabilidades críticas
**Status:** ✅ Pronto para produção (após configurações finais)
