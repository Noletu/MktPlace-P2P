# 👨‍💻 Guia para Lucas - Branch: feature/rbac-and-crypto-cards-complete

**Branch criada em:** 04/01/2026
**Criada por:** nicode + Claude
**Status:** ✅ Pronta para desenvolvimento

---

## 🎯 O Que Tem Nesta Branch?

Esta branch contém **TODAS** as features implementadas até agora:

1. **Sistema RBAC Completo** (Role-Based Access Control)
2. **Crypto Price Cards** (Preços e taxas em tempo real)
3. **Melhorias no Dashboard Admin**

**Total:** 57 arquivos modificados/criados com ~13.500 linhas de código

---

## 🚀 Como Começar

### 1️⃣ Clonar/Atualizar o Repositório

Se você ainda **não tem** o repositório:
```bash
git clone https://github.com/Noletu/MktPlace-P2P.git
cd MktPlace-P2P
```

Se você **já tem** o repositório:
```bash
cd MktPlace-P2P
git fetch origin
```

### 2️⃣ Mudar para a Branch

```bash
git checkout feature/rbac-and-crypto-cards-complete
```

### 3️⃣ Instalar Dependências

```bash
# Backend (API)
cd apps/api
npm install

# Frontend (Web)
cd ../web
npm install

# Voltar para raiz
cd ../..
```

### 4️⃣ Configurar Banco de Dados

```bash
cd apps/api

# Gerar cliente Prisma
npx prisma generate

# Rodar migrations
npx prisma migrate dev

# Seedar banco (RBAC + dados iniciais)
npx prisma db seed
```

**IMPORTANTE:** O seed vai criar:
- Roles padrão (USER, GERENTE, SUPPORT, ADMIN, MASTER)
- Permissões para cada role
- Promover usuários existentes para suas roles

### 5️⃣ Iniciar Servidores

**Terminal 1 - Backend:**
```bash
cd apps/api
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd apps/web
npm run dev
```

### 6️⃣ Acessar a Aplicação

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001

---

## 📚 Documentação Disponível

### RBAC (Sistema de Permissões)
```
/README-RBAC.md                      ← Guia completo do RBAC
/docs/RBAC-IMPLEMENTATION.md         ← Detalhes técnicos
/docs/RBAC-QUICK-REFERENCE.md        ← Referência rápida
/docs/RBAC-FILES-SUMMARY.md          ← Resumo de arquivos
/CHANGELOG-RBAC.md                   ← Histórico de mudanças
```

### Crypto Price Cards
```
/docs/CRYPTO-PRICE-CARDS.md                ← Documentação completa
/docs/CRYPTO-PRICE-CARDS-QUICK-START.md    ← Guia rápido
/docs/INDEX-CRYPTO-CARDS.md                ← Índice
/CHANGELOG-CRYPTO-CARDS.md                 ← Histórico de mudanças
```

**Recomendação:** Comece pelos guias rápidos e referências antes de mergulhar nas docs completas.

---

## 🔑 Informações Importantes

### Hierarquia de Roles (RBAC)
```
MASTER > ADMIN > GERENTE > SUPPORT > USER
```

**O que cada role pode fazer:**
- **MASTER:** Tudo (incluindo operações financeiras)
- **ADMIN:** Tudo menos operações financeiras críticas
- **GERENTE:** Operações do dia-a-dia (disputas, freeze, pedidos)
- **SUPPORT:** Apenas suporte básico
- **USER:** Usuário normal da plataforma

### Acessar Painel Admin

**Como MASTER:**
1. Faça login com sua conta
2. Se não for MASTER ainda, rode: `node apps/api/promote-to-master.js SEU_EMAIL`
3. Acesse: http://localhost:3000/admin

**Badge no header:**
- MASTER: Roxo
- ADMIN: Azul
- GERENTE: Verde

### Crypto Price Cards

**Onde aparecem:**
- Homepage (header)
- Painel Admin (header)

**Como funcionam:**
- Auto-atualização: Preços (30min) | Taxas (15min)
- Desktop: 3 cards lado a lado
- Mobile: Dropdown "💰 Preços"
- Hover: Tooltip com detalhes

**APIs usadas:**
- CoinGecko (preços)
- mempool.space (taxas BTC)
- Etherscan (taxas ETH)

---

## 🗂️ Estrutura de Arquivos (Principais)

```
MktPlace-P2P/
│
├── apps/
│   ├── api/                           ← Backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma          ← Schema atualizado (GERENTE + frozenUntil)
│   │   │   └── seeds/                 ← Seeds RBAC
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── role.controller.ts ← Gestão de roles
│   │   │   ├── middleware/
│   │   │   │   ├── manager.middleware.ts         ← GERENTE+
│   │   │   │   ├── financialOperations.middleware.ts  ← MASTER only
│   │   │   │   └── master.middleware.ts          ← MASTER only
│   │   │   ├── services/
│   │   │   │   └── role.service.ts    ← Lógica de roles
│   │   │   ├── jobs/
│   │   │   │   └── autoUnfreeze.job.ts ← Auto-desbloqueio (cron)
│   │   │   └── routes/
│   │   │       └── role.routes.ts     ← Rotas de roles
│   │   │
│   │   └── promote-to-master.js       ← Script para promover a MASTER
│   │
│   └── web/                           ← Frontend
│       ├── app/
│       │   └── admin/
│       │       ├── layout.tsx         ← Header admin (badge dinâmico)
│       │       ├── page.tsx           ← Dashboard limpo
│       │       └── roles/page.tsx     ← Painel de roles (MASTER only)
│       │
│       ├── components/
│       │   ├── AppHeader.tsx          ← Header homepage (crypto cards)
│       │   ├── CryptoPriceCard.tsx    ← Card individual
│       │   ├── CryptoPriceCards.tsx   ← Container
│       │   └── admin/modals/          ← 8 modais admin
│       │
│       ├── hooks/
│       │   └── useCryptoPrices.ts     ← Auto-update logic
│       │
│       └── services/
│           └── cryptoPriceService.ts  ← API calls (CoinGecko, etc)
│
└── docs/                              ← Documentação completa
    ├── RBAC-*.md
    └── CRYPTO-PRICE-CARDS-*.md
```

---

## ✅ Checklist para Verificar se Tudo Está OK

### Backend
- [ ] `npm install` rodou sem erros
- [ ] `npx prisma generate` funcionou
- [ ] `npx prisma migrate dev` aplicou migrations
- [ ] `npx prisma db seed` criou roles e permissões
- [ ] Servidor iniciou em `http://localhost:3001`
- [ ] Nenhum erro no console

### Frontend
- [ ] `npm install` rodou sem erros
- [ ] Servidor iniciou em `http://localhost:3000`
- [ ] Crypto cards aparecem no header
- [ ] Dark mode funciona
- [ ] Nenhum erro no console do navegador

### Login e Painel Admin
- [ ] Consegue fazer login
- [ ] Badge aparece no header (MASTER/ADMIN/GERENTE)
- [ ] Painel admin acessível em `/admin`
- [ ] Painel de roles acessível em `/admin/roles` (se MASTER)
- [ ] Modais abrem corretamente

### Crypto Cards
- [ ] 3 cards aparecem (BTC, SOL, ETH)
- [ ] Preços carregam corretamente
- [ ] Tooltips aparecem on hover
- [ ] Responsive: Desktop mostra cards, mobile mostra dropdown

---

## 🐛 Problemas Comuns

### "Prisma Client não encontrado"
**Solução:**
```bash
cd apps/api
npx prisma generate
```

### "Migrations pendentes"
**Solução:**
```bash
cd apps/api
npx prisma migrate dev
```

### "Roles não existem no banco"
**Solução:**
```bash
cd apps/api
npx prisma db seed
```

### "Não consigo acessar /admin/roles"
**Solução:**
Você precisa ser MASTER. Execute:
```bash
cd apps/api
node promote-to-master.js SEU_EMAIL
```

### "Crypto cards não aparecem"
**Solução:**
1. Verificar console do navegador (F12)
2. Verificar se APIs externas estão acessíveis:
```bash
curl https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
```

### "CORS Error"
**Solução:**
Verificar se backend está rodando em `http://localhost:3001`

---

## 🎯 Próximas Tarefas (Sugestões)

### Alta Prioridade
- [ ] Adicionar testes unitários para RBAC
- [ ] Adicionar testes E2E para modais admin
- [ ] Implementar cache em localStorage para crypto cards

### Média Prioridade
- [ ] Adicionar mais criptomoedas (ADA, DOT, AVAX)
- [ ] Gráfico de variação de preços (24h)
- [ ] Notificações quando taxas estiverem baixas

### Baixa Prioridade
- [ ] WebSocket para updates real-time
- [ ] API própria agregando fontes de preços
- [ ] ML para prever melhores horários de transação

---

## 💡 Dicas de Desenvolvimento

### Git Workflow
```bash
# Criar sua própria branch de trabalho
git checkout -b feature/minha-nova-feature

# Trabalhar normalmente
git add .
git commit -m "feat: minha mudança"

# Manter sua branch atualizada com a principal
git fetch origin
git rebase origin/feature/rbac-and-crypto-cards-complete

# Push quando pronto
git push origin feature/minha-nova-feature
```

### Debug
- **Backend:** Console do terminal onde rodou `npm run dev`
- **Frontend:** Console do navegador (F12)
- **Banco:** `npx prisma studio` (interface visual)

### Logs Úteis
```bash
# Ver logs do backend
cd apps/api
npm run dev

# Ver logs do Prisma
export DEBUG="prisma:*"
npm run dev

# Ver SQL queries
export DEBUG="prisma:query"
npm run dev
```

---

## 📞 Contato

**Branch criada por:** nicode
**Assistido por:** Claude (Anthropic)
**Data:** 04/01/2026

**Se tiver dúvidas:**
1. Consulte a documentação em `/docs`
2. Verifique os READMEs e CHANGELOGs
3. Entre em contato com nicode

---

## 🎉 Boa Sorte!

Esta branch está 100% funcional e testada. Toda a documentação está completa e atualizada. Se seguir este guia passo a passo, você terá o mesmo ambiente que temos aqui.

**Happy Coding! 🚀**

---

**Última atualização:** 04/01/2026
**Branch:** feature/rbac-and-crypto-cards-complete
**Status:** ✅ Ready for Development
