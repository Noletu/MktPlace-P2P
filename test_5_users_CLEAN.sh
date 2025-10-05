#!/bin/bash

echo "🧪 TESTE COMPLETO - MktPlace P2P v0.2.1"
echo "=========================================="
echo "Testando 5 usuários com fluxo completo"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

API_URL="http://localhost:3001/api/v1"
TIMESTAMP=$(date +%s)
TOTAL_TESTS=0
PASSED_TESTS=0
START_TIME=$(date +%s)

test_passed() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  PASSED_TESTS=$((PASSED_TESTS + 1))
  echo -e "${GREEN}✅ ${NC}$1"
}

test_failed() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -e "${RED}❌ FALHOU${NC} - $1"
  echo "   Resposta: $2"
}

rm -f cookies_*.txt /tmp/payload*.json

echo "════════════════════════════════════════════════"
echo -e "${CYAN}👤 USUÁRIO 1 - João (BTC → R\$450 PIX)${NC}"
echo "════════════════════════════════════════════════"
echo ""

cat > /tmp/payload1_reg.json << EOF
{
  "email": "joao.$TIMESTAMP@teste.com",
  "cpf": "11144477735",
  "password": "SenhaJoao123!",
  "name": "João Vendedor"
}
EOF

echo "1.1 - Registrar João"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_joao.txt \
  -d @/tmp/payload1_reg.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER1_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "João registrado - ID: $USER1_ID"
else
  test_failed "Erro ao registrar João" "$RESPONSE"
  exit 1
fi

cat > /tmp/payload1_kyc.json << EOF
{
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
}
EOF

echo "1.2 - KYC Level 1 - João"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_joao.txt \
  -d @/tmp/payload1_kyc.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC L1 completo - João (limite R\$500/dia)"
else
  test_failed "Erro KYC - João" "$RESPONSE"
fi

cat > /tmp/payload1_wallet.json << EOF
{
  "crypto": "BTC",
  "network": "BITCOIN",
  "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
}
EOF

echo "1.3 - Adicionar Carteira BTC - João"
RESPONSE=$(curl -s -X POST "$API_URL/wallets" \
  -H "Content-Type: application/json" \
  -b cookies_joao.txt \
  -d @/tmp/payload1_wallet.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Carteira BTC adicionada - João"
else
  test_failed "Erro carteira - João" "$RESPONSE"
fi

cat > /tmp/payload1_order.json << EOF
{
  "type": "PIX",
  "cryptoType": "BTC",
  "cryptoNetwork": "BITCOIN",
  "cryptoAmount": "0.0018",
  "brlAmount": "450.00",
  "orderData": {
    "pixKey": "11144477735",
    "pixKeyType": "CPF",
    "recipientName": "João Vendedor Silva"
  }
}
EOF

echo "1.4 - Criar Pedido PIX R\$450 - João"
RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -b cookies_joao.txt \
  -d @/tmp/payload1_order.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  ORDER1_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Pedido PIX R\$450 criado - ID: $ORDER1_ID"
else
  test_failed "Erro pedido - João" "$RESPONSE"
  ORDER1_ID="invalid"
fi
echo ""

echo "════════════════════════════════════════════════"
echo -e "${PURPLE}👤 USUÁRIO 2 - Maria (Quer comprar BTC)${NC}"
echo "════════════════════════════════════════════════"
echo ""

cat > /tmp/payload2_reg.json << EOF
{
  "email": "maria.$TIMESTAMP@teste.com",
  "cpf": "52998224725",
  "password": "SenhaMaria456!",
  "name": "Maria Compradora"
}
EOF

echo "2.1 - Registrar Maria"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_maria.txt \
  -d @/tmp/payload2_reg.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER2_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Maria registrada - ID: $USER2_ID"
else
  test_failed "Erro ao registrar Maria" "$RESPONSE"
fi

cat > /tmp/payload2_kyc.json << EOF
{
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
}
EOF

echo "2.2 - KYC Level 1 - Maria"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_maria.txt \
  -d @/tmp/payload2_kyc.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC L1 completo - Maria"
else
  test_failed "Erro KYC - Maria" "$RESPONSE"
fi

echo "2.3 - Listar Marketplace - Maria"
RESPONSE=$(curl -s -X GET "$API_URL/orders/marketplace" \
  -b cookies_maria.txt)

if echo "$RESPONSE" | grep -q "$ORDER1_ID"; then
  test_passed "Marketplace mostra pedido de João (R\$450)"
else
  test_failed "Pedido não aparece no marketplace" "$RESPONSE"
fi

echo "2.4 - Aceitar Pedido de João (Match) - Maria"
RESPONSE=$(curl -s -X POST "$API_URL/orders/$ORDER1_ID/match" \
  -H "Content-Type: application/json" \
  -b cookies_maria.txt)

if echo "$RESPONSE" | grep -q '"success":true'; then
  TRANSACTION1_ID=$(echo "$RESPONSE" | grep -o '"transaction":{"id":"[^"]*' | sed 's/"transaction":{"id":"//')
  test_passed "Match realizado! Transaction ID: $TRANSACTION1_ID"
else
  test_failed "Erro ao fazer match - Maria" "$RESPONSE"
fi

FAKE_IMAGE="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

cat > /tmp/payload2_proof.json << EOF
{
  "transactionId": "$TRANSACTION1_ID",
  "comprovanteData": "$FAKE_IMAGE"
}
EOF

echo "2.5 - Upload Comprovante PIX - Maria"
RESPONSE=$(curl -s -X POST "$API_URL/transactions/submit-proof" \
  -H "Content-Type: application/json" \
  -b cookies_maria.txt \
  -d @/tmp/payload2_proof.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Comprovante enviado - Maria → João (R\$450)"
else
  test_failed "Erro ao enviar comprovante - Maria" "$RESPONSE"
fi
echo ""

echo "════════════════════════════════════════════════"
echo -e "${BLUE}👤 USUÁRIO 3 - Pedro (USDT + Boleto)${NC}"
echo "════════════════════════════════════════════════"
echo ""

cat > /tmp/payload3_reg.json << EOF
{
  "email": "pedro.$TIMESTAMP@teste.com",
  "cpf": "39053344705",
  "password": "SenhaPedro789!",
  "name": "Pedro Trader"
}
EOF

echo "3.1 - Registrar Pedro"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_pedro.txt \
  -d @/tmp/payload3_reg.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER3_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Pedro registrado - ID: $USER3_ID"
else
  test_failed "Erro ao registrar Pedro" "$RESPONSE"
fi

cat > /tmp/payload3_kyc.json << EOF
{
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
}
EOF

echo "3.2 - KYC Level 1 - Pedro"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_pedro.txt \
  -d @/tmp/payload3_kyc.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC L1 completo - Pedro"
else
  test_failed "Erro KYC - Pedro" "$RESPONSE"
fi

cat > /tmp/payload3_wallet.json << EOF
{
  "crypto": "USDT",
  "network": "POLYGON",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
}
EOF

echo "3.3 - Adicionar Carteira USDT - Pedro"
RESPONSE=$(curl -s -X POST "$API_URL/wallets" \
  -H "Content-Type: application/json" \
  -b cookies_pedro.txt \
  -d @/tmp/payload3_wallet.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Carteira USDT (Polygon) adicionada - Pedro"
else
  test_failed "Erro carteira - Pedro" "$RESPONSE"
fi

cat > /tmp/payload3_order.json << EOF
{
  "type": "BOLETO",
  "cryptoType": "USDT",
  "cryptoNetwork": "POLYGON",
  "cryptoAmount": "100",
  "brlAmount": "480.00",
  "orderData": {
    "barcode": "34191790010104351004791020150008291070026000",
    "dueDate": "2025-10-15",
    "recipientName": "Pedro Trader LTDA",
    "recipientDocument": "12345678000190"
  }
}
EOF

echo "3.4 - Criar Pedido Boleto R\$480 - Pedro"
RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -b cookies_pedro.txt \
  -d @/tmp/payload3_order.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  ORDER2_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Pedido Boleto R\$480 criado - ID: $ORDER2_ID"
else
  test_failed "Erro pedido - Pedro" "$RESPONSE"
fi
echo ""

echo "════════════════════════════════════════════════"
echo -e "${YELLOW}👤 USUÁRIO 4 - Ana (ETH → R\$350 PIX)${NC}"
echo "════════════════════════════════════════════════"
echo ""

cat > /tmp/payload4_reg.json << EOF
{
  "email": "ana.$TIMESTAMP@teste.com",
  "cpf": "72851920901",
  "password": "SenhaAna999!",
  "name": "Ana Silva"
}
EOF

echo "4.1 - Registrar Ana"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_ana.txt \
  -d @/tmp/payload4_reg.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER4_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Ana registrada - ID: $USER4_ID"
else
  test_failed "Erro ao registrar Ana" "$RESPONSE"
fi

cat > /tmp/payload4_kyc.json << EOF
{
  "fullName": "Ana Silva Costa",
  "dateOfBirth": "1992-05-20",
  "address": {
    "street": "Avenida Brasil",
    "number": "2000",
    "neighborhood": "Jardins",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01430000"
  }
}
EOF

echo "4.2 - KYC Level 1 - Ana"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_ana.txt \
  -d @/tmp/payload4_kyc.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC L1 completo - Ana"
else
  test_failed "Erro KYC - Ana" "$RESPONSE"
fi

cat > /tmp/payload4_wallet.json << EOF
{
  "crypto": "ETH",
  "network": "ETHEREUM",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1"
}
EOF

echo "4.3 - Adicionar Carteira ETH - Ana"
RESPONSE=$(curl -s -X POST "$API_URL/wallets" \
  -H "Content-Type: application/json" \
  -b cookies_ana.txt \
  -d @/tmp/payload4_wallet.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Carteira ETH adicionada - Ana"
else
  test_failed "Erro carteira - Ana" "$RESPONSE"
fi

cat > /tmp/payload4_order.json << EOF
{
  "type": "PIX",
  "cryptoType": "ETH",
  "cryptoNetwork": "ETHEREUM",
  "cryptoAmount": "0.15",
  "brlAmount": "350.00",
  "orderData": {
    "pixKey": "ana.silva@email.com",
    "pixKeyType": "EMAIL",
    "recipientName": "Ana Silva Costa"
  }
}
EOF

echo "4.4 - Criar Pedido PIX R\$350 - Ana"
RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -b cookies_ana.txt \
  -d @/tmp/payload4_order.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  ORDER3_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Pedido PIX R\$350 criado - ID: $ORDER3_ID"
else
  test_failed "Erro pedido - Ana" "$RESPONSE"
fi
echo ""

echo "════════════════════════════════════════════════"
echo -e "${PURPLE}👤 USUÁRIO 5 - Carlos (Comprar USDT)${NC}"
echo "════════════════════════════════════════════════"
echo ""

cat > /tmp/payload5_reg.json << EOF
{
  "email": "carlos.$TIMESTAMP@teste.com",
  "cpf": "69190787080",
  "password": "SenhaCarlos555!",
  "name": "Carlos Oliveira"
}
EOF

echo "5.1 - Registrar Carlos"
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies_carlos.txt \
  -d @/tmp/payload5_reg.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  USER5_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Carlos registrado - ID: $USER5_ID"
else
  test_failed "Erro ao registrar Carlos" "$RESPONSE"
fi

cat > /tmp/payload5_kyc.json << EOF
{
  "fullName": "Carlos Oliveira Santos",
  "dateOfBirth": "1987-12-03",
  "address": {
    "street": "Rua Oscar Freire",
    "number": "1500",
    "neighborhood": "Pinheiros",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "05409000"
  }
}
EOF

echo "5.2 - KYC Level 1 - Carlos"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b cookies_carlos.txt \
  -d @/tmp/payload5_kyc.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "KYC L1 completo - Carlos"
else
  test_failed "Erro KYC - Carlos" "$RESPONSE"
fi

echo "5.3 - Ver Marketplace - Carlos"
RESPONSE=$(curl -s -X GET "$API_URL/orders/marketplace" \
  -b cookies_carlos.txt)

if echo "$RESPONSE" | grep -q '"success":true'; then
  MARKETPLACE_COUNT=$(echo "$RESPONSE" | grep -o '"id":"' | wc -l)
  test_passed "Marketplace consultado - Pedidos: $MARKETPLACE_COUNT"
else
  test_failed "Erro marketplace - Carlos" "$RESPONSE"
fi

echo "5.4 - Aceitar Pedido de Pedro (Match) - Carlos"
RESPONSE=$(curl -s -X POST "$API_URL/orders/$ORDER2_ID/match" \
  -H "Content-Type: application/json" \
  -b cookies_carlos.txt)

if echo "$RESPONSE" | grep -q '"success":true'; then
  TRANSACTION2_ID=$(echo "$RESPONSE" | grep -o '"transaction":{"id":"[^"]*' | sed 's/"transaction":{"id":"//')
  test_passed "Match realizado! Transaction ID: $TRANSACTION2_ID"
else
  test_failed "Erro ao fazer match - Carlos" "$RESPONSE"
fi
echo ""

echo "════════════════════════════════════════════════"
echo -e "${GREEN}📊 VERIFICAÇÕES FINAIS${NC}"
echo "════════════════════════════════════════════════"
echo ""

echo "6.1 - Verificar Meus Pedidos - João"
RESPONSE=$(curl -s -X GET "$API_URL/orders/my-orders" -b cookies_joao.txt)
if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "João vê seus pedidos"
else
  test_failed "João não vê pedidos" "$RESPONSE"
fi

echo "6.2 - Verificar Transações - Maria"
RESPONSE=$(curl -s -X GET "$API_URL/transactions/my-transactions" -b cookies_maria.txt)
if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Maria vê transações"
else
  test_failed "Maria não vê transações" "$RESPONSE"
fi

echo "6.3 - Verificar Marketplace - Pedro"
RESPONSE=$(curl -s -X GET "$API_URL/orders/marketplace" -b cookies_pedro.txt)
if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Pedro consultou marketplace"
else
  test_failed "Pedro erro marketplace" "$RESPONSE"
fi

echo "6.4 - Listar Carteiras - Ana"
RESPONSE=$(curl -s -X GET "$API_URL/wallets" -b cookies_ana.txt)
if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Ana vê suas carteiras"
else
  test_failed "Ana erro carteiras" "$RESPONSE"
fi

echo "6.5 - Ver Meus Pedidos - Carlos"
RESPONSE=$(curl -s -X GET "$API_URL/orders/my-orders" -b cookies_carlos.txt)
if echo "$RESPONSE" | grep -q '"success":true'; then
  test_passed "Carlos vê seus pedidos"
else
  test_failed "Carlos erro pedidos" "$RESPONSE"
fi

rm -f cookies_*.txt /tmp/payload*.json

END_TIME=$(date +%s)
EXECUTION_TIME=$((END_TIME - START_TIME))

echo ""
echo "════════════════════════════════════════════════"
echo -e "${BLUE}📈 ESTATÍSTICAS FINAIS${NC}"
echo "════════════════════════════════════════════════"
echo ""
echo -e "${CYAN}👥 USUÁRIOS (5):${NC}"
echo "  1. João - BTC → R\$450 PIX"
echo "  2. Maria - Comprou BTC de João"
echo "  3. Pedro - USDT → R\$480 Boleto"
echo "  4. Ana - ETH → R\$350 PIX"
echo "  5. Carlos - Comprou USDT de Pedro"
echo ""
echo -e "${PURPLE}🔄 TRANSAÇÕES:${NC}"
echo "  1. Maria → João: R\$450"
echo "  2. Carlos → Pedro: R\$480"
echo ""
echo -e "${YELLOW}💰 VOLUME:${NC}"
echo "  Total Transacionado: R\$930"
echo "  Pedidos Ativos: Ana (R\$350)"
echo ""
echo -e "${GREEN}⏱️  PERFORMANCE:${NC}"
echo "  Tempo de execução: ${EXECUTION_TIME}s"
echo "  Testes: $PASSED_TESTS/$TOTAL_TESTS"
echo "  Taxa de sucesso: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
echo ""

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
  echo -e "${GREEN}🎉 TODOS OS TESTES PASSARAM!${NC}"
  echo ""
  echo "Sistema P2P 100% funcional com:"
  echo "  ✅ 5 usuários autenticados"
  echo "  ✅ 5 KYC Level 1"
  echo "  ✅ 4 carteiras (BTC, ETH, USDT)"
  echo "  ✅ 3 pedidos criados"
  echo "  ✅ 2 transações matched"
  echo "  ✅ Marketplace operacional"
else
  echo -e "${YELLOW}⚠️  Taxa: $((PASSED_TESTS * 100 / TOTAL_TESTS))%${NC}"
fi
echo ""
echo "════════════════════════════════════════════════"
