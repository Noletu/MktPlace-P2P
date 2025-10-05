# 🚀 Mktplace da Liberdade

> Marketplace P2P para pagamento de boletos e PIX com criptomoedas. Mais barato, mais livre.

**Versão:** 0.2.2 | **Status:** ✅ 100% Testado e Funcional

## 🚀 Início Rápido

### Windows (CMD/PowerShell)
```cmd
INICIAR-SIMPLES.bat
```

### Linux / Mac / Git Bash
```bash
bash start.sh
```

**📖 Documentação completa:** Veja [COMO_INICIAR.md](COMO_INICIAR.md)

---

## 🎯 Visão Geral

O **Mktplace da Liberdade** é um marketplace descentralizado onde pessoas com criptomoedas podem pagar suas contas em BRL (boletos/PIX) através de outros usuários que desejam adquirir cripto. Um ecossistema win-win onde todos ganham:

- **Quem tem cripto**: Paga suas contas sem vender cripto em exchanges
- **Quem quer cripto**: Compra cripto com 1% de cashback pagando contas de terceiros
- **Plataforma**: Recebe apenas criptomoedas (fee 1.5%), nunca BRL

### 💡 Diferenciais

- ✅ **17% mais barato**: Fee total 2.5% vs ~3% dos concorrentes
- ✅ **Cashback 1%**: Pagadores recebem recompensa em cripto
- ✅ **P2P + Garantia**: Liquidez descentralizada com fallback centralizado
- ✅ **Multi-chain**: 6 criptos × 10 networks (Solana, Polygon, BSC, TRC20, etc)
- ✅ **Privacy coins**: Monero (XMR) e Zcash (ZEC) para máxima privacidade
- ✅ **Crypto-only flow**: Plataforma nunca toca em BRL (otimização fiscal)

---

## 📦 Arquitetura do Projeto

Monorepo Turborepo com:

```
mktplace-liberdade/
├── apps/
│   ├── web/          # Next.js 14 frontend
│   └── api/          # Node.js + Express backend
├── packages/
│   ├── shared/       # Tipos e validações compartilhadas
│   ├── ui/           # Componentes shadcn/ui (futuro)
│   └── contracts/    # Smart contracts Solidity + Anchor (futuro)
├── infra/
│   ├── docker/       # Docker Compose (PostgreSQL + Redis)
│   └── k8s/          # Kubernetes manifests (futuro)
└── README.md
```

---

## 🛠️ Stack Tecnológica

### Frontend (`apps/web`)
- **Framework**: Next.js 14 (App Router)
- **Linguagem**: TypeScript
- **Estilo**: TailwindCSS + shadcn/ui
- **State**: Zustand / Jotai
- **Blockchain**:
  - Solana: `@solana/web3.js` + Wallet Adapter
  - EVM: Wagmi + Viem (Polygon, BSC, Ethereum)
  - Bitcoin: BitcoinJS
- **Real-time**: Socket.io client

### Backend (`apps/api`)
- **Runtime**: Node.js 20+
- **Framework**: Express
- **Linguagem**: TypeScript
- **Database**: PostgreSQL 16 + Prisma ORM
- **Cache**: Redis 7
- **Queue**: Bull/BullMQ
- **Real-time**: Socket.io server
- **Blockchain**: Ethers.js, Solana web3.js, Bitcoin RPC

### Smart Contracts (`packages/contracts`)
- **EVM**: Solidity + Hardhat (Polygon, BSC)
- **Solana**: Anchor (Rust)
- **Escrow**: On-chain custody com release via oracle

### Database
- **PostgreSQL 16**: Dados transacionais
- **Redis 7**: Cache, sessions, queue

### Compliance & Security
- **KYC**: Unico IDTech
- **OCR**: Google Cloud Vision API
- **AML**: Chainalysis API
- **2FA**: Google Authenticator (TOTP)

---

## 🚀 Quick Start

### 1. Pré-requisitos

- Node.js 20+
- Docker & Docker Compose
- Git

### 2. Clone e Install

```bash
cd "Mktplace da Liberdade"

# Install dependencies
npm install

# Install workspace dependencies
cd apps/web && npm install
cd ../api && npm install
cd ../../packages/shared && npm install
```

### 3. Setup Database

```bash
# Iniciar PostgreSQL + Redis via Docker
cd infra/docker
docker-compose up -d

# Verificar se está rodando
docker-compose ps

# Acessar Adminer (UI do PostgreSQL): http://localhost:8080
# Server: postgres | User: mktplace | Password: mktplace_dev_password
```

### 4. Setup Prisma

```bash
cd apps/api

# Copiar .env.example
cp .env.example .env

# Editar .env e configurar DATABASE_URL:
# DATABASE_URL="postgresql://mktplace:mktplace_dev_password@localhost:5432/mktplace?schema=public"

# Gerar Prisma Client
npm run prisma:generate

# Criar database e rodar migrations
npm run prisma:migrate

# (Opcional) Abrir Prisma Studio para ver dados
npm run prisma:studio
```

### 5. Rodar Projeto

```bash
# Na raiz do projeto
npm run dev

# Ou rodar individualmente:

# Frontend (porta 3000)
cd apps/web && npm run dev

# Backend (porta 3001)
cd apps/api && npm run dev
```

### 6. Acessar

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api/v1
- **Adminer (PostgreSQL UI)**: http://localhost:8080
- **Prisma Studio**: `npm run prisma:studio` (apps/api)

---

## 📊 Database Schema

### Principais tabelas:

- **User**: Usuários com KYC e reputação
- **Wallet**: Carteiras multi-crypto/multi-network
- **Order**: Boletos e PIX publicados no marketplace
- **Transaction**: Matching e validação de comprovantes
- **Fee**: Fees da plataforma e cashback
- **Review**: Sistema de avaliação entre usuários
- **PriceQuote**: Cotações cripto em tempo real

Ver schema completo em: `apps/api/prisma/schema.prisma`

---

## 🎨 Funcionalidades (Roadmap)

### ✅ Fase 1: MVP (Meses 1-2) - **CONCLUÍDO v0.2.2**

- [x] Setup monorepo
- [x] Next.js frontend
- [x] Node.js backend
- [x] PostgreSQL + Redis (usando SQLite em dev)
- [x] Prisma ORM + schema
- [x] Auth (JWT + Refresh Tokens)
- [x] 2FA (Google Authenticator)
- [x] KYC multi-nível (Level 1, 2, 3)
- [x] Sistema de carteiras crypto
- [x] Publicação de pedidos PIX
- [x] Publicação de pedidos Boleto
- [x] Marketplace P2P
- [x] Matching P2P
- [x] Upload de comprovantes
- [x] Sistema de transações
- [x] Scripts de inicialização automatizada
- [x] 100% testado (26/26 testes passando)

### 🔄 Fase 2: Automação (Meses 3-4)

- [ ] Smart contracts (Polygon + Solana)
- [ ] Escrow descentralizado
- [ ] Validação automática OCR + IA
- [ ] Sistema de timeout (plataforma paga)
- [ ] Multi-cripto completo (BTC, ETH, XMR, ZEC)
- [ ] WebSocket real-time

### 🚀 Fase 3: Escala (Meses 5-6)

- [ ] Sistema de reputação
- [ ] Dashboard analytics
- [ ] Mobile app (PWA ou React Native)
- [ ] API pública
- [ ] Programa de afiliados

### 📋 Fase 4: Compliance (Mês 7)

- [ ] Registro VASP no Banco Central
- [ ] Integração COAF
- [ ] Auditorias (segurança + smart contracts)
- [ ] Documentação legal (LGPD, termos, AML)

### 💰 Fase 5: Crescimento (Meses 8-12)

- [ ] Marketing agressivo
- [ ] 50k usuários
- [ ] DeFi integration (staking de fees)
- [ ] B2B API + white-label
- [ ] Break-even

---

## 💸 Modelo de Negócio

### Fee Structure

| Participante | Fee | Descrição |
|-------------|-----|-----------|
| **Plataforma** | 1.5% | Recebido em cripto (nunca BRL) |
| **Pagador** | +1% cashback | Incentivo para pagar contas de terceiros |
| **Total** | 2.5% | Mais barato que concorrentes (3%) |

### Dupla Receita

1. **P2P Matching** (1.5%): Fee sobre transações P2P
2. **Timeout Fallback** (2%): Se order não match em X dias, plataforma paga e fica com 2%

### Exemplo Prático

**Cenário**: Usuário A quer pagar aluguel de R$2.000

1. Deposita equivalente a R$2.050 em USDT (2.5% fee = R$50)
2. Publica boleto no order book
3. Usuário B aceita e paga R$2.000 via PIX
4. Usuário B recebe R$2.070 em USDT (R$2.050 + R$20 cashback 1%)
5. Plataforma retém R$30 em USDT (1.5% fee)

**Win-win-win**:
- A pagou aluguel sem vender cripto
- B comprou cripto com 1% cashback
- Plataforma ganhou 1.5% em cripto

---

## 🔐 Compliance & Legal

### Modelo Crypto-Only

A plataforma **nunca toca em BRL**. Recebemos apenas criptomoedas:

- ✅ Lucro não realizado (zero IR/CSLL enquanto não vender)
- ✅ Usuários responsáveis por declarar ganhos (IN RFB 1888/2019)
- ✅ Não somos instituição de pagamento, somos VASP
- ✅ Transações BRL são P2P diretas (fora da plataforma)

### Registro VASP

Planejado para **Mês 7** junto ao Banco Central:

- Custódia e exchange de criptoativos
- KYC/AML compliance
- Segregação de fundos (hot/cold storage)
- Reporting ao COAF

---

## 🌐 Criptomoedas Suportadas

### MVP (Meses 1-2)
- **USDC** Solana ⭐ (fee $0.00025)
- **USDT** Solana ⭐ (fee $0.00025)
- **USDC** Polygon (fee $0.01)
- **USDT** Polygon (fee $0.01)

### Fase 2 (Meses 3-4)
- Bitcoin (BTC)
- Ethereum (ETH)
- Monero (XMR) 🔒
- Zcash (ZEC) 🔒
- USDC/USDT BSC
- USDC/USDT TRC20

**Total**: 6 criptos × 10 networks

---

## 📈 Métricas de Sucesso

| Fase | Período | Usuários | Volume/mês | Revenue/mês | Status |
|------|---------|----------|------------|-------------|--------|
| MVP | Mês 2 | 100 | - | - | 🔄 Em desenvolvimento |
| Crescimento | Mês 6 | 5,000 | R$500k | R$42k (7.5k USDT) | ⏳ Planejado |
| Scale | Mês 12 | 50,000 | R$10M | R$825k (150k USDT) | ⏳ Planejado |

---

## 🤝 Contribuindo

Este é um projeto privado em desenvolvimento inicial. Contribuições serão aceitas futuramente.

---

## 📝 License

Proprietary - All rights reserved

---

## 📞 Contato

- **Website**: (em breve)
- **Email**: (em breve)
- **Discord**: (em breve)

---

## 🎯 Próximos Passos (Semana 1)

1. ✅ Setup monorepo Turborepo
2. ✅ Next.js 14 frontend
3. ✅ Node.js backend
4. ✅ PostgreSQL + Redis
5. ✅ Prisma schema
6. ✅ Shared types package
7. 🔄 Inicializar Git
8. ⏳ Sprint 1: Auth + KYC básico
9. ⏳ Sprint 2: Depósito cripto Solana

---

**Status**: 🚧 MVP em desenvolvimento ativo | v0.1.0

**Última atualização**: Janeiro 2025
