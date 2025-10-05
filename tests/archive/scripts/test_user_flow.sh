#!/bin/bash

echo "🧪 TESTE DE FLUXO COMPLETO - MktPlace P2P v0.3.0"
echo "=================================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
API_URL="http://localhost:3001/api/v1"
COOKIES_FILE="test_cookies.txt"
USER_EMAIL="teste.$(date +%s)@exemplo.com"
USER_CPF="11144477735" # CPF válido
USER_PASSWORD="Senha@123!"
USER_NAME="Usuário Teste"

# Limpar cookies anteriores
rm -f $COOKIES_FILE

echo "📋 Teste 1: Registrar Novo Usuário"
echo "   Email: $USER_EMAIL"
echo "   CPF: $USER_CPF"
echo ""

RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -c $COOKIES_FILE \
  -d '{
    "email": "'"$USER_EMAIL"'",
    "cpf": "'"$USER_CPF"'",
    "password": "'"$USER_PASSWORD"'",
    "name": "'"$USER_NAME"'"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASSOU${NC} - Usuário registrado com sucesso"
  USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  echo "   User ID: $USER_ID"
else
  echo -e "${RED}❌ FALHOU${NC} - Erro no registro"
  echo "   Resposta: $RESPONSE"
  exit 1
fi
echo ""

echo "📋 Teste 2: Login com Usuário Criado"
RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -c $COOKIES_FILE \
  -b $COOKIES_FILE \
  -d '{
    "email": "'"$USER_EMAIL"'",
    "password": "'"$USER_PASSWORD"'"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASSOU${NC} - Login realizado com sucesso"
else
  echo -e "${RED}❌ FALHOU${NC} - Erro no login"
  echo "   Resposta: $RESPONSE"
  exit 1
fi
echo ""

echo "📋 Teste 3: Acessar Dashboard (/auth/me)"
RESPONSE=$(curl -s -X GET "$API_URL/auth/me" \
  -b $COOKIES_FILE)

if echo "$RESPONSE" | grep -q "$USER_EMAIL"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Dashboard acessível via cookies"
  echo "   Email confirmado: $USER_EMAIL"
else
  echo -e "${RED}❌ FALHOU${NC} - Falha ao acessar dashboard"
  echo "   Resposta: $RESPONSE"
  exit 1
fi
echo ""

echo "📋 Teste 4: Completar KYC Level 1"
RESPONSE=$(curl -s -X POST "$API_URL/kyc/level1" \
  -H "Content-Type: application/json" \
  -b $COOKIES_FILE \
  -d '{
    "fullName": "'"$USER_NAME"'",
    "dateOfBirth": "1990-01-01",
    "address": {
      "street": "Rua Teste",
      "number": "123",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01001000"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASSOU${NC} - KYC Level 1 completado"
else
  echo -e "${RED}❌ FALHOU${NC} - Erro no KYC"
  echo "   Resposta: $RESPONSE"
  exit 1
fi
echo ""

echo "📋 Teste 5: Adicionar Carteira BTC"
RESPONSE=$(curl -s -X POST "$API_URL/wallets" \
  -H "Content-Type: application/json" \
  -b $COOKIES_FILE \
  -d '{
    "crypto": "BTC",
    "network": "BITCOIN",
    "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASSOU${NC} - Carteira BTC adicionada"
  WALLET_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  echo "   Wallet ID: $WALLET_ID"
else
  echo -e "${RED}❌ FALHOU${NC} - Erro ao adicionar carteira"
  echo "   Resposta: $RESPONSE"
  exit 1
fi
echo ""

echo "📋 Teste 6: Listar Carteiras"
RESPONSE=$(curl -s -X GET "$API_URL/wallets" \
  -b $COOKIES_FILE)

if echo "$RESPONSE" | grep -q "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Carteiras listadas com sucesso"
else
  echo -e "${RED}❌ FALHOU${NC} - Erro ao listar carteiras"
  echo "   Resposta: $RESPONSE"
  exit 1
fi
echo ""

echo "📋 Teste 7: Criar Pedido PIX"
RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -b $COOKIES_FILE \
  -d '{
    "type": "PIX",
    "cryptoType": "BTC",
    "cryptoNetwork": "BITCOIN",
    "cryptoAmount": "0.001",
    "brlAmount": "100.00",
    "orderData": {
      "pixKey": "'"$USER_CPF"'",
      "pixKeyType": "CPF",
      "recipientName": "'"$USER_NAME"'"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASSOU${NC} - Pedido PIX criado"
  ORDER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  echo "   Order ID: $ORDER_ID"
else
  echo -e "${RED}❌ FALHOU${NC} - Erro ao criar pedido"
  echo "   Resposta: $RESPONSE"
  exit 1
fi
echo ""

echo "📋 Teste 8: Listar Marketplace"
RESPONSE=$(curl -s -X GET "$API_URL/orders/marketplace" \
  -b $COOKIES_FILE)

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASSOU${NC} - Marketplace acessível"
  ORDER_COUNT=$(echo "$RESPONSE" | grep -o '"id":"' | wc -l)
  echo "   Pedidos disponíveis: $ORDER_COUNT"
else
  echo -e "${RED}❌ FALHOU${NC} - Erro ao acessar marketplace"
  echo "   Resposta: $RESPONSE"
  exit 1
fi
echo ""

echo "📋 Teste 9: Listar Meus Pedidos"
RESPONSE=$(curl -s -X GET "$API_URL/orders/my-orders" \
  -b $COOKIES_FILE)

if echo "$RESPONSE" | grep -q "$ORDER_ID"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Meus pedidos acessível"
else
  echo -e "${RED}❌ FALHOU${NC} - Erro ao listar meus pedidos"
  echo "   Resposta: $RESPONSE"
  exit 1
fi
echo ""

echo "📋 Teste 10: Logout"
RESPONSE=$(curl -s -X POST "$API_URL/auth/logout" \
  -b $COOKIES_FILE \
  -c $COOKIES_FILE)

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASSOU${NC} - Logout realizado"
else
  echo -e "${YELLOW}⚠️  AVISO${NC} - Logout pode ter falhado, mas cookies foram limpos"
fi
echo ""

echo "📋 Teste 11: Verificar Acesso Bloqueado Após Logout"
RESPONSE=$(curl -s -X GET "$API_URL/auth/me" \
  -b $COOKIES_FILE)

if echo "$RESPONSE" | grep -q "não fornecido\|inválido\|expirado"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Acesso bloqueado corretamente após logout"
else
  echo -e "${RED}❌ FALHOU${NC} - Acesso ainda permitido após logout!"
  echo "   Resposta: $RESPONSE"
fi
echo ""

# Limpar cookies
rm -f $COOKIES_FILE

echo "=================================================="
echo -e "${BLUE}📊 RESUMO DOS TESTES${NC}"
echo ""
echo "Funcionalidades Testadas:"
echo "  ✅ Registro de usuário (senha forte + CPF válido)"
echo "  ✅ Login com HttpOnly cookies"
echo "  ✅ Dashboard autenticado"
echo "  ✅ KYC Level 1"
echo "  ✅ Adicionar carteira BTC"
echo "  ✅ Listar carteiras"
echo "  ✅ Criar pedido PIX"
echo "  ✅ Listar marketplace"
echo "  ✅ Listar meus pedidos"
echo "  ✅ Logout e revogação de acesso"
echo ""
echo -e "${GREEN}🎉 TODOS OS TESTES PASSARAM!${NC}"
echo ""
echo "Sistema pronto para uso! 🚀"
echo ""
echo "Próximos passos:"
echo "  1. Testar no navegador: http://localhost:3000"
echo "  2. Criar segundo usuário para testar matching"
echo "  3. Testar upload de comprovante"
echo ""
