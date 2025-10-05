#!/bin/bash

echo ""
echo "========================================"
echo "  🚀 MktPlace P2P - Inicialização"
echo "========================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ ERRO: Node.js não encontrado!${NC}"
    echo ""
    echo "Por favor, instale o Node.js: https://nodejs.org/"
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ ERRO: npm não encontrado!${NC}"
    exit 1
fi

echo "[1/5] 🔍 Verificando portas..."
echo ""

# Verificar porta 3001 (API)
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an 2>/dev/null | grep :3001 | grep LISTEN >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Porta 3001 já está em uso!${NC}"
    echo ""
    echo "Para liberar a porta, execute: bash stop.sh"
    exit 1
fi

# Verificar porta 3000 (Frontend)
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an 2>/dev/null | grep :3000 | grep LISTEN >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Porta 3000 já está em uso!${NC}"
    echo ""
    echo "Para liberar a porta, execute: bash stop.sh"
    exit 1
fi

echo -e "${GREEN}✅ Portas 3000 e 3001 disponíveis${NC}"
echo ""

echo "[2/5] 🔧 Iniciando API (Backend)..."
echo ""

# Criar diretório de logs se não existir
mkdir -p logs

# Iniciar API em background
cd apps/api
npm run dev > ../../logs/api.log 2>&1 &
API_PID=$!
cd ../..

# Salvar PID
echo $API_PID > logs/api.pid

echo "⏳ Aguardando API inicializar (5 segundos)..."
sleep 5

echo -e "${GREEN}✅ API iniciada em http://localhost:3001${NC}"
echo "   PID: $API_PID"
echo ""

echo "[3/5] 🎨 Iniciando Frontend (Next.js)..."
echo ""

# Iniciar Frontend em background
cd apps/web
npm run dev > ../../logs/web.log 2>&1 &
WEB_PID=$!
cd ../..

# Salvar PID
echo $WEB_PID > logs/web.pid

echo "⏳ Aguardando Frontend inicializar (5 segundos)..."
sleep 5

echo -e "${GREEN}✅ Frontend iniciado em http://localhost:3000${NC}"
echo "   PID: $WEB_PID"
echo ""

echo "[4/5] 🌐 Abrindo navegador..."
echo ""

sleep 2

# Abrir navegador (compatível com Linux, Mac e Windows)
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000 &> /dev/null
elif command -v open &> /dev/null; then
    open http://localhost:3000
elif command -v start &> /dev/null; then
    start http://localhost:3000
else
    echo -e "${YELLOW}⚠️  Não foi possível abrir o navegador automaticamente${NC}"
    echo "   Abra manualmente: http://localhost:3000"
fi

echo -e "${GREEN}✅ Navegador aberto${NC}"
echo ""

echo "[5/5] 📊 Status dos Serviços"
echo ""
echo "┌─────────────────────────────────────────┐"
echo "│  ✅ API:       http://localhost:3001   │"
echo "│  ✅ Frontend:  http://localhost:3000   │"
echo "│  ✅ Navegador: Aberto                   │"
echo "└─────────────────────────────────────────┘"
echo ""
echo "========================================"
echo "  ✅ Tudo Pronto!"
echo "========================================"
echo ""
echo "📝 Logs disponíveis em:"
echo "   - API:      logs/api.log"
echo "   - Frontend: logs/web.log"
echo ""
echo "📊 PIDs salvos em:"
echo "   - API:      logs/api.pid"
echo "   - Frontend: logs/web.pid"
echo ""
echo "💡 Dicas:"
echo "   - Para ver logs da API:      tail -f logs/api.log"
echo "   - Para ver logs do Frontend: tail -f logs/web.log"
echo "   - Para parar tudo:           bash stop.sh"
echo ""
echo "⚠️  Processos rodando em background"
echo "   Use 'bash stop.sh' para parar tudo"
echo ""
