# Documentação - Mktplace P2P

**Última atualização**: 2025-12-11

---

## 📚 Índice de Documentação

### Platform Wallets HD (Última Implementação)

| Documento | Descrição | Para Quem |
|-----------|-----------|-----------|
| [**Resumo Executivo**](../PLATFORM-WALLETS-SUMMARY.md) | Visão geral da implementação | Todos |
| [**Implementação Técnica**](./PLATFORM-WALLETS-HD-IMPLEMENTATION.md) | Arquitetura, código, testes detalhados | Desenvolvedores |
| [**Guia Rápido**](./PLATFORM-WALLETS-QUICK-GUIDE.md) | Setup, uso diário, troubleshooting | Admins/Sócios |
| [**Changelog**](../CHANGELOG-PLATFORM-WALLETS.md) | Histórico de mudanças | Todos |

### Outros Sistemas

| Documento | Descrição |
|-----------|-----------|
| [2FA System](./2FA-SYSTEM.md) | Sistema de autenticação 2FA |
| [Collateral System](./COLLATERAL_SYSTEM.md) | Sistema de garantias |
| [Troubleshooting](./TROUBLESHOOTING.md) | Guia de resolução de problemas |

---

## 🚀 Quick Start

### Para Desenvolvedores

1. **Setup Inicial**:
```bash
# Clone do repositório
git clone <repo-url>
cd MktPlace-P2P

# Instalar dependências
npm install

# Setup banco de dados
cd apps/api
npx prisma db push

# Iniciar servidores
npm run dev  # API (porta 3001)
cd ../web
npm run dev  # Frontend (porta 3000)
```

2. **Criar Usuário Admin**:
```bash
cd apps/api
node scripts/create-master-user.js
```

3. **Gerar Master Seed**:
- Login como MASTER
- Navegar para `/admin/master-seed`
- Seguir wizard de geração

### Para Admins/Sócios

1. **Acesso ao Sistema**:
```
URL: http://localhost:3000
Login: master@admin.com
Senha: Master@123
```

2. **Gerar Master Seed** (primeira vez):
- Painel Admin → Master Seed
- Gerar Nova Seed
- **IMPORTANTE**: Guardar 24 palavras em papel no cofre

3. **Ver Endereços dos Sócios**:
- Painel Admin → Master Seed
- Card "Carteiras dos Sócios"
- Copiar endereços conforme necessário

---

## 📋 Estrutura do Projeto

```
MktPlace-P2P/
├── apps/
│   ├── api/          # Backend (Express + Prisma)
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   ├── hd-wallet/        # Derivação HD
│   │   │   │   ├── platformWallet.service.ts
│   │   │   │   └── masterSeedAdmin.service.ts
│   │   │   ├── middleware/
│   │   │   └── routes/
│   │   └── prisma/
│   │       └── schema.prisma
│   │
│   └── web/          # Frontend (Next.js)
│       └── app/
│           └── admin/
│               ├── master-seed/   # Master Seed Management
│               ├── funds/          # Controle de Fundos
│               └── users/          # Gestão de Usuários
│
├── docs/             # Documentação
│   ├── README.md                                  # Este arquivo
│   ├── PLATFORM-WALLETS-HD-IMPLEMENTATION.md     # Técnica
│   └── PLATFORM-WALLETS-QUICK-GUIDE.md           # Uso
│
├── CHANGELOG-PLATFORM-WALLETS.md  # Mudanças
└── PLATFORM-WALLETS-SUMMARY.md    # Resumo
```

---

## 🔐 Segurança

### Informações Sensíveis

**NUNCA commitar**:
- ❌ `.env` (contém MASTER_SEED_ENCRYPTED)
- ❌ `.env.keys` (contém MASTER_SEED_ENCRYPTION_KEY)
- ❌ Mnemonics (24 palavras)
- ❌ Private keys
- ❌ Backups com dados reais

**Sempre guardar offline**:
- ✅ Mnemonic em papel no cofre
- ✅ Backup do `.env` em local seguro separado
- ✅ Múltiplas cópias em locais diferentes

### Boas Práticas

1. **Development**:
   - Use master seed de teste
   - NUNCA use seed de produção em dev
   - Valores pequenos para testes

2. **Production**:
   - Master seed real apenas em produção
   - Mínimo na hot wallet
   - Maioria em cold wallet
   - Backups regulares

3. **Acesso**:
   - 2FA obrigatório para MASTER
   - Senhas fortes
   - Audit log de todas as operações

---

## 🧪 Testes

### Backend

```bash
cd apps/api

# Testes unitários
npm test

# Testes de derivação
npm run test:derivation

# Verificar derivação HD
npm run test:hd-wallet
```

### Frontend

```bash
cd apps/web

# Testes de componentes
npm test

# E2E tests
npm run test:e2e
```

### Testes Manuais

1. **Master Seed**:
   - Gerar nova seed
   - Verificar 9 platform wallets criadas
   - Copiar endereços
   - Verificar separação Account 0/1+

2. **Platform Wallets**:
   - Ver saldos
   - Copiar endereços
   - Verificar redes suportadas

---

## 📊 Glossário

### Termos Técnicos

| Termo | Descrição |
|-------|-----------|
| **BIP39** | Padrão para mnemonic (24 palavras) |
| **BIP32** | Padrão para derivação hierárquica |
| **BIP44** | Padrão para multi-account hierarchy |
| **Master Seed** | Seed raiz que deriva todas as wallets |
| **HD Wallet** | Hierarchical Deterministic Wallet |
| **Derivation Path** | Caminho BIP44 (m/44'/coin'/account'/change/index) |
| **Account 0** | Reservado para Platform Wallets (sócios) |
| **Account >= 1** | User Wallets (clientes) |

### Componentes do Sistema

| Componente | Função |
|------------|--------|
| **Platform Wallet** | Carteira dos sócios (Account 0) |
| **User Wallet** | Carteira dos usuários (Account >= 1) |
| **Hot Wallet** | Wallet online (master seed no servidor) |
| **Cold Wallet** | Wallet offline (hardware wallet, papel) |
| **Derivation Service** | Serviço que deriva endereços |
| **Key Management** | Gerencia encriptação de chaves |

---

## 🔧 Troubleshooting

### Problemas Comuns

1. **Master Seed não aparece**:
   - Ver: [Troubleshooting Guide](./TROUBLESHOOTING.md)
   - Verificar `.env` tem `MASTER_SEED_ENCRYPTED`
   - Reiniciar API server

2. **Platform Wallets não criadas**:
   - Verificar banco de dados (Prisma Studio)
   - Forçar criação via console
   - Ver logs do servidor

3. **Erro de derivação**:
   - Verificar bibliotecas instaladas
   - Limpar node_modules
   - Reinstalar dependências

### Logs e Debug

```bash
# API logs
cd apps/api
npm run dev

# Frontend logs
cd apps/web
npm run dev

# Database
cd apps/api
npx prisma studio  # Abre interface visual
```

---

## 📞 Suporte

### Documentação

- **Técnica**: [PLATFORM-WALLETS-HD-IMPLEMENTATION.md](./PLATFORM-WALLETS-HD-IMPLEMENTATION.md)
- **Uso**: [PLATFORM-WALLETS-QUICK-GUIDE.md](./PLATFORM-WALLETS-QUICK-GUIDE.md)
- **Mudanças**: [CHANGELOG-PLATFORM-WALLETS.md](../CHANGELOG-PLATFORM-WALLETS.md)

### Recursos Externos

- [BIP39 Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP32 Specification](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP44 Specification](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Next.js Docs](https://nextjs.org/docs)

### Ferramentas

- [Ian Coleman BIP39 Tool](https://iancoleman.io/bip39/) - Testar derivação (⚠️ nunca com seed real)
- [Blockchain Explorers](https://blockchair.com/) - Verificar transações
- [Prisma Studio](https://www.prisma.io/studio) - Visualizar banco de dados

---

## 🎯 Roadmap

### Concluído ✅

- [x] Sistema HD Wallet completo
- [x] Platform Wallets (Account 0)
- [x] Separação User/Platform
- [x] Master Seed Management
- [x] Frontend Admin Panel
- [x] Documentação completa

### Em Desenvolvimento 🚧

- [ ] AdminFunds Dashboard (3 visões)
- [ ] Blockchain sync automático
- [ ] Relatórios de fees
- [ ] Alertas de movimentações

### Futuro 🔮

- [ ] Multi-signature para saques
- [ ] Hardware wallet integration
- [ ] Mobile admin app
- [ ] API pública
- [ ] Webhooks

---

## 📜 Licença

**Projeto**: Mktplace P2P
**Versão**: 1.0
**Data**: 2025-12-11

---

## ✅ Quick Links

| Link | Descrição |
|------|-----------|
| [Resumo Executivo](../PLATFORM-WALLETS-SUMMARY.md) | Visão geral |
| [Implementação](./PLATFORM-WALLETS-HD-IMPLEMENTATION.md) | Técnica |
| [Guia Rápido](./PLATFORM-WALLETS-QUICK-GUIDE.md) | Uso |
| [Changelog](../CHANGELOG-PLATFORM-WALLETS.md) | Mudanças |
| [Troubleshooting](./TROUBLESHOOTING.md) | Problemas |

---

**Documentação mantida por**: Claude (Anthropic)
**Última revisão**: 2025-12-11
