#!/bin/bash

# Script de Teste Completo - Mktplace P2P
# Simulação com 2 usuários testando TODAS funcionalidades

BASE_URL="http://localhost:3001/api/v1"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
BUGS_FOUND=0

# Arrays para armazenar resultados
declare -a BUGS_LIST
declare -a FAILED_LIST

# Função para log
log() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
    FAILED_LIST+=("$1")
}

log_bug() {
    echo -e "${YELLOW}[BUG]${NC} $1"
    ((BUGS_FOUND++))
    BUGS_LIST+=("$1")
}

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Variáveis globais para tokens e IDs
MARIA_TOKEN=""
MARIA_ID=""
JOAO_TOKEN=""
JOAO_ID=""
MARIA_ORDER_ID=""
JOAO_ORDER_ID=""
CHAT_ID=""
TRANSACTION_ID=""
DISPUTE_ID=""
MARIA_COLLATERAL_ADDRESS_ID=""
JOAO_COLLATERAL_ADDRESS_ID=""

# ========================================
# FASE 1: SETUP E AUTENTICAÇÃO
# ========================================

log_section "FASE 1: SETUP E AUTENTICAÇÃO"

# 1.1 Registro de Usuários
log "1.1 Testando registro de usuários..."

# Registrar Maria
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.vendedor@teste.com",
    "password": "Senha123!",
    "cpf": "12345678901",
    "name": "Maria Vendedor"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_success "Maria registrada com sucesso"
    MARIA_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
else
    log_error "Falha ao registrar Maria: $RESPONSE"
fi

# Registrar João
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao.comprador@teste.com",
    "password": "Senha456!",
    "cpf": "98765432109",
    "name": "João Comprador"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_success "João registrado com sucesso"
    JOAO_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
else
    log_error "Falha ao registrar João: $RESPONSE"
fi

# Testar CPF duplicado
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "outro@teste.com",
    "password": "Senha123!",
    "cpf": "12345678901",
    "name": "Outro Usuario"
  }')

if echo "$RESPONSE" | grep -q '"success":false'; then
    log_success "Validação de CPF duplicado funcionando"
else
    log_error "Sistema permitiu CPF duplicado"
    log_bug "BUG #1: Sistema não valida CPF duplicado"
fi

# 1.2 Login e Autenticação
log "1.2 Testando login..."

# Login Maria
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.vendedor@teste.com",
    "password": "Senha123!"
  }')

if echo "$RESPONSE" | grep -q '"accessToken"'; then
    log_success "Maria logada com sucesso"
    MARIA_TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
else
    log_error "Falha ao fazer login de Maria: $RESPONSE"
fi

# Login João
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao.comprador@teste.com",
    "password": "Senha456!"
  }')

if echo "$RESPONSE" | grep -q '"accessToken"'; then
    log_success "João logado com sucesso"
    JOAO_TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
else
    log_error "Falha ao fazer login de João: $RESPONSE"
fi

# Testar senha incorreta
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.vendedor@teste.com",
    "password": "SenhaErrada!"
  }')

if echo "$RESPONSE" | grep -q '"success":false'; then
    log_success "Validação de senha incorreta funcionando"
else
    log_error "Sistema não validou senha incorreta corretamente"
fi

# 1.3 Verificar autenticação
log "1.3 Testando proteção de rotas..."

# Tentar acessar rota protegida sem token
RESPONSE=$(curl -s "$BASE_URL/users/me")

if echo "$RESPONSE" | grep -qE '(401|Unauthorized|Authentication required)'; then
    log_success "Proteção de rotas sem token funcionando"
else
    log_error "Rota protegida acessível sem token"
    log_bug "BUG #2: Falha na autenticação - rotas desprotegidas"
fi

# Acessar com token válido
RESPONSE=$(curl -s "$BASE_URL/users/me" \
  -H "Authorization: Bearer $MARIA_TOKEN")

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_success "Acesso com token válido funcionando"
else
    log_error "Falha ao acessar rota com token válido: $RESPONSE"
fi

# ========================================
# FASE 2: SISTEMA KYC
# ========================================

log_section "FASE 2: SISTEMA KYC"

# 2.1 KYC Level 1 - Maria
log "2.1 Testando KYC Level 1 - Maria..."

RESPONSE=$(curl -s -X POST "$BASE_URL/kyc/level1" \
  -H "Authorization: Bearer $MARIA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "12345678901",
    "phone": "(11) 98765-4321"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_success "Maria completou KYC Level 1"
else
    log_error "Falha no KYC Level 1 de Maria: $RESPONSE"
fi

# 2.2 KYC Level 1 - João
log "2.2 Testando KYC Level 1 - João..."

RESPONSE=$(curl -s -X POST "$BASE_URL/kyc/level1" \
  -H "Authorization: Bearer $JOAO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "98765432109",
    "phone": "(11) 91234-5678"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_success "João completou KYC Level 1"
else
    log_error "Falha no KYC Level 1 de João: $RESPONSE"
fi

# Verificar perfil atualizado
RESPONSE=$(curl -s "$BASE_URL/users/me" \
  -H "Authorization: Bearer $MARIA_TOKEN")

if echo "$RESPONSE" | grep -q '"kycLevel":"LEVEL_1"'; then
    log_success "KYC Level atualizado corretamente no perfil"
else
    log_error "KYC Level não atualizado no perfil"
fi

# ========================================
# RELATÓRIO PARCIAL
# ========================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RELATÓRIO PARCIAL - FASE 1 e 2${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total de testes executados: ${TOTAL_TESTS}"
echo -e "${GREEN}Testes passaram: ${PASSED_TESTS}${NC}"
echo -e "${RED}Testes falharam: ${FAILED_TESTS}${NC}"
echo -e "${YELLOW}Bugs encontrados: ${BUGS_FOUND}${NC}"

if [ ${BUGS_FOUND} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}BUGS ENCONTRADOS:${NC}"
    for bug in "${BUGS_LIST[@]}"; do
        echo -e "  - $bug"
    done
fi

if [ ${FAILED_TESTS} -gt 0 ]; then
    echo ""
    echo -e "${RED}TESTES FALHADOS:${NC}"
    for test in "${FAILED_LIST[@]}"; do
        echo -e "  - $test"
    done
fi

echo ""
echo "Tokens salvos:"
echo "MARIA_TOKEN: ${MARIA_TOKEN:0:20}..."
echo "JOAO_TOKEN: ${JOAO_TOKEN:0:20}..."
echo ""
echo "Continuando para FASE 3..."
