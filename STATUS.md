# 📊 Status do Projeto - Mktplace da Liberdade

**Última atualização**: Janeiro 2025
**Versão**: 0.1.0-alpha
**Status**: 🟡 Setup Inicial em Progresso

---

## ✅ Completado

### Estrutura Base
- [x] Monorepo Turborepo configurado
- [x] Git repository inicializado (commit inicial feito)
- [x] `.gitignore` configurado
- [x] README.md completo com documentação
- [x] SETUP.md com guia de instalação

### Frontend (`apps/web`)
- [x] Next.js 14 com App Router
- [x] TypeScript configurado
- [x] TailwindCSS configurado
- [x] Landing page inicial
- [x] Layout base
- [x] Globals CSS com tema

### Backend (`apps/api`)
- [x] Node.js + Express setup
- [x] TypeScript configurado
- [x] Prisma ORM configurado
- [x] Schema database completo
- [x] Health check endpoint
- [x] .env.example criado

### Database
- [x] PostgreSQL 16 schema definido
- [x] Redis configurado (docker-compose)
- [x] Docker Compose file criado
- [x] Adminer incluído para UI

### Shared Package
- [x] Types compartilhados (6 criptos, 8 networks)
- [x] Validações Zod (CPF, boleto, PIX)
- [x] Enums e interfaces
- [x] Utilitários (formatação, cálculo de fees)

### Infraestrutura
- [x] Docker Compose (PostgreSQL + Redis + Adminer)
- [x] Scripts de setup (`setup.sh`)
- [x] Documentação completa

---

## 🔄 Em Progresso

- [ ] Instalação de dependências npm (em background)
  - Status: Rodando (pode demorar 5-10 minutos)
  - Verificar: `ps aux | grep npm`

---

## ⏳ Próximos Passos Imediatos

### 1. Finalizar Setup Básico

```bash
cd "/home/nicode/Mktplace da Liberdade"

# Verificar se instalação terminou
ps aux | grep npm

# Se ainda rodando, aguardar ou instalar manualmente:
cd apps/web && npm install --legacy-peer-deps
cd ../api && npm install --legacy-peer-deps
cd ../../packages/shared && npm install --legacy-peer-deps
```

### 2. Configurar Database Local

**Opção A: Com Docker (Recomendado)**
```bash
# Se Docker estiver instalado no Windows
# Abra Docker Desktop e então:
cd infra/docker
docker compose up -d
```

**Opção B: PostgreSQL Local**
```bash
# Instalar PostgreSQL no WSL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Iniciar serviço
sudo service postgresql start

# Criar database
sudo -u postgres psql -c "CREATE USER mktplace WITH PASSWORD 'mktplace_dev_password';"
sudo -u postgres psql -c "CREATE DATABASE mktplace OWNER mktplace;"
```

### 3. Configurar .env

```bash
cd apps/api
cp .env.example .env

# Editar .env com configurações corretas
# Pelo menos DATABASE_URL precisa estar correto
```

### 4. Rodar Migrations

```bash
cd apps/api
npm run prisma:generate
npm run prisma:migrate
```

### 5. Testar Aplicação

```bash
# Na raiz do projeto
npm run dev

# Ou separadamente:
# Terminal 1
cd apps/api && npm run dev

# Terminal 2
cd apps/web && npm run dev
```

---

## 🎯 Sprint 1: Auth + KYC (Próxima)

**Duração estimada**: 1-2 semanas
**Objetivo**: Sistema de autenticação funcional com KYC nível 1

### Tarefas

#### Backend API
- [ ] Instalar e configurar NextAuth.js
- [ ] Criar rotas de auth:
  - `POST /api/auth/register` (registro com CPF + email)
  - `POST /api/auth/login` (login com email + senha)
  - `POST /api/auth/logout`
  - `GET /api/auth/me` (usuário atual)
- [ ] Implementar hash de senha (bcrypt)
- [ ] Implementar JWT tokens
- [ ] Middleware de autenticação
- [ ] Validação de CPF
- [ ] Rate limiting nas rotas de auth

#### Frontend Web
- [ ] Criar página de login (`/login`)
- [ ] Criar página de registro (`/register`)
- [ ] Criar página de dashboard (`/dashboard`)
- [ ] Componente de formulário de login
- [ ] Componente de formulário de registro
- [ ] Validação client-side (React Hook Form + Zod)
- [ ] Feedback de erros
- [ ] Loading states
- [ ] Protected routes (middleware Next.js)

#### KYC Nível 1
- [ ] Form de cadastro com CPF
- [ ] Validação de CPF (checksum)
- [ ] Verificação de email (envio de código)
- [ ] Armazenar dados KYC no Prisma
- [ ] Atualizar status KYC Level 1
- [ ] Mostrar limites no dashboard (R$1k/dia)

#### Testes
- [ ] Testes unitários (validações)
- [ ] Testes de integração (auth flow)
- [ ] Testes E2E (Playwright) - opcional

---

## 📋 Backlog (Sprints Futuras)

### Sprint 2: Depósito de Cripto (Semanas 3-4)
- [ ] Integração Solana Wallet Adapter
- [ ] Geração de endereços de depósito
- [ ] Monitoring blockchain (Solana)
- [ ] Confirmação de depósitos
- [ ] Dashboard com saldo

### Sprint 3: Order Book - Boletos (Semanas 5-6)
- [ ] Upload de boleto (PDF/imagem)
- [ ] OCR Google Vision
- [ ] Publicar no order book
- [ ] Listar ordens disponíveis
- [ ] Filtros e busca

### Sprint 4: Order Book - PIX (Semanas 7-8)
- [ ] Form de criação de pedido PIX
- [ ] Validação de chave PIX
- [ ] Publicar no order book
- [ ] Integração com boletos (mesmo sistema)

### Sprint 5: Matching P2P (Semanas 9-10)
- [ ] Sistema de matching FIFO
- [ ] Aceitar ordem
- [ ] Upload de comprovante
- [ ] Validação manual (admin)
- [ ] Release de cripto

---

## 🐛 Issues Conhecidos

1. **npm install timeout**: Dependências demorando muito
   - Workaround: Usar `--legacy-peer-deps`
   - Instalar workspaces individualmente

2. **Docker não disponível no WSL**:
   - Solução: Instalar Docker Desktop no Windows
   - Ou: Usar PostgreSQL/Redis local no WSL

3. **Peer dependencies warnings**:
   - Normal durante desenvolvimento
   - Resolvido com `--legacy-peer-deps`

---

## 📈 Métricas de Progresso

**Setup Inicial**: 85% ✅
- Estrutura: 100% ✅
- Configuração: 100% ✅
- Dependências: 50% 🔄 (instalando)
- Database: 80% ⏳ (aguardando Docker/local)

**MVP Total**: 12% 🔄
- Sprint 1 (Auth): 0% ⏳
- Sprint 2 (Depósito): 0% ⏳
- Sprint 3 (Boletos): 0% ⏳
- Sprint 4 (PIX): 0% ⏳

---

## 🔗 Links Úteis

### Documentação
- [README.md](./README.md) - Overview completo
- [SETUP.md](./SETUP.md) - Guia de instalação
- [apps/api/prisma/schema.prisma](./apps/api/prisma/schema.prisma) - Schema database

### External Docs
- [Prisma](https://www.prisma.io/docs)
- [Next.js](https://nextjs.org/docs)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [TailwindCSS](https://tailwindcss.com/docs)

---

## 💡 Comandos Rápidos

```bash
# Ver status Git
git status

# Ver estrutura de pastas
tree -L 3 -I 'node_modules'

# Verificar processos npm
ps aux | grep npm

# Verificar portas em uso
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :5432
sudo lsof -i :6379

# Limpar tudo e recomeçar
rm -rf node_modules apps/*/node_modules packages/*/node_modules
npm install --legacy-peer-deps
```

---

**Autor**: Claude Code + Dev Team
**Repositório**: (privado)
**Licença**: Proprietary
