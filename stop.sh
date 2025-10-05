#!/bin/bash

echo ""
echo "========================================"
echo "  🛑 MktPlace P2P - Parar Serviços"
echo "========================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "[1/3] 🔍 Procurando processos do projeto..."
echo ""

# Variáveis para PIDs
API_PID=""
WEB_PID=""

# Tentar ler PIDs dos arquivos salvos
if [ -f logs/api.pid ]; then
    API_PID=$(cat logs/api.pid 2>/dev/null)
fi

if [ -f logs/web.pid ]; then
    WEB_PID=$(cat logs/web.pid 2>/dev/null)
fi

# Se não encontrou nos arquivos, procurar pelas portas
if [ -z "$API_PID" ]; then
    if command -v lsof &> /dev/null; then
        API_PID=$(lsof -ti:3001 2>/dev/null)
    else
        # Fallback para netstat (Linux)
        API_PID=$(netstat -tlnp 2>/dev/null | grep :3001 | awk '{print $7}' | cut -d'/' -f1)
    fi
fi

if [ -z "$WEB_PID" ]; then
    if command -v lsof &> /dev/null; then
        WEB_PID=$(lsof -ti:3000 2>/dev/null)
    else
        # Fallback para netstat (Linux)
        WEB_PID=$(netstat -tlnp 2>/dev/null | grep :3000 | awk '{print $7}' | cut -d'/' -f1)
    fi
fi

echo "[2/3] 🛑 Parando serviços..."
echo ""

# Parar API
if [ -n "$API_PID" ]; then
    echo -e "${RED}🔴 Parando API (PID: $API_PID)...${NC}"
    kill -9 $API_PID 2>/dev/null && echo -e "${GREEN}✅ API parada${NC}" || echo -e "${YELLOW}⚠️  API já estava parada${NC}"
    rm -f logs/api.pid
else
    echo -e "${YELLOW}ℹ️  API não está rodando (porta 3001 livre)${NC}"
fi

# Parar Frontend
if [ -n "$WEB_PID" ]; then
    echo -e "${RED}🔴 Parando Frontend (PID: $WEB_PID)...${NC}"
    kill -9 $WEB_PID 2>/dev/null && echo -e "${GREEN}✅ Frontend parado${NC}" || echo -e "${YELLOW}⚠️  Frontend já estava parado${NC}"
    rm -f logs/web.pid
else
    echo -e "${YELLOW}ℹ️  Frontend não está rodando (porta 3000 livre)${NC}"
fi

echo ""
echo "[3/3] 🧹 Limpando processos Node.js órfãos..."
echo ""

# Matar processos Node.js relacionados ao projeto
ORPHAN_PIDS=$(ps aux | grep -E '(tsx|next)' | grep -v grep | awk '{print $2}')

if [ -n "$ORPHAN_PIDS" ]; then
    echo "$ORPHAN_PIDS" | while read pid; do
        if [ -n "$pid" ]; then
            echo -e "${RED}🔴 Parando processo Node.js (PID: $pid)...${NC}"
            kill -9 $pid 2>/dev/null
        fi
    done
else
    echo -e "${GREEN}✅ Nenhum processo órfão encontrado${NC}"
fi

echo ""
echo "========================================"
echo "  ✅ Serviços Parados!"
echo "========================================"
echo ""

# Verificar se portas estão realmente livres
echo "📊 Verificando portas..."
echo ""

if command -v lsof &> /dev/null; then
    # Usar lsof (Mac/algumas versões Linux)
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Porta 3001 (API)      : Ainda em uso${NC}"
        echo "   Execute novamente este script"
    else
        echo -e "${GREEN}✅ Porta 3001 (API)      : Livre${NC}"
    fi

    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Porta 3000 (Frontend) : Ainda em uso${NC}"
        echo "   Execute novamente este script"
    else
        echo -e "${GREEN}✅ Porta 3000 (Frontend) : Livre${NC}"
    fi
else
    # Usar netstat (Linux)
    if netstat -an 2>/dev/null | grep :3001 | grep LISTEN >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Porta 3001 (API)      : Ainda em uso${NC}"
    else
        echo -e "${GREEN}✅ Porta 3001 (API)      : Livre${NC}"
    fi

    if netstat -an 2>/dev/null | grep :3000 | grep LISTEN >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Porta 3000 (Frontend) : Ainda em uso${NC}"
    else
        echo -e "${GREEN}✅ Porta 3000 (Frontend) : Livre${NC}"
    fi
fi

echo ""
echo "💡 Dicas:"
echo "   - Para iniciar novamente: bash start.sh"
echo "   - Logs foram preservados em logs/"
echo ""
