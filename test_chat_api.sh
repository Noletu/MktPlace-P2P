#!/bin/bash

# Script de Teste Automatizado - API REST do Chat P2P
# Projeto: Mktplace da Liberdade
# Versão: 1.0
# Data: 20/10/2025

set -e  # Exit on error

# ========================================
# CONFIGURAÇÕES
# ========================================

API_URL="http://localhost:3001/api/v1"
LOG_FILE="test_chat_results.log"
VERBOSE=1

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========================================
# FUNÇÕES AUXILIARES
# ========================================

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

# ========================================
# VERIFICAÇÕES INICIAIS
# ========================================

echo "========================================" > "$LOG_FILE"
echo "TESTE AUTOMATIZADO - CHAT API REST" >> "$LOG_FILE"
echo "Data: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

log "Iniciando testes da API de Chat..."

# Verificar se API está rodando
log "Verificando se API está online..."
if curl -s -f "$API_URL/../health" > /dev/null; then
    success "API está online"
else
    error "API não está respondendo em $API_URL"
    error "Certifique-se de iniciar o backend: cd apps/api && npm run dev"
    exit 1
fi

# ========================================
# TESTES DE AUTENTICAÇÃO
# ========================================

log "========================================="
log "FASE 1: AUTENTICAÇÃO"
log "========================================="

# Teste 1.1: Registrar Usuário A (teste)
log "Teste 1.1: Registrando usuário 'teste'..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "teste@example.com",
        "password": "senha123",
        "cpf": "12345678901",
        "name": "Usuário Teste"
    }' 2>&1)

if echo "$REGISTER_RESPONSE" | grep -q '"success":true\|"email":"teste@example.com"'; then
    success "Usuário 'teste' registrado com sucesso"
else
    if echo "$REGISTER_RESPONSE" | grep -q "já existe\|already exists"; then
        warning "Usuário 'teste' já existe (OK para testes)"
    else
        error "Falha ao registrar usuário 'teste'"
        echo "$REGISTER_RESPONSE" | tee -a "$LOG_FILE"
    fi
fi

# Teste 1.2: Login Usuário A
log "Teste 1.2: Fazendo login como 'teste'..."
LOGIN_A_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -c cookies_a.txt \
    -d '{
        "email": "teste@example.com",
        "password": "senha123"
    }' 2>&1)

if echo "$LOGIN_A_RESPONSE" | grep -q '"success":true'; then
    TOKEN_A=$(echo "$LOGIN_A_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    USER_A_ID=$(echo "$LOGIN_A_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    success "Login de 'teste' bem-sucedido (ID: $USER_A_ID)"
    log "Token A: ${TOKEN_A:0:20}..."
else
    error "Falha no login de 'teste'"
    echo "$LOGIN_A_RESPONSE" | tee -a "$LOG_FILE"
    exit 1
fi

# Teste 1.3: Registrar Usuário B (teste2)
log "Teste 1.3: Registrando usuário 'teste2'..."
REGISTER_B_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "teste2@example.com",
        "password": "senha123",
        "cpf": "98765432101",
        "name": "Usuário Teste 2"
    }' 2>&1)

if echo "$REGISTER_B_RESPONSE" | grep -q '"success":true\|"email":"teste2@example.com"'; then
    success "Usuário 'teste2' registrado com sucesso"
else
    if echo "$REGISTER_B_RESPONSE" | grep -q "já existe\|already exists"; then
        warning "Usuário 'teste2' já existe (OK para testes)"
    else
        error "Falha ao registrar usuário 'teste2'"
        echo "$REGISTER_B_RESPONSE" | tee -a "$LOG_FILE"
    fi
fi

# Teste 1.4: Login Usuário B
log "Teste 1.4: Fazendo login como 'teste2'..."
LOGIN_B_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -c cookies_b.txt \
    -d '{
        "email": "teste2@example.com",
        "password": "senha123"
    }' 2>&1)

if echo "$LOGIN_B_RESPONSE" | grep -q '"success":true'; then
    TOKEN_B=$(echo "$LOGIN_B_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    USER_B_ID=$(echo "$LOGIN_B_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    success "Login de 'teste2' bem-sucedido (ID: $USER_B_ID)"
    log "Token B: ${TOKEN_B:0:20}..."
else
    error "Falha no login de 'teste2'"
    echo "$LOGIN_B_RESPONSE" | tee -a "$LOG_FILE"
    exit 1
fi

# ========================================
# TESTES DE CRIAÇÃO DE PEDIDO
# ========================================

log "========================================="
log "FASE 2: CRIAÇÃO DE PEDIDO"
log "========================================="

# Teste 2.1: Usuário A cria pedido PIX
log "Teste 2.1: Usuário A cria pedido PIX de R$ 500..."
CREATE_ORDER_RESPONSE=$(curl -s -X POST "$API_URL/orders" \
    -H "Content-Type: application/json" \
    -b cookies_a.txt \
    -d '{
        "type": "PIX",
        "cryptoType": "BTC",
        "cryptoNetwork": "BITCOIN",
        "cryptoAmount": "0.01",
        "brlAmount": "500.00",
        "paymentDetails": {
            "pixKey": "teste@example.com",
            "pixKeyType": "EMAIL"
        }
    }' 2>&1)

if echo "$CREATE_ORDER_RESPONSE" | grep -q '"success":true'; then
    ORDER_ID=$(echo "$CREATE_ORDER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    success "Pedido criado com sucesso (ID: $ORDER_ID)"
else
    error "Falha ao criar pedido"
    echo "$CREATE_ORDER_RESPONSE" | tee -a "$LOG_FILE"
    exit 1
fi

# ========================================
# TESTES DE CHAT - CRIAÇÃO E ACESSO
# ========================================

log "========================================="
log "FASE 3: CHAT - CRIAÇÃO E ACESSO"
log "========================================="

# Teste 3.1: Tentar acessar chat antes de negociação (deve falhar)
log "Teste 3.1: Usuário A tenta acessar chat antes de negociação (deve falhar)..."
GET_CHAT_BEFORE=$(curl -s -X GET "$API_URL/chat/order/$ORDER_ID" \
    -b cookies_a.txt \
    -w "\nHTTP_STATUS:%{http_code}" 2>&1)

HTTP_STATUS=$(echo "$GET_CHAT_BEFORE" | grep "HTTP_STATUS" | cut -d':' -f2)
if [ "$HTTP_STATUS" = "400" ] || echo "$GET_CHAT_BEFORE" | grep -q "Chat não disponível"; then
    success "Bloqueio correto: owner não pode acessar chat antes de negociação"
else
    error "Falha: deveria bloquear owner antes de negociação"
    echo "$GET_CHAT_BEFORE" | tee -a "$LOG_FILE"
fi

# Teste 3.2: Usuário B acessa marketplace
log "Teste 3.2: Usuário B busca pedidos disponíveis..."
GET_MARKETPLACE=$(curl -s -X GET "$API_URL/orders/available" \
    -b cookies_b.txt 2>&1)

if echo "$GET_MARKETPLACE" | grep -q "$ORDER_ID"; then
    success "Pedido de A aparece no marketplace para B"
else
    error "Pedido não aparece no marketplace"
    echo "$GET_MARKETPLACE" | tee -a "$LOG_FILE"
fi

# Teste 3.3: Usuário B cria/acessa chat (GET /chat/order/:orderId)
log "Teste 3.3: Usuário B acessa chat do pedido..."
GET_CHAT_B=$(curl -s -X GET "$API_URL/chat/order/$ORDER_ID" \
    -b cookies_b.txt 2>&1)

if echo "$GET_CHAT_B" | grep -q '"success":true'; then
    CHAT_ID=$(echo "$GET_CHAT_B" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    success "Chat criado/acessado com sucesso (Chat ID: $CHAT_ID)"
else
    error "Falha ao acessar/criar chat"
    echo "$GET_CHAT_B" | tee -a "$LOG_FILE"
    exit 1
fi

# ========================================
# TESTES DE MENSAGENS
# ========================================

log "========================================="
log "FASE 4: ENVIO E RECEBIMENTO DE MENSAGENS"
log "========================================="

# Teste 4.1: Usuário B envia primeira mensagem
log "Teste 4.1: Usuário B envia primeira mensagem..."
SEND_MSG_B=$(curl -s -X POST "$API_URL/chat/$CHAT_ID/messages" \
    -H "Content-Type: application/json" \
    -b cookies_b.txt \
    -d '{
        "message": "Olá! Tenho interesse no seu pedido de R$ 500."
    }' 2>&1)

if echo "$SEND_MSG_B" | grep -q '"success":true'; then
    MESSAGE_1_ID=$(echo "$SEND_MSG_B" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    success "Primeira mensagem enviada (ID: $MESSAGE_1_ID)"
    log "Esta mensagem deve iniciar negociação (PENDING → IN_NEGOTIATION)"
else
    error "Falha ao enviar primeira mensagem"
    echo "$SEND_MSG_B" | tee -a "$LOG_FILE"
    exit 1
fi

# Aguardar processamento assíncrono
sleep 2

# Teste 4.2: Verificar se pedido mudou para IN_NEGOTIATION
log "Teste 4.2: Verificando se pedido mudou para IN_NEGOTIATION..."
GET_ORDER_STATUS=$(curl -s -X GET "$API_URL/orders/$ORDER_ID" \
    -b cookies_a.txt 2>&1)

if echo "$GET_ORDER_STATUS" | grep -q '"status":"IN_NEGOTIATION"'; then
    success "Pedido mudou para IN_NEGOTIATION após primeira mensagem"
else
    error "Pedido não mudou para IN_NEGOTIATION"
    echo "$GET_ORDER_STATUS" | tee -a "$LOG_FILE"
fi

# Teste 4.3: Usuário A acessa chat (agora deve funcionar)
log "Teste 4.3: Usuário A acessa chat após negociação iniciada..."
GET_CHAT_A=$(curl -s -X GET "$API_URL/chat/order/$ORDER_ID" \
    -b cookies_a.txt \
    -w "\nHTTP_STATUS:%{http_code}" 2>&1)

HTTP_STATUS_A=$(echo "$GET_CHAT_A" | grep "HTTP_STATUS" | cut -d':' -f2)
if [ "$HTTP_STATUS_A" = "200" ] && echo "$GET_CHAT_A" | grep -q '"success":true'; then
    success "Usuário A consegue acessar chat após negociação iniciada"
else
    error "Falha: Usuário A não consegue acessar chat (BUG CRÍTICO!)"
    echo "$GET_CHAT_A" | tee -a "$LOG_FILE"
fi

# Teste 4.4: Usuário A busca mensagens do chat
log "Teste 4.4: Usuário A busca mensagens do chat..."
GET_MESSAGES_A=$(curl -s -X GET "$API_URL/chat/$CHAT_ID/messages" \
    -b cookies_a.txt 2>&1)

if echo "$GET_MESSAGES_A" | grep -q "Tenho interesse no seu pedido"; then
    success "Usuário A vê mensagem de B no histórico"
else
    error "Usuário A não vê mensagem de B"
    echo "$GET_MESSAGES_A" | tee -a "$LOG_FILE"
fi

# Teste 4.5: Usuário A responde
log "Teste 4.5: Usuário A envia resposta..."
SEND_MSG_A=$(curl -s -X POST "$API_URL/chat/$CHAT_ID/messages" \
    -H "Content-Type: application/json" \
    -b cookies_a.txt \
    -d '{
        "message": "Olá! Sim, o pedido está disponível. Podemos prosseguir."
    }' 2>&1)

if echo "$SEND_MSG_A" | grep -q '"success":true'; then
    success "Usuário A enviou resposta com sucesso"
else
    error "Falha ao enviar resposta de A"
    echo "$SEND_MSG_A" | tee -a "$LOG_FILE"
fi

# Teste 4.6: Usuário B vê resposta de A
log "Teste 4.6: Usuário B busca mensagens (deve ver resposta de A)..."
GET_MESSAGES_B=$(curl -s -X GET "$API_URL/chat/$CHAT_ID/messages" \
    -b cookies_b.txt 2>&1)

if echo "$GET_MESSAGES_B" | grep -q "Podemos prosseguir"; then
    success "Usuário B vê resposta de A no histórico"
else
    error "Usuário B não vê resposta de A"
    echo "$GET_MESSAGES_B" | tee -a "$LOG_FILE"
fi

# Teste 4.7: Teste de mensagem vazia (deve falhar)
log "Teste 4.7: Tentando enviar mensagem vazia (deve falhar)..."
SEND_EMPTY=$(curl -s -X POST "$API_URL/chat/$CHAT_ID/messages" \
    -H "Content-Type: application/json" \
    -b cookies_a.txt \
    -d '{
        "message": ""
    }' 2>&1)

if echo "$SEND_EMPTY" | grep -q '"success":false\|error'; then
    success "Mensagem vazia bloqueada corretamente"
else
    warning "Mensagem vazia foi aceita (deveria bloquear)"
fi

# Teste 4.8: Teste de mensagem com caracteres especiais
log "Teste 4.8: Enviando mensagem com caracteres especiais..."
SEND_SPECIAL=$(curl -s -X POST "$API_URL/chat/$CHAT_ID/messages" \
    -H "Content-Type: application/json" \
    -b cookies_b.txt \
    -d '{
        "message": "🔥 Testando áéíóú 特殊文字 <script>alert(\"xss\")</script>"
    }' 2>&1)

if echo "$SEND_SPECIAL" | grep -q '"success":true'; then
    success "Mensagem com caracteres especiais aceita"
else
    error "Falha ao enviar mensagem com caracteres especiais"
    echo "$SEND_SPECIAL" | tee -a "$LOG_FILE"
fi

# ========================================
# TESTES DE SEGURANÇA
# ========================================

log "========================================="
log "FASE 5: SEGURANÇA E PERMISSÕES"
log "========================================="

# Teste 5.1: Usuário sem autenticação tenta acessar chat
log "Teste 5.1: Tentando acessar chat sem token (deve falhar)..."
GET_CHAT_NO_AUTH=$(curl -s -X GET "$API_URL/chat/$CHAT_ID" \
    -w "\nHTTP_STATUS:%{http_code}" 2>&1)

HTTP_STATUS_NO_AUTH=$(echo "$GET_CHAT_NO_AUTH" | grep "HTTP_STATUS" | cut -d':' -f2)
if [ "$HTTP_STATUS_NO_AUTH" = "401" ] || echo "$GET_CHAT_NO_AUTH" | grep -q "Unauthorized\|não autenticado"; then
    success "Acesso sem autenticação bloqueado corretamente"
else
    error "Falha de segurança: acesso sem autenticação permitido!"
    echo "$GET_CHAT_NO_AUTH" | tee -a "$LOG_FILE"
fi

# Teste 5.2: Usuário C tenta acessar chat de A e B
log "Teste 5.2: Criando usuário C para teste de permissão..."
REGISTER_C=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "teste3@example.com",
        "password": "senha123",
        "cpf": "11122233301",
        "name": "Usuário Teste 3"
    }' 2>&1)

LOGIN_C=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -c cookies_c.txt \
    -d '{
        "email": "teste3@example.com",
        "password": "senha123"
    }' 2>&1)

if echo "$LOGIN_C" | grep -q '"success":true'; then
    log "Usuário C logado, tentando acessar chat de A e B..."
    GET_CHAT_C=$(curl -s -X GET "$API_URL/chat/$CHAT_ID" \
        -b cookies_c.txt \
        -w "\nHTTP_STATUS:%{http_code}" 2>&1)

    HTTP_STATUS_C=$(echo "$GET_CHAT_C" | grep "HTTP_STATUS" | cut -d':' -f2)
    if [ "$HTTP_STATUS_C" = "403" ] || echo "$GET_CHAT_C" | grep -q "não tem permissão\|Forbidden"; then
        success "Usuário C bloqueado de acessar chat de outros (segurança OK)"
    else
        error "Falha de segurança: Usuário C acessou chat de outros!"
        echo "$GET_CHAT_C" | tee -a "$LOG_FILE"
    fi
else
    warning "Não foi possível criar usuário C para teste de permissão"
fi

# ========================================
# TESTES DE CONTADORES
# ========================================

log "========================================="
log "FASE 6: CONTADORES E STATUS"
log "========================================="

# Teste 6.1: Contador de chats não lidos
log "Teste 6.1: Verificando contador de chats não lidos de A..."
GET_UNREAD_COUNT_A=$(curl -s -X GET "$API_URL/chat/unread-count" \
    -b cookies_a.txt 2>&1)

if echo "$GET_UNREAD_COUNT_A" | grep -q '"unreadCount"'; then
    UNREAD_COUNT=$(echo "$GET_UNREAD_COUNT_A" | grep -o '"unreadCount":[0-9]*' | cut -d':' -f2)
    success "Contador de não lidas: $UNREAD_COUNT"
else
    error "Falha ao buscar contador de não lidas"
    echo "$GET_UNREAD_COUNT_A" | tee -a "$LOG_FILE"
fi

# Teste 6.2: Marcar mensagens como lidas
log "Teste 6.2: Usuário A marca mensagens como lidas..."
MARK_READ=$(curl -s -X POST "$API_URL/chat/$CHAT_ID/read" \
    -b cookies_a.txt 2>&1)

if echo "$MARK_READ" | grep -q '"success":true'; then
    success "Mensagens marcadas como lidas"
else
    error "Falha ao marcar mensagens como lidas"
    echo "$MARK_READ" | tee -a "$LOG_FILE"
fi

# Teste 6.3: Listar todos os chats de A
log "Teste 6.3: Listando chats de A..."
GET_USER_CHATS=$(curl -s -X GET "$API_URL/chat" \
    -b cookies_a.txt 2>&1)

if echo "$GET_USER_CHATS" | grep -q "$CHAT_ID"; then
    success "Chat aparece na lista de chats de A"
else
    error "Chat não aparece na lista"
    echo "$GET_USER_CHATS" | tee -a "$LOG_FILE"
fi

# ========================================
# RESUMO DOS TESTES
# ========================================

log "========================================="
log "RESUMO DOS TESTES"
log "========================================="

TOTAL_TESTS=15
PASSED_TESTS=$(grep -c "✅" "$LOG_FILE" || echo 0)
FAILED_TESTS=$(grep -c "❌" "$LOG_FILE" || echo 0)
WARNING_TESTS=$(grep -c "⚠️" "$LOG_FILE" || echo 0)

SUCCESS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)

echo ""
log "📊 ESTATÍSTICAS FINAIS"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Total de testes:      $TOTAL_TESTS"
success "Aprovados:            $PASSED_TESTS"
error "Reprovados:           $FAILED_TESTS"
warning "Avisos:               $WARNING_TESTS"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Taxa de sucesso:      $SUCCESS_RATE%"
echo ""

if [ "$FAILED_TESTS" -eq 0 ]; then
    success "🎉 TODOS OS TESTES PASSARAM!"
    log "O sistema de chat está funcionando corretamente."
else
    error "⚠️  ALGUNS TESTES FALHARAM"
    log "Verifique os erros acima e corrija antes de prosseguir."
fi

log "Resultados completos salvos em: $LOG_FILE"

# Cleanup cookies
rm -f cookies_a.txt cookies_b.txt cookies_c.txt

exit 0
