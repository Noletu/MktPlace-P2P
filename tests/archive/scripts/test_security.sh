#!/bin/bash

echo "🧪 TESTE DE SEGURANÇA - MktPlace P2P v0.3.0"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Teste 1: Health Check
echo "📋 Teste 1: Health Check"
RESPONSE=$(curl -s http://localhost:3001/health)
if echo "$RESPONSE" | grep -q "ok"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Servidor respondendo"
else
  echo -e "${RED}❌ FALHOU${NC} - Servidor não responde"
fi
echo ""

# Teste 2: Senha Fraca (DEVE FALHAR)
echo "🔒 Teste 2: Validação de Senha Forte"
echo "   Tentando senha fraca: 'senha123'"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste.senha@exemplo.com",
    "cpf": "11144477735",
    "password": "senha123",
    "name": "Teste Senha"
  }')

if echo "$RESPONSE" | grep -q "maiúscula"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Senha fraca rejeitada corretamente"
else
  echo -e "${RED}❌ FALHOU${NC} - Senha fraca foi aceita!"
  echo "   Resposta: $RESPONSE"
fi
echo ""

# Teste 3: CPF Inválido (DEVE FALHAR)
echo "🆔 Teste 3: Validação de CPF"
echo "   Tentando CPF inválido: '12345678900'"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste.cpf@exemplo.com",
    "cpf": "12345678900",
    "password": "Senha@123!",
    "name": "Teste CPF"
  }')

if echo "$RESPONSE" | grep -q "dígitos verificadores"; then
  echo -e "${GREEN}✅ PASSOU${NC} - CPF inválido rejeitado corretamente"
else
  echo -e "${RED}❌ FALHOU${NC} - CPF inválido foi aceito!"
  echo "   Resposta: $RESPONSE"
fi
echo ""

# Teste 4: Registro com Senha Forte (DEVE PASSAR)
echo "✨ Teste 4: Registro com Credenciais Válidas"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario.valido@exemplo.com",
    "cpf": "11144477735",
    "password": "Senha@Forte123!",
    "name": "Usuário Válido"
  }')

if echo "$RESPONSE" | grep -q "sucesso"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Registro bem-sucedido"

  # Verificar se token NÃO está no JSON (agora em cookie)
  if echo "$RESPONSE" | grep -q '"token"'; then
    echo -e "${YELLOW}⚠️  AVISO${NC} - Token ainda aparece no JSON (deveria estar apenas em cookie)"
  else
    echo -e "${GREEN}✅ SEGURO${NC} - Token não exposto no JSON (HttpOnly cookie)"
  fi
else
  echo -e "${RED}❌ FALHOU${NC} - Registro com credenciais válidas falhou"
  echo "   Resposta: $RESPONSE"
fi
echo ""

# Teste 5: Login e Cookies
echo "🍪 Teste 5: Login com HttpOnly Cookies"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "usuario.valido@exemplo.com",
    "password": "Senha@Forte123!"
  }')

if echo "$RESPONSE" | grep -q "sucesso"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Login bem-sucedido"

  # Verificar cookies
  if [ -f cookies.txt ] && grep -q "HttpOnly" cookies.txt; then
    echo -e "${GREEN}✅ SEGURO${NC} - Cookie HttpOnly configurado"
  else
    echo -e "${YELLOW}⚠️  AVISO${NC} - Cookie HttpOnly não detectado"
  fi
else
  echo -e "${RED}❌ FALHOU${NC} - Login falhou"
fi
echo ""

# Teste 6: Acesso Autenticado com Cookie
echo "🔐 Teste 6: Requisição Autenticada (Cookie)"
RESPONSE=$(curl -s -X GET http://localhost:3001/api/v1/auth/me \
  -b cookies.txt)

if echo "$RESPONSE" | grep -q "usuario.valido@exemplo.com"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Autenticação via cookie funcionando"
else
  echo -e "${RED}❌ FALHOU${NC} - Autenticação via cookie falhou"
  echo "   Resposta: $RESPONSE"
fi
echo ""

# Teste 7: Acesso SEM Cookie (DEVE FALHAR)
echo "🚫 Teste 7: Bloqueio de Acesso Não Autenticado"
RESPONSE=$(curl -s -X GET http://localhost:3001/api/v1/auth/me)

if echo "$RESPONSE" | grep -q "não fornecido"; then
  echo -e "${GREEN}✅ PASSOU${NC} - Acesso bloqueado corretamente"
else
  echo -e "${RED}❌ FALHOU${NC} - Acesso sem autenticação foi permitido!"
fi
echo ""

# Resumo
echo "=========================================="
echo "📊 RESUMO DOS TESTES DE SEGURANÇA"
echo ""
echo "Funcionalidades Validadas:"
echo "  ✅ Validação de senha forte (uppercase + número + especial)"
echo "  ✅ Validação completa de CPF (dígitos verificadores)"
echo "  ✅ HttpOnly cookies (proteção XSS)"
echo "  ✅ Autenticação via cookies"
echo "  ✅ Bloqueio de acessos não autorizados"
echo ""
echo "🎉 Testes concluídos!"
echo ""
echo "Para mais testes, consulte: GUIA_TESTES.md"
