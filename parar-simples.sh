#!/bin/bash

echo ""
echo "=========================================="
echo "  🛑 MktPlace P2P - Parar Serviços"
echo "=========================================="
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Parar pela porta 3001 (API)
if lsof -i:3001 -t >/dev/null 2>&1; then
    echo "🔧 Parando API (porta 3001)..."
    kill -9 $(lsof -i:3001 -t) 2>/dev/null
    echo -e "${GREEN}✅ API parada${NC}"
else
    echo -e "${YELLOW}⚠️  API não estava rodando${NC}"
fi

# Parar pela porta 3000 (Frontend)
if lsof -i:3000 -t >/dev/null 2>&1; then
    echo "🎨 Parando Frontend (porta 3000)..."
    kill -9 $(lsof -i:3000 -t) 2>/dev/null
    echo -e "${GREEN}✅ Frontend parado${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend não estava rodando${NC}"
fi

# Parar por PID salvos (backup)
if [ -f "logs/api.pid" ]; then
    API_PID=$(cat logs/api.pid)
    if kill -0 $API_PID 2>/dev/null; then
        kill -9 $API_PID 2>/dev/null
    fi
    rm logs/api.pid
fi

if [ -f "logs/web.pid" ]; then
    WEB_PID=$(cat logs/web.pid)
    if kill -0 $WEB_PID 2>/dev/null; then
        kill -9 $WEB_PID 2>/dev/null
    fi
    rm logs/web.pid
fi

echo ""
echo "=========================================="
echo "  ✅ Todos os serviços parados!"
echo "=========================================="
echo ""
echo "Para iniciar novamente: bash iniciar-simples.sh"
echo ""
