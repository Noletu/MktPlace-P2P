# ⚡ Quick Start - Mktplace da Liberdade

> Setup rápido para começar a desenvolver em 5 minutos

## 🎯 O que você precisa

- Node.js 20+
- Docker Desktop (recomendado) OU PostgreSQL + Redis locais

---

## 🚀 Setup em 3 Passos

### 1️⃣ Rodar Script de Setup

```bash
cd "/home/nicode/Mktplace da Liberdade"
chmod +x setup.sh
./setup.sh
```

**Isso vai:**
- ✅ Instalar todas as dependências
- ✅ Copiar .env.example → .env
- ✅ Iniciar PostgreSQL + Redis (Docker)
- ✅ Gerar Prisma Client
- ✅ Rodar migrations

---

### 2️⃣ Verificar Database

**Com Docker:**
```bash
cd infra/docker
docker compose ps
```

Deve mostrar:
- ✅ mktplace-postgres (healthy)
- ✅ mktplace-redis (healthy)
- ✅ mktplace-adminer (running)

**Sem Docker:**

Certifique-se que PostgreSQL e Redis estão rodando localmente na porta 5432 e 6379.

---

### 3️⃣ Rodar Aplicação

```bash
# Na raiz do projeto
npm run dev
```

Acesse:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001/health
- **Adminer**: http://localhost:8080

---

## 🐛 Problemas?

### npm install está demorando

```bash
# Use a flag legacy-peer-deps
npm install --legacy-peer-deps

# Ou instale cada workspace:
cd apps/web && npm install --legacy-peer-deps
cd ../api && npm install --legacy-peer-deps
cd ../../packages/shared && npm install --legacy-peer-deps
```

### Docker não encontrado

**Opção 1**: Instale Docker Desktop
- Windows: https://docs.docker.com/desktop/install/windows-install/
- Mac: https://docs.docker.com/desktop/install/mac-install/

**Opção 2**: Use PostgreSQL/Redis locais

```bash
# Ubuntu/WSL
sudo apt install postgresql redis-server
sudo service postgresql start
sudo service redis-server start

# Criar database
sudo -u postgres createuser -s mktplace
sudo -u postgres createdb mktplace -O mktplace
sudo -u postgres psql -c "ALTER USER mktplace PASSWORD 'mktplace_dev_password';"
```

### Erro de conexão com database

Edite `apps/api/.env` e verifique `DATABASE_URL`:

```env
DATABASE_URL="postgresql://mktplace:mktplace_dev_password@localhost:5432/mktplace?schema=public"
```

Se PostgreSQL está em outro host/porta, ajuste conforme necessário.

---

## 📝 Próximos Passos

Depois do setup, começar **Sprint 1: Auth + KYC**

Ver roadmap detalhado em:
- `STATUS.md` - Status atual e próximas tarefas
- `README.md` - Documentação completa
- `SETUP.md` - Guia de setup detalhado

---

## 🎉 Pronto!

Agora você pode começar a desenvolver o MVP!

**Comandos úteis:**
```bash
npm run dev              # Rodar tudo
npm run build            # Build produção
cd apps/api && npm run prisma:studio  # Visualizar database
```

Boa codificação! 🚀
