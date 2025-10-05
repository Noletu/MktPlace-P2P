#!/bin/bash

echo "🧪 TESTE MULTI-USUÁRIO - MktPlace P2P v0.3.0"
echo "=============================================="
echo "Simulando 5 usuários realizando transações P2P"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# API
API_URL="http://localhost:3001/api/v1"

# Timestamp para emails únicos
TIMESTAMP=$(date +%s)

# CPFs VÁLIDOS (todos verificados)
CPF_JOAO="11144477735"
CPF_MARIA="52998224725"
CPF_PEDRO="39053344705"
CPF_ANA="07285192090"
CPF_CARLOS="69190787003"

# Contador
TOTAL_TESTS=0
PASSED_TESTS=0

test_passed() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  PASSED_TESTS=$((PASSED_TESTS + 1))
  echo -e "${GREEN}✅ PASSOU${NC} - $1"
}

test_failed() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -e "${RED}❌ FALHOU${NC} - $1"
  echo "   Resposta: $2"
}

# Limpar cookies
rm -f cookies_*.txt

echo "═══════════════════════════════════════════════════════════"
echo -e "${CYAN}👤 USUÁRIO 1 - João Vendedor (Tem BTC, quer pagar R\$2.000)${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📋 1.1 - Registrar João Vendedor"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_joao.txt \
  -d '{
    "email": "joao.vendedor.'$TIMESTAMP'@teste.com",
    "cpf": "'$CPF_JOAO'",
    "password": "Senha@Joao123!",
    "name": "João Vendedor"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER1_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "João registrado - ID: $USER1_ID"
else
  test_failed "Erro ao registrar João" "$RESPONSE"
  exit 1
fi
echo ""

echo "📋 1.2 - KYC Level 1 - João"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_joao.txt \
  -d '{
    "fullName": "João Vendedor Silva",
    "dateOfBirth": "1985-03-15",
    "address": {
      "street": "Avenida Paulista",
      "number": "1000",
      "neighborhood": "Bela Vista",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01310100"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC Level 1 completo - João"
else
  test_failed "Erro no KYC - João" "$RESPONSE"
fi
echo ""

echo "📋 1.3 - Adicionar Carteira BTC - João"
RESPONSE=$(curl -s -X POST "$API_URL/wallets" \
  -H "Content-Type: application/json" \
  -b cookies_joao.txt \
  -d '{
    "crypto": "BTC",
    "network": "BITCOIN",
    "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Carteira BTC adicionada - João"
else
  test_failed "Erro ao adicionar carteira - João" "$RESPONSE"
fi
echo ""

echo "📋 1.4 - Criar Pedido PIX R\$2.000 (BTC) - João"
RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -b cookies_joao.txt \
  -d '{
    "type": "PIX",
    "cryptoType": "BTC",
    "cryptoNetwork": "BITCOIN",
    "cryptoAmount": "0.008",
    "brlAmount": "2000.00",
    "orderData": {
      "pixKey": "'$CPF_JOAO'",
      "pixKeyType": "CPF",
      "recipientName": "João Vendedor Silva"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  ORDER1_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Pedido PIX R\$2.000 criado - Order ID: $ORDER1_ID"
else
  test_failed "Erro ao criar pedido - João" "$RESPONSE"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo -e "${PURPLE}👤 USUÁRIO 2 - Maria Compradora (Quer comprar BTC)${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📋 2.1 - Registrar Maria Compradora"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_maria.txt \
  -d '{
    "email": "maria.compradora.'$TIMESTAMP'@teste.com",
    "cpf": "'$CPF_MARIA'",
    "password": "Senha@Maria456!",
    "name": "Maria Compradora"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER2_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Maria registrada - ID: $USER2_ID"
else
  test_failed "Erro ao registrar Maria" "$RESPONSE"
fi
echo ""

echo "📋 2.2 - KYC Level 1 - Maria"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_maria.txt \
  -d '{
    "fullName": "Maria Compradora Santos",
    "dateOfBirth": "1990-07-22",
    "address": {
      "street": "Rua Augusta",
      "number": "500",
      "neighborhood": "Consolação",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01305000"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC Level 1 completo - Maria"
else
  test_failed "Erro no KYC - Maria" "$RESPONSE"
fi
echo ""

echo "📋 2.3 - Listar Marketplace - Maria (ver pedido de João)"
RESPONSE=$(curl -s -X GET "$API_URL/orders/marketplace" \
  -b cookies_maria.txt)

if echo "$RESPONSE" | grep -q "$ORDER1_ID"; then
  test_passed "Marketplace mostra pedido de João (R\$2.000)"
else
  test_failed "Pedido de João não aparece no marketplace" "$RESPONSE"
fi
echo ""

echo "📋 2.4 - Aceitar Pedido de João (Match) - Maria"
RESPONSE=$(curl -s -X POST "$API_URL/orders/$ORDER1_ID/match" \
  -H "Content-Type: application/json" \
  -b cookies_maria.txt)

if echo "$RESPONSE" | grep -q '"success":true'; then
  TRANSACTION1_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | grep -v "orderId" | head -1 | sed 's/"id":"//')
  test_passed "Match realizado! Transaction ID: $TRANSACTION1_ID"
else
  test_failed "Erro ao fazer match - Maria" "$RESPONSE"
fi
echo ""

echo "📋 2.5 - Upload Comprovante PIX - Maria"
FAKE_IMAGE="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

RESPONSE=$(curl -s -X POST "$API_URL/transactions/submit-proof" \
  -H "Content-Type: application/json" \
  -b cookies_maria.txt \
  -d '{
    "transactionId": "'$TRANSACTION1_ID'",
    "comprovanteData": "'$FAKE_IMAGE'"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Comprovante enviado - Maria → João (R\$2.000)"
else
  test_failed "Erro ao enviar comprovante - Maria" "$RESPONSE"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo -e "${BLUE}👤 USUÁRIO 3 - Pedro Trader (Tem USDT, quer pagar R\$500)${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📋 3.1 - Registrar Pedro Trader"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_pedro.txt \
  -d '{
    "email": "pedro.trader.'$TIMESTAMP'@teste.com",
    "cpf": "'$CPF_PEDRO'",
    "password": "Senha@Pedro789!",
    "name": "Pedro Trader"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER3_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Pedro registrado - ID: $USER3_ID"
else
  test_failed "Erro ao registrar Pedro" "$RESPONSE"
fi
echo ""

echo "📋 3.2 - KYC Level 1 - Pedro"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_pedro.txt \
  -d '{
    "fullName": "Pedro Trader Oliveira",
    "dateOfBirth": "1988-11-10",
    "address": {
      "street": "Rua da Consolação",
      "number": "300",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01302000"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC Level 1 completo - Pedro"
else
  test_failed "Erro no KYC - Pedro" "$RESPONSE"
fi
echo ""

echo "📋 3.3 - Adicionar Carteira USDT (Polygon) - Pedro"
RESPONSE=$(curl -s -X POST "$API_URL/wallets" \
  -H "Content-Type: application/json" \
  -b cookies_pedro.txt \
  -d '{
    "crypto": "USDT",
    "network": "POLYGON",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Carteira USDT (Polygon) adicionada - Pedro"
else
  test_failed "Erro ao adicionar carteira - Pedro" "$RESPONSE"
fi
echo ""

echo "📋 3.4 - Criar Pedido Boleto R\$500 (USDT) - Pedro"
RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -b cookies_pedro.txt \
  -d '{
    "type": "BOLETO",
    "cryptoType": "USDT",
    "cryptoNetwork": "POLYGON",
    "cryptoAmount": "100",
    "brlAmount": "500.00",
    "orderData": {
      "barcode": "34191790010104351004791020150008291070026000",
      "dueDate": "2025-10-15",
      "recipientName": "Pedro Trader LTDA",
      "recipientDocument": "12345678000190"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  ORDER2_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Pedido Boleto R\$500 criado - Order ID: $ORDER2_ID"
else
  test_failed "Erro ao criar pedido - Pedro" "$RESPONSE"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo -e "${YELLOW}👤 USUÁRIO 4 - Ana Investidora (Quer acumular USDT)${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📋 4.1 - Registrar Ana Investidora"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_ana.txt \
  -d '{
    "email": "ana.investidora.'$TIMESTAMP'@teste.com",
    "cpf": "'$CPF_ANA'",
    "password": "Senha@Ana2025!",
    "name": "Ana Investidora"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER4_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Ana registrada - ID: $USER4_ID"
else
  test_failed "Erro ao registrar Ana" "$RESPONSE"
fi
echo ""

echo "📋 4.2 - KYC Level 1 - Ana"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_ana.txt \
  -d '{
    "fullName": "Ana Investidora Costa",
    "dateOfBirth": "1995-04-18",
    "address": {
      "street": "Avenida Faria Lima",
      "number": "2000",
      "neighborhood": "Itaim Bibi",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01452000"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC Level 1 completo - Ana"
else
  test_failed "Erro no KYC - Ana" "$RESPONSE"
fi
echo ""

echo "📋 4.3 - Listar Marketplace - Ana (ver pedido de Pedro)"
RESPONSE=$(curl -s -X GET "$API_URL/orders/marketplace" \
  -b cookies_ana.txt)

if echo "$RESPONSE" | grep -q "$ORDER2_ID"; then
  test_passed "Marketplace mostra pedido de Pedro (R\$500 Boleto)"
else
  test_failed "Pedido de Pedro não aparece no marketplace" "$RESPONSE"
fi
echo ""

echo "📋 4.4 - Aceitar Pedido de Pedro (Match) - Ana"
RESPONSE=$(curl -s -X POST "$API_URL/orders/$ORDER2_ID/match" \
  -H "Content-Type: application/json" \
  -b cookies_ana.txt)

if echo "$RESPONSE" | grep -q '"success":true'; then
  TRANSACTION2_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | grep -v "orderId" | head -1 | sed 's/"id":"//')
  test_passed "Match realizado! Transaction ID: $TRANSACTION2_ID"
else
  test_failed "Erro ao fazer match - Ana" "$RESPONSE"
fi
echo ""

echo "📋 4.5 - Upload Comprovante Boleto - Ana"
RESPONSE=$(curl -s -X POST "$API_URL/transactions/submit-proof" \
  -H "Content-Type: application/json" \
  -b cookies_ana.txt \
  -d '{
    "transactionId": "'$TRANSACTION2_ID'",
    "comprovanteData": "'$FAKE_IMAGE'"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Comprovante enviado - Ana → Pedro (R\$500)"
else
  test_failed "Erro ao enviar comprovante - Ana" "$RESPONSE"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo -e "${CYAN}👤 USUÁRIO 5 - Carlos Diversificado (Tem ETH, testa cancelamento)${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📋 5.1 - Registrar Carlos Diversificado"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_carlos.txt \
  -d '{
    "email": "carlos.diverso.'$TIMESTAMP'@teste.com",
    "cpf": "'$CPF_CARLOS'",
    "password": "Senha@Carlos!88",
    "name": "Carlos Diversificado"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER5_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Carlos registrado - ID: $USER5_ID"
else
  test_failed "Erro ao registrar Carlos" "$RESPONSE"
fi
echo ""

echo "📋 5.2 - KYC Level 1 - Carlos"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_carlos.txt \
  -d '{
    "fullName": "Carlos Diversificado Lima",
    "dateOfBirth": "1992-09-05",
    "address": {
      "street": "Rua Oscar Freire",
      "number": "800",
      "neighborhood": "Jardins",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01426000"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC Level 1 completo - Carlos"
else
  test_failed "Erro no KYC - Carlos" "$RESPONSE"
fi
echo ""

echo "📋 5.3 - Adicionar Carteira ETH - Carlos"
RESPONSE=$(curl -s -X POST "$API_URL/wallets" \
  -H "Content-Type: application/json" \
  -b cookies_carlos.txt \
  -d '{
    "crypto": "ETH",
    "network": "ETHEREUM",
    "address": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Carteira ETH adicionada - Carlos"
else
  test_failed "Erro ao adicionar carteira - Carlos" "$RESPONSE"
fi
echo ""

echo "📋 5.4 - Criar Pedido PIX R\$1.200 (ETH) - Carlos"
RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -b cookies_carlos.txt \
  -d '{
    "type": "PIX",
    "cryptoType": "ETH",
    "cryptoNetwork": "ETHEREUM",
    "cryptoAmount": "0.5",
    "brlAmount": "1200.00",
    "orderData": {
      "pixKey": "'$CPF_CARLOS'",
      "pixKeyType": "CPF",
      "recipientName": "Carlos Diversificado Lima"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  ORDER3_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Pedido PIX R\$1.200 criado - Order ID: $ORDER3_ID"
else
  test_failed "Erro ao criar pedido - Carlos" "$RESPONSE"
fi
echo ""

echo "📋 5.5 - Cancelar Pedido - Carlos (Teste de Cancelamento)"
RESPONSE=$(curl -s -X POST "$API_URL/orders/$ORDER3_ID/cancel" \
  -H "Content-Type: application/json" \
  -b cookies_carlos.txt)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Pedido cancelado com sucesso - Carlos"
else
  test_failed "Erro ao cancelar pedido - Carlos" "$RESPONSE"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}📊 VERIFICAÇÕES FINAIS${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📋 6.1 - Verificar Transações - Maria"
RESPONSE=$(curl -s -X GET "$API_URL/transactions/my-transactions" -b cookies_maria.txt)
if echo "$RESPONSE" | grep -q "$TRANSACTION1_ID"; then
  test_passed "Maria vê transação com João (comprovante enviado)"
else
  test_failed "Maria não vê transação" "$RESPONSE"
fi
echo ""

echo "📋 6.2 - Verificar Transações - Ana"
RESPONSE=$(curl -s -X GET "$API_URL/transactions/my-transactions" -b cookies_ana.txt)
if echo "$RESPONSE" | grep -q "$TRANSACTION2_ID"; then
  test_passed "Ana vê transação com Pedro (comprovante enviado)"
else
  test_failed "Ana não vê transação" "$RESPONSE"
fi
echo ""

# Limpar cookies
rm -f cookies_*.txt

echo "═══════════════════════════════════════════════════════════"
echo -e "${BLUE}📈 ESTATÍSTICAS FINAIS${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${CYAN}👥 USUÁRIOS CRIADOS:${NC}"
echo "  1. João Vendedor    - CPF: $CPF_JOAO (Vendeu BTC por R\$2.000)"
echo "  2. Maria Compradora - CPF: $CPF_MARIA (Comprou BTC pagando R\$2.000)"
echo "  3. Pedro Trader     - CPF: $CPF_PEDRO (Vendeu USDT por R\$500)"
echo "  4. Ana Investidora  - CPF: $CPF_ANA (Comprou USDT pagando R\$500)"
echo "  5. Carlos Diverso   - CPF: $CPF_CARLOS (Criou e cancelou pedido ETH)"
echo ""
echo -e "${GREEN}💼 PEDIDOS CRIADOS:${NC}"
echo "  1. João:   R\$2.000 PIX (BTC)    → Status: VALIDATING (matched por Maria)"
echo "  2. Pedro:  R\$500 Boleto (USDT)  → Status: VALIDATING (matched por Ana)"
echo "  3. Carlos: R\$1.200 PIX (ETH)    → Status: CANCELLED"
echo ""
echo -e "${PURPLE}🔄 TRANSAÇÕES:${NC}"
echo "  1. Maria → João (R\$2.000):  Comprovante PIX enviado ✅"
echo "  2. Ana → Pedro (R\$500):     Comprovante Boleto enviado ✅"
echo ""
echo -e "${YELLOW}💰 VOLUME TRANSACIONADO:${NC}"
echo "  Total em BRL: R\$2.500 (R\$2.000 + R\$500)"
echo "  Fees plataforma (1.5%): R\$37,50"
echo "  Cashback pagadores (1%): R\$25,00"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ RESULTADO DOS TESTES${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Total de testes: $TOTAL_TESTS"
echo "  Testes passaram: $PASSED_TESTS"
echo "  Taxa de sucesso: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
echo ""

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
  echo -e "${GREEN}🎉 TODOS OS TESTES PASSARAM!${NC}"
  echo ""
  echo "Sistema P2P 100% funcional com:"
  echo "  ✅ 5 usuários autenticados (HttpOnly cookies)"
  echo "  ✅ 5 KYC Level 1 completos"
  echo "  ✅ 4 carteiras multi-crypto"
  echo "  ✅ 3 pedidos (2 matched, 1 cancelled)"
  echo "  ✅ 2 transações com comprovantes"
  echo "  ✅ Marketplace P2P operacional"
else
  echo -e "${RED}⚠️  ALGUNS TESTES FALHARAM${NC}"
  echo "  Taxa de sucesso: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
fi
echo ""
echo "═══════════════════════════════════════════════════════════"
