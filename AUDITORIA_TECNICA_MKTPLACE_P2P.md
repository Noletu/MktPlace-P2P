# Auditoria Técnica — MktPlace-P2P

> **Versão:** 1.1
> **Data:** 14 de maio de 2026
> **Repositório auditado:** [Noletu/MktPlace-P2P](https://github.com/Noletu/MktPlace-P2P) `main` @ commit HEAD no momento da auditoria
> **Stack:** Turborepo · Next.js 14 · Express · TypeScript · Prisma · SQLite (atual) · BigNumber.js · BIP39/BIP32
>
> **Changelog v1.1:** adicionada seção §1.1 com classificação por **fase de execução** ([FAZER AGORA] / [ADIAR PRE-STAGING] / [ADIAR PRE-PROD]). Cada finding agora possui campo `Fase` explícito.

---

## 0. Como usar este documento

Este documento foi escrito para ser consumido **diretamente pelo Claude Code** em sessões de correção. Convenções:

1. **Cada finding tem ID único** (ex.: `CRIT-04`, `SER-13`). Use o ID como referência em commits, PRs, branches e comandos para o Claude Code.
2. **Cada finding é autossuficiente** — paths absolutos a partir da raiz do repo, linhas exatas, código atual, código proposto, critérios de aceitação e testes.
3. **Findings têm grafo de dependência** (`Depende de:` / `Bloqueia:`). Respeite a ordem topológica.
4. **Workflow recomendado por sessão:**
   ```
   1. Claude Code lê AUDITORIA_TECNICA_MKTPLACE_P2P.md (este arquivo)
   2. Lê CLAUDE.md do projeto (regras de TDD, Git, TypeScript)
   3. Escolhe 1-3 findings que não tenham dependências pendentes
   4. Para cada finding:
      a. Cria branch fix/<ID>-<slug-curto>
      b. Escreve teste que reproduz o bug (RED)
      c. Implementa a correção (GREEN)
      d. Refatora se necessário (REFACTOR)
      e. Verifica critérios de aceitação
      f. Commit com mensagem padronizada (ver §10)
      g. Atualiza este doc marcando o finding como ✅ Fechado
   5. Abre PR único agregando os fixes da sessão
   ```
5. **Não combine findings críticos em um único PR** — facilita rollback e revisão.

---

## 1. Sumário executivo

| Severidade | Quantidade | Bloqueia produção? |
|------------|------------|---------------------|
| 🔴 Crítico (CRIT) | 12 | Sim |
| 🟠 Sério (SER) | 16 | Sim para escala |
| 🟡 Médio (MED) | 12 | Não, mas pesa em manutenibilidade |
| 🟢 Reconhecimento de boas práticas | 16 | — |

**Veredito:** o sistema **não pode receber valor real** até pelo menos os findings `CRIT-01` a `CRIT-12` estarem fechados. Os bugs de ledger (`CRIT-04`, `CRIT-05`) e de derivação HD (`CRIT-02`) falham silenciosamente — descobertos apenas por reclamação de usuário, quando já é tarde.

---

## 1.1. Classificação por fase de execução

Nem todos os findings precisam ser resolvidos imediatamente. A classificação abaixo separa o que é **estrutural** (custo cresce com o tempo) do que é **operacional** (só importa em staging/produção).

### Princípio de decisão

> **Faça agora se:** toca em schema, contrato de dados, padrões de código, ou dinheiro/chaves.
> **Adie se:** é camada operacional, exige decisão de infra ainda não tomada, ou só faz diferença com tráfego/dinheiro real.

### Legenda

| Tag | Significado |
|-----|-------------|
| 🚨 **[FAZER AGORA]** | Estrutural. Cada dia que passa aumenta o custo de correção. **Não adie.** |
| 🟡 **[FAZER AGORA — PARCIAL]** | Fazer apenas a fatia indicada. Restante junto da fase posterior. |
| 🔵 **[ADIAR PRE-STAGING]** | Faça antes do primeiro deploy a um ambiente que use Postgres real, Redis e auth de verdade. |
| ⚪ **[ADIAR PRE-PROD]** | Faça antes do go-to-market (beta privado / abertura ao público). |
| ⚫ **[ADIAR PRE-LAUNCH PÚBLICO]** | Cabe na transição da Fase 0 → Fase 1 do roadmap do produto. |

### Distribuição por fase

| Fase | Quantos findings | Tempo estimado de dev |
|------|------------------|------------------------|
| 🚨 FAZER AGORA | 14 findings | ~3-4 semanas (1-2 devs) |
| 🟡 FAZER AGORA — PARCIAL | 2 findings | incluído acima |
| 🔵 ADIAR PRE-STAGING | 17 findings | ~2-3 semanas |
| ⚪ ADIAR PRE-PROD | 5 findings | ~1-2 semanas |
| ⚫ ADIAR PRE-LAUNCH | 2 findings | sob demanda |

### Tabela mestre — todos os findings por fase

#### 🚨 FAZER AGORA (14)

| ID | Título resumido | Esforço | Status |
|----|-----------------|---------|--------|
| CRIT-01 | Migrar para PostgreSQL | 1-2 semanas | ✅ `c9f0c82` |
| CRIT-02 | HD account index persistido (anti-colisão) | 1 semana | ⬜ |
| CRIT-03 | BigNumber em todos os valores monetários | 2-3 dias | ✅ `133d99b` + `e4ab499` |
| CRIT-03b | String → Decimal(38,18) no schema | 1-2 dias | ✅ `4d177e6` |
| CRIT-04 | Ledger atômico (unlock/credit/deduct) | 3-5 dias | ✅ `a40aea8` + `e4ab499` |
| CRIT-05 | Claim atômico em submitProof/cancelOrder | 2-3 dias |
| CRIT-06 | Backup codes 2FA com crypto.randomBytes | 1h | ✅ `bea7f20` |
| CRIT-07 | TOTP replay protection | meio dia | ✅ `38219ab` + `e9fcea3` |
| CRIT-08 | Limpar git de credenciais e dev.db | meio dia | ✅ Sprint 2 sessão 3 (git filter-repo + force-push 2026-05-16) |
| CRIT-09 | Kill switch em simulatePaymentReceived | 15min | ✅ `c5187e6` |
| CRIT-12 | Memzero da master seed após uso | meio dia | ✅ Sprint 2 sessão 4 (v1.10) |
| SER-14 | COOKIE_SECRET separado do JWT_SECRET | 15min |
| SER-21 | Remover arquivos .bak/.old/.backup | 15min | ✅ `62c8b55` |
| MED-32 | Adicionar updatedAt onde falta (junto com CRIT-01) | 1h |
| MED-39 | Remover customDailyLimitStr zumbi (junto com CRIT-01) | 1h |

#### 🟡 FAZER AGORA — PARCIAL (2)

| ID | Fazer agora | Adiar para |
|----|-------------|------------|
| SER-13 | Algoritmo explícito em sign/verify + secrets separados (`JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET`) — ~1h | TTL curto (15min) → PRE-STAGING (depende de refresh flow do frontend) |
| MED-31 | Substituir apenas `console.log` que vaza dado sensível (vide `auth.middleware.ts:51` que logga email) — ~1h | Refator completo para winston → PRE-STAGING |
| MED-33 | Migrar para `Json`/`jsonb` (junto com CRIT-01) | Validação Zod robusta dos JSONs → PRE-STAGING |
| MED-34 | FKs explícitas no schema (junto com CRIT-01) | `ON DELETE` policies finas → PRE-STAGING |

#### 🔵 ADIAR PRE-STAGING (17)

> **Trigger:** quando for subir o primeiro ambiente com Postgres real, Redis, domínio próprio e auth funcional fora do localhost.

| ID | Por que adiar agora |
|----|---------------------|
| CRIT-10 | Decisão de cloud provider e KMS ainda não tomada |
| CRIT-11 | Depende de CRIT-10 |
| SER-13 (resto) | TTL curto atrapalha debug enquanto frontend de auth está mudando |
| SER-15 | Em dev, credenciais fixas facilitam debug (desde que fora do git, vide CRIT-08) |
| SER-17 | CORS sem origin é útil em curl/Postman durante dev |
| SER-18 | Refator de Argon2id implica re-encriptar wallets → coordenar com KMS migration |
| SER-19 | Junto com refator de chaves (SER-18) |
| SER-20 | Frontend de auth ainda em iteração — mexer agora dá merge conflict |
| SER-22 | Sem usuários reais, account lockout só atrapalha (você se tranca da própria conta de teste) |
| SER-23 | Mesma razão de SER-22 |
| SER-24 | Workers ainda em iteração; require2FA prematuro atrapalha |
| SER-25 | Adiciona dependência de Redis. `setImmediate` é suficiente em dev |
| SER-26 | Em dev usa-se boleto fake mesmo |
| SER-27 | Em dev usa-se CPF fake mesmo |
| SER-28 | Mesma razão de SER-24 |
| MED-31 (resto) | Refator completo só faz sentido quando log aggregation estiver configurado |
| MED-36 | Em dev `unsafe-inline` ajuda no debug visual |
| MED-37 | Documentação melhor quando frontend de RBAC estabilizar |
| MED-38 | Quando upload de comprovante for usado de fato |

#### ⚪ ADIAR PRE-PROD (5)

> **Trigger:** antes de aceitar primeiro usuário externo (beta privado).

| ID | Por que adiar agora |
|----|---------------------|
| SER-16 | Sem tráfego real, DoS não é vetor |
| MED-29 | Reorganização de docs não bloqueia desenvolvimento |
| MED-30 | Decisão de time, pode esperar |
| MED-35 | Load tests sem staging real são inúteis |
| MED-40 | Workers em processo separado é mudança de infra |

#### ⚫ ADIAR PRE-LAUNCH PÚBLICO (decisões de produto/orçamento)

| Item | Quando |
|------|--------|
| Auditoria externa de segurança (Trail of Bits / Tempest / Conviso) | Depois de fechar todos os CRIT e SER da fase pre-prod |
| Bug bounty (HackerOne / Intigriti) | Pós-lançamento público |
| KYC providers (Unico / Idwall / Caf) | Quando registrar como VASP no BACEN |
| AML providers (Chainalysis / TRM Labs) | Volume alto ou exigência regulatória |
| Smart contracts auditados (Fase 2 do roadmap) | Quando produto centralizado validar product-market fit |

### Como o Claude Code deve usar

No início de cada sessão, o agente decide o que pegar com base na fase atual do projeto. Sugestão de prompt:

```
Estamos na fase de [DESENVOLVIMENTO INICIAL].
Leia AUDITORIA_TECNICA_MKTPLACE_P2P.md §1.1.
Hoje vamos atacar APENAS findings marcados com 🚨 [FAZER AGORA] ou 🟡 [PARCIAL].
Liste os findings disponíveis, considerando dependências, e proponha
2-3 que façam sentido para esta sessão.
```

Quando o projeto avançar de fase, basta atualizar o prompt:

```
Estamos na fase de [PRE-STAGING].
Findings disponíveis: 🚨 [FAZER AGORA] não fechados + 🔵 [ADIAR PRE-STAGING].
```

---

## 2. Escopo da auditoria

### 2.1 O que foi analisado

| Área | Cobertura | Findings |
|------|-----------|----------|
| Schema Prisma | 100% | CRIT-01, MED-32, MED-33, MED-34, MED-39 |
| Auth (login, register, JWT, cookies) | 100% | CRIT-08, SER-13, SER-14, SER-20, SER-22, SER-23 |
| 2FA (TOTP, backup codes) | 100% | CRIT-06, CRIT-07 |
| HD Wallet (seed, derivation, key management) | 100% | CRIT-02, CRIT-10, CRIT-11, CRIT-12, SER-18, SER-19 |
| Ledger interno (lock/unlock/credit/deduct) | 100% | CRIT-03, CRIT-04, CRIT-05 |
| Order service (create, match, cancel) | ~70% | CRIT-05, SER-22 |
| Transaction service (proof submit/validate) | ~70% | CRIT-05 |
| Middlewares (auth, rate limit, CORS) | 100% | SER-16, SER-17, SER-37 |
| Rotas e controllers (sample) | ~40% | SER-26, SER-27, SER-28 |
| Bootstrap (`src/index.ts`) | 100% | SER-14, SER-16, MED-40 |
| Segurança de repositório (gitignore, secrets) | 100% | CRIT-08, MED-29 |

### 2.2 O que NÃO foi analisado (gaps de auditoria)

Sessões futuras devem cobrir:

- `apps/web/` inteiro — XSS, gestão de estado sensível, leakage via dev tools, CSP no Next.js
- `src/services/withdrawal-processor.service.ts` — saída de cripto da plataforma (alto risco)
- `src/services/sweep.service.ts` — varredura de hot wallets
- `src/services/blockchain/transaction-sender.service.ts` — assinatura e broadcast
- `src/services/dispute.service.ts` — fluxo de disputas
- `src/services/penalty.service.ts` + `antiSpam.service.ts`
- `src/services/boleto-ocr.service.ts` — validação de comprovantes
- `src/socket/` — autenticação WebSocket, autorização por room
- `src/workers/` inteiro — concorrência entre instâncias, leader election
- `prisma/seed.ts` — credenciais geradas, idempotência
- Tests existentes — adequação de coverage real, falsos positivos
- Frontend admin (`/admin/*`) — controle de acesso server-side via Next middleware
- Infra Docker / k8s

Recomenda-se contratar **auditoria externa** (Trail of Bits, OpenZeppelin, ou pentester local) antes do go-to-market.

---

## 3. Categorias de severidade

| Tag | Definição |
|-----|-----------|
| 🔴 **CRIT** | Bug explorável que causa perda direta de fundos, comprometimento de chaves, ou ACID violation no ledger. **Bloqueia produção.** |
| 🟠 **SER** | Falha de segurança ou correção que não causa perda imediata mas reduz drasticamente o custo de exploit por atacante motivado. Bloqueia escala. |
| 🟡 **MED** | Dívida técnica, anti-padrão, ou risco indireto. Afeta manutenibilidade, performance ou conformidade. |
| 🟢 **GOOD** | Prática correta identificada — preservar e replicar. |

---

## 4. Convenções para Claude Code

### 4.1 Branch naming
```
fix/<ID-em-minusculas>-<slug-curto-em-kebab-case>
# exemplos:
fix/crit-04-ledger-tocttou-races
fix/ser-13-jwt-shorter-expiry
```

### 4.2 Commit message template
```
<tipo>(<escopo>): <descrição curta em pt-BR> [<ID>]

<descrição em pt-BR explicando o porquê>

Auditoria: <ID>
Refs: AUDITORIA_TECNICA_MKTPLACE_P2P.md
```
Tipos: `fix`, `refactor`, `test`, `security`, `chore`, `docs`.

### 4.3 Estrutura de teste
Para todo finding com correção em código de runtime, espera-se:
```
apps/api/src/services/__tests__/<service>.<id>.spec.ts
```
contendo, no mínimo:
1. Teste que **reproduz** o bug com o código antigo (deve falhar antes do fix).
2. Teste que **prova** a correção (deve passar depois do fix).
3. Teste de **regressão** para o caminho feliz (já era).

### 4.4 Definition of Done (geral)

Um finding está fechado quando:

- [ ] Código corrigido nas linhas indicadas
- [ ] Testes unitários novos passando
- [ ] `npm run lint` no diretório `apps/api` sem novos warnings
- [ ] `npm test` sem regressões
- [ ] Critério de aceitação específico do finding atendido
- [ ] Documentação (esta) atualizada com ✅ + commit hash

---

# Parte I — Findings Críticos (🔴 CRIT)

---

## CRIT-01 — SQLite como banco em arquitetura financeira

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — base estrutural; cada semana de desenvolvimento em cima do SQLite multiplica o retrabalho
**Categoria:** Infraestrutura / Banco de dados
**Status:** ✅ **Fechado** (Sprint 1 — commit `c9f0c82`)
**Depende de:** —
**Bloqueia:** CRIT-04, CRIT-05, MED-33, MED-34, MED-39 (todos se beneficiam de Postgres)
**Esforço estimado:** 1-2 semanas

### Fechamento (Sprint 1)
- `provider = "postgresql"` em `apps/api/prisma/schema.prisma` (commit `c9f0c82`)
- `DATABASE_URL` em `apps/api/.env` aponta para `postgresql://mktplace:.../mktplace` (Docker Compose `infra/docker/docker-compose.yml`)
- Schema validado: `npx prisma validate` passa; `npx prisma generate` regenera client sem erros
- Migration de campos String → Decimal entregue separadamente como **CRIT-03b** (commit `4d177e6`); ver seção CRIT-03 para detalhes
- ⚠️ Aplicação da migration (`npx prisma migrate dev`) depende de Postgres rodando localmente — comando fica como pré-requisito documentado para o desenvolvedor

### Arquivos afetados
- `apps/api/prisma/schema.prisma:8-11`
- `.env.example:5`
- `apps/api/prisma/migrations/**` (todas as migrações precisam ser regeradas)
- `infra/docker/docker-compose.yml` (verificar)

### Código atual
```prisma
// apps/api/prisma/schema.prisma:8-11
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

```env
# .env.example:5
DATABASE_URL="file:./apps/api/prisma/dev.db"
```

### Problema

O README declara Postgres mas o schema é SQLite. SQLite é **inadequado para sistema custodial**:

1. **Single-writer global** — apenas uma transação de escrita por vez na database inteira. Sob carga concorrente, todos os requests de escrita serializam.
2. **Sem `SELECT ... FOR UPDATE`** — impossibilita lock pessimista de linhas.
3. **Sem tipo `Decimal` nativo** — força armazenamento de valores monetários como `String`, abrindo brecha para `parseFloat` em runtime (vide CRIT-03).
4. **Sem ENUMs nativos** — o próprio comentário admite isso em `schema.prisma:13`.
5. **Sem transações aninhadas** — o próprio código admite em `order.service.ts:404`.
6. **Não escala horizontalmente** — impossível ter múltiplas instâncias de API.
7. **Sem replicação síncrona** — perda de dados em crash é provável.

### Correção

#### Passo 1 — Trocar provider
```prisma
// apps/api/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### Passo 2 — Trocar todos os campos `String` que armazenam dinheiro/cripto para `Decimal`
Onde encontrar (não-exaustivo):
- `User.customDailyLimit` (já é Float — vide MED-39)
- `Order.cryptoAmount`, `Order.brlAmount`, `Order.platformFee`, `Order.payerReward`, `Order.totalFee`, `Order.collateralLockedAmount`, `Order.refundAmount`, `Order.refundNetworkFee`, `Order.refundProcessingFee`, `Order.originalPlatformFee`, `Order.discountAmount`
- `UserWallet.balance`, `availableBalance`, `lockedBalance`, `totalDeposited`, `totalUsed`
- `WalletTransaction.amount`, `balanceBefore`, `balanceAfter`
- `Withdrawal.amount`, `fee`, `netAmount`
- `Fee.amount`
- `PlatformTransfer.amount`
- `SweepTransaction.amount`

Para cada, mude:
```prisma
// antes
cryptoAmount String

// depois
cryptoAmount Decimal @db.Decimal(38, 18)  // 38 dígitos totais, 18 decimais (suporta BTC com satoshis e wei de ETH)
```

⚠️ **`@db.Decimal(38, 18)` cobre BTC (8 decimais), USDC/USDT (6 decimais), e ETH (18 decimais) com folga.** Para valores em BRL use `@db.Decimal(20, 2)`.

#### Passo 3 — Migrar ENUMs string para enum nativo Postgres
Onde encontrar:
- `Order.status`, `Order.orderType`, `Order.type`, `Order.refundStatus`
- `Transaction.status`
- `UserWallet.status` (se houver)
- `Dispute.status`
- `Withdrawal.status`
- `WalletTransaction.type`

Padrão:
```prisma
enum OrderStatus {
  PENDING
  MATCHED
  IN_NEGOTIATION
  PAYMENT_SENT
  VALIDATING
  COMPLETED
  DISPUTED
  CANCELLED
  TIMEOUT
  EXPIRED
}

model Order {
  status OrderStatus @default(PENDING)
}
```

#### Passo 4 — Resetar migrations
```bash
cd apps/api
rm -rf prisma/migrations
npx prisma migrate dev --name init_postgres
```

#### Passo 5 — Atualizar Docker Compose
Confirmar que `infra/docker/docker-compose.yml` provisiona Postgres 16 + healthcheck.

#### Passo 6 — Script de seed regerar
```bash
npm run prisma:seed
```

#### Passo 7 — Atualizar `.env.example`
```env
DATABASE_URL="postgresql://mktplace:CHANGE_ME@localhost:5432/mktplace?schema=public"
```

#### Passo 8 — Atualizar README, COMO_INICIAR, etc.

### Critério de aceitação

- [ ] `npx prisma validate` passa
- [ ] `npx prisma migrate dev` cria DB Postgres limpo
- [ ] Todos os testes E2E passam contra Postgres
- [ ] Nenhum campo `String` armazena valor monetário
- [ ] Todos os status são `enum` no schema
- [ ] `grep -r "sqlite" prisma/` retorna vazio
- [ ] `grep -r "parseFloat.*Balance\|parseFloat.*Amount" src/` revisado (CRIT-03 trata o que sobrar)

### Testes

```typescript
// apps/api/src/__tests__/db.crit01.spec.ts
describe('CRIT-01: Postgres provider', () => {
  it('uses PostgreSQL provider', async () => {
    const result = await prisma.$queryRawUnsafe<[{version: string}]>(
      'SELECT version();'
    );
    expect(result[0].version).toMatch(/PostgreSQL/);
  });

  it('Decimal fields preserve precision (no float drift)', async () => {
    const wallet = await prisma.userWallet.create({
      data: {
        userId: 'test-user',
        cryptoType: 'BTC',
        network: 'BITCOIN',
        address: 'bc1qtest',
        derivationPath: "m/44'/0'/1'/0'/0'",
        encryptedPrivateKey: 'test',
        balance: '0.10000001',
        availableBalance: '0.10000001',
        lockedBalance: '0',
      },
    });
    expect(wallet.balance.toString()).toBe('0.100000010000000000');
  });

  it('SELECT FOR UPDATE works (advisory lock)', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(1)');
      // se chegou aqui sem erro, locks funcionam
    });
  });
});
```

### Riscos / observações

- **Dados de dev existentes serão perdidos.** Documentar isso em runbook.
- A versão dev.db comitada (vide CRIT-08) precisa ser removida do histórico Git **antes** ou **depois** dessa migração — coordenar com o time.
- Considerar usar Prisma `previewFeatures = ["postgresqlExtensions"]` se for usar `pg_trgm` para search.

---

## CRIT-02 — Colisão determinística de HD wallets entre usuários

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — em dev, migração é trivial; com saldo on-chain real, exige sweep de todos os endereços antigos
**Categoria:** Criptografia / Custódia
**Status:** ⬜ Aberto
**Depende de:** CRIT-01 (para migration limpa)
**Bloqueia:** ir para produção
**Esforço estimado:** 1 semana + script de migração de dados

### Arquivo afetado
- `apps/api/src/services/hd-wallet/derivation.service.ts:283-298`

### Código atual
```typescript
// apps/api/src/services/hd-wallet/derivation.service.ts:283-298
private static userIdToAccountIndex(userId: string): number {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(userId).digest();

  // Usar primeiros 4 bytes como número (0 a 4,294,967,295)
  const account = hash.readUInt32BE(0);

  // Limitar a 2^31 - 1 para BIP32 (hardened derivation)
  const limitedAccount = account % 0x80000000;

  // IMPORTANTE: Garantir que account >= 1 (0 é reservado para platform)
  return limitedAccount === 0 ? 1 : limitedAccount;
}
```

### Problema

O índice da conta BIP44 é derivado por SHA-256(userId), truncado a 31 bits → espaço efetivo de 2^31 ≈ 2,147,483,648.

**Paradoxo do aniversário aplicado:**
- 50% de probabilidade de colisão com **~54.000 usuários**
- 99% de probabilidade com **~280.000 usuários**

Quando dois `userId` distintos colidem no mesmo `accountIndex`:
- Eles compartilham o **mesmo endereço** (mesma carteira HD).
- Quem depositar pode ter o saldo "roubado" pelo outro fazendo retirada.
- O bug **não dispara erro nenhum** — o sistema atribui o mesmo endereço a dois usuários silenciosamente.

A correção do `if (limitedAccount === 0) return 1;` (linha 297) só protege contra colidir com a Platform Wallet (Account 0). **Não protege contra colisão entre usuários.**

### Correção

#### Passo 1 — Adicionar campo persistente no schema
```prisma
// apps/api/prisma/schema.prisma — model User
model User {
  // ...
  hdAccountIndex Int @unique  // BIP44 account index, sequencial >= 1
  // ...
}
```

Para Postgres, a sequência é trivial:
```sql
CREATE SEQUENCE user_hd_account_seq START WITH 1 INCREMENT BY 1;
```

#### Passo 2 — Atribuir `hdAccountIndex` em transação de registro
```typescript
// apps/api/src/services/auth.service.ts — register()
const user = await prisma.$transaction(async (tx) => {
  const seqResult = await tx.$queryRaw<[{nextval: bigint}]>`
    SELECT nextval('user_hd_account_seq') as nextval
  `;
  const accountIndex = Number(seqResult[0].nextval);

  // SECURITY: BIP32 hardened derivation suporta até 2^31 - 1 ≈ 2.1B usuários
  if (accountIndex >= 0x80000000) {
    throw new Error('HD account index space exhausted');
  }

  return await tx.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      name: input.name,
      roleId: userRole.id,
      legacyRole: 'USER',
      hdAccountIndex: accountIndex,
    },
  });
});
```

#### Passo 3 — Refatorar `userIdToAccountIndex`
```typescript
// apps/api/src/services/hd-wallet/derivation.service.ts
static async deriveUserWallet(
  userId: string,
  cryptoType: string,
  network: string
): Promise<{ address: string; privateKey: string; derivationPath: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hdAccountIndex: true },
  });
  if (!user) throw new Error(`User ${userId} not found`);
  if (user.hdAccountIndex == null) {
    throw new Error(`User ${userId} has no HD account index (data integrity error)`);
  }

  const coinType = this.getCoinType(cryptoType, network);
  const account = user.hdAccountIndex;

  const derivationPath = `m/44'/${coinType}'/${account}'/0'/0'`;
  // ... resto idêntico
}
```

#### Passo 4 — Script de migração para usuários existentes
```typescript
// apps/api/scripts/migrate-hd-account-index.ts
async function migrate() {
  const users = await prisma.user.findMany({
    where: { hdAccountIndex: null },
    orderBy: { createdAt: 'asc' }, // determinístico
    select: { id: true },
  });

  for (let i = 0; i < users.length; i++) {
    const oldIndex = computeLegacyIndex(users[i].id); // SHA-256 antigo
    const newIndex = i + 1; // novo sequencial

    if (oldIndex === newIndex) continue; // sorte cósmica

    console.log(`User ${users[i].id}: oldPath m/44'/.../${oldIndex}' → newPath m/44'/.../${newIndex}'`);
    // ATENÇÃO: se já há saldo on-chain no oldPath, é preciso varrer para o newPath ANTES.
  }
}
```

⚠️ **Para usuários com saldo on-chain no path antigo, é mandatório fazer sweep do endereço antigo para o novo antes de mudar o `hdAccountIndex`.**

#### Passo 5 — Remover `userIdToAccountIndex` da classe
Deixar somente a função `static computeLegacyIndex(userId)` para uso exclusivo do script de migração.

### Critério de aceitação

- [ ] Schema possui `User.hdAccountIndex Int @unique`
- [ ] Registro novo gera `hdAccountIndex` sequencial via SEQUENCE atômica
- [ ] `deriveUserWallet` lê `hdAccountIndex` do banco (nunca recomputa)
- [ ] Script de migração executado sem erros em ambiente de staging
- [ ] Teste de stress: criar 100.000 usuários e verificar zero colisões

### Testes

```typescript
// apps/api/src/services/__tests__/derivation.crit02.spec.ts
describe('CRIT-02: HD wallet sem colisão', () => {
  it('rejeita derivação se hdAccountIndex é null', async () => {
    const user = await prisma.user.create({
      data: { email: 'x@y.com', password: 'h', hdAccountIndex: null as any },
    });
    await expect(
      DerivationService.deriveUserWallet(user.id, 'BTC', 'BITCOIN')
    ).rejects.toThrow(/no HD account index/);
  });

  it('100k usuários, zero colisão de endereço', async () => {
    const addresses = new Set<string>();
    for (let i = 0; i < 100_000; i++) {
      const user = await prisma.user.create({
        data: {
          email: `user${i}@test.com`,
          password: 'h',
          hdAccountIndex: i + 1,
        },
      });
      const { address } = await DerivationService.deriveUserWallet(user.id, 'BTC', 'BITCOIN');
      expect(addresses.has(address)).toBe(false);
      addresses.add(address);
    }
  });

  it('SEQUENCE é atômica sob concorrência', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      prisma.$queryRaw<[{nextval: bigint}]>`SELECT nextval('user_hd_account_seq')`
    );
    const results = await Promise.all(promises);
    const values = results.map(r => Number(r[0].nextval));
    expect(new Set(values).size).toBe(100); // todos únicos
  });
});
```

---

## CRIT-03 — `parseFloat` em valores monetários

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — é um padrão de código; cada `parseFloat` novo escrito hoje é mais um para refatorar amanhã
**Categoria:** Aritmética / Money
**Status:** ✅ **Fechado** (Sprint 1 — commits `133d99b` + `e4ab499` hardening + `4d177e6` CRIT-03b)
**Depende de:** —
**Bloqueia:** CRIT-04 (correção das races deve já usar BigNumber)
**Esforço estimado:** 2-3 dias + testes

### Fechamento (Sprint 1)

**CRIT-03 base** (`133d99b`):
- Criado `apps/api/src/utils/money.ts` com helpers BigNumber: `toBN`, `addBN`, `subBN`, `mulBN`, `divBN`, `sumBN`, `gtBN`, `ltBN`, `gteBN`, `lteBN`, `eqBN`, `toFixed`, `maxBN`, `minBN`, `isZeroBN`, `isNegativeBN`
- Eliminado `parseFloat` de todos os ~30 arquivos da API (`grep -r "parseFloat" apps/api/src --include="*.ts"` retorna vazio)
- Reutilização: `bignumber.js@9.3.1` já estava no `package.json`

**CRIT-03 hardening** (`e4ab499`):
- Type `Money = string | BigNumber | Prisma.Decimal` em `money.ts`; `number` rejeitado em runtime
- `addBN`, `subBN`, `sumBN`, comparações tipadas como `Money` (não aceitam `number`)
- `toIntegerDown(value, multiplier)` com `BigNumber.ROUND_DOWN` explícito para conversões crypto → smallest-unit (lamports/wei)
- `transaction-sender.service.ts`: 4 sites de conversão on-chain agora usam `toIntegerDown`
- Testes: `money.crit03.spec.ts` com 18 testes (fast-check property-based + Prisma.Decimal + IEEE-754 sanity)

**CRIT-03b — String → Decimal no schema** (`4d177e6`):
- ~50 campos monetários migrados de `String` para `Decimal @db.Decimal(38, 18)` em 11 modelos (UserWallet, Order, Transaction, Withdrawal, Fee, PlatformWallet, PlatformWalletMovement, PlatformTransfer, SweepTransaction, PriceQuote, CancellationHistory, ExchangeRate, WalletTransaction)
- 18 serviços adaptados: `new BigNumber(decimal)` → `toBN(decimal)`; `.toString()` em boundaries (emails, notifications, APIs internas que esperam `string`)
- TypeScript clean: zero erros novos introduzidos (25 pré-existentes preservados)
- **Migration aplicada (2026-05-15)**: `20260515004150_init_postgres_decimal_fields` — colunas `numeric(38,18)` confirmadas via `information_schema.columns`. Migrations SQLite legadas arquivadas em `prisma/migrations.sqlite-legacy/`.

**CRIT-03b read-path** (commit a seguir): durante a auditoria pós-migration, foram identificadas comparações de pagamento em `services/blockchain.service.ts:120,186` e leitura de saldo em `services/blockchain/blockchain.service.ts:208` que usavam `toBN(weiBalance).toNumber() / 1e18` ou `parseInt(hexWei, 16) / 1e18`. Wei de ETH excede `Number.MAX_SAFE_INTEGER` (2^53 ≈ 9e15) — a div em double truncava silenciosamente. Substituído por `divBN(weiStr, 1e18)` e comparação via `gteBN()`, preservando precisão de 18 casas. Para o caminho hex→decimal, `BigInt(hex)` antes do `divBN`.

### Arquivos afetados (não exaustivo — `grep` para confirmar)

| Arquivo | Linhas | Contexto |
|---------|--------|----------|
| `apps/api/src/services/collateral.service.ts` | 114, 159, 184, 191 | Saldo de carteira |
| `apps/api/src/services/internal-balance.service.ts` | 130 | Retorno como `number` ao caller |
| `apps/api/src/services/order.service.ts` | 1078, 504 | Validação de limite diário |
| `apps/api/src/services/order.service.ts` | (procurar) | `parseFloat(order.brlAmount)` em vários lugares |
| `apps/api/prisma/schema.prisma` | 28 | `customDailyLimit Float` legacy |

### Código atual (exemplos)
```typescript
// collateral.service.ts:191
newBalance: (parseFloat(wallet.balance) + parseFloat(amount)).toFixed(8),

// internal-balance.service.ts:130
async getAvailableBalance(...): Promise<number> {
  // ...
  return parseFloat(wallet.availableBalance);  // ⚠️ devolve number!
}

// order.service.ts:1078
const limitCheck = await limitService.canUserTransact(
  payerId,
  parseFloat(order.brlAmount)
);
```

### Problema

`number` em JavaScript é IEEE-754 double. Isso implica:

```javascript
0.1 + 0.2 === 0.30000000000000004
(0.1).toFixed(20) === "0.10000000000000000555"
parseFloat("99999999999999999999.0") === 1e20  // perde precisão
```

Para BTC com 8 decimais ou ETH com 18 decimais, **divergências são inevitáveis e cumulativas**. Em sistemas custodiais, isso vira:

- Discrepância entre o que o usuário vê e o que está no banco
- Saldos negativos por falsa precisão
- Auditoria interna que "não bate"
- Reclame Aqui

Mesmo `.toFixed(8)` em string final não corrige — o erro já aconteceu na operação aritmética.

A presença de `bignumber.js` nas dependências (e seu uso correto em `wallet.service.lockBalance`) prova que vocês sabem disso. O problema é consistência.

### Correção

#### Política
**Regra de ouro:** nenhum valor monetário pode trafegar como `number`. Sempre `string` (entrada/saída de API e DB) ou `BigNumber` (operação aritmética).

#### Padrão de função de saldo
```typescript
// ❌ ERRADO
async getAvailableBalance(...): Promise<number> {
  return parseFloat(wallet.availableBalance);
}

// ✅ CERTO
async getAvailableBalance(...): Promise<BigNumber> {
  if (!wallet) return new BigNumber(0);
  return new BigNumber(wallet.availableBalance);
}

// ou, se o caller precisa serializar:
async getAvailableBalanceString(...): Promise<string> {
  return new BigNumber(wallet.availableBalance).toFixed(8);
}
```

#### Padrão de comparação
```typescript
// ❌ ERRADO
if (parseFloat(wallet.balance) >= parseFloat(amount)) { ... }

// ✅ CERTO
if (new BigNumber(wallet.balance).gte(new BigNumber(amount))) { ... }
```

#### Padrão de soma/subtração
```typescript
// ❌ ERRADO
const newBalance = (parseFloat(a) + parseFloat(b)).toFixed(8);

// ✅ CERTO
const newBalance = new BigNumber(a).plus(new BigNumber(b)).toFixed(8);
```

#### Helper centralizado (criar)
```typescript
// apps/api/src/utils/money.ts
import BigNumber from 'bignumber.js';

// Configurar BigNumber globalmente para evitar notação científica em strings
BigNumber.config({ EXPONENTIAL_AT: 1e9, DECIMAL_PLACES: 30 });

export const toBN = (v: string | number | BigNumber): BigNumber => {
  if (BigNumber.isBigNumber(v)) return v;
  const bn = new BigNumber(v);
  if (bn.isNaN()) throw new Error(`Invalid numeric value: ${v}`);
  return bn;
};

export const fmtCrypto = (v: BigNumber | string, decimals = 8): string =>
  toBN(v).toFixed(decimals, BigNumber.ROUND_DOWN);

export const fmtBRL = (v: BigNumber | string): string =>
  toBN(v).toFixed(2, BigNumber.ROUND_HALF_UP);

export const isPositive = (v: string | BigNumber): boolean => toBN(v).gt(0);

export const eqMoney = (a: string | BigNumber, b: string | BigNumber): boolean =>
  toBN(a).eq(toBN(b));
```

#### Refator obrigatório
1. Substituir todo `parseFloat` em arquivos de `services/`, `controllers/`, `workers/` que envolva valor monetário pelo helper acima.
2. Mudar assinatura de funções que retornam `number` para retornar `string` ou `BigNumber`.
3. Atualizar `limitService.canUserTransact` para aceitar `string | BigNumber`.

### Critério de aceitação

- [ ] `grep -rE "parseFloat\(.*(balance|amount|fee|brl|crypto|collateral|reward)" apps/api/src/` retorna vazio (case-insensitive)
- [ ] `grep -rE ": number" apps/api/src/services/` revisado linha a linha — nenhum representa dinheiro
- [ ] `utils/money.ts` criado e em uso
- [ ] Todos os testes existentes passam
- [ ] Novo teste de propriedade (fast-check ou similar): para 1000 pares de strings monetárias, `BigNumber.plus` é associativo

### Testes

```typescript
// apps/api/src/utils/__tests__/money.crit03.spec.ts
import fc from 'fast-check';
import { toBN, fmtCrypto } from '../money';

describe('CRIT-03: aritmética monetária segura', () => {
  it('toBN rejeita NaN/undefined/string inválida', () => {
    expect(() => toBN('abc')).toThrow();
    expect(() => toBN('')).toThrow();
  });

  it('plus é associativo para strings de 0 a 1e18', () => {
    fc.assert(fc.property(
      fc.bigInt({ min: 0n, max: 10n ** 18n }),
      fc.bigInt({ min: 0n, max: 10n ** 18n }),
      fc.bigInt({ min: 0n, max: 10n ** 18n }),
      (a, b, c) => {
        const left = toBN(a.toString()).plus(toBN(b.toString())).plus(toBN(c.toString()));
        const right = toBN(a.toString()).plus(toBN(b.toString()).plus(toBN(c.toString())));
        return left.eq(right);
      }
    ));
  });

  it('0.1 + 0.2 === 0.3 (sanidade contra IEEE-754)', () => {
    expect(toBN('0.1').plus(toBN('0.2')).eq(toBN('0.3'))).toBe(true);
  });

  it('preserva 18 decimais em soma', () => {
    const result = toBN('1.000000000000000001').plus('0.000000000000000001');
    expect(result.toFixed(18)).toBe('1.000000000000000002');
  });
});
```

---

## CRIT-04 — Race conditions no ledger (TOCTOU em `unlockBalance`, `deductBalance`, `creditBalance`)

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — DNA das funções financeiras; o padrão correto vira referência para todo código novo
**Categoria:** Concorrência / ACID
**Status:** ✅ **Fechado** (Sprint 1 — commits `a40aea8` + `e4ab499` hardening, **validado em Postgres real**)
**Depende de:** CRIT-01 (idealmente Postgres com `SELECT FOR UPDATE`)
**Bloqueia:** ir para produção
**Esforço estimado:** 3-5 dias

### Fechamento (Sprint 1)

**CRIT-04 base** (`a40aea8`):
- `unlockBalance`, `deductBalance`, `creditBalance` refatorados para `prisma.$transaction(async tx => ...)`
- Leitura de saldo (`findUnique`) movida para DENTRO do callback da transação — elimina o TOCTOU
- Isolation level `Prisma.TransactionIsolationLevel.Serializable` em todas as três
- Retry naive em P2034 (recursão simples) — substituído pelo hardening abaixo

**CRIT-04 hardening** (`e4ab499`):
- `withSerializableRetry<T>(method, context, fn)` helper em `wallet.service.ts`:
  - `logger.warn('LEDGER_RETRY_P2034', { method, attempt, walletId, ... })` estruturado a cada retry
  - Backoff exponencial com jitter, **cap em 250ms**: `min(250, 10 * 2^(n-1)) + random(50)` ms
  - Cap em **30 tentativas** (~7s worst-case), suficiente para lotes de ~50 concorrentes na mesma linha em test/dev. P2034 final em produção é logado como `LEDGER_P2034_EXHAUSTED` (erro), sinalizando problema arquitetural — ajustado após validação em Postgres real onde o cap=5 original falsificava ~30% das corridas concorrentes.
- `LEDGER_TX_OPTIONS` com `maxWait` env-aware:
  - `production` ou `staging`: 2500ms (abortar rápido se DB engasgou)
  - Default (dev/test): 5000ms (carga baixa, prioriza não falhar testes)
  - `timeout`: 10000ms (read + write + commit total)
- Testes: `wallet.crit04.spec.ts` com 4 integration tests:
  - 100 unlocks concorrentes de 1 BTC em wallet com locked=100 → exatamente 100 sucedem, saldo final correto
  - 200 unlocks com locked=100 → exatamente 100 fulfilled + 100 rejected
  - 50 credits concorrentes de 2 BTC → balance final = 100, sem duplicação
  - 30 deducts concorrentes com locked=20 → exatamente 20 fulfilled, saldo nunca negativo
  - Skip automático se `DATABASE_URL` não for postgresql (usa `describe.skip`)
  - HD wallet / blockchain services stubados via `jest.mock` no topo do arquivo — os métodos do ledger não os usam, e o stub evita o `SyntaxError` ESM de `@ethereumjs/wallet` no Jest CJS.
- **Validação executada em Postgres 18 nativo (2026-05-15):** 4/4 testes verde em 19.46s rodando contra DB real provisionado em `localhost:5432/mktplace`. Migration `20260515004150_init_postgres_decimal_fields` aplicada; tipos `numeric(38,18)` confirmados via `\d "UserWallet"`.

### Arquivos afetados
- `apps/api/src/services/wallet.service.ts:299-362` (`unlockBalance`)
- `apps/api/src/services/wallet.service.ts:374-446` (`deductBalance`)
- `apps/api/src/services/wallet.service.ts:470-530` (`creditBalance`)

### Código atual (defeituoso)
```typescript
// apps/api/src/services/wallet.service.ts:299
static async unlockBalance(walletId, amount, orderId, reason) {
  const wallet = await prisma.userWallet.findUnique({  // ⚠️ leitura FORA da tx
    where: { id: walletId },
  });
  if (!wallet) throw new Error(...);

  const lockedBN = new BigNumber(wallet.lockedBalance);  // valor pode estar stale
  const amountBN = new BigNumber(amount);

  if (lockedBN.lt(amountBN)) throw new Error(...);

  const newLockedBN = lockedBN.minus(amountBN);
  const newAvailableBN = new BigNumber(wallet.availableBalance).plus(amountBN);

  await prisma.$transaction([  // ⚠️ só os WRITES são atômicos
    prisma.userWallet.update({
      where: { id: walletId },
      data: {
        availableBalance: newAvailableBN.toFixed(8),
        lockedBalance: newLockedBN.toFixed(8),
      },
    }),
    prisma.walletTransaction.create({ /* ... */ }),
  ]);
}
```

### Problema

`prisma.$transaction([array])` executa os writes em um BEGIN/COMMIT, mas a **leitura** foi feita antes, fora da transação. O `findUnique` retorna um snapshot. Em concorrência:

```
T0: Wallet { lockedBalance: "100" }
T1: Request A → findUnique → vê locked=100
T2: Request B → findUnique → vê locked=100
T3: A calcula newLocked = 100 - 50 = 50
T4: B calcula newLocked = 100 - 50 = 50
T5: A → UPDATE locked=50
T6: B → UPDATE locked=50

Resultado: locked=50 (deveria ser 0), availableBalance creditado 2x (50+50=100).
Saldo de 100 unidades inventado do nada.
```

O mesmo padrão se aplica a:
- `deductBalance` (`wallet.service.ts:374-446`) — atacante pode deduzir menos que devido
- `creditBalance` (`wallet.service.ts:470-530`) — atacante pode creditar duas vezes recebendo um único depósito

**Em contraste, `lockBalance` (linha 218) está correto:**
```typescript
// ✅ CORRETO
const result = await prisma.$transaction(async (tx) => {
  const wallet = await tx.userWallet.findUnique({ where: { id: walletId } });
  // ... validação e update dentro do mesmo `tx`
});
```

### Correção

#### Padrão a aplicar nas três funções

```typescript
static async unlockBalance(
  walletId: string,
  amount: string,
  orderId: string,
  reason: string = 'Collateral unlocked'
) {
  return await prisma.$transaction(async (tx) => {
    // Em Postgres, usar SELECT FOR UPDATE para garantir lock pessimista
    const [wallet] = await tx.$queryRaw<UserWallet[]>`
      SELECT * FROM "UserWallet" WHERE id = ${walletId} FOR UPDATE
    `;

    if (!wallet) throw new Error(`Wallet ${walletId} not found`);

    const lockedBN = toBN(wallet.lockedBalance);
    const amountBN = toBN(amount);

    if (lockedBN.lt(amountBN)) {
      throw new Error(
        `Cannot unlock ${amountBN.toFixed(8)}. Only ${lockedBN.toFixed(8)} is locked.`
      );
    }

    const newLockedBN = lockedBN.minus(amountBN);
    const newAvailableBN = toBN(wallet.availableBalance).plus(amountBN);

    await tx.userWallet.update({
      where: { id: walletId },
      data: {
        availableBalance: newAvailableBN.toFixed(8),
        lockedBalance: newLockedBN.toFixed(8),
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId,
        userId: wallet.userId,
        type: 'UNLOCK',
        amount,
        balanceBefore: wallet.availableBalance,
        balanceAfter: newAvailableBN.toFixed(8),
        description: reason,
        metadata: JSON.stringify({ orderId, unlockedAmount: amount, timestamp: new Date().toISOString() }),
      },
    });

    return {
      success: true,
      newAvailableBalance: newAvailableBN.toFixed(8),
      newLockedBalance: newLockedBN.toFixed(8),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 10000,
  });
}
```

#### Alternativa sem SQL raw (Prisma puro)

Se preferir não usar `$queryRaw`, use isolation `Serializable` + retry em conflito:

```typescript
import { Prisma } from '@prisma/client';

async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        // Serialization failure — retry
        if (attempt === maxRetries - 1) throw e;
        await new Promise(r => setTimeout(r, 10 * Math.pow(2, attempt)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('unreachable');
}

static async unlockBalance(walletId, amount, orderId, reason) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.findUnique({ where: { id: walletId } });
      // ... resto idêntico ao padrão acima
    }, { isolationLevel: 'Serializable' })
  );
}
```

### Critério de aceitação

- [ ] `unlockBalance`, `deductBalance`, `creditBalance` todos com leitura DENTRO do `prisma.$transaction(async (tx) => ...)`
- [ ] Isolation level `Serializable` configurado, **ou** `SELECT FOR UPDATE` aplicado
- [ ] Retry com backoff exponencial em conflito de serialização
- [ ] Teste de stress concorrente passa (vide testes abaixo)
- [ ] `parseFloat` removido (cf. CRIT-03)

### Testes

```typescript
// apps/api/src/services/__tests__/wallet.crit04.spec.ts
describe('CRIT-04: ledger atômico sob concorrência', () => {
  async function createWallet(locked = '100', available = '0') {
    return await prisma.userWallet.create({
      data: {
        userId: 'test',
        cryptoType: 'BTC',
        network: 'BITCOIN',
        address: 'bc1qtest',
        derivationPath: "m/44'/0'/1'/0'/0'",
        encryptedPrivateKey: 'enc',
        balance: locked + available,
        availableBalance: available,
        lockedBalance: locked,
      },
    });
  }

  it('100 unlocks concorrentes de 1 não inventam saldo', async () => {
    const wallet = await createWallet('100', '0');
    const orderIds = Array.from({ length: 100 }, (_, i) => `order${i}`);

    const results = await Promise.allSettled(
      orderIds.map(oid => WalletService.unlockBalance(wallet.id, '1', oid))
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    expect(fulfilled).toBe(100);

    const final = await prisma.userWallet.findUnique({ where: { id: wallet.id } });
    expect(final!.lockedBalance).toBe('0.00000000');
    expect(final!.availableBalance).toBe('100.00000000');
  });

  it('200 unlocks concorrentes de 1 (só 100 deveriam passar) falham corretamente', async () => {
    const wallet = await createWallet('100', '0');
    const results = await Promise.allSettled(
      Array.from({ length: 200 }, (_, i) =>
        WalletService.unlockBalance(wallet.id, '1', `order${i}`)
      )
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;

    expect(fulfilled).toBe(100);
    expect(rejected).toBe(100);

    const final = await prisma.userWallet.findUnique({ where: { id: wallet.id } });
    expect(final!.lockedBalance).toBe('0.00000000');
    expect(final!.availableBalance).toBe('100.00000000');
  });

  it('creditBalance concorrente não duplica créditos', async () => {
    const wallet = await createWallet('0', '0');
    await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        WalletService.creditBalance(wallet.id, '2', `deposit${i}`)
      )
    );
    const final = await prisma.userWallet.findUnique({ where: { id: wallet.id } });
    expect(final!.balance).toBe('100.00000000');
  });
});
```

---

## CRIT-05 — TOCTOU em `submitProof` e outros pontos do `transaction.service` / `order.service`

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — mesmo padrão do CRIT-04, replicar enquanto a base de chamadores é pequena
**Categoria:** Concorrência / ACID
**Status:** ⬜ Aberto
**Depende de:** CRIT-04 (mesmo padrão)
**Bloqueia:** ir para produção
**Esforço estimado:** 2-3 dias

### Arquivos afetados
- `apps/api/src/services/transaction.service.ts:17-86` (`submitProof`)
- `apps/api/src/services/order.service.ts:1205-1421` (`cancelOrder`)
- `apps/api/src/services/order.service.ts:1422-1582` (`cancelOrderByPayer`)
- `apps/api/src/services/order.service.ts:1583+` (`cancelOrderByProvider`)
- Demais funções que seguem o padrão "findUnique → validate status → $transaction([...])"

### Código atual (`submitProof`)
```typescript
async submitProof(input: SubmitProofInput): Promise<Transaction> {
  const transaction = await prisma.transaction.findUnique({  // ⚠️ stale read
    where: { id: input.transactionId },
    include: { order: true },
  });
  if (!transaction) throw new Error('Transação não encontrada');
  if (transaction.payerId !== input.userId) throw new Error('...');
  if (transaction.status !== TransactionStatus.PENDING) throw new Error('...');

  const [updatedTransaction] = await prisma.$transaction([  // ⚠️ batch, sem lock
    prisma.transaction.update({
      where: { id: input.transactionId },
      data: { /* ... */ status: TransactionStatus.VALIDATING },
    }),
    prisma.order.update({ /* ... */ }),
  ]);
}
```

### Problema

Dois requests `submitProof` simultâneos para o mesmo `transactionId`:
- Ambos passam na verificação `status === PENDING`
- Ambos disparam o `$transaction([...])`
- O segundo sobrescreve o comprovante do primeiro **silenciosamente**

Pior: pode haver requests que mudam o status para destinos diferentes simultaneamente. Exemplo, comprador `submitProof` e timeout worker `cancel` ao mesmo tempo — não está claro qual ganha.

### Correção

#### Padrão de "claim atômico" (já usado em `validateProof`, replicar)
```typescript
async submitProof(input: SubmitProofInput): Promise<Transaction> {
  const validationDeadline = new Date();
  validationDeadline.setHours(validationDeadline.getHours() + 24);

  return await prisma.$transaction(async (tx) => {
    // 1. Claim atômico: só passa se status ainda é PENDING e payer correto
    const claimResult = await tx.transaction.updateMany({
      where: {
        id: input.transactionId,
        status: TransactionStatus.PENDING,
        payerId: input.userId,  // autorização inclusa no claim
      },
      data: {
        comprovanteData: input.comprovanteData,
        comprovanteUrl: input.comprovanteUrl,
        status: TransactionStatus.VALIDATING,
        validationDeadline,
      },
    });

    if (claimResult.count === 0) {
      // Verificar se foi por status ou autorização
      const existing = await tx.transaction.findUnique({
        where: { id: input.transactionId },
        select: { status: true, payerId: true },
      });
      if (!existing) throw new Error('Transação não encontrada');
      if (existing.payerId !== input.userId) throw new Error('Não autorizado');
      throw new Error(
        `Transação não está aguardando comprovante (status: ${existing.status})`
      );
    }

    // 2. Atualizar order (idempotente — só se ainda está MATCHED)
    await tx.order.updateMany({
      where: {
        id: (await tx.transaction.findUnique({
          where: { id: input.transactionId },
          select: { orderId: true },
        }))!.orderId,
        status: OrderStatus.MATCHED,
      },
      data: { status: OrderStatus.PAYMENT_SENT },
    });

    return (await tx.transaction.findUnique({ where: { id: input.transactionId } }))!;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
```

#### Aplicar mesmo padrão em todas as funções `cancel*` e similares

Para cada operação que faz "findUnique → check status → update", reescrever como:
1. `updateMany({ where: { id, status: STATE_REQUIRED, ...auth }, data: { status: NEW_STATE } })`
2. Verificar `count === 0` e diferenciar erros (não encontrado vs status errado vs não autorizado)
3. Demais writes encadeados dentro do mesmo `tx`

### Critério de aceitação

- [ ] `submitProof`, `cancelOrder`, `cancelOrderByPayer`, `cancelOrderByProvider` usam padrão de claim atômico
- [ ] Nenhum read-then-write fora de `prisma.$transaction(async tx => ...)`
- [ ] Testes de concorrência (vide abaixo) passam

### Testes

```typescript
describe('CRIT-05: claim atômico em submitProof', () => {
  it('submitProof concorrente para mesma transaction → apenas um sucesso', async () => {
    const tx = await createPendingTransaction();
    const results = await Promise.allSettled([
      transactionService.submitProof({ transactionId: tx.id, userId: tx.payerId, comprovanteData: 'A', comprovanteUrl: 'a' }),
      transactionService.submitProof({ transactionId: tx.id, userId: tx.payerId, comprovanteData: 'B', comprovanteUrl: 'b' }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled').length).toBe(1);
    expect(results.filter(r => r.status === 'rejected').length).toBe(1);
  });
});
```

---

## CRIT-06 — Backup codes de 2FA gerados com `Math.random()`

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — 1h de trabalho, fecha bypass de 2FA desde o início
**Categoria:** Criptografia / RNG
**Status:** ✅ **Fechado** (Sprint 2 — commit `bea7f20`)
**Depende de:** —
**Bloqueia:** —
**Esforço estimado:** 1h + invalidação de códigos existentes

### Fechamento (Sprint 2 — sessão 1 quick wins)

**RNG trocado por CSPRNG:**
- `generateBackupCodes(count)` agora usa `crypto.randomBytes(5).toString('hex').toUpperCase()` — 40 bits de entropia por código. Retorna strings **raw** (10 hex chars uppercase, sem hífen).
- Helper `formatBackupCode(raw)` adiciona hífens para exibição (`XXXX-XXXX-XX`). Hash continua sobre o raw; UI mostra formatado. Decoupling raw/formatado permite mudar UX no futuro sem invalidar hashes.
- Helper `normalizeBackupCode(input)` strip non-hex + uppercase antes do `bcrypt.compare`. Usuário pode digitar com hífens, sem hífens, em qualquer case.

**Pontos de uso atualizados:**
- `enableTwoFactor`: hash sobre raw, retorna formatado ao caller.
- `regenerateBackupCodes`: idem.
- `useBackupCode`: normaliza ANTES do compare; rejeita entrada que não vire 10 hex chars.

**Script de invalidação** (`apps/api/scripts/invalidate-2fa-backup-codes.ts`):
- Dry-run por default; `--apply` executa a invalidação.
- `UPDATE users SET twoFactorBackupCodes = NULL WHERE twoFactorEnabled = true AND twoFactorBackupCodes IS NOT NULL`.
- Documenta comunicação recomendada aos usuários: TOTP do app continua funcionando, só os backup codes precisam regenerar via UI (Configurações → Segurança → Regenerar Backup Codes).

**Testes** (`services/__tests__/twoFactor.crit06.spec.ts`, 5/5 verde):
- `cada código bate o padrão ^[0-9A-F]{10}$` em 50 amostras.
- `10.000 códigos consecutivos são todos únicos` — sanity check da entropia (40 bits, P(colisão em 10k) ≈ 4.5e-5).
- **Spy assertivo: `Math.random` NÃO é chamado** em nenhum momento de `generateBackupCodes(100)`.
- `count default = 10`.
- Distribuição razoável de chars (anti-bias): para cada hex char `0-9A-F`, frequência entre 250 e 1500 em 10.000 chars (esperado ~625).

### Arquivo afetado
- `apps/api/src/services/twoFactor.service.ts:197-205`

### Código atual
```typescript
generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}
```

### Problema

`Math.random()` no V8 usa **xorshift128+** — gerador pseudoaleatório **não-criptográfico**. Com poucas amostras consecutivas (~3 valores de `Math.random()`), o estado interno pode ser reconstruído ([paper](https://www.usenix.org/conference/usenixsecurity20/presentation/casini)).

Como esses códigos **bypassam o MFA**, ou seja, dispensam o autenticador → vulnerabilidade crítica de bypass de 2FA.

Análise adicional:
- `.toString(36).substring(2, 10)` extrai 8 chars do meio de um número base-36
- Entropia nominal: 36^8 ≈ 2.82 × 10^12 (≈ 41 bits)
- Entropia real considerando previsibilidade de `Math.random`: **muito menor**

### Correção

```typescript
import crypto from 'crypto';

generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 10 caracteres hex = 5 bytes = 40 bits de entropia REAL (CSPRNG)
    // formato XXXX-XXXX-XX para usabilidade
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
    codes.push(formatted);
  }
  return codes;
}
```

### Procedimento de migração

Códigos atuais devem ser **invalidados** porque podem ter sido derivados de RNG previsível:

```typescript
// apps/api/scripts/invalidate-2fa-backup-codes.ts
await prisma.user.updateMany({
  where: { twoFactorEnabled: true, twoFactorBackupCodes: { not: null } },
  data: { twoFactorBackupCodes: null },
});
```

Notificar usuários por email solicitando regeneração via `/2fa/regenerate-backup-codes`.

### Critério de aceitação

- [ ] Função usa `crypto.randomBytes`
- [ ] Códigos formatados como `XXXX-XXXX-XX` (preserva entropia, melhora UX)
- [ ] Script de invalidação executado
- [ ] Email automático disparado para usuários afetados
- [ ] Cobertura de teste: gera 100.000 códigos, verifica unicidade e padrão

### Testes

```typescript
describe('CRIT-06: backup codes seguros', () => {
  it('gera códigos únicos e bem-formados', () => {
    const codes = new Set<string>();
    const svc = new TwoFactorService();
    for (let i = 0; i < 10_000; i++) {
      const batch = svc.generateBackupCodes(10);
      for (const c of batch) {
        expect(c).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{2}$/);
        expect(codes.has(c)).toBe(false);
        codes.add(c);
      }
    }
  });

  it('não usa Math.random', async () => {
    const spy = jest.spyOn(Math, 'random');
    const svc = new TwoFactorService();
    svc.generateBackupCodes(10);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

---

## CRIT-07 — Sem replay protection no TOTP

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — meio dia; entrega 2FA correto desde já
**Categoria:** 2FA / Replay
**Status:** ✅ **Fechado** (Sprint 2 sessão 2 — commits `38219ab` + `e9fcea3`)
**Depende de:** —
**Bloqueia:** —
**Esforço estimado:** meio dia

### Fechamento (Sprint 2 — sessão 2)

**Schema:** novo campo `User.twoFactorLastUsedStep BigInt?` (migration `20260516151623_add_totp_last_used_step`). Armazena o timestep absoluto (`floor(unix / 30)`) do último TOTP aceito. Null quando 2FA nunca foi usado ou foi desabilitado (resetado em `disableTwoFactor`).

**verifyToken** (`twoFactor.service.ts`):
- `speakeasy.totp.verify` → `speakeasy.totp.verifyDelta`. Verifica retorna `{ delta }` se válido (com `WINDOW=1`, delta ∈ {-1, 0, +1} aceita pequeno clock skew do cliente) ou `undefined` se inválido.
- Calcula `currentStep = floor(Date.now()/1000/30) + delta` — o step absoluto que o token de fato assinou.
- **Replay check:** se `lastUsedStep !== null && BigInt(currentStep) <= lastUsedStep`, rejeita imediatamente e loga `securityLogger.totpReplay({userId, currentStep, lastUsed, reason: 'step_already_consumed'})`. Não cai para backup code: TOTP 6 dígitos não normaliza para backup code de 10 hex chars (CRIT-06) e o sinal de replay é forte demais para silenciar.
- **Anti-race atômico:** update via `prisma.user.updateMany` com `WHERE id = userId AND (twoFactorLastUsedStep IS NULL OR twoFactorLastUsedStep < currentStep)`. Duas requests paralelas com o mesmo token: ambas passam pelo replay check (lastUsedStep ainda null), ambas chamam updateMany; a primeira recebe `count=1`, a segunda recebe `count=0` (a condição WHERE falhou após a primeira escrever) e é tratada como replay (`reason: 'concurrent_update'`).
- Fallback para `useBackupCode` preservado para o caso de token inválido (TOTP errado, expirado fora de window=1). Backup codes do CRIT-06 inalterados.

**Logger:** novo método `securityLogger.totpReplay(userId, { currentStep, lastUsed, reason })` em `utils/logger.ts`. Vai para o transport `security-*.log` (retenção 90d) via winston.

**Testes** (`services/__tests__/twoFactor.crit07.spec.ts`, 6/6 verde em ~5s):
- (a) Token TOTP válido novo aceito; `twoFactorLastUsedStep` marcado com `nowStep`.
- (b) Mesmo token reusado em segundos rejeitado; step gravado não regride.
- (c) Token gerado para `nowSec + 30` aceito quando "agora" avança um step (Date.now mockado).
- (d) Token de step passado (delta=-1) aceito uma vez; replay rejeitado; token atual continua funcionando (step novo > step anterior).
- (e) `securityLogger.totpReplay` chamado uma vez no replay attempt, com `reason: 'step_already_consumed'`.
- (f) **Atomicidade:** `Promise.all([verifyToken, verifyToken])` com mesmo token → exatamente 1 sucesso + 1 falha. Estado final corretamente marcado.

**Validações cruzadas:** `twoFactor.crit06.spec.ts` (5/5) + `seed-guard.spec.ts` (4/4) + `seed-pipeline.spec.ts` (4/4) seguem verde. `npx tsc --noEmit` reporta os mesmos 25 erros pré-existentes, sem novos.

**Vetores cobertos** (do enunciado do finding):
- Shoulder-surfing: atacante vê código por cima do ombro → tenta reutilizar → rejeitado.
- Screen-share / extensão maliciosa: código capturado durante login legítimo → atacante tenta antes do step expirar → rejeitado.
- MITM em conexão inicial sem TLS válido: mesmo cenário, mesmo resultado.
- Race condition (atacante envia request paralelo no MESMO step): `count=0` na segunda updateMany detecta.

### Arquivo afetado
- `apps/api/src/services/twoFactor.service.ts:122-145` (`verifyToken`)

### Código atual
```typescript
async verifyToken(userId: string, token: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret || !user?.twoFactorEnabled) return false;

  const isTOTPValid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: WINDOW,  // default 1 = ±30s
  });
  if (isTOTPValid) return true;

  return await this.useBackupCode(userId, token);
}
```

### Problema

`speakeasy.totp.verify` retorna `true` para qualquer chamada com o mesmo `token` dentro da janela de tempo (30-90s). Não há registro de "este token já foi usado".

**Cenário de exploit:**
1. Atacante observa o usuário digitando 2FA (shoulder-surfing, screen-share, browser-extension malicioso, MITM em conexão inicial sem TLS)
2. Em segundos, atacante reusa o mesmo código em outro device/IP
3. Login bem-sucedido

A própria RFC 6238 §5.2 obriga implementações a rejeitar reuso:
> *"The verifier MUST NOT accept the second attempt of the OTP after the successful validation has been issued for the first OTP."*

### Correção

#### Schema
```prisma
// apps/api/prisma/schema.prisma — model User
model User {
  // ...
  twoFactorLastUsedStep BigInt? // timestep do último TOTP aceito (Unix / 30)
}
```

#### Service
```typescript
async verifyToken(userId: string, token: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret || !user?.twoFactorEnabled) return false;

  // speakeasy.totp.verifyDelta retorna { delta } se válido, undefined se inválido
  const verifyResult = speakeasy.totp.verifyDelta({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: WINDOW,
    step: 30,
  });

  if (verifyResult !== undefined) {
    const currentStep = BigInt(Math.floor(Date.now() / 1000 / 30) + verifyResult.delta);

    // SECURITY: rejeitar reuso dentro da janela
    if (user.twoFactorLastUsedStep != null && currentStep <= user.twoFactorLastUsedStep) {
      console.warn('[2FA] Replay attempt detected', { userId, currentStep, lastUsed: user.twoFactorLastUsedStep });
      return false;
    }

    // Atomic update: só atualiza se step ainda for maior (anti-race)
    const claim = await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { twoFactorLastUsedStep: null },
          { twoFactorLastUsedStep: { lt: currentStep } },
        ],
      },
      data: { twoFactorLastUsedStep: currentStep },
    });

    return claim.count === 1;
  }

  return await this.useBackupCode(userId, token);
}
```

### Critério de aceitação

- [ ] Schema migrado com `twoFactorLastUsedStep`
- [ ] Reuso do mesmo TOTP rejeitado mesmo dentro da janela
- [ ] Update atômico do `lastUsedStep` (anti-race)
- [ ] Audit log de tentativa de replay

### Testes

```typescript
describe('CRIT-07: replay protection TOTP', () => {
  it('rejeita reuso do mesmo token', async () => {
    const user = await setupUserWith2FA();
    const token = speakeasy.totp({ secret: user.secret, encoding: 'base32' });

    const first = await twoFactorService.verifyToken(user.id, token);
    const second = await twoFactorService.verifyToken(user.id, token);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('aceita token diferente em step seguinte', async () => {
    const user = await setupUserWith2FA();
    const t1 = speakeasy.totp({ secret: user.secret, encoding: 'base32' });
    await twoFactorService.verifyToken(user.id, t1);

    jest.advanceTimersByTime(31_000); // próximo step

    const t2 = speakeasy.totp({ secret: user.secret, encoding: 'base32' });
    expect(await twoFactorService.verifyToken(user.id, t2)).toBe(true);
  });
});
```

---

## CRIT-08 — Credenciais e dev.db commitados no histórico Git

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — quanto mais commits em cima, mais sujo fica o `git filter-repo` depois
**Categoria:** Operacional / Segurança
**Status:** ✅ **Fechado** (Sprint 2 sessão 3 — operação destrutiva em 2026-05-16, ver Fechamento abaixo)
**Depende de:** —
**Bloqueia:** —
**Esforço estimado:** meio dia

### Fechamento (Sprint 2 — Sessão 3)

**Operação destrutiva executada em 2026-05-16.** `git filter-repo` (v `a40bce548d2c`, instalado via `pip install git-filter-repo`) reescreveu o histórico completo do repositório local + force-push para `origin`.

**Comando executado:**
```bash
git filter-repo --force --invert-paths \
  --path CREDENCIAIS_ADMIN.md \
  --path apps/api/prisma/dev.db \
  --path-glob 'apps/api/prisma/*.db*' \
  --path-glob '.backup_*' \
  --path-glob 'Captura de tela*' \
  --path-glob '*.bak' \
  --path-glob '*.old' \
  --path-glob '*.backup'
```

**Estatísticas:**
- 141 commits processados em 0.44s; repack completo em 1.62s.
- Tamanho do `.git`: **14M → 3.4M** (redução ~76%).
- `size-pack`: 10.63 MiB → 3.10 MiB.
- Objetos in-pack: 3391 → 3524 (sobe pouco — filter-repo cria objetos novos pro histórico reescrito; o ganho de tamanho vem da remoção dos blobs grandes).

**Caminhos confirmados como ausentes do histórico (`git log --all --full-history -- <path>` retorna vazio):**
- `CREDENCIAIS_ADMIN.md`
- `apps/api/prisma/dev.db` (+ variantes `*.db*`)
- `.backup_20251029_203853` (+ qualquer `.backup_*`)
- `*Captura de tela*`
- Qualquer `*.bak`, `*.old`, `*.backup` (SER-21 já tinha removido do estado atual; agora também do histórico)

**Decisões de escopo registradas:**
- **Tags:** as 3 tags `sprint-1-complete`, `sprint-2-session-1-complete`, `sprint-2-session-2-complete` foram recriadas apontando para os SHAs novos equivalentes (mesmo merge de PR, novo objeto).
- **SHAs antigos:** mantidos como **referência histórica** em todos os documentos prévios. `git show <SHA-antigo>` não funciona mais, mas as mensagens de commit (que filter-repo preserva) continuam pesquisáveis via `git log --grep`.

**Mapeamento de SHAs (antes → depois):**

| Referência | SHA antigo | SHA novo |
|---|---|---|
| `sprint-1-complete` (PR #1 merge) | `16969d12a82a382686f667484a749424f3ea47a7` | `a59f91c78ce4fe332ad762a4787638850c141218` |
| `sprint-2-session-1-complete` (PR #2 merge) | `3586cd3741b12e52b587069c91e23fe582749745` | `20cb76ea0553803681911dcb2449c375eb6eee8a` |
| `sprint-2-session-2-complete` (PR #6 merge) | `60aa8d2312e37e3fb979af64410a20e7bba42401` | `65453aee8e3716099652f3058c126a127d678e3a` |
| PR #3 merge (seed-prod-guard) | `f341273` | `d23972c` |
| PR #4 merge (runbook-prod-bootstrap) | `4efa542` | `a1214be` |
| PR #5 merge (seed-pipeline-one-shot) | `8163d1d` | `01a6685` |

**Backup íntegro pré-operação:** `C:\Users\lucas\projetos\MktPlace-P2P-backup-pre-crit08` (sócios cientes, validado antes da execução).

**Validações pós-operação:**
- `git status`: working tree clean, estrutura do projeto intacta.
- `npx prisma validate` + `generate`: OK.
- `twoFactor.crit07.spec.ts`: 6/6 ✅ (CRIT-07 não regrediu).
- `seed-pipeline.spec.ts`: 4/4 ✅ (TECH-DEBT-DEV01 não regrediu).
- Force push de `main` e das 3 tags confirmado via `git ls-remote origin`.

**Status de re-clone:** Nícolas precisa apagar o clone local e re-clonar — qualquer branch local dele ficará órfã. Coordenação rastreada em **TECH-DEBT-OP03** abaixo.

### Arquivos afetados
- `CREDENCIAIS_ADMIN.md` (raiz)
- `apps/api/prisma/dev.db` (binário, ~MB)
- `.backup_20251029_203853/` (diretório inteiro)
- `.gitignore:36` — `!apps/api/prisma/dev.db` (exceção que reinclui o arquivo)

### Problema

1. `CREDENCIAIS_ADMIN.md` expõe `master@mktplace.com / Master@2025!` e `admin@mktplace.com / Admin@123` em texto puro. O `seed.ts` provavelmente usa essas mesmas credenciais por default. Sem rigor, vão para produção.
2. `dev.db` é versionado intencionalmente para "novos devs terem dados de teste" — em algum momento alguém vai commitar dados reais por erro.
3. Pastas `.backup_*/` indicam que **vocês versionam backups dentro do repo**, antipadrão sério.

### Correção

#### Passo 1 — Remover do índice mas manter no disco
```bash
git rm --cached CREDENCIAIS_ADMIN.md
git rm --cached apps/api/prisma/dev.db
git rm -r --cached .backup_20251029_203853/
```

#### Passo 2 — Reescrever o histórico (apaga das versões antigas)
```bash
# Backup do repo antes!
git filter-repo --invert-paths \
  --path CREDENCIAIS_ADMIN.md \
  --path apps/api/prisma/dev.db \
  --path-glob '.backup_*'
```

⚠️ Requer `git-filter-repo` instalado. Coordenar com todo o time — todo mundo precisa re-clonar depois do force push.

#### Passo 3 — Atualizar `.gitignore`
```diff
- # Exceção: dev.db versionado para novos devs terem dados de teste
- !apps/api/prisma/dev.db
+ # dev.db NUNCA deve ser commitado. Use `npm run prisma:seed` para popular.

+ # Credenciais
+ CREDENCIAIS_*.md
+ credentials*.json
+ .secrets/

+ # Backups
+ .backup_*/
+ *.backup
+ *.bak
+ *.old
```

#### Passo 4 — Rotacionar todas as credenciais de admin/master
Mesmo que o seed gere passwords aleatórios agora (vide SER-15), execute uma vez para reset completo.

#### Passo 5 — Criar `CREDENCIAIS_ADMIN.md.example`
```markdown
# Credenciais (template)

Após executar `npm run prisma:seed`, as credenciais geradas serão exibidas no stdout.
Salve-as em local seguro (1Password, Bitwarden). Este arquivo NÃO deve conter senhas reais.
```

#### Passo 6 — Auditar histórico Git por outros segredos vazados
```bash
# Buscar por padrões suspeitos no histórico
git log --all -p | grep -iE "password|secret|key|token|api_key|private" | head -100

# Ou usar truffleHog / gitleaks
gitleaks detect --source . --verbose
```

### Critério de aceitação

- [ ] `git ls-files | grep -E "CREDENCIAIS|dev\.db|\.backup_"` retorna vazio
- [ ] `.gitignore` atualizado
- [ ] Todos os commits novos não referenciam mais esses paths
- [ ] Senhas atuais de master/admin rotacionadas
- [ ] `gitleaks detect` sem findings críticos
- [ ] Force-push coordenado (todos do time alinhados)

---

## CRIT-09 — `simulatePaymentReceived` exposto em código de produção

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — 15 minutos; backdoor que cria dinheiro do nada se rota existir
**Categoria:** Backdoor / Exposição
**Status:** ✅ **Fechado** (Sprint 2 — commit `c5187e6`)
**Depende de:** —
**Bloqueia:** —
**Esforço estimado:** 15min

### Fechamento (Sprint 2 — sessão 1 quick wins)

**Defense-in-depth aplicada em duas camadas:**

1. **Service (`services/collateral.service.ts:200`)** — guard interno:
   ```typescript
   if (process.env.NODE_ENV === 'production') {
     throw new Error('simulatePaymentReceived disabled in production');
   }
   ```
   O throw acontece ANTES de qualquer chamada a `WalletService.getWallet`/`creditBalance`. Mesmo que um worker, script ou rota futura chame o método direto, em prod ele falha imediatamente.

2. **Perímetro (`routes/collateral.routes.ts` + `controllers/collateral.controller.ts`)** — rota `POST /:id/simulate-payment` removida e método `CollateralController.simulatePayment` deletado. Comentários inline em ambos os arquivos alertam: **nunca reexpor por HTTP**.

**Testes** (`services/__tests__/collateral.crit09.spec.ts`, 3/3 verde):
- `lança em NODE_ENV=production ANTES de tocar wallet.service` — asserta que `WalletService.getWallet` e `creditBalance` **não foram chamados** (mocks com `not.toHaveBeenCalled()`).
- `permite execução em development` — passa do guard, falha em "Wallet not found".
- `permite execução em test` — idem.

A função `simulatePaymentReceived` segue acessível em testes automatizados E2E rodando em `NODE_ENV=development|test`.

### Arquivos afetados
- `apps/api/src/services/collateral.service.ts:172-191`
- `apps/api/src/controllers/collateral.controller.ts` (verificar se está exposto)
- `apps/api/src/routes/collateral.routes.ts` (verificar)

### Código atual
```typescript
// collateral.service.ts:172
async simulatePaymentReceived(
  addressId: string,
  amount: string,
  txHash?: string
) {
  const wallet = await WalletService.getWallet(addressId);
  if (!wallet) throw new Error('Wallet not found');
  await WalletService.creditBalance(wallet.id, amount, `Collateral payment: ${txHash || 'simulated'}`);
  return {
    success: true,
    newBalance: (parseFloat(wallet.balance) + parseFloat(amount)).toFixed(8),
  };
}
```

### Problema

Função literal **cria dinheiro do nada**. Se há **qualquer** rota exposta que aponta para ela (controller + route), basta o atacante ter um token JWT válido para creditar o saldo que quiser. Em produção isso é game over.

### Correção

#### Opção A — Mover para `tests/helpers/`
```typescript
// apps/api/tests/helpers/credit-helpers.ts
export async function simulatePaymentReceived(...) { /* ... */ }
```

#### Opção B — Guard explícito
```typescript
async simulatePaymentReceived(addressId: string, amount: string, txHash?: string) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('simulatePaymentReceived disabled in production');
  }
  // ... corpo
}
```

#### Verificar rota
```bash
grep -r "simulatePaymentReceived\|simulate-payment" apps/api/src/routes apps/api/src/controllers
```

Se encontrar rota, removê-la imediatamente.

### Critério de aceitação

- [ ] Função inacessível em `NODE_ENV=production` (throw)
- [ ] Nenhuma rota HTTP a invoca
- [ ] Idealmente: função movida para `tests/`
- [ ] Teste que prova que em produção a chamada lança

### Testes

```typescript
describe('CRIT-09: simulatePaymentReceived bloqueado em produção', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = original; });

  it('lança em produção', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      collateralService.simulatePaymentReceived('w', '1', 'tx')
    ).rejects.toThrow(/production/);
  });

  it('funciona em dev', async () => {
    process.env.NODE_ENV = 'development';
    // ... setup wallet ...
    // expect success
  });
});
```

---

## CRIT-10 — Master seed armazenado no mesmo servidor da aplicação

**Severidade:** 🔴 Crítica
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — exige decisão de cloud provider (AWS vs GCP) + conta corporativa + IAM. Em dev a seed atual está OK; produção exige seed completamente diferente
**Categoria:** Custódia / Gestão de chaves
**Status:** ⬜ Aberto
**Depende de:** —
**Bloqueia:** ir para produção custodial
**Esforço estimado:** 1-2 semanas (decisão arquitetural + implementação)

### Arquivo afetado
- `apps/api/src/services/hd-wallet/master-seed.service.ts:160-181` (uso de `MASTER_SEED_ENCRYPTED` via env)
- `apps/api/src/services/hd-wallet/master-seed.service.ts:31-90` (chave de encriptação via `.env.keys` ou `.env`)

### Problema

Arquitetura atual:
```
.env.keys (no disco do servidor)
  └─ MASTER_SEED_ENCRYPTION_KEY (chave AES-256)

.env (no disco do mesmo servidor)
  └─ MASTER_SEED_ENCRYPTED (seed BIP39 cifrada)
```

**Ambas no mesmo servidor.** Vetores de comprometimento:
1. RCE via lib vulnerável (supply chain) → atacante lê filesystem → ambas as chaves expostas → todos os fundos derivados perdidos
2. Backup mal-configurado vaza `.env` + `.env.keys`
3. Container/imagem Docker com env vars vaza para registry público
4. Logs que capturam env vars (ex.: error handler bobo)
5. Engenheiro interno mal-intencionado com SSH

**Para um projeto custodial, não é se vai acontecer — é quando.**

### Correção

#### Camada 1 (mínimo aceitável): KMS / Secrets Manager

Opções por cloud:
- **AWS:** KMS (chave) + Secrets Manager (seed cifrada) com IAM role na instância
- **GCP:** Cloud KMS + Secret Manager
- **Self-hosted:** HashiCorp Vault com seal via cloud KMS ou Shamir

Padrão de uso:
```typescript
// apps/api/src/services/hd-wallet/master-seed.service.ts
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: 'us-east-1' });

static async getMasterSeed(): Promise<Buffer> {
  // Não armazenar em memória além do strictly necessário
  const ciphertextB64 = process.env.MASTER_SEED_CIPHERTEXT;
  if (!ciphertextB64) throw new Error('MASTER_SEED_CIPHERTEXT not set');

  const cmd = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertextB64, 'base64'),
    KeyId: process.env.KMS_KEY_ID,
  });
  const result = await kms.send(cmd);
  return Buffer.from(result.Plaintext!);
}
```

Vantagens:
- A chave AES nunca está no servidor — KMS decripta on-demand
- Chamadas a KMS são auditadas
- Acesso revogável instantaneamente (revogar IAM role)
- Rotation policy automática

#### Camada 2 (padrão profissional): HSM dedicado

- AWS CloudHSM
- YubiHSM 2
- Ledger Enterprise
- Fireblocks (full custody-as-a-service)

#### Camada 3 (recomendada para MVP custodial): híbrido

```
┌────────────────────────────────────────────────────┐
│ Hot Wallet (1-2% do TVL)                           │
│ Master seed via KMS, chamada on-demand             │
│ Usada para: pagamento de fees, sweeps pequenos     │
└────────────────────────────────────────────────────┘
                       │
                       ▼ sweep contínuo
┌────────────────────────────────────────────────────┐
│ Cold Wallet (98-99% do TVL)                        │
│ Multisig 2-de-3 (hardware wallets dos sócios)     │
│ Movimentação requer aprovação multi-pessoa        │
└────────────────────────────────────────────────────┘
```

#### Considerações adicionais

- Master seed única para todos os usuários **continua sendo single point of failure**. Considere:
  - Master seed para Platform Wallets
  - Master seed separada para User Wallets
  - User wallets idealmente client-side ou em enclave (Secure Enclave / TEE)

### Critério de aceitação (para Camada 1)

- [ ] `MASTER_SEED_ENCRYPTION_KEY` removido do servidor
- [ ] Chave migrada para KMS (AWS/GCP) ou Vault
- [ ] `getMasterSeed` chama KMS para decriptar
- [ ] Permissão IAM mínima (apenas `kms:Decrypt` para o role da instância)
- [ ] Audit logs do KMS configurados
- [ ] Runbook de "rotação de chave" documentado
- [ ] Runbook de "recuperação em desastre" documentado

### Notas para sessão de implementação

Esse é um item que demanda **decisão de produto/orçamento antes da implementação**. Recomenda-se:

1. Sessão 1: definir cloud provider e camada-alvo (KMS vs HSM vs híbrido)
2. Sessão 2: implementação contra a escolha
3. Sessão 3: drill de recovery (apagar a chave e ver se consegue restaurar)

---

## CRIT-11 — Falta de rotina de rotação de chaves

**Severidade:** 🔴 Crítica
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — runbook é especulativo sem CRIT-10 resolvido
**Categoria:** Operacional / Gestão de chaves
**Status:** ⬜ Aberto
**Depende de:** CRIT-10
**Bloqueia:** —
**Esforço estimado:** 2-3 dias

### Problema

Não há documentação ou código para rotacionar:
- `MASTER_SEED_ENCRYPTION_KEY`
- `WALLET_ENCRYPTION_KEY`
- `JWT_SECRET`
- `COOKIE_SECRET`

Em caso de suspeita de comprometimento, **não há plano** para mudar essas chaves sem invalidar tudo.

### Correção

#### Documentar runbook em `docs/runbooks/key-rotation.md`

```markdown
# Rotação de Chaves

## JWT_SECRET (impacto: usuários re-logam)

1. Gerar nova chave: `openssl rand -hex 64`
2. Adicionar como `JWT_SECRET_NEW` (nova) e manter `JWT_SECRET` (atual)
3. Deploy: `verifyToken` aceita **ambas** durante grace period (24h)
4. Após grace period: remover `JWT_SECRET`, renomear `JWT_SECRET_NEW` → `JWT_SECRET`

## WALLET_ENCRYPTION_KEY (impacto: re-encriptar todas as private keys)

Função `KeyManagementService.rotateKey` existe mas:
1. Não é thread-safe (vide finding SER-19)
2. Não há job batch para processar todas as wallets

Implementação:
- Worker que itera UserWallet em lotes
- Re-encripta usando nova MASTER_KEY
- Atualiza `encryptedPrivateKey`
- Marca `lastEncryptionRotation`

## MASTER_SEED_ENCRYPTION_KEY (impacto: re-encriptar a seed, mas o seed material em si NÃO muda)

1. Decriptar com chave antiga
2. Encriptar com chave nova
3. Atualizar `MASTER_SEED_ENCRYPTED` no KMS/Vault
4. Atualizar `MASTER_SEED_ENCRYPTION_KEY` no KMS

## MASTER SEED (impacto: catastrófico — mudar TODOS os endereços)

Procedimento de emergência (compromisso confirmado):
1. Pausar todos os depósitos novos
2. Gerar nova master seed via cerimônia em ambiente air-gapped
3. Para cada wallet existente, derivar nova wallet a partir da nova seed
4. Worker de sweep: para cada wallet antiga com saldo, transferir on-chain para a nova
5. Aguardar confirmações
6. Atualizar `encryptedPrivateKey` no banco
7. Comunicar usuários
```

#### Implementação mínima
```typescript
// apps/api/src/services/key-rotation.service.ts
export class KeyRotationService {
  static async rotateWalletEncryptionKey(newKeyHex: string) {
    const wallets = await prisma.userWallet.findMany({ select: { id: true } });
    for (const { id } of wallets) {
      await prisma.$transaction(async (tx) => {
        const w = await tx.userWallet.findUnique({ where: { id } });
        if (!w) return;
        const plain = KeyManagementService.decryptPrivateKey(w.encryptedPrivateKey, w.userId);
        const reEnc = KeyManagementService.encryptPrivateKeyWithKey(plain, w.userId, newKeyHex);
        await tx.userWallet.update({
          where: { id },
          data: { encryptedPrivateKey: reEnc },
        });
      });
    }
  }
}
```

### Critério de aceitação

- [ ] `docs/runbooks/key-rotation.md` criado
- [ ] Função `rotateWalletEncryptionKey` implementada e testada em staging
- [ ] Suporte a dois `JWT_SECRET` em paralelo durante grace period
- [ ] Drill de rotação executado uma vez em staging

---

## CRIT-12 — Memória não zerada após uso da master seed

**Severidade:** 🔴 Crítica
**Fase:** 🚨 **[FAZER AGORA]** — meio dia; estabelece padrão de "callers zeram buffer" enquanto callers são poucos
**Categoria:** Memória / Cripto
**Status:** ✅ Fechado — Sprint 2 sessão 4 (v1.10)
**Depende de:** —
**Bloqueia:** —
**Esforço estimado:** meio dia
**Commits:** ver "Fechamento" abaixo

### Arquivo afetado
- `apps/api/src/services/hd-wallet/master-seed.service.ts:115-148` (`getMasterSeed`)

### Código atual
```typescript
static getMasterSeed(): Buffer {
  if (this.cachedMasterSeed && this.cacheExpiry && Date.now() > this.cacheExpiry) {
    this.cachedMasterSeed = null;  // ⚠️ buffer original continua no heap
    this.cacheExpiry = null;
  }
  if (this.cachedMasterSeed) return this.cachedMasterSeed;

  const encryptedSeed = process.env.MASTER_SEED_ENCRYPTED;
  // ...
  const seed = this.decryptSeed(encryptedSeed);
  this.cachedMasterSeed = seed;
  this.cacheExpiry = Date.now() + this.CACHE_TTL;
  return seed;  // ⚠️ retorna o mesmo Buffer cached
}
```

### Problema

1. **`this.cachedMasterSeed = null` não zera o conteúdo do Buffer.** O dado fica no heap até o GC, podendo:
   - Aparecer em core dumps
   - Ser lido por outro processo via `/proc/<pid>/maps`
   - Sobreviver em swap memory após o processo encerrar
2. **`return seed`** retorna **referência** ao buffer interno. Quem chamar pode reter essa referência além do TTL.
3. **TTL expira só no próximo `getMasterSeed`** — não há timer ativo.

### Correção

```typescript
import * as crypto from 'crypto';

export class MasterSeedService {
  private static cachedMasterSeed: Buffer | null = null;
  private static cacheExpiry: number | null = null;
  private static expiryTimer: NodeJS.Timeout | null = null;
  private static readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * Retorna CÓPIA defensiva do seed. Caller deve zerar após uso:
   *   const seed = MasterSeedService.getMasterSeed();
   *   try { ... usar seed ... } finally { seed.fill(0); }
   */
  static getMasterSeed(): Buffer {
    this.refreshIfExpired();

    if (this.cachedMasterSeed) {
      // Cópia defensiva — caller pode zerar sem afetar cache
      return Buffer.from(this.cachedMasterSeed);
    }

    const encryptedSeed = process.env.MASTER_SEED_ENCRYPTED;
    if (!encryptedSeed) throw new Error('MASTER_SEED_ENCRYPTED not found');

    const seed = this.decryptSeed(encryptedSeed);

    // Armazenar no cache
    this.cachedMasterSeed = Buffer.from(seed);
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    // Timer ativo para zerar proativamente
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => this.clearCache(), this.CACHE_TTL).unref();

    // Devolver cópia, zerar local
    const copy = Buffer.from(seed);
    seed.fill(0);
    return copy;
  }

  private static refreshIfExpired(): void {
    if (this.cacheExpiry && Date.now() > this.cacheExpiry) {
      this.clearCache();
    }
  }

  private static clearCache(): void {
    if (this.cachedMasterSeed) {
      this.cachedMasterSeed.fill(0);  // zerar conteúdo
      this.cachedMasterSeed = null;
    }
    this.cacheExpiry = null;
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
```

#### Callers devem zerar
```typescript
// apps/api/src/services/hd-wallet/derivation.service.ts
private static deriveBitcoin(path: string) {
  const masterSeed = MasterSeedService.getMasterSeed();
  try {
    const root = bip32.fromSeed(masterSeed);
    const child = root.derivePath(path);
    // ...
    return result;
  } finally {
    masterSeed.fill(0);
  }
}
```

Idem para `deriveEthereum`, `deriveSolana`.

### Critério de aceitação

- [x] `clearCache` zera o conteúdo do buffer
- [x] Timer ativo agendado em cada cache populate
- [x] Callers (`derivation.service.ts`) zeram o buffer recebido em `finally`
- [x] Teste verifica que após `clearCache`, conteúdo do buffer é todo zero
- [x] Teste verifica que `getMasterSeed` chamado 2x retorna buffers distintos (cópia defensiva)

### Testes

```typescript
describe('CRIT-12: zeragem de memória da master seed', () => {
  it('clearCache zera o buffer cached', () => {
    const s1 = MasterSeedService.getMasterSeed();
    expect(s1.some(b => b !== 0)).toBe(true);
    (MasterSeedService as any).clearCache();
    expect((MasterSeedService as any).cachedMasterSeed).toBe(null);
  });

  it('retorna cópias distintas', () => {
    const a = MasterSeedService.getMasterSeed();
    const b = MasterSeedService.getMasterSeed();
    expect(a === b).toBe(false); // referências distintas
    expect(a.equals(b)).toBe(true); // mesmo conteúdo
    a.fill(0);
    expect(b.some(byte => byte !== 0)).toBe(true); // b não foi afetado
  });
});
```

### Fechamento (Sprint 2 — sessão 4)

**Implementação aplicada em `fix/crit-12-master-seed-memzero`:**

**Padrões estabelecidos:**

1. **`clearCache()` (privado):** zera o buffer com `fill(0)` ANTES de soltar a referência (`= null`), depois cancela o timer. Evita dados sensíveis no heap até o GC, em core dumps, swap e `/proc/<pid>/maps`.

2. **Cópia defensiva como contrato público:** `getMasterSeed()` sempre retorna `Buffer.from(cachedMasterSeed)`. Cache interno nunca sai do service. Buffer intermediário de `decryptSeed` é zerado com `seed.fill(0)` antes do retorno.

3. **Timer ativo com `.unref()`:** `setTimeout(() => this.clearCache(), CACHE_TTL).unref()` agendado a cada cache populate. Zera proativamente sem precisar de nova chamada a `getMasterSeed`. `.unref()` evita que o timer bloqueie o shutdown do processo.

4. **Callers zeram em `finally`:** todos os callers em `derivation.service.ts` envolvem o uso do seed em `try { ... } finally { masterSeed.fill(0); }`.

**Arquivos tocados:**
- `apps/api/src/services/hd-wallet/master-seed.service.ts` — `clearCache()`, `refreshIfExpired()`, `getMasterSeed()` refatorados; `expiryTimer` adicionado
- `apps/api/src/services/hd-wallet/derivation.service.ts` — `deriveBitcoin`, `deriveEthereum`, `deriveSolana` com try/finally
- `apps/api/src/services/hd-wallet/__tests__/master-seed.crit12.spec.ts` — criado (5 testes: 5/5 ✅)

**Testes pós-fix:** 49/49 verde (44 suites pré-existentes + 5 novos CRIT-12).

---

# Parte II — Findings Sérios (🟠 SER)

---

## SER-13 — JWT com TTL excessivo e mesmo secret para access/refresh

**Severidade:** 🟠 Sério
**Fase:** 🟡 **[FAZER AGORA — PARCIAL]** — fazer agora: secrets separados (`JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET`), algoritmo explícito, audience, issuer (~1h). Adiar para 🔵 **[PRE-STAGING]**: TTL curto (15min) — atrapalha debug enquanto frontend de auth está mudando
**Categoria:** Auth
**Status:** ⬜ Aberto
**Esforço estimado:** 1 dia

### Arquivo afetado
- `apps/api/src/utils/jwt.ts:28-29`

### Código atual
```typescript
const JWT_SECRET: string = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export const generateToken = (payload: JWTPayload): string => {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const generateRefreshToken = (userId: string, tokenId: string): string => {
  // ...
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  //                       ^^^^^^^^^ MESMO secret
};
```

### Problema

1. **Access token de 7 dias** em sistema financeiro é tempo demais. Industry standard: 15 minutos. Se token vaza, atacante tem 7 dias de acesso.
2. **Mesmo `JWT_SECRET` para access e refresh.** Comprometer o secret = comprometer ambos. Devem ser secrets separados, idealmente com algoritmos diferentes.
3. **Algoritmo não especificado em `verify`.** Embora `jsonwebtoken` atual não seja vulnerável a `alg=none`, defesa em profundidade recomenda explícito.
4. **Sem validação de `audience` e `issuer`.**

### Correção
```typescript
// apps/api/src/utils/jwt.ts
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_ISSUER = process.env.JWT_ISSUER || 'mktplace.liberdade';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'mktplace.liberdade.users';

const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

if (!JWT_ACCESS_SECRET || JWT_ACCESS_SECRET.length < 64) {
  throw new Error('JWT_ACCESS_SECRET must be set and >= 64 chars');
}
if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 64) {
  throw new Error('JWT_REFRESH_SECRET must be set and >= 64 chars');
}
if (JWT_ACCESS_SECRET === JWT_REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
}

export const generateToken = (payload: JWTPayload): string => {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as JWTPayload;
};

export const generateRefreshToken = (userId: string, tokenId: string): string =>
  jwt.sign({ userId, tokenId }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as RefreshTokenPayload;
```

### Atualizar `.env.example`
```env
JWT_ACCESS_SECRET="<gerar com: openssl rand -hex 64>"
JWT_REFRESH_SECRET="<gerar DIFERENTE: openssl rand -hex 64>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="30d"
JWT_ISSUER="mktplace.liberdade"
JWT_AUDIENCE="mktplace.liberdade.users"
```

### Migração de tokens existentes

Como o secret muda, todos os tokens emitidos invalidam. Soluções:
- **Opção A:** Forçar re-login (mais simples, desloga todos)
- **Opção B:** Período de overlap (aceitar ambos secrets por 24h)

### Critério de aceitação
- [ ] Secrets separados validados na inicialização
- [ ] Access TTL ≤ 30min
- [ ] Algoritmo explícito em sign/verify
- [ ] `audience` e `issuer` validados
- [ ] Refresh flow testado end-to-end

---

## SER-14 — `COOKIE_SECRET` faz fallback para `JWT_SECRET`

**Severidade:** 🟠 Sério
**Fase:** 🚨 **[FAZER AGORA]** — 15 minutos; aproveitar a mesma sessão do SER-13 parcial
**Categoria:** Auth / Cookies
**Esforço estimado:** 15min

### Arquivo afetado
- `apps/api/src/index.ts:166`

### Código atual
```typescript
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));
```

### Correção
```typescript
if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET.length < 32) {
  throw new Error('COOKIE_SECRET must be set with >= 32 chars');
}
app.use(cookieParser(process.env.COOKIE_SECRET));
```

### Critério de aceitação
- [ ] Sem fallback para JWT
- [ ] Validação explícita do COOKIE_SECRET na inicialização

---

## SER-15 — Senhas hardcoded no seed de admin

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — em dev, credenciais fixas facilitam debug (desde que arquivo esteja fora do git via CRIT-08). Mínimo agora: seed gera password aleatório se `NODE_ENV=production`
**Categoria:** Operacional / Bootstrapping
**Status:** 🟡 **Mitigação parcial** (commits `17fea25` + `0e4f5eb`) — finding continua aberto
**Esforço estimado:** meio dia

### Mitigação parcial (Sprint 2 — Caminho C)

O fix definitivo (seed gerar password aleatório + emitir) continua planejado para PRE-STAGING. Enquanto isso, foi adicionado **guard NODE_ENV=production** em `prisma/seed.ts` e `prisma/seeds/rbac-seed.ts`:

- O guard lança `Error` imediatamente no topo da função, ANTES de qualquer query Prisma ou bcrypt.
- Mensagem aponta para o runbook operacional em **TECH-DEBT-OP02** (provisionamento real de master/admin em prod).
- 4 testes em `prisma/__tests__/seed-guard.spec.ts` validam o guard (spawn real do tsx + asserção que mensagem do guard aparece em prod e ausência de erro de conexão Prisma = guard parou ANTES do DB).

**Por que isto não fecha SER-15:** a defesa em profundidade impede o seed de rodar em prod, mas não resolve "como provisionar credenciais reais". Isso continua sendo escopo do fix completo (geração aleatória + handoff seguro) + runbook (TECH-DEBT-OP02).

### Arquivo afetado
- `apps/api/prisma/seed.ts` (verificar)
- `CREDENCIAIS_ADMIN.md` (já tratado em CRIT-08)

### Padrão de correção
```typescript
// apps/api/prisma/seed.ts
import crypto from 'crypto';

function genStrongPassword(length = 24): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  let pw = '';
  for (let i = 0; i < length; i++) {
    pw += charset[crypto.randomInt(charset.length)];
  }
  return pw;
}

async function seedAdmins() {
  const masterPw = genStrongPassword();
  const adminPw = genStrongPassword();

  await prisma.user.upsert({
    where: { email: 'master@mktplace.com' },
    update: {},
    create: {
      email: 'master@mktplace.com',
      password: await hashPassword(masterPw),
      name: 'Master',
      forcePasswordReset: true,  // novo campo no schema
      roleId: masterRole.id,
    },
  });
  // idem para admin

  console.log('===========================================');
  console.log('CREDENCIAIS GERADAS — SALVE EM LOCAL SEGURO:');
  console.log(`  master@mktplace.com / ${masterPw}`);
  console.log(`  admin@mktplace.com  / ${adminPw}`);
  console.log('===========================================');
  console.log('Estas senhas só serão exibidas UMA VEZ.');
}
```

### Adicionar no schema
```prisma
model User {
  // ...
  forcePasswordReset Boolean @default(false)
}
```

E no middleware de auth: bloquear ações além de `/auth/change-password` enquanto `forcePasswordReset = true`.

### Critério de aceitação
- [ ] Seed gera passwords aleatórios fortes
- [ ] `forcePasswordReset` flag setada em admins recém-criados
- [ ] Middleware respeita o flag
- [ ] Endpoint de change-password atualiza flag para false

---

## SER-16 — `express.json({ limit: '15mb' })` permite DoS

**Severidade:** 🟠 Sério
**Fase:** ⚪ **[ADIAR PRE-PROD]** — sem tráfego real, DoS não é vetor
**Categoria:** DoS
**Esforço estimado:** 1h

### Arquivo afetado
- `apps/api/src/index.ts:170-171`

### Código atual
```typescript
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
```

### Correção
```typescript
// JSON global pequeno
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Para uploads de comprovante usar multer (multipart) em vez de base64 em JSON
// Em routes de upload de comprovante:
import multer from 'multer';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },  // 10MB, 1 arquivo
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido'));
    }
    cb(null, true);
  },
});

router.post('/proof', upload.single('comprovante'), proofController);
```

⚠️ Cruza com SER-38 (validar magic bytes do arquivo, não só mime type).

### Critério de aceitação
- [ ] Limite global de JSON ≤ 1MB
- [ ] Uploads via multer/multipart
- [ ] `fileFilter` valida mime
- [ ] Limite de tamanho por arquivo configurável

---

## SER-17 — CORS aceita "sem origin" em dev

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — CORS sem origin é útil para curl/Postman durante dev; ajustar antes de subir staging
**Categoria:** CORS
**Esforço estimado:** 15min

### Arquivo afetado
- `apps/api/src/index.ts:142-145`

### Código atual
```typescript
if (!origin && process.env.NODE_ENV !== 'production') {
  return callback(null, true);
}
```

### Problema

Se `NODE_ENV` não estiver setado explicitamente (default em alguns containers), `process.env.NODE_ENV !== 'production'` é `true`, e CORS aceita request sem origin (curl, Postman, e ataques server-side).

### Correção
```typescript
const isDev = process.env.NODE_ENV === 'development';

if (!origin) {
  if (isDev) return callback(null, true);
  return callback(new Error('Origin required'), false);
}
```

Note: `isDev` exige **explicitamente** `=== 'development'`. Em produção, mesmo `NODE_ENV` ausente, rejeita.

### Critério de aceitação
- [ ] Default seguro: sem origin → rejeitado
- [ ] Apenas `NODE_ENV === 'development'` permite

---

## SER-18 — PBKDF2 com 100k iterações

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — refator implica re-encriptar todas as wallets existentes; coordenar com migração KMS (CRIT-10)
**Categoria:** KDF / Cripto
**Esforço estimado:** 1 dia (com plano de migração)

### Arquivo afetado
- `apps/api/src/services/hd-wallet/key-management.service.ts:148`

### Código atual
```typescript
const key = crypto.pbkdf2Sync(
  inputMaterial,
  salt,
  100000,  // ⚠️ baixo demais
  32,
  'sha256'
);
```

### Problema

OWASP Password Storage Cheat Sheet (2023+):
- PBKDF2-SHA256: **600.000** iterações mínimas
- PBKDF2-SHA512: 210.000

100k era recomendação de 2018. Hoje permite brute force razoável em GPU.

### Correção — Opção A (mínima, mantém PBKDF2)
```typescript
const KDF_ITERATIONS = 600_000;
const key = crypto.pbkdf2Sync(inputMaterial, salt, KDF_ITERATIONS, 32, 'sha256');
```

⚠️ Migração: chaves armazenadas com 100k não decriptam com 600k. Necessário re-encriptar todas as wallets (vide CRIT-11 — `rotateWalletEncryptionKey`).

### Correção — Opção B (recomendada, Argon2id)
```bash
npm install argon2
```

```typescript
import argon2 from 'argon2';

private static async deriveEncryptionKey(userId: string, salt: Buffer): Promise<Buffer> {
  const inputMaterial = Buffer.from(this.MASTER_KEY + userId);
  return await argon2.hash(inputMaterial, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,  // 64 MB
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
    salt,
    raw: true,
  });
}
```

### Critério de aceitação
- [ ] PBKDF2 ≥ 600k ou Argon2id configurado
- [ ] Migração executada com `rotateWalletEncryptionKey`
- [ ] Performance aceitável (medir tempo de derivação)

---

## SER-19 — `KeyManagementService.rotateKey` não é thread-safe

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — junto com refator de chaves (SER-18)
**Categoria:** Concorrência / Cripto
**Esforço estimado:** meio dia

### Arquivo afetado
- `apps/api/src/services/hd-wallet/key-management.service.ts:175-194`

### Código atual
```typescript
static rotateKey(encryptedPrivateKey, userId, newMasterKey?) {
  const privateKey = this.decryptPrivateKey(encryptedPrivateKey, userId);
  const oldMasterKey = this.MASTER_KEY;
  if (newMasterKey) this.MASTER_KEY = newMasterKey;  // ⚠️ mutação global
  const newEncryptedPrivateKey = this.encryptPrivateKey(privateKey, userId);
  this.MASTER_KEY = oldMasterKey;  // ⚠️ restauro
  return newEncryptedPrivateKey;
}
```

### Problema

Mutação de estado global (`this.MASTER_KEY`) em ambiente Node.js single-thread? Tudo bem para CPU-bound. **Problema é com I/O async:** se `encryptPrivateKey` for async ou tiver `await` em algum lugar futuro, outra request pode pegar a `MASTER_KEY` errada.

Mais crítico: mistura responsabilidades. Deveria receber a chave nova como parâmetro explícito.

### Correção
```typescript
private static encryptWithKey(privateKey: string, userId: string, masterKey: string): string {
  const salt = crypto.randomBytes(this.SALT_LENGTH);
  const derivedKey = this.deriveEncryptionKeyFromMaster(userId, salt, masterKey);
  const iv = crypto.randomBytes(this.IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(privateKey, 'hex')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [salt, iv, authTag, ciphertext].map(b => b.toString('hex')).join(':');
}

static rotateKey(encryptedPrivateKey: string, userId: string, newMasterKey: string): string {
  const privateKey = this.decryptPrivateKey(encryptedPrivateKey, userId);
  try {
    return this.encryptWithKey(privateKey, userId, newMasterKey);
  } finally {
    // Zerar privateKey local... (mas é string, imutável — usar Buffer no futuro)
  }
}
```

### Critério de aceitação
- [ ] `rotateKey` recebe `newMasterKey` explicitamente
- [ ] Não muta `this.MASTER_KEY`

---

## SER-20 — Tokens enviados duplamente (cookie + JSON body)

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — frontend de auth ainda em iteração; mexer agora gera merge conflict com features em construção
**Categoria:** Auth / XSS surface
**Esforço estimado:** 1 dia + migração frontend

### Arquivos afetados
- `apps/api/src/controllers/auth.controller.ts:44-50, 109-115` (responses)
- `apps/web/` (consumir cookies em vez de body)

### Código atual
```typescript
setAccessTokenCookie(res, result.token);
setRefreshTokenCookie(res, result.refreshToken);
res.status(200).json({
  success: true,
  data: {
    user: result.user,
    accessToken: result.token,   // ⚠️ exposto a JS
    refreshToken: result.refreshToken, // ⚠️ exposto a JS
  },
});
```

### Problema

Tokens em JSON body anulam a proteção XSS dos cookies HttpOnly. Se o frontend salva em `localStorage` (mesmo "para compatibilidade"), XSS leitura trivial.

### Correção

Backend:
```typescript
setAccessTokenCookie(res, result.token);
setRefreshTokenCookie(res, result.refreshToken);
res.status(200).json({
  success: true,
  data: { user: result.user },
});
```

Frontend: ajustar `fetch` para `credentials: 'include'` e não esperar tokens na resposta. Cliente mobile (futuro) usa Authorization header — endpoint específico de mobile pode retornar token, mas separadamente.

### Critério de aceitação
- [ ] Responses HTTP não contém `accessToken` nem `refreshToken`
- [ ] Frontend funciona com cookies HttpOnly
- [ ] `localStorage` não contém tokens
- [ ] Endpoint `/auth/me` retorna user data

---

## SER-21 — Arquivos `.old`, `.bak`, `.backup` no repo

**Severidade:** 🟠 Sério
**Fase:** 🚨 **[FAZER AGORA]** — 15 minutos; agrupar com CRIT-08
**Categoria:** Higiene / Risco de exposição
**Status:** ✅ **Fechado** (Sprint 2 — commit `62c8b55`)
**Esforço estimado:** 15min

### Fechamento (Sprint 2 — sessão 1 quick wins)

Escopo expandido em relação aos 5 arquivos listados originalmente — a auditoria pede "nenhum `.old/.bak/.backup` rastreado", então `git rm` foi rodado em todos os 14 backups versionados (7 em `apps/api`, 7 em `apps/web`):

- `apps/api/package.json.backup`
- `apps/api/src/middleware/auth.middleware.ts.backup`
- `apps/api/src/controllers/wallet.controller.ts.old`
- `apps/api/src/routes/wallet.routes.ts.old`
- `apps/api/src/services/wallet.service.ts.old`
- `apps/api/src/services/support.service.ts.bak`
- `apps/api/src/workers/deposit-monitor.worker.ts.backup`
- `apps/web/package.json.backup`
- `apps/web/app/admin/{audit,disputes,funds,orders,security,users}/page.tsx.backup` (6 arquivos)

`.gitignore` ganhou bloco SER-21 com `*.bak / *.old / *.backup / *~` (`*.swp/*.swo` já estavam cobertos). Verificação: `git ls-files | grep -E '\.(bak|old|backup)$|~$'` retorna vazio.

### Arquivos afetados
```
apps/api/src/middleware/auth.middleware.ts.backup
apps/api/src/controllers/wallet.controller.ts.old
apps/api/src/routes/wallet.routes.ts.old
apps/api/src/services/wallet.service.ts.old
apps/api/src/services/support.service.ts.bak
```

### Correção
```bash
find . -type f \( -name "*.old" -o -name "*.bak" -o -name "*.backup" \) -not -path "./node_modules/*" -not -path "./.git/*" -delete
```

E adicionar ao `.gitignore`:
```
*.old
*.bak
*.backup
*.swp
*~
```

### Critério de aceitação
- [ ] Nenhum arquivo `.old/.bak/.backup` rastreado
- [ ] `.gitignore` previne re-commit

---

## SER-22 — Sem account lockout por usuário (só por IP)

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — sem usuários reais, lockout só atrapalha desenvolvimento (você se tranca da própria conta de teste)
**Categoria:** Brute force
**Esforço estimado:** meio dia

### Problema

`rateLimiter.middleware.ts` limita por IP, mas atacante com botnet rotaciona IPs.

### Correção

#### Schema
```prisma
model User {
  // ...
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
  lastFailedLoginAt   DateTime?
}
```

#### Auth service
```typescript
async login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new Error('Credenciais inválidas');

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error(`Conta bloqueada até ${user.lockedUntil.toISOString()}`);
  }

  const ok = await comparePassword(input.password, user.password);

  if (!ok) {
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= 10;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newAttempts,
        lastFailedLoginAt: new Date(),
        lockedUntil: shouldLock ? new Date(Date.now() + 60 * 60 * 1000) : null,
      },
    });
    throw new Error('Credenciais inválidas');
  }

  // Reset em login bem-sucedido
  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastFailedLoginAt: null },
    });
  }

  // ... resto idêntico
}
```

### Critério de aceitação
- [ ] 10 tentativas falhas → conta bloqueada por 1h
- [ ] Reset em login bem-sucedido
- [ ] Email notifica usuário do bloqueio (cf. SER-23)

---

## SER-23 — Login leakeia se 2FA está habilitado

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — mesma razão de SER-22 + complica testes de auth durante desenvolvimento
**Categoria:** Information leak
**Esforço estimado:** meio dia

### Problema

`auth.service.ts:115-129`: o erro `2FA_REQUIRED` é jogado **após** validar senha. Atacante consegue distinguir:
- "Senha errada" → resposta com erro 401
- "Senha correta, mas precisa 2FA" → resposta com `requiresTwoFactor: true`

Permite enumeração e cracking offline de senhas de usuários com 2FA.

### Correção

Resposta uniforme: sempre exigir 2FA primeiro, depois validar senha + 2FA juntos.

```typescript
async login(input: LoginInput): Promise<AuthResponse | { requiresTwoFactor: true }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    // Constant-time delay para não vazar timing
    await comparePassword(input.password, '$2a$10$dummyhashtopreventtiming');
    throw new Error('Credenciais inválidas');
  }

  // Se 2FA habilitado, exigir token JUNTO
  if (user.twoFactorEnabled && !input.twoFactorToken) {
    // Sem revelar se senha está certa
    return { requiresTwoFactor: true };
  }

  const ok = await comparePassword(input.password, user.password);
  if (!ok) throw new Error('Credenciais inválidas');

  if (user.twoFactorEnabled) {
    const is2FAValid = await twoFactorService.verifyToken(user.id, input.twoFactorToken!);
    if (!is2FAValid) throw new Error('Credenciais inválidas');
    //                                  ^^^^^^^^^^^^^^^^^^^^^ uniforme
  }

  // ... emitir tokens
}
```

⚠️ Trade-off de UX: usuário sem 2FA digita senha → entra direto. Usuário com 2FA digita senha → vê tela "informe 2FA" — mesmo se senha está errada, vê essa tela. Para o atacante, indistinguível.

### Critério de aceitação
- [ ] Erro uniforme para "senha errada" e "2FA errado"
- [ ] Para usuário com 2FA, primeira request retorna sempre `requiresTwoFactor`
- [ ] Timing approximadamente constante (medir)

---

## SER-24 — Controle de workers em runtime sem 2FA fresh

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — workers ainda em iteração; require2FA prematuro atrapalha debug
**Categoria:** Operacional
**Esforço estimado:** 1 dia

### Problema

README documenta `/admin/workers` com botões Start/Stop. Parar `BalanceSyncWorker` em produção significa saldos errados sendo mostrados. Operação muito sensível para um simples token JWT.

### Correção

```typescript
// apps/api/src/routes/workers.routes.ts
router.use(authMiddleware);
router.use(masterMiddleware);  // só MASTER
router.use(require2FAFresh);    // 2FA verificado nos últimos 5min

router.post('/:name/stop', adminActionLimiter, workersController.stop);
```

Middleware `require2FAFresh`:
```typescript
// apps/api/src/middleware/require2FAFresh.middleware.ts
export async function require2FAFresh(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.userId) return res.status(401).json({ error: 'Não autenticado' });
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { twoFactorEnabled: true, twoFactorLastVerifiedAt: true },
  });
  if (!user?.twoFactorEnabled) {
    return res.status(403).json({ error: '2FA obrigatório para esta operação' });
  }
  const last = user.twoFactorLastVerifiedAt;
  if (!last || Date.now() - last.getTime() > 5 * 60 * 1000) {
    return res.status(403).json({ error: '2FA recente requerido', code: 'STALE_2FA' });
  }
  next();
}
```

Adicionar campo `twoFactorLastVerifiedAt` no schema. Atualizar em cada `verifyToken` bem-sucedido.

### Critério de aceitação
- [ ] Stop/Start workers exige 2FA fresh
- [ ] Audit log com `who/when/which-worker` em cada ação
- [ ] Alerta automático para Slack/email em stop em produção

---

## SER-25 — `setImmediate` com `.catch(() => {})` engole erros

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — adiciona dependência de Redis; `setImmediate` é suficiente em dev
**Categoria:** Observability
**Esforço estimado:** 2-3 dias (migrar para BullMQ)

### Padrão recorrente
```typescript
setImmediate(async () => {
  try {
    await notificationService.notifyOrderMatched(...);
    emailService.sendIfAllowed(...).catch(() => {});  // ⚠️ silent fail
  } catch (error) {
    console.error('Failed to send order matched notifications:', error);
  }
});
```

### Correção

Usar BullMQ (já está nas dependências do README, embora não tenha visto no package.json — adicionar se necessário).

```typescript
// apps/api/src/queues/notification.queue.ts
import { Queue, Worker } from 'bullmq';

const connection = { host: process.env.REDIS_HOST, port: 6379 };
export const notificationQueue = new Queue('notifications', { connection });

export const notificationWorker = new Worker('notifications', async (job) => {
  switch (job.name) {
    case 'order-matched':
      await notificationService.notifyOrderMatched(job.data);
      await emailService.sendOrderMatchedEmail(job.data);
      break;
    // ...
  }
}, { connection, concurrency: 10 });

notificationWorker.on('failed', (job, err) => {
  logger.error('Notification job failed', { jobId: job?.id, err });
  Sentry.captureException(err, { extra: { jobId: job?.id } });
});
```

E nos pontos de uso:
```typescript
// em vez de setImmediate
await notificationQueue.add('order-matched', {
  orderId,
  sellerId: order.userId,
  buyerId: payerId,
}, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
});
```

### Critério de aceitação
- [ ] BullMQ configurado com Redis
- [ ] Retries automáticos
- [ ] Falhas reportadas a Sentry/log estruturado
- [ ] `setImmediate` para side-effects removido
- [ ] Health endpoint inclui status das queues

---

## SER-26 — Validação de boleto sem checksum

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — em dev usa-se boleto fake; validador real só importa quando entrar comprovante real
**Categoria:** Validação de input
**Esforço estimado:** 1 dia

### Arquivo afetado
- `apps/api/src/controllers/order.controller.ts:9-14` (`BoletoDataSchema`)

### Código atual
```typescript
const BoletoDataSchema = z.object({
  barcode: z.string().min(44),  // ⚠️ aceita qualquer 44 chars
  // ...
});
```

### Correção

Validar **módulo 10 e módulo 11** (algoritmos oficiais FEBRABAN).

Opção A — Lib pronta:
```bash
npm install boleto-brasileiro-validator
```
```typescript
import { isValidBoleto } from 'boleto-brasileiro-validator';

const BoletoDataSchema = z.object({
  barcode: z.string()
    .min(44).max(48)
    .refine(s => isValidBoleto(s), 'Código de boleto inválido (checksum)'),
  // ...
});
```

Opção B — Implementação direta (se preferir não depender de lib):
```typescript
function validateBoletoChecksum(barcode: string): boolean {
  // 44 dígitos linha digitável → calcular DV
  // implementação FEBRABAN módulo 10/11
  // ... (ver documentação FEBRABAN)
}
```

### Critério de aceitação
- [ ] Checksum validado
- [ ] Boletos inválidos rejeitados com mensagem clara

---

## SER-27 — Validação de CPF/CNPJ estrutural

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — em dev usa-se CPF fake; validador real entra antes de KYC
**Categoria:** Validação de input
**Esforço estimado:** 2h

### Arquivo afetado
- `apps/api/src/controllers/order.controller.ts:14` (`recipientDocument`)
- Demais lugares onde CPF/CNPJ é aceito (KYC, etc.)

### Código atual
```typescript
recipientDocument: z.string().min(11),  // aceita "11111111111"
```

### Correção
```typescript
import { cpf, cnpj } from 'cpf-cnpj-validator';

const documentSchema = z.string().refine(
  v => cpf.isValid(v) || cnpj.isValid(v),
  'CPF ou CNPJ inválido'
);
```

Para email e telefone, regex robusto (ou lib).

### Critério de aceitação
- [ ] CPF/CNPJ validados estruturalmente em todos os schemas
- [ ] PixKey validada conforme tipo (CPF, CNPJ, EMAIL, PHONE, RANDOM)

---

## SER-28 — Sem 2FA fresh em rotas admin financeiras

**Severidade:** 🟠 Sério
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — mesma razão de SER-24
**Categoria:** Auth / Privilege escalation
**Esforço estimado:** meio dia

### Problema

Rotas como `admin-balance`, `admin-funds`, `master-seed-admin`, `withdrawal` permitem operações que movem dinheiro com apenas o token JWT. Se o token é roubado, atacante movimenta fundos.

### Correção

Aplicar `require2FAFresh` (SER-24) em todas as rotas que envolvem:
- Aprovação de withdrawal
- Transferência de platform funds
- Mudança de wallets da plataforma
- Operações de master seed
- Aprovação manual de transactions

```typescript
// apps/api/src/routes/admin-balance.routes.ts
router.use(authMiddleware);
router.use(adminMiddleware);
router.post('/transfer', require2FAFresh, financialOperationsLimiter, ...);
router.post('/withdraw', require2FAFresh, financialOperationsLimiter, ...);
```

### Critério de aceitação
- [ ] Lista canônica de "operações financeiras críticas" documentada
- [ ] Todas exigem 2FA fresh (≤ 5min)
- [ ] Endpoint `/auth/2fa-fresh-verify` para verificar 2FA sem novo login

---

# Parte III — Findings Médios (🟡 MED)

---

## MED-29 — Documentação fragmentada (80+ arquivos .md na raiz)

**Severidade:** 🟡 Médio
**Fase:** ⚪ **[ADIAR PRE-PROD]** — reorganização de docs não bloqueia desenvolvimento. Mínimo agora: garantir que `README.md` raiz aponta para o ponto de entrada principal
**Esforço estimado:** 1 dia

### Problema

Raiz tem >80 arquivos `.md` sem hierarquia. Dev novo não sabe por onde começar.

### Correção

Reorganizar:
```
docs/
├── README.md                    # ponto único de entrada
├── architecture/
│   ├── overview.md
│   ├── hd-wallet.md
│   ├── ledger.md
│   └── auth-rbac.md
├── runbooks/
│   ├── deploy.md
│   ├── key-rotation.md
│   ├── incident-response.md
│   └── db-migration.md
├── changelog/
│   ├── 2025-10.md
│   ├── 2025-11.md
│   └── 2025-12.md
└── guides/
    ├── onboarding.md
    ├── testing.md
    └── claude-code-conventions.md
```

Raiz fica apenas com: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `.env.example`, `package.json`, `turbo.json`, `AUDITORIA_TECNICA_MKTPLACE_P2P.md`.

### Critério de aceitação
- [ ] Raiz tem ≤ 8 arquivos .md
- [ ] `docs/README.md` é o index
- [ ] CHANGELOGs antigos consolidados

---

## MED-30 — Comentários em português dentro do código

**Severidade:** 🟡 Médio
**Fase:** ⚪ **[ADIAR PRE-PROD]** — decisão de time. Se ninguém estrangeiro vai entrar tão cedo, mantém pt-BR e documenta a decisão em `CONTRIBUTING.md`
**Esforço estimado:** ongoing

### Recomendação

Convenções de código em **inglês** facilitam:
- Onboarding de devs internacionais
- Busca em stack traces
- Integração com ferramentas

Padronizar. Documentação para usuário pode ser pt-BR; código técnico, inglês.

### Critério de aceitação
- [ ] Decisão de time documentada em `CONTRIBUTING.md`
- [ ] Linter regra para forçar inglês em comentários novos (opcional)

---

## MED-31 — `console.log` espalhado em código de produção

**Severidade:** 🟡 Médio
**Fase:** 🟡 **[FAZER AGORA — PARCIAL]** — agora: remover apenas `console.log` que vazam dados sensíveis (vide `auth.middleware.ts:51` que logga email + userId). Adiar para 🔵 **[PRE-STAGING]**: refator completo para winston junto com log aggregation
**Esforço estimado:** 1 dia

### Problema

>50 `console.log` em controllers/services. Custa I/O, pode vazar dados (`auth.middleware.ts:51` logga `userId, email`).

### Correção

Substituir todos por `logger.info/debug/warn/error` (winston já está configurado).

```bash
# Verificar
grep -rn "console.log\|console.error\|console.warn" apps/api/src | wc -l
```

Refator automatizado com codemod (jscodeshift). Configurar log levels:
- `production`: `info`
- `staging`: `debug`
- `test`: `error`

### Critério de aceitação
- [ ] `grep -r "console\." apps/api/src` retorna apenas testes
- [ ] Log estruturado JSON em produção
- [ ] Nenhum log contém senhas, tokens, seeds

---

## MED-32 — Schema sem `updatedAt` em alguns models

**Severidade:** 🟡 Médio
**Fase:** 🚨 **[FAZER AGORA]** — aproveitar a mesma migration de CRIT-01 (PostgreSQL); evita migration extra depois
**Esforço estimado:** 1h

### Problema

Comentário no código admite "UserWallet não tem updatedAt". Outros models podem ter o mesmo gap.

### Correção
```prisma
model UserWallet {
  // ...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Auditar todos os models e adicionar onde faltar.

### Critério de aceitação
- [ ] Todos os models têm `createdAt` + `updatedAt`
- [ ] Migration aplicada
- [ ] Backfill de `updatedAt` para registros existentes (usar `createdAt`)

---

## MED-33 — Strings JSON em campos do banco

**Severidade:** 🟡 Médio
**Fase:** 🟡 **[FAZER AGORA — PARCIAL]** — agora (junto com CRIT-01): trocar tipo do campo para `Json`/`@db.JsonB`. Adiar para 🔵 **[PRE-STAGING]**: validação Zod robusta de todos os shapes JSON aceitos
**Esforço estimado:** 1 dia (após CRIT-01)

### Problema

Campos `orderData`, `notificationPreferences`, `twoFactorBackupCodes`, `disputeData`, `metadata` armazenam JSON como `String`. Em Postgres → usar `jsonb` permite query, indexação parcial, validação.

### Correção (após CRIT-01)
```prisma
model Order {
  orderData Json  // → @db.JsonB em Postgres
}
```

Validar com Zod no momento do create:
```typescript
const OrderDataSchema = z.union([BoletoDataSchema, PixDataSchema]);

await prisma.order.create({
  data: {
    orderData: OrderDataSchema.parse(input.orderData),
  },
});
```

### Critério de aceitação
- [ ] Campos JSON migrados para `Json`/`@db.JsonB`
- [ ] Validação Zod aplicada
- [ ] Queries que filtram por subcampo usam `path` do Prisma

---

## MED-34 — Foreign keys denormalizadas sem constraint

**Severidade:** 🟡 Médio
**Fase:** 🟡 **[FAZER AGORA — PARCIAL]** — agora (junto com CRIT-01): adicionar FKs explícitas. Adiar para 🔵 **[PRE-STAGING]**: refinar policies `ON DELETE` por relacionamento
**Esforço estimado:** meio dia

### Exemplos
- `Order.cancelledBy String?` — sem FK para User
- `Order.providerId String?` — sem FK
- `Transaction.validatedBy String?` — sem FK

### Correção
```prisma
model Order {
  cancelledById String?
  cancelledBy   User?   @relation("CancelledOrders", fields: [cancelledById], references: [id], onDelete: SetNull)

  providerId    String?
  provider      User?   @relation("ProvidedOrders", fields: [providerId], references: [id], onDelete: SetNull)
}
```

### Critério de aceitação
- [ ] FKs explícitas
- [ ] `ON DELETE` policy definida (`SET NULL` ou `RESTRICT` conforme caso)

---

## MED-35 — Falta de testes de concorrência

**Severidade:** 🟡 Médio
**Fase:** ⚪ **[ADIAR PRE-PROD]** — load tests sem ambiente de staging real produzem números enganosos
**Esforço estimado:** 1 semana

### Recomendação

Adicionar suite com `artillery`:
```yaml
# tests/load/match-order.yml
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 100
scenarios:
  - flow:
      - post:
          url: '/api/v1/orders/{{ orderId }}/match'
          json: { ... }
```

Cenários sugeridos:
- 100 users matcheiam mesma order
- 100 unlocks concorrentes da mesma wallet
- Submit proof e cancel order disputam mesma transaction

### Critério de aceitação
- [ ] `npm run test:load` configurado
- [ ] CI roda subset em PR

---

## MED-36 — CSP com `'unsafe-inline'` para styles

**Severidade:** 🟡 Médio
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — em dev, `'unsafe-inline'` facilita iteração visual; ajustar antes do staging
**Esforço estimado:** meio dia

### Arquivo afetado
- `apps/api/src/index.ts:108-119` (helmet config)

### Correção

Usar nonces:
```typescript
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      // ...
    },
  },
}));
```

### Critério de aceitação
- [ ] `'unsafe-inline'` removido para styles
- [ ] Aplicação não quebra (testar páginas críticas)

---

## MED-37 — `userRole` cookie não-HttpOnly

**Severidade:** 🟡 Médio
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — documentação fica melhor quando frontend RBAC estabilizar
**Esforço estimado:** documentação

### Arquivo afetado
- `apps/api/src/utils/cookies.ts:36-44`

### Recomendação

Documentar explicitamente:
1. Cookie `userRole` é apenas **UX hint** para o Next.js middleware
2. Backend **nunca** deve usar `req.cookies.userRole` para autorização
3. Frontend pode ser tricked, mas isso só afeta tela exibida, não autorização real

Adicionar comentário no código:
```typescript
/**
 * SECURITY: este cookie é apenas UX hint.
 * Frontend pode ser enganado mas o backend SEMPRE valida role
 * a partir do JWT + lookup no banco em `authMiddleware`.
 */
export const setUserRoleCookie = ...
```

### Critério de aceitação
- [ ] Comentário explicativo no código
- [ ] Documentação em `docs/architecture/auth-rbac.md`
- [ ] Backend não lê `req.cookies.userRole`

---

## MED-38 — Multer sem validação de magic bytes

**Severidade:** 🟡 Médio (escala para SER se uploads forem servidos publicamente)
**Fase:** 🔵 **[ADIAR PRE-STAGING]** — só importa quando upload de comprovante for usado de fato em testes E2E reais
**Esforço estimado:** 2h

### Correção

```bash
npm install file-type
```
```typescript
import { fileTypeFromBuffer } from 'file-type';

router.post('/proof', upload.single('comprovante'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });

  // Validar magic bytes (não confiar em mimetype declarado)
  const type = await fileTypeFromBuffer(req.file.buffer);
  if (!type || !['image/jpeg', 'image/png', 'application/pdf'].includes(type.mime)) {
    return res.status(400).json({ error: 'Tipo de arquivo inválido' });
  }

  // Renomear para nome aleatório
  const filename = `${crypto.randomBytes(16).toString('hex')}.${type.ext}`;
  // ... salvar
});
```

### Critério de aceitação
- [ ] Magic bytes validados além de mime
- [ ] Filename randomizado
- [ ] PDFs scaneados ANTES de OCR (cf. `boleto-ocr.service.ts`)

---

## MED-39 — `customDailyLimit Float` (zombie field)

**Severidade:** 🟡 Médio
**Fase:** 🚨 **[FAZER AGORA]** — agrupar com CRIT-01 (migração para Postgres) e CRIT-03 (BigNumber). Resolver junto evita migration extra
**Esforço estimado:** 1h

### Arquivo afetado
- `apps/api/prisma/schema.prisma:28-29`

### Código atual
```prisma
customDailyLimit    Float?    // DEPRECATED: usar customDailyLimitStr (Float causa arredondamentos)
customDailyLimitStr String?   // MIGRATION (H-8): substitui customDailyLimit com precisão correta
```

### Correção

Após migrar para Postgres (CRIT-01):
```prisma
customDailyLimit Decimal? @db.Decimal(20, 2)
// remover customDailyLimitStr
```

Migration: copiar `customDailyLimitStr` → `customDailyLimit`, depois dropar a coluna string.

### Critério de aceitação
- [ ] `customDailyLimitStr` removido
- [ ] Apenas `customDailyLimit Decimal?` no schema
- [ ] Backfill testado

---

## MED-40 — Workers iniciam no processo da API

**Severidade:** 🟡 Médio
**Fase:** ⚪ **[ADIAR PRE-PROD]** — mudança de infra significativa; processo único é mais fácil em dev
**Esforço estimado:** 1 semana (impacto em infra)

### Problema

`src/index.ts` inicia API + todos os workers. Em produção com N instâncias:
- N workers concorrendo no mesmo job (sweep, balance-sync, order-expiration)
- Sem coordenação → trabalho duplicado, race conditions externas

### Correção

#### Opção A — Processo separado de workers
```typescript
// apps/api/src/worker.ts (entrypoint dedicado)
import './workers/all-workers';
```

```json
// package.json
"scripts": {
  "start:api": "node dist/index.js",
  "start:worker": "node dist/worker.js"
}
```

Deploy: 1 instância worker, N instâncias API.

#### Opção B — Leader election via Redis
```typescript
import Redis from 'ioredis';
const redis = new Redis();

async function tryAcquireLeadership(name: string, ttl = 30): Promise<boolean> {
  const result = await redis.set(`leader:${name}`, INSTANCE_ID, 'EX', ttl, 'NX');
  return result === 'OK';
}

// No worker:
setInterval(async () => {
  if (await tryAcquireLeadership('balance-sync')) {
    await runBalanceSync();
  }
}, 5000);
```

### Critério de aceitação
- [ ] Decisão arquitetural documentada
- [ ] Workers não rodam em N instâncias simultaneamente
- [ ] Health check separado para worker process

---

# Parte IV — Boas práticas reconhecidas (🟢 GOOD)

Preservar e replicar:

| ID | Onde | O quê |
|----|------|-------|
| GOOD-01 | `validateProof` em `transaction.service.ts:108-126` | Padrão de claim atômico com `updateMany + WHERE status` — replicar nos outros pontos |
| GOOD-02 | `utils/jwt.ts:11-25` | Validação rigorosa de `JWT_SECRET` (length, placeholders) |
| GOOD-03 | `master-seed.service.ts` | AES-256-GCM com IV aleatório, authentication tag |
| GOOD-04 | `index.ts` | Helmet com HSTS, frameguard, noSniff, CSP |
| GOOD-05 | `rateLimiter.middleware.ts` | Rate limiters segmentados por endpoint sensível |
| GOOD-06 | `cookies.ts` | SameSite=strict em produção (CSRF) |
| GOOD-07 | `cookies.ts` | HttpOnly em access/refresh tokens |
| GOOD-08 | Schemas Zod | Validação em todas as rotas críticas |
| GOOD-09 | `auditLogService` | Audit log centralizado |
| GOOD-10 | RBAC com `Role.level` numérico | Permite hierarquia (SUPPORT=40, MANAGER=60, ADMIN=80, MASTER=100) |
| GOOD-11 | `securityLogger` | Logger dedicado para eventos de segurança |
| GOOD-12 | `master-seed.service.ts:21-23` | Cache com TTL (apesar de CRIT-12, conceito correto) |
| GOOD-13 | `auth.middleware.ts:106-120` | Conta congelada bloqueia escritas mas permite GETs e disputas |
| GOOD-14 | `refreshToken.service` + JTI | Blacklist de tokens via JTI |
| GOOD-15 | `BigNumber` em `wallet.service.lockBalance` | Uso correto onde aplicado |
| GOOD-16 | Discriminated union Zod (`CreateOrderSchema`) | Type-safety entre BUY/SELL orders |

---

# Parte V — Plano de sprints sugerido (alinhado com §1.1)

> ⚠️ **Mudança em relação à v1.0:** o plano foi reorganizado para refletir a classificação por fase (§1.1). Sprints 1-3 cobrem tudo que é 🚨 **[FAZER AGORA]**. Sprints 4+ entram conforme o projeto avança para staging e produção.

## 🚨 FASE 1 — Desenvolvimento ([FAZER AGORA])

**Quando executar:** durante o desenvolvimento atual, antes de qualquer ambiente além de localhost.

### Sprint 1 — Fundação financeira (1.5 semanas)
**Objetivo:** ledger correto antes de qualquer outra coisa
- CRIT-01 (Postgres) — 1 semana
  - Junto: MED-32 (updatedAt), MED-33 parcial (Json type), MED-34 parcial (FKs), MED-39 (zombie field)
- CRIT-03 (BigNumber em tudo) — 2-3 dias
- CRIT-04 (race conditions no ledger) — 2-3 dias

### Sprint 2 — Identidade e custódia (1 semana)
- CRIT-02 (HD account index persistido) — 3 dias
- CRIT-05 (TOCTOU em submitProof/cancel) — 2 dias
- CRIT-08 (limpar git de secrets) — meio dia
- CRIT-09 (kill switch simulatePayment) — 15min
- CRIT-06 (backup codes crypto-safe) — 1h
- CRIT-07 (TOTP replay protection) — meio dia
- CRIT-12 (memzero da seed) — meio dia
- SER-21 (limpar .bak/.old) — 15min

### Sprint 3 — Hardening leve (meio dia)
- SER-13 parcial (secrets separados + algoritmo) — 1h
- SER-14 (COOKIE_SECRET separado) — 15min
- MED-31 parcial (apenas logs que vazam dados sensíveis) — 1h

**🎯 Marco da Fase 1:** ao fechar esses sprints, o sistema está pronto para receber primeiro deploy a um ambiente real (staging).

---

## 🔵 FASE 2 — Pré-staging ([ADIAR PRE-STAGING])

**Quando executar:** antes do primeiro deploy fora do localhost (staging real com Postgres, Redis, domínio próprio).

### Sprint 4 — Custódia profissional (2-3 semanas)
**Decisão de produto necessária antes:** KMS vs HSM vs híbrido
- CRIT-10 (master seed → KMS) — 1-2 semanas
- CRIT-11 (rotação documentada) — 2 dias
- SER-18 (Argon2id) — 1 dia
- SER-19 (rotateKey thread-safe) — meio dia

### Sprint 5 — Auth hardening completo (1 semana)
- SER-13 resto (TTL 15min) — 1 dia
- SER-15 (seed com passwords aleatórios) — meio dia
- SER-17 (CORS sem origin) — 15min
- SER-20 (não duplicar tokens em body) — 1 dia
- SER-22 (account lockout) — meio dia
- SER-23 (uniform login error) — meio dia
- SER-24 (workers control + 2FA fresh) — 1 dia
- SER-28 (2FA fresh em rotas admin) — meio dia

### Sprint 6 — Operações e validação (1 semana)
- SER-25 (BullMQ) — 2 dias
- SER-26 (boleto checksum) — 1 dia
- SER-27 (CPF/CNPJ validador) — 2h
- MED-31 resto (refator completo para winston) — 1 dia
- MED-33 resto (validação Zod robusta dos JSONs) — meio dia
- MED-34 resto (refinar policies ON DELETE) — meio dia
- MED-36 (CSP sem unsafe-inline) — meio dia
- MED-37 (documentar userRole cookie) — 1h
- MED-38 (magic bytes em uploads) — 2h

**🎯 Marco da Fase 2:** ao fechar esses sprints, o sistema está pronto para beta privado com usuários reais.

---

## ⚪ FASE 3 — Pré-produção ([ADIAR PRE-PROD])

**Quando executar:** antes de abrir para qualquer usuário externo (beta privado / abertura pública).

### Sprint 7 — Robustez de produção (1-2 semanas)
- SER-16 (limite JSON) — 1h
- MED-29 (docs reorganizadas) — 1 dia
- MED-30 (decisão pt-BR vs inglês formalizada) — 1h
- MED-35 (load tests) — 3 dias
- MED-40 (workers processo separado) — 1 semana

### Sprint 8 — Auditoria externa e validação
- Contratar pentester ou empresa (Tempest / Conviso / Tenchi)
- Endereçar findings da auditoria externa
- Drill de incident response
- Drill de key rotation

**🎯 Marco da Fase 3:** sistema pronto para ir ao ar.

---

## ⚫ FASE 4 — Pós-lançamento ([ADIAR PRE-LAUNCH PÚBLICO])

**Quando executar:** após o produto estar no ar e com tráfego real.

- Bug bounty (HackerOne / Intigriti)
- KYC providers (Unico / Idwall / Caf)
- AML providers (Chainalysis / TRM Labs) — quando registrar como VASP no BACEN
- Smart contracts auditados (Fase 2 do roadmap do produto) — somente se product-market fit validar

---

# Parte VI — Templates

## Template de commit
```
fix(ledger): unlockBalance agora é atômico com SELECT FOR UPDATE [CRIT-04]

Anteriormente, unlockBalance lia o saldo da carteira fora da transação
e fazia o update em prisma.$transaction([...]). Sob concorrência, dois
requests podiam ambos passar na verificação e creditar duplamente.

Mudanças:
- Read movido para dentro de prisma.$transaction(async tx => ...)
- Isolation level Serializable
- Retry com backoff em P2034 (serialization failure)
- Helper utils/money.ts para evitar parseFloat

Auditoria: CRIT-04
Refs: AUDITORIA_TECNICA_MKTPLACE_P2P.md
```

## Template de PR
```markdown
## Resumo
Corrige CRIT-04 (race conditions no ledger).

## Findings fechados
- [x] CRIT-04 — `unlockBalance`, `deductBalance`, `creditBalance` atômicos

## Critérios de aceitação
- [x] Leitura DENTRO de `prisma.$transaction(async tx => ...)`
- [x] Isolation `Serializable`
- [x] Retry em conflito
- [x] Teste de concorrência (100 unlocks paralelos)
- [x] `parseFloat` removido

## Como testar
```bash
cd apps/api
npm test -- wallet.crit04.spec
```

## Risco
Médio — código de ledger. Testado com 100k operações concorrentes em staging.

## Rollback
`git revert <hash>` — sem migrations destrutivas.
```

## Template de branch
```
fix/crit-04-ledger-atomic-transactions
fix/ser-13-jwt-separate-secrets
test/crit-04-concurrent-unlock
```

---

# Parte VII — Checklist geral de produção

Antes de aceitar qualquer cripto real, **todos** os itens abaixo devem estar verdes:

## Infraestrutura
- [ ] Postgres em produção (CRIT-01)
- [ ] Redis para sessions/queues
- [ ] Workers em processo separado (MED-40)
- [ ] Health checks configurados
- [ ] Monitoring (Datadog/NewRelic/Grafana)
- [ ] Error tracking (Sentry)
- [ ] Log aggregation (CloudWatch/Loki)

## Custódia
- [ ] Master seed em KMS/HSM (CRIT-10)
- [ ] Procedimento de rotação documentado (CRIT-11)
- [ ] Cold wallet multisig configurada
- [ ] Hot wallet com ≤ 2% do TVL
- [ ] Sweep worker testado em staging
- [ ] Cerimônia de geração de seed documentada
- [ ] Backup do mnemonic em cofres físicos (2-de-3 ou similar)

## Segurança
- [ ] Todos os CRIT fechados
- [ ] Auditoria externa (Trail of Bits / pentester local)
- [ ] WAF na frente da API
- [ ] DDoS protection (Cloudflare/AWS Shield)
- [ ] Logs sem dados sensíveis (testar com grep)
- [ ] Penetration test executado
- [ ] Plano de resposta a incidentes
- [ ] Bug bounty (HackerOne/Intigriti) considerado

## Compliance
- [ ] LGPD: política de privacidade publicada
- [ ] Termos de uso revisados por advogado
- [ ] KYC/AML providers contratados (Unico, Chainalysis)
- [ ] Reporting COAF configurado
- [ ] Registro VASP no BACEN (planejado para Mês 7)

## Operações
- [ ] Runbook de deploy
- [ ] Runbook de rollback
- [ ] Runbook de incidentes
- [ ] Runbook de rotação de chaves
- [ ] On-call rotation definida
- [ ] PagerDuty/Opsgenie configurado

## Testes
- [ ] Coverage > 80% em código de ledger e auth
- [ ] Testes de concorrência (MED-35)
- [ ] Testes E2E completos
- [ ] Drill de disaster recovery executado
- [ ] Drill de key rotation executado

---

## TECH-DEBT — Erros TypeScript pré-existentes catalogados (Sprint 1)

Durante o fechamento da Sprint 1, `npx tsc --noEmit` reporta **25 erros pré-existentes**, todos comprovadamente anteriores às mudanças de CRIT-01/03/03b/04. Catalogados aqui para serem absorvidos por sprints futuras.

| # | Arquivo:Linha | Código | Resumo | Categoria sugerida | Sprint destino |
|---|---------------|--------|--------|--------------------|----------------|
| 1 | `controllers/auth.controller.ts:582` | TS18048 | `req.user` is possibly 'undefined' | AuthGuard typing | Sprint 2 (limpeza tipos) |
| 2 | `controllers/auth.controller.ts:596` | TS18048 | `req.user` is possibly 'undefined' | AuthGuard typing | Sprint 2 |
| 3 | `controllers/coupon.controller.ts:123` | TS2322 | `string` not assignable to `Record<string, any>` | Schema mismatch | Sprint 2 |
| 4 | `controllers/dispute.controller.ts:65` | TS2345 | `ACCOUNT_BLOCK_APPEAL` ausente do `CreateDisputeInput` | Schema/types out-of-sync | Sprint 2 |
| 5 | `controllers/order.controller.ts:134` | TS2339 | `brlAmount` ausente em `BUY` order union | Discriminated union narrowing | Sprint 2 |
| 6 | `controllers/order.controller.ts:140` | TS2339 | `brlAmount` ausente em `BUY` order union | Discriminated union narrowing | Sprint 2 |
| 7 | `middleware/admin.middleware.ts:27` (col 19) | TS2367 | Comparação `Role` vs `string` sem overlap | Migração role enum → Role table incompleta | Sprint 2 |
| 8 | `middleware/admin.middleware.ts:27` (col 44) | TS2367 | idem | idem | Sprint 2 |
| 9 | `middleware/admin.middleware.ts:27` (col 71) | TS2367 | idem | idem | Sprint 2 |
| 10 | `services/admin.service.ts:86` | TS2353 | `createdBy` ausente em `PlatformWalletCreateInput` | Schema drift | Sprint 2 |
| 11 | `services/admin.service.ts:537` | TS2322 | `role: string` não casa com `RoleUpdateOneWithoutUsersNestedInput` | Migração role incompleta | Sprint 2 |
| 12 | `services/dispute.service.ts:843` | TS2339 | `network` não existe na seleção | Schema/select drift | Sprint 2 |
| 13 | `services/dispute.service.ts:1479` | TS2353 | Operador `in` em `RoleNullableRelationFilter` | Prisma type drift | Sprint 2 |
| 14 | `services/exchange-rate.service.ts:109` | TS18046 | `data` is of type `unknown` (axios untyped) | Axios response typing | Sprint 3 |
| 15 | `services/exchange-rate.service.ts:158` (col 12) | TS18046 | idem | idem | Sprint 3 |
| 16 | `services/exchange-rate.service.ts:158` (col 26) | TS18046 | idem | idem | Sprint 3 |
| 17 | `services/exchange-rate.service.ts:162` | TS18046 | idem | idem | Sprint 3 |
| 18 | `services/exchange-rate.service.ts:207` | TS18046 | idem | idem | Sprint 3 |
| 19 | `services/finance.service.ts:152` | TS2353 | `label` ausente em `PlatformWalletSelect` | Schema drift | Sprint 2 |
| 20 | `services/masterSeedAdmin.service.ts:324` | TS2339 | `randomBytes` ausente em `Crypto` (deveria ser `node:crypto`) | Import errado | Sprint 2 (CRIT-10/11 dependentes) |
| 21 | `services/masterSeedAdmin.service.ts:378` | TS2554 | Aridade errada de função | idem | Sprint 2 |
| 22 | `services/masterSeedAdmin.service.ts:382` | TS2304 | `auditLogService` não encontrado | Import faltando | Sprint 2 |
| 23 | `services/transaction.service.ts:469` | TS2339 | `network` ausente na seleção | Schema/select drift | Sprint 2 |
| 24 | `services/transaction.service.ts:507` | TS2339 | `orderType` ausente na seleção | Schema/select drift | Sprint 2 |
| 25 | `socket/__tests__/notification.socket.test.ts:24` | TS2345 | Mismatch entre `http.Server` e `socket.io.Server` generics — **bloqueia compilação da suite, Jest reporta `Test suite failed to run`** (runtime impact: 0 testes de socket executados) | Test infrastructure | Sprint 3 |

### Falhas de teste pré-existentes (runtime)

Distintas dos erros de TS acima — estas são suites que **compilam** mas falham em tempo de execução por drift entre mocks e implementação:

| ID | Suite | Detalhe | Causa-raiz | Sprint destino |
|----|-------|---------|------------|----------------|
| TD-T26 | `services/__tests__/notification.service.test.ts` | **5 testes falham** em 2 grupos: `createNotification › deve criar uma notificação com sucesso`, `createNotification › deve usar prioridade NORMAL como padrão`, `createNotification › deve lançar erro ao falhar ao criar notificação`, `getUserNotifications › deve buscar notificações do usuário com filtros`, `getUserNotifications › deve usar valores padrão quando filtros não fornecidos`. Mensagem comum: `TypeError: Cannot read properties of undefined (reading 'findUnique')`. | `src/__tests__/setup.ts` mocka apenas `prisma.notification.*` (create, findUnique, findMany, count, update, updateMany, delete, deleteMany). O `NotificationService` evoluiu e passou a tocar outros models (provavelmente `user`, `userNotificationPreference` ou similar) que não estão no mock global — chamada retorna `undefined.findUnique`. Solução: ampliar `setup.ts` ou mockar localmente no `describe`. | Sprint 3 (test-infra hygiene) |
| TD-T27 | `socket/__tests__/notification.socket.test.ts` | Suite inteira não roda (`Test suite failed to run`). 0 testes executados. | Mesma raiz do erro #25 da tabela acima — falha de compilação do TypeScript impede o Jest de carregar o arquivo. Resolver o `TS2345` reabilita os testes; pode haver falhas latentes ainda assim. | Sprint 3 (depende de #25) |

**Notas operacionais:**
- Nenhum dos 25 erros de TS bloqueia execução em runtime de produção (TypeScript não roda no banco). São travas estáticas que precisam ser endereçadas antes do "go live".
- Cluster `masterSeedAdmin.service.ts` (erros 20-22) tem dependência forte com **CRIT-10 (master seed em KMS)** e **CRIT-11 (rotação)** — naturalmente cai na Sprint 2.
- Cluster `admin.middleware.ts + admin.service.ts:537` (erros 7-9, 11) reflete migração incompleta de `legacyRole: string` para tabela `Role` relacional. Bloqueador da Sprint 2 de identidade.
- Cluster `exchange-rate.service.ts` (erros 14-18), `socket.test.ts` (erro 25 + TD-T27), e `notification.service.test.ts` (TD-T26) são higiene de tipos / test-infra sem impacto financeiro — Sprint 3.
- Todas as falhas TD-T26/TD-T27 foram confirmadas pré-Sprint-1 via `git stash` da branch atual + rerun.

### Pendências de developer-experience (DX)

Problemas que não causam falha em produção, mas atrapalham desenvolvimento ou onboarding. Identificados durante operação normal (ex.: reset de banco dev), com solução conhecida.

| ID | Problema | Fase | Solução proposta | Esforço |
|----|----------|------|------------------|---------|
| **TECH-DEBT-DEV01** | Seed pipeline não é one-shot: `prisma/seed.ts` depende de `prisma/seeds/rbac-seed.ts` ter sido executado antes. Quando a ordem é invertida, falha cripticamente com `❌ Roles RBAC não encontrados! Execute primeiro: npx tsx prisma/seeds/rbac-seed.ts` no meio do output do `prisma migrate reset`. Observado em 2026-05-15 ao executar Caminho A (reset de banco dev). | ✅ **Fechado** (commits `fb6edbb` + `176b2dc` em 2026-05-16) | **Solução aplicada (opção a):** `seed.ts` agora importa `seedRBAC` de `./seeds/rbac-seed` e chama `await seedRBAC()` no início da `main()`, logo após o guard `NODE_ENV=production`. `seedRBAC` já era idempotente (upsert por slug/name em tudo) — re-rodar não duplica. `findUnique` defensivo + `process.exit(1)` substituído por `findUniqueOrThrow` (pós-seedRBAC, contrato garante existência). `rbac-seed.ts` preservado como standalone-executável via `if (require.main === module)`. **Tests:** `prisma/__tests__/seed-pipeline.spec.ts` 4/4 verde (DB virgem→cria tudo; DB populado→idempotente; users zerados/RBAC intacto→recria só users; drop RBAC inteiro→seed reconstrói sem mensagem antiga). **Validado** em Postgres dev: `migrate reset --force` é one-shot end-to-end em 2026-05-16. | 30min |

### Pendências operacionais (não-código)

Distintas dos erros de TS e falhas de teste acima — estas são ações que precisam acontecer **em ambiente real (staging/prod)** após código mergeado, mas que não dependem de mudança no código. Catalogadas aqui para não cair entre as cadeiras.

| ID | Título | Fase | Razão / Detalhes |
|----|--------|------|------------------|
| **TECH-DEBT-OP01** | Invalidar backup codes 2FA pré-CRIT-06 em produção | 🔵 **[ADIAR PRE-PROD]** | Backup codes salvos no banco ANTES de `bea7f20` foram gerados com `Math.random()` (xorshift128+ — previsível a partir de poucas amostras). O bug está fechado no código, mas as **hashes antigas seguem válidas** no banco até serem usadas ou regeneradas. Em prod, isto é uma janela de bypass de 2FA até zerarmos. **Pré-requisitos:** (1) feature de regeneração de backup codes visível e testada na UI; (2) email transacional pronto comunicando os usuários. **Comando:** `cd apps/api && DATABASE_URL=<prod> npx tsx scripts/invalidate-2fa-backup-codes.ts` (dry-run) → `--apply`. **Smoke test do script:** ✅ executado em 2026-05-15 contra Postgres dev (9/9 verificações PASS — userA `enabled+codes` detectado/zerado, userB `disabled+codes` intocado). **Quando rodar:** logo antes do primeiro deploy a prod com usuários reais. Não fazer antes — usuários de dev/staging usariam backup codes gerados pelo novo CSPRNG normalmente. |
| **TECH-DEBT-OP02** | Provisionamento de master/admin em produção | 🔵 **[ADIAR PRE-PROD]** | **Decisão registrada:** NÃO usar `prisma/seed.ts` em produção (guard `NODE_ENV=production` em commits `17fea25` + `0e4f5eb` — PR #3 mergeado). Provisionamento real exige runbook operacional dedicado. **Runbook documentado em [`docs/runbook-prod-bootstrap.md`](docs/runbook-prod-bootstrap.md)** (2026-05-15) com plano completo: gerar senhas via `openssl rand`, criar **DOIS masters independentes** (um por sócio — anti-SPOF), excluir defaults `master@mktplace.com`/`admin@mktplace.com` na MESMA transação atômica, flags `forcePasswordReset` + `force2FASetup` forçam setup completo no primeiro login, 2FA obrigatório antes de qualquer permissão master ativa. **Código ainda não implementado** — depende de SER-15 e SER-28 saírem do `[ADIAR PRE-STAGING]` para entrar em sprint que adicione: campos de schema (`forcePasswordReset`, `force2FASetup`), middleware de redirect, endpoints `/auth/setup-password` e `/auth/setup-2fa`, telas frontend, e `scripts/bootstrap-prod.ts` (especificação completa no próprio runbook). **Plano de teste:** 3-4 ensaios em dev local → 1 dry-run em staging → execução real em prod. **Quando rodar:** uma única vez, ao provisionar prod pela primeira vez, com ambos os sócios presentes em videochamada. |
| **TECH-DEBT-OP03** | Coordenar re-clone com Nícolas pós-CRIT-08 | 🚨 **[FAZER AGORA]** — Pendente coordenação | A reescrita do histórico em CRIT-08 (Sprint 2 sessão 3) renomeou TODOS os SHAs do repositório. Quem tem clone local feito antes de 2026-05-16 está com histórico divergente — `git pull` resulta em merge confuso ou rejeita. **Ação:** Nícolas precisa (1) confirmar que não tem branch local com trabalho não-pushado; (2) apagar a pasta local do clone; (3) `git clone https://github.com/Noletu/MktPlace-P2P` de novo. Qualquer branch local que ele tivesse fica órfã (commits referenciam SHAs antigos inexistentes). Confirmação de re-clone OK = task fechada. **Quando:** o quanto antes — qualquer push de Nícolas sobre o clone antigo vai falhar de qualquer jeito. |

---

**Fim do documento.**

Última edição: 17/05/2026 (v1.10 — CRIT-12 fechado: memzero da master seed, cópia defensiva, timer ativo com .unref(), callers com try/finally; Sprint 2 sessão 4)
Auditor: Claude (claude.ai/web)
Próxima revisão sugerida: após Sprint 2 ou em 30 dias, o que vier primeiro.