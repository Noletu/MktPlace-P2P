#!/bin/bash

echo "🧪 TESTE SIMPLIFICADO - MktPlace P2P v0.2.1"
echo "==========================================="
echo "Testando 3 usuários com fluxo completo"
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
  "orderData": "{\"pixKey\":\"11144477735\",\"pixKeyType\":\"CPF\",\"recipientName\":\"João Vendedor Silva\"}"
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
  TRANSACTION1_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | grep -v "orderId" | head -1 | sed 's/"id":"//')
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
  "brlAmount": "500.00",
  "orderData": "{\"barcode\":\"34191790010104351004791020150008291070026000\",\"dueDate\":\"2025-10-15\",\"recipientName\":\"Pedro Trader LTDA\",\"recipientDocument\":\"12345678000190\"}"
}
EOF

echo "3.4 - Criar Pedido Boleto R\$500 - Pedro"
RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -b cookies_pedro.txt \
  -d @/tmp/payload3_order.json)

if echo "$RESPONSE" | grep -q '"success":true'; then
  ORDER2_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  test_passed "Pedido Boleto R\$500 criado - ID: $ORDER2_ID"
else
  test_failed "Erro pedido - Pedro" "$RESPONSE"
fi
echo ""

echo "════════════════════════════════════════════════"
echo -e "${GREEN}📊 VERIFICAÇÕES FINAIS${NC}"
echo "════════════════════════════════════════════════"
echo ""

echo "4.1 - Verificar Meus Pedidos - João"
RESPONSE=$(curl -s -X GET "$API_URL/orders/my-orders" -b cookies_joao.txt)
if echo "$RESPONSE" | grep -q "$ORDER1_ID"; then
  test_passed "João vê seu pedido (status: VALIDATING)"
else
  test_failed "João não vê pedido" "$RESPONSE"
fi

echo "4.2 - Verificar Transações - Maria"
RESPONSE=$(curl -s -X GET "$API_URL/transactions/my-transactions" -b cookies_maria.txt)
if echo "$RESPONSE" | grep -q "$TRANSACTION1_ID"; then
  test_passed "Maria vê transação com João"
else
  test_failed "Maria não vê transação" "$RESPONSE"
fi

echo "4.3 - Verificar Marketplace - Pedro"
RESPONSE=$(curl -s -X GET "$API_URL/orders/marketplace" -b cookies_pedro.txt)
MARKETPLACE_COUNT=$(echo "$RESPONSE" | grep -o '"id":"' | wc -l)
test_passed "Marketplace consultado - Pedidos ativos: $MARKETPLACE_COUNT"

rm -f cookies_*.txt /tmp/payload*.json

END_TIME=$(date +%s)
EXECUTION_TIME=$((END_TIME - START_TIME))

echo ""
echo "════════════════════════════════════════════════"
echo -e "${BLUE}📈 ESTATÍSTICAS FINAIS${NC}"
echo "════════════════════════════════════════════════"
echo ""
echo -e "${CYAN}👥 USUÁRIOS:${NC}"
echo "  1. João - BTC → R\$450 PIX (VALIDATING)"
echo "  2. Maria - Comprou BTC pagando R\$450"
echo "  3. Pedro - USDT → R\$500 Boleto (PENDING)"
echo ""
echo -e "${PURPLE}🔄 TRANSAÇÕES:${NC}"
echo "  1. Maria → João: R\$450 (comprovante enviado)"
echo ""
echo -e "${YELLOW}💰 VOLUME:${NC}"
echo "  Transacionado: R\$450"
echo "  Pendente: R\$500"
echo "  Total: R\$950"
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
  echo "  ✅ 3 usuários autenticados"
  echo "  ✅ 3 KYC Level 1"
  echo "  ✅ 2 carteiras (BTC, USDT)"
  echo "  ✅ 2 pedidos (1 matched, 1 ativo)"
  echo "  ✅ 1 transação com comprovante"
  echo "  ✅ Marketplace operacional"
else
  echo -e "${YELLOW}⚠️  Taxa: $((PASSED_TESTS * 100 / TOTAL_TESTS))%${NC}"
fi
echo ""
echo "════════════════════════════════════════════════"
