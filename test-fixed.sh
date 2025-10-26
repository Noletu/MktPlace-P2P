#!/bin/bash

# Script de Teste Completo CORRIGIDO - Mktplace P2P
# Simulação com 2 usuários testando TODAS funcionalidades

BASE_URL="http://localhost:3001/api/v1"

# CPFs válidos (com dígitos verificadores corretos)
MARIA_CPF="52998224725"
JOAO_CPF="51188453094"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Variáveis globais para tokens e IDs
MARIA_TOKEN=""
MARIA_ID=""
JOAO_TOKEN=""
JOAO_ID=""
ADMIN_TOKEN=""

MARIA_ORDER_ID=""
JOAO_ORDER_ID=""
CHAT_ID=""
TRANSACTION_ID=""
DISPUTE_ID=""
MARIA_COLLATERAL_ADDRESS_ID=""
JOAO_COLLATERAL_ADDRESS_ID=""
MARIA_BALANCE_ID=""
JOAO_BALANCE_ID=""

# ========================================
# FASE 1: SETUP E AUTENTICAÇÃO (CORRIGIDO)
# ========================================

log_section "FASE 1: SETUP E AUTENTICAÇÃO (CORRIGIDO)"

# 1.1 Registro de Usuários
log "1.1 Testando registro de usuários..."

# Registrar Maria
log_info "Registrando Maria com CPF válido: $MARIA_CPF"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.vendedor@teste.com",
    "password": "Senha123!",
    "cpf": "'"$MARIA_CPF"'",
    "name": "Maria Vendedor"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_success "Maria registrada com sucesso"
    MARIA_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
    log_info "Maria ID: $MARIA_ID"
else
    log_error "Falha ao registrar Maria: $RESPONSE"
fi

# Registrar João
log_info "Registrando João com CPF válido: $JOAO_CPF"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao.comprador@teste.com",
    "password": "Senha456!",
    "cpf": "'"$JOAO_CPF"'",
    "name": "João Comprador"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_success "João registrado com sucesso"
    JOAO_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
    log_info "João ID: $JOAO_ID"
else
    log_error "Falha ao registrar João: $RESPONSE"
fi

# Testar CPF duplicado
log_info "Testando validação de CPF duplicado..."
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "outro@teste.com",
    "password": "Senha123!",
    "cpf": "'"$MARIA_CPF"'",
    "name": "Outro Usuario"
  }')

if echo "$RESPONSE" | grep -qE '(success.*false|erro|CPF já cadastrado|já existe)'; then
    log_success "Validação de CPF duplicado funcionando"
else
    log_error "Sistema permitiu CPF duplicado: $RESPONSE"
    log_bug "BUG #1: Sistema não valida CPF duplicado no registro"
fi

# 1.2 Login e Autenticação
log "1.2 Testando login..."

# Login Maria
log_info "Fazendo login de Maria..."
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.vendedor@teste.com",
    "password": "Senha123!"
  }')

if echo "$RESPONSE" | grep -q '"accessToken"'; then
    log_success "Maria logada com sucesso"
    MARIA_TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    log_info "Token Maria: ${MARIA_TOKEN:0:30}..."
else
    log_error "Falha ao fazer login de Maria: $RESPONSE"
fi

# Login João
log_info "Fazendo login de João..."
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao.comprador@teste.com",
    "password": "Senha456!"
  }')

if echo "$RESPONSE" | grep -q '"accessToken"'; then
    log_success "João logado com sucesso"
    JOAO_TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    log_info "Token João: ${JOAO_TOKEN:0:30}..."
else
    log_error "Falha ao fazer login de João: $RESPONSE"
fi

# Testar senha incorreta
log_info "Testando senha incorreta..."
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.vendedor@teste.com",
    "password": "SenhaErrada!"
  }')

if echo "$RESPONSE" | grep -qE '(success.*false|erro|inválid|incorret)'; then
    log_success "Validação de senha incorreta funcionando"
else
    log_error "Sistema não validou senha incorreta: $RESPONSE"
fi

# 1.3 Verificar autenticação (ROTA CORRETA: /auth/me)
log "1.3 Testando proteção de rotas..."

# Tentar acessar rota protegida sem token
log_info "Tentando acessar /auth/me sem token..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/auth/me" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [[ "$HTTP_CODE" == "401" ]] || echo "$RESPONSE" | grep -qE '(401|Unauthorized|Authentication|token)'; then
    log_success "Proteção de rotas sem token funcionando (HTTP $HTTP_CODE)"
else
    log_error "Rota protegida acessível sem token (HTTP $HTTP_CODE)"
    log_bug "BUG #2: Falha na autenticação - rotas desprotegidas"
fi

# Acessar com token válido
log_info "Acessando /auth/me com token válido..."
RESPONSE=$(curl -s "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $MARIA_TOKEN")

if echo "$RESPONSE" | grep -qE '(success.*true|email|maria)'; then
    log_success "Acesso com token válido funcionando"
    log_info "Dados de Maria: $(echo "$RESPONSE" | grep -o '"kycLevel":"[^"]*' | cut -d'"' -f4)"
else
    log_error "Falha ao acessar rota com token válido: $RESPONSE"
fi

# ========================================
# FASE 2: SISTEMA KYC (CORRIGIDO)
# ========================================

log_section "FASE 2: SISTEMA KYC (CORRIGIDO)"

# 2.1 KYC Level 1 - Maria (COM FULLNAME E TELEFONE SEM MÁSCARA)
log "2.1 Testando KYC Level 1 - Maria..."

log_info "Submetendo KYC Level 1 com fullName, CPF válido e telefone sem máscara..."
RESPONSE=$(curl -s -X POST "$BASE_URL/kyc/level1" \
  -H "Authorization: Bearer $MARIA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Maria Silva Vendedor",
    "cpf": "'"$MARIA_CPF"'",
    "phone": "11987654321"
  }')

if echo "$RESPONSE" | grep -qE '(success.*true|aprovado|LEVEL_1)'; then
    log_success "Maria completou KYC Level 1"
    log_info "Resposta: $(echo "$RESPONSE" | grep -o '"kycLevel":"[^"]*' | cut -d'"' -f4)"
else
    log_error "Falha no KYC Level 1 de Maria: $RESPONSE"
fi

# 2.2 KYC Level 1 - João
log "2.2 Testando KYC Level 1 - João..."

log_info "Submetendo KYC Level 1 de João..."
RESPONSE=$(curl -s -X POST "$BASE_URL/kyc/level1" \
  -H "Authorization: Bearer $JOAO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "João Pedro Comprador",
    "cpf": "'"$JOAO_CPF"'",
    "phone": "11912345678"
  }')

if echo "$RESPONSE" | grep -qE '(success.*true|aprovado|LEVEL_1)'; then
    log_success "João completou KYC Level 1"
else
    log_error "Falha no KYC Level 1 de João: $RESPONSE"
fi

# 2.3 Verificar perfil atualizado
log "2.3 Verificando se KYC foi atualizado no perfil..."

RESPONSE=$(curl -s "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $MARIA_TOKEN")

if echo "$RESPONSE" | grep -q '"kycLevel":"LEVEL_1"'; then
    log_success "KYC Level atualizado corretamente no perfil de Maria"
else
    log_error "KYC Level não atualizado no perfil: $RESPONSE"
fi

# 2.4 Testar duplicação de CPF no KYC
log "2.4 Testando validação de CPF duplicado no KYC..."

# Criar novo usuário
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste3@teste.com",
    "password": "Senha123!",
    "cpf": "13669396000",
    "name": "Teste Tres"
  }')

TESTE3_TOKEN=""
if echo "$RESPONSE" | grep -q '"success":true'; then
    TESTE3_TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
fi

# Tentar usar CPF de Maria no KYC do novo usuário
if [ -n "$TESTE3_TOKEN" ]; then
    log_info "Tentando submeter KYC com CPF já cadastrado..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/kyc/level1" \
      -H "Authorization: Bearer $TESTE3_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "fullName": "Teste Tres",
        "cpf": "'"$MARIA_CPF"'",
        "phone": "11999999999"
      }')

    if echo "$RESPONSE" | grep -qE '(success.*false|erro|CPF já|duplicado|existe)'; then
        log_success "Validação de CPF duplicado no KYC funcionando"
    else
        log_error "Sistema permitiu CPF duplicado no KYC: $RESPONSE"
        log_bug "BUG #3: Sistema não valida CPF duplicado no KYC"
    fi
fi

# ========================================
# RELATÓRIO PARCIAL
# ========================================

log_section "RELATÓRIO PARCIAL - FASE 1 e 2"

echo ""
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
echo -e "${GREEN}Taxa de sucesso: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%${NC}"
echo ""
echo "Tokens salvos:"
echo "  MARIA_TOKEN: ${MARIA_TOKEN:0:20}..."
echo "  JOAO_TOKEN: ${JOAO_TOKEN:0:20}..."
echo "  MARIA_ID: $MARIA_ID"
echo "  JOAO_ID: $JOAO_ID"
echo ""

# Salvar tokens em arquivo temporário para próximas fases
cat > /tmp/test-tokens.sh <<EOF
export MARIA_TOKEN="$MARIA_TOKEN"
export JOAO_TOKEN="$JOAO_TOKEN"
export MARIA_ID="$MARIA_ID"
export JOAO_ID="$JOAO_ID"
export MARIA_CPF="$MARIA_CPF"
export JOAO_CPF="$JOAO_CPF"
EOF

log_info "Tokens salvos em /tmp/test-tokens.sh"
echo ""
echo -e "${BLUE}Pronto para continuar para FASE 3: Sistema de Saldo Interno${NC}"
