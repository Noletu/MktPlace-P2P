#!/bin/bash

# Mktplace da Liberdade - Setup Script
# Este script automatiza o setup inicial do projeto

set -e

echo "🚀 Mktplace da Liberdade - Setup Inicial"
echo "========================================"
echo ""

# Step 1: Install dependencies
echo "📦 [1/5] Instalando dependências..."
echo "Isso pode demorar alguns minutos..."
npm install --legacy-peer-deps

# Step 2: Install workspace dependencies
echo ""
echo "📦 [2/5] Instalando dependências dos workspaces..."
cd apps/web && npm install --legacy-peer-deps
cd ../api && npm install --legacy-peer-deps
cd ../../packages/shared && npm install --legacy-peer-deps
cd ../..

# Step 3: Setup environment
echo ""
echo "⚙️  [3/5] Configurando environment..."
if [ ! -f apps/api/.env ]; then
    cp apps/api/.env.example apps/api/.env
    echo "✅ .env criado em apps/api/.env"
    echo "⚠️  ATENÇÃO: Edite apps/api/.env com suas configurações!"
else
    echo "⚠️  .env já existe, pulando..."
fi

# Step 4: Start Docker (if available)
echo ""
echo "🐳 [4/5] Iniciando PostgreSQL + Redis..."
if command -v docker &> /dev/null; then
    cd infra/docker
    docker compose up -d
    echo "✅ PostgreSQL e Redis iniciados!"
    cd ../..
else
    echo "⚠️  Docker não encontrado. Instale Docker Desktop ou configure manualmente:"
    echo "   - PostgreSQL 16 na porta 5432"
    echo "   - Redis 7 na porta 6379"
    echo "   - Ou instale Docker: https://docs.docker.com/get-docker/"
fi

# Step 5: Prisma setup
echo ""
echo "🗄️  [5/5] Configurando Prisma..."
cd apps/api

if command -v docker &> /dev/null && docker ps | grep -q mktplace-postgres; then
    echo "Aguardando PostgreSQL iniciar..."
    sleep 5

    npx prisma generate
    echo "✅ Prisma Client gerado!"

    npx prisma migrate dev --name init
    echo "✅ Migrations aplicadas!"
else
    echo "⚠️  PostgreSQL não está rodando. Execute depois:"
    echo "   cd apps/api"
    echo "   npm run prisma:generate"
    echo "   npm run prisma:migrate"
fi

cd ../..

echo ""
echo "✨ Setup completo!"
echo ""
echo "📝 Próximos passos:"
echo "   1. Se Docker não está instalado, configure PostgreSQL e Redis manualmente"
echo "   2. Edite apps/api/.env com as configurações corretas"
echo "   3. Execute: npm run dev"
echo "   4. Acesse:"
echo "      - Frontend: http://localhost:3000"
echo "      - API: http://localhost:3001"
echo ""
echo "🎉 Boa codificação!"
