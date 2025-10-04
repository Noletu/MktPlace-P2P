# 🚀 Setup Guide - Mktplace da Liberdade

## Opção 1: Setup Automático (Recomendado)

Se você tem Docker instalado:

```bash
chmod +x setup.sh
./setup.sh
```

---

## Opção 2: Setup Manual

### Pré-requisitos

- Node.js 20+
- PostgreSQL 16+ (ou Docker)
- Redis 7+ (ou Docker)
- Git

### Passo 1: Instalar Dependências

```bash
# Na raiz do projeto
npm install --legacy-peer-deps

# Instalar dependências dos workspaces
cd apps/web
npm install --legacy-peer-deps

cd ../api
npm install --legacy-peer-deps

cd ../../packages/shared
npm install --legacy-peer-deps

cd ../..
```

### Passo 2: Configurar Database

#### Com Docker (Recomendado)

```bash
cd infra/docker
docker compose up -d

# Verificar se está rodando
docker compose ps

# Ver logs
docker compose logs -f
```

Acessar Adminer (UI do PostgreSQL): http://localhost:8080
- System: PostgreSQL
- Server: postgres
- Username: mktplace
- Password: mktplace_dev_password
- Database: mktplace

#### Sem Docker (Manual)

**PostgreSQL:**

1. Instale PostgreSQL 16:
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql-16

   # macOS
   brew install postgresql@16
   ```

2. Crie database e usuário:
   ```sql
   CREATE USER mktplace WITH PASSWORD 'mktplace_dev_password';
   CREATE DATABASE mktplace OWNER mktplace;
   GRANT ALL PRIVILEGES ON DATABASE mktplace TO mktplace;
   ```

**Redis:**

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# macOS
brew install redis
brew services start redis
```

### Passo 3: Configurar Environment

```bash
cd apps/api
cp .env.example .env
```

Edite `apps/api/.env`:

```env
# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://mktplace:mktplace_dev_password@localhost:5432/mktplace?schema=public"

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Blockchain RPC URLs (usar testnet para desenvolvimento)
SOLANA_RPC_URL=https://api.devnet.solana.com
POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# CoinGecko API (opcional no MVP)
COINGECKO_API_KEY=

# Google Cloud Vision OCR (configurar depois)
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
```

### Passo 4: Setup Prisma

```bash
cd apps/api

# Gerar Prisma Client
npm run prisma:generate

# Criar tabelas no database
npm run prisma:migrate

# (Opcional) Abrir Prisma Studio para visualizar dados
npm run prisma:studio
```

### Passo 5: Rodar o Projeto

**Opção A: Rodar tudo junto (via Turbo)**

```bash
# Na raiz do projeto
npm run dev
```

Isso vai iniciar:
- Frontend em http://localhost:3000
- Backend em http://localhost:3001

**Opção B: Rodar separadamente**

Terminal 1 (Backend):
```bash
cd apps/api
npm run dev
```

Terminal 2 (Frontend):
```bash
cd apps/web
npm run dev
```

### Passo 6: Verificar Setup

**Backend:**
```bash
curl http://localhost:3001/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX...",
  "service": "Mktplace da Liberdade API"
}
```

**Frontend:**

Acesse http://localhost:3000 e você deve ver a landing page.

---

## Troubleshooting

### Erro: "Cannot find module '@prisma/client'"

```bash
cd apps/api
npm run prisma:generate
```

### Erro: "Database connection failed"

Verifique:
1. PostgreSQL está rodando: `docker compose ps` ou `sudo systemctl status postgresql`
2. Credenciais corretas no `.env`
3. Database foi criado: `psql -U mktplace -d mktplace`

### Erro: "Redis connection refused"

```bash
# Verificar se Redis está rodando
redis-cli ping
# Deve responder: PONG

# Se não estiver rodando:
docker compose up -d redis
# ou
sudo systemctl start redis
```

### Erro: "Port 3000/3001 already in use"

```bash
# Matar processo na porta
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:3001 | xargs kill -9

# Ou mudar porta no .env (API) ou em apps/web/package.json (Frontend)
```

### Dependências demorando muito

```bash
# Usar flag legacy-peer-deps
npm install --legacy-peer-deps

# Ou limpar cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## Scripts Úteis

```bash
# Rodar tudo em dev mode
npm run dev

# Build para produção
npm run build

# Lint
npm run lint

# Limpar tudo
npm run clean

# Prisma Studio (visualizar database)
cd apps/api && npm run prisma:studio

# Ver logs do Docker
cd infra/docker && docker compose logs -f

# Parar Docker
cd infra/docker && docker compose down

# Parar e remover dados (CUIDADO!)
cd infra/docker && docker compose down -v
```

---

## Estrutura de Portas

| Serviço | Porta | URL |
|---------|-------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| Adminer | 8080 | http://localhost:8080 |
| Prisma Studio | 5555 | http://localhost:5555 |

---

## Próximos Passos

Após o setup, você pode começar a desenvolver:

1. **Sprint 1**: Auth + KYC básico
   - Implementar NextAuth.js
   - Criar páginas de login/registro
   - API de autenticação
   - KYC nível 1 (CPF + Email)

2. **Sprint 2**: Depósito de cripto
   - Integração Solana wallet
   - Gerar endereços de depósito
   - Monitoring blockchain
   - Dashboard de saldo

3. **Sprint 3**: Order Book
   - Criar ordem (boleto/PIX)
   - Listar ordens
   - Matching FIFO

Ver roadmap completo no `README.md`.

---

## Recursos

- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Solana Web3.js**: https://solana-labs.github.io/solana-web3.js/
- **Wagmi Docs**: https://wagmi.sh
- **TailwindCSS**: https://tailwindcss.com/docs

---

🎉 **Setup completo!** Agora é hora de codar!
