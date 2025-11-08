#!/bin/bash

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}${CYAN}========================================${NC}"
echo -e "${BOLD}${CYAN}  🗑️  MktPlace P2P - Limpeza do Banco${NC}"
echo -e "${BOLD}${CYAN}========================================${NC}"
echo ""
echo -e "${RED}${BOLD}⚠️  ATENÇÃO: Esta operação deletará TODOS os dados!${NC}"
echo ""
echo -e "${YELLOW}O que será DELETADO:${NC}"
echo "  ❌ Todos os usuários comuns"
echo "  ❌ Todas as carteiras"
echo "  ❌ Todos os pedidos e transações"
echo "  ❌ Todos os chats e mensagens"
echo "  ❌ Todas as notificações"
echo "  ❌ Todas as disputas e avaliações"
echo "  ❌ Todo o histórico de auditoria"
echo "  ❌ Todos os saldos e colaterais"
echo ""
echo -e "${GREEN}O que será PRESERVADO:${NC}"
echo "  ✅ Usuário MASTER (master@mktplace.com)"
echo "  ✅ Usuário ADMIN (admin@mktplace.com)"
echo "  ✅ Estrutura do banco (schema, migrations)"
echo ""
echo -e "${BLUE}💾 Um BACKUP AUTOMÁTICO será criado antes da limpeza!${NC}"
echo ""
echo -e "${BOLD}========================================${NC}"
echo ""

# Verificar Node.js
echo -e "${BLUE}[1/5]${NC} 🔍 Verificando Node.js..."
echo ""

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ ERRO: Node.js não encontrado!${NC}"
    echo ""
    echo "Por favor, instale o Node.js: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js instalado${NC}"
echo ""

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ ERRO: npm não encontrado!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm instalado${NC}"
echo ""

# Verificar se servidor está rodando
echo -e "${BLUE}[2/5]${NC} 🔍 Verificando se servidor está rodando..."
echo ""

SERVER_RUNNING=false

# Verificar porta 3001 (API)
if command -v lsof &> /dev/null; then
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        SERVER_RUNNING=true
    fi
else
    if netstat -an 2>/dev/null | grep :3001 | grep LISTEN >/dev/null 2>&1; then
        SERVER_RUNNING=true
    fi
fi

if [ "$SERVER_RUNNING" = true ]; then
    echo -e "${YELLOW}⚠️  Servidor detectado rodando na porta 3001!${NC}"
    echo ""
    read -p "Deseja parar o servidor antes de limpar? (S/n): " parar

    if [[ -z "$parar" ]] || [[ "$parar" =~ ^[Ss]$ ]] || [[ "$parar" =~ ^[Ss][Ii][Mm]$ ]]; then
        echo ""
        echo -e "${BLUE}🛑 Parando servidor...${NC}"
        bash stop.sh
        echo ""
        echo "⏳ Aguardando 3 segundos..."
        sleep 3
    else
        echo ""
        echo -e "${YELLOW}⚠️  Continuando com servidor rodando...${NC}"
    fi
else
    echo -e "${GREEN}✅ Servidor não está rodando${NC}"
fi

echo ""

# Listar backups existentes
echo -e "${BLUE}[3/5]${NC} 📦 Backups existentes:"
echo ""

if ls apps/api/prisma/dev.db.backup-* 2>/dev/null | head -5; then
    echo ""
    echo -e "${YELLOW}💡 Dica: Backups mais antigos podem ser deletados para economizar espaço${NC}"
else
    echo -e "${YELLOW}ℹ️  Nenhum backup encontrado (será criado agora)${NC}"
fi

echo ""

# Solicitar confirmação
echo -e "${BLUE}[4/5]${NC} ⚠️  Confirmação necessária"
echo ""
read -p "$(echo -e ${BOLD}${RED}Tem certeza que deseja limpar o banco? \(s/N\): ${NC})" confirmacao

if [[ ! "$confirmacao" =~ ^[Ss]$ ]] && [[ ! "$confirmacao" =~ ^[Ss][Ii][Mm]$ ]]; then
    echo ""
    echo -e "${YELLOW}❌ Operação cancelada pelo usuário${NC}"
    echo ""
    exit 0
fi

echo ""
echo -e "${BLUE}[5/5]${NC} 🧹 Executando limpeza do banco..."
echo ""
echo -e "${CYAN}${BOLD}IMPORTANTE: Um backup será criado automaticamente!${NC}"
echo ""

# Executar limpeza
cd apps/api
if npm run db:clean; then
    cd ../..

    echo ""
    echo -e "${BOLD}${GREEN}========================================${NC}"
    echo -e "${BOLD}${GREEN}  ✅ Banco Limpo com Sucesso!${NC}"
    echo -e "${BOLD}${GREEN}========================================${NC}"
    echo ""

    # Listar backups criados
    echo -e "${BLUE}💾 Backups disponíveis:${NC}"
    echo ""
    ls -lh apps/api/prisma/dev.db.backup-* 2>/dev/null | tail -3 | awk '{print "   " $9 " (" $5 ")"}'
    echo ""

    # Mostrar credenciais
    echo -e "${CYAN}🔐 Credenciais Disponíveis:${NC}"
    echo "  ┌─────────────────────────────────────┐"
    echo "  │ ${BOLD}Master:${NC}                             │"
    echo "  │   Email: master@mktplace.com        │"
    echo "  │   Senha: Master@2025!               │"
    echo "  │                                     │"
    echo "  │ ${BOLD}Admin:${NC}                              │"
    echo "  │   Email: admin@mktplace.com         │"
    echo "  │   Senha: Admin@123                  │"
    echo "  └─────────────────────────────────────┘"
    echo ""

    # Próximos passos
    echo -e "${YELLOW}📋 Próximos Passos:${NC}"
    echo "  1. Reiniciar servidor: bash start.sh"
    echo "  2. Fazer login com credenciais acima"
    echo "  3. Cadastrar carteiras da plataforma (ou executar seed)"
    echo ""

    # Dicas
    echo -e "${BLUE}💡 Dicas:${NC}"
    echo "  - Ver backups:      ls -lh apps/api/prisma/dev.db.backup-*"
    echo "  - Restaurar backup: cd apps/api/prisma && cp dev.db.backup-XXX dev.db"
    echo "  - Executar seed:    cd apps/api && npm run prisma:seed"
    echo ""

    echo -e "${BOLD}${GREEN}========================================${NC}"
    echo ""

else
    cd ../..

    echo ""
    echo -e "${BOLD}${RED}========================================${NC}"
    echo -e "${BOLD}${RED}  ❌ ERRO: Falha na limpeza do banco!${NC}"
    echo -e "${BOLD}${RED}========================================${NC}"
    echo ""
    echo "Verifique os logs acima para detalhes."
    echo "O backup NÃO foi afetado se foi criado."
    echo ""
    exit 1
fi
