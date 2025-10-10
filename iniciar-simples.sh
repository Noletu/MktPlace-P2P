#!/bin/bash

echo ""
echo "=========================================="
echo "  🚀 MktPlace P2P - Início Simples Ubuntu"
echo "=========================================="
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado!${NC}"
    echo "Instale com: sudo apt install nodejs npm"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version)${NC}"
echo ""

# [1/5] Instalar dependências (se necessário)
if [ ! -d "node_modules" ]; then
    echo "[1/5] 📦 Instalando dependências..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erro ao instalar dependências${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Dependências instaladas${NC}"
    echo ""
else
    echo "[1/5] ✅ Dependências já instaladas"
    echo ""
fi

# [2/5] Verificar portas
echo "[2/5] 🔍 Verificando portas..."
echo ""

if lsof -i:3001 -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Porta 3001 em uso. Liberando...${NC}"
    kill -9 $(lsof -i:3001 -t) 2>/dev/null
fi

if lsof -i:3000 -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Porta 3000 em uso. Liberando...${NC}"
    kill -9 $(lsof -i:3000 -t) 2>/dev/null
fi

echo -e "${GREEN}✅ Portas disponíveis${NC}"
echo ""

# [3/5] Configurar variáveis de ambiente
echo "[3/5] ⚙️  Configurando variáveis de ambiente..."
echo ""

cd apps/api

# Criar .env se não existir
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "Criando .env a partir do .env.example..."
        cp .env.example .env
        echo -e "${GREEN}✅ Arquivo .env criado${NC}"
    else
        echo -e "${RED}❌ .env.example não encontrado${NC}"
        cd ../..
        exit 1
    fi
else
    echo -e "${GREEN}✅ Arquivo .env já existe${NC}"
fi

# Verificar se Prisma está configurado
if [ -f "prisma/schema.prisma" ]; then
    # Gerar Prisma Client
    npx prisma generate > /dev/null 2>&1

    # Criar/atualizar banco
    if [ ! -f "prisma/dev.db" ]; then
        echo "Criando banco de dados..."
        npx prisma migrate deploy > /dev/null 2>&1
    fi
    echo -e "${GREEN}✅ Banco de dados pronto${NC}"
else
    echo -e "${YELLOW}⚠️  Schema Prisma não encontrado${NC}"
fi

cd ../..
echo ""

# [4/5] Iniciar API
echo "[4/5] 🔧 Iniciando API..."
echo ""

mkdir -p logs

cd apps/api
npm run dev > ../../logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > ../../logs/api.pid
cd ../..

echo "⏳ Aguardando API (5s)..."
sleep 5

if kill -0 $API_PID 2>/dev/null; then
    echo -e "${GREEN}✅ API rodando em http://localhost:3001${NC}"
    echo "   PID: $API_PID"
else
    echo -e "${RED}❌ API falhou ao iniciar${NC}"
    echo "Veja o log: cat logs/api.log"
    exit 1
fi
echo ""

# [5/5] Iniciar Frontend
echo "[5/5] 🎨 Iniciando Frontend..."
echo ""

cd apps/web
npm run dev > ../../logs/web.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > ../../logs/web.pid
cd ../..

echo "⏳ Aguardando Frontend (5s)..."
sleep 5

if kill -0 $WEB_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Frontend rodando em http://localhost:3000${NC}"
    echo "   PID: $WEB_PID"
else
    echo -e "${RED}❌ Frontend falhou ao iniciar${NC}"
    echo "Veja o log: cat logs/web.log"
    exit 1
fi
echo ""

# Abrir navegador
echo "🌐 Abrindo navegador..."
sleep 2

if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000 &> /dev/null &
    echo -e "${GREEN}✅ Navegador aberto${NC}"
else
    echo -e "${YELLOW}⚠️  Abra manualmente: http://localhost:3000${NC}"
fi
echo ""

# Status final
echo "=========================================="
echo "  ✅ SISTEMA RODANDO!"
echo "=========================================="
echo ""
echo "📍 URLs:"
echo "   API:      http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo ""
echo "📝 Logs:"
echo "   API:      tail -f logs/api.log"
echo "   Frontend: tail -f logs/web.log"
echo ""
echo "🛑 Para parar:"
echo "   bash parar-simples.sh"
echo "   (ou Ctrl+C e depois: kill $API_PID $WEB_PID)"
echo ""
echo "⚠️  Processos em background"
echo "   API PID: $API_PID"
echo "   Web PID: $WEB_PID"
echo ""
