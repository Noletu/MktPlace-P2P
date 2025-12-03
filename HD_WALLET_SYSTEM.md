# Sistema de Carteiras HD (Hierarchical Deterministic Wallets)

## 📚 Visão Geral

O MktPlace P2P agora utiliza um sistema de **Carteiras HD (Hierarchical Deterministic)** baseado nos padrões BIP32/BIP44 para gerenciar fundos de colateral de forma unificada e segura.

### O que mudou?

**ANTES (Sistema Antigo - Deprecated):**
- ❌ Colateral depositado em endereços separados (`CollateralAddress`)
- ❌ Saldo interno separado (`InternalBalance`)
- ❌ Usuário precisava fornecer endereços manualmente
- ❌ Complexidade desnecessária com múltiplos sistemas

**AGORA (Sistema HD Wallet):**
- ✅ **Uma carteira HD por crypto/rede** - derivada automaticamente
- ✅ **Saldo único** - mesma carteira recebe depósitos E serve como colateral
- ✅ **Endereço gerado automaticamente** - sem input manual
- ✅ **Bloqueio/desbloqueio transparente** - saldo bloqueado para pedidos ativos
- ✅ **Auditoria completa** - histórico de todas transações

---

## 🔑 Arquitetura Técnica

### BIP32/BIP44 - Derivação Hierárquica

Todas as carteiras são derivadas de uma **master seed** usando o padrão BIP44:

```
m / purpose' / coin_type' / account' / change / address_index
```

**Exemplo de paths:**
- Bitcoin: `m/44'/0'/[account]'/0/0`
- Ethereum/EVM: `m/44'/60'/[account]'/0/0`
- Solana: `m/44'/501'/[account]'/0/0`
- Tron: `m/44'/195'/[account]'/0/0`

**Account derivation:** Cada `userId` é hasheado (SHA-256) para gerar um `account` index determinístico. Isso garante que:
- Mesmo usuário sempre gera mesma carteira
- Usuários diferentes geram carteiras diferentes
- Derivação é reproduzível

### Criptografia de Chaves Privadas

**Master Seed:**
- Mnemônico BIP39 (24 palavras)
- Criptografado com AES-256-GCM
- Armazenado em `MASTER_SEED_ENCRYPTED` (.env)
- **CRÍTICO:** Backup do mnemônico deve ser mantido offline

**Private Keys Individuais:**
- Cada carteira tem sua private key criptografada
- AES-256-GCM com salt único por usuário
- Chave derivada via PBKDF2 (100k iterações)
- **NUNCA** armazenadas em plain text
- **NUNCA** expostas em logs ou responses

### Segurança

1. **Encryption Keys:**
   ```env
   MASTER_SEED_ENCRYPTION_KEY=<32 bytes hex>  # Criptografa master seed
   WALLET_ENCRYPTION_KEY=<32 bytes hex>        # Criptografa private keys
   ```

2. **Rotação de Chaves:**
   - Sistema suporta rotação de encryption keys
   - Método `KeyManagementService.rotateKey()`

3. **Backup & Recovery:**
   - Master mnemonic (24 palavras) permite recuperar TODAS as carteiras
   - Deve ser armazenado offline (papel, vault físico, etc)
   - **NUNCA** compartilhar ou expor

---

## 🗄️ Modelo de Dados

### UserWallet

```prisma
model UserWallet {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])

  cryptoType String // BTC, USDC, USDT
  network    String // BITCOIN, ETHEREUM, BASE, ARBITRUM, SOLANA, TRC20

  address        String // Endereço público derivado
  derivationPath String // Ex: m/44'/60'/0'/0/0
  encryptedPrivateKey String // Private key criptografada

  balance          String @default("0")
  lockedBalance    String @default("0")
  availableBalance String @default("0")

  totalDeposited String @default("0")
  totalWithdrawn String @default("0")
  totalUsed      String @default("0")

  lastSyncedAt    DateTime?
  lastBlockHeight Int?

  isActive Boolean @default(true)

  @@unique([userId, cryptoType, network])
}
```

### WalletTransaction

```prisma
model WalletTransaction {
  id     String @id @default(cuid())
  walletId String
  wallet   UserWallet @relation(fields: [walletId], references: [id])
  userId   String

  type   String // DEPOSIT, WITHDRAWAL, LOCK, UNLOCK, DEDUCT
  amount String

  balanceBefore String
  balanceAfter  String

  txHash       String?   // Hash da tx blockchain (deposits/withdrawals)
  blockHeight  Int?      // Altura do bloco (confirmação)
  confirmations Int @default(0)

  description String
  metadata    String? // JSON com dados adicionais

  orderId String? // Referência ao pedido (se aplicável)

  createdAt DateTime @default(now())
}
```

---

## 🔄 Fluxos de Uso

### 1. Criação de Carteira

**Automática (Recomendado):**
```typescript
// Sistema cria carteira automaticamente ao criar pedido
const order = await orderService.createOrder({
  userId,
  cryptoType: 'USDC',
  network: 'ETHEREUM',
  // ... outros dados
});

// Se usuário não tem carteira USDC/ETHEREUM:
// 1. Sistema cria automaticamente via DerivationService
// 2. Retorna endereço para depósito
// 3. Aguarda confirmação on-chain
```

**Manual (API):**
```typescript
POST /api/v1/wallets
{
  "cryptoType": "USDC",
  "network": "ETHEREUM"
}

// Response:
{
  "id": "clx123...",
  "address": "0x1234...",
  "balance": "0",
  "availableBalance": "0",
  "lockedBalance": "0"
}
```

### 2. Depósito de Fundos

```
1. Usuário obtém endereço da carteira
   GET /api/v1/wallets

2. Usuário envia crypto para o endereço (via exchange, wallet externa, etc)

3. Deposit Monitor Worker detecta transação (30s)
   - Consulta saldo on-chain
   - Detecta mudança
   - Aguarda confirmações mínimas:
     * Bitcoin: 3 confirmações
     * Ethereum: 12 confirmações
     * Base/Arbitrum: 10 confirmações
     * Solana: 15 confirmações
     * Tron: 19 confirmações

4. Após confirmação:
   - Credita saldo em `balance` e `availableBalance`
   - Cria WalletTransaction (tipo: DEPOSIT)
   - Envia notificação ao usuário
```

### 3. Criação de Pedido com Colateral

**Fluxo Híbrido:**

```typescript
// CASO 1: Saldo suficiente
const order = await orderService.createOrder({
  userId,
  cryptoType: 'USDC',
  cryptoAmount: '100',
  network: 'ETHEREUM',
  // ...
});

// Sistema:
// 1. Verifica saldo disponível (105 USDC necessário = 100 + 2.5% taxa)
// 2. Se tem saldo: bloqueia e cria pedido INSTANTÂNEO
// 3. Pedido aparece no marketplace imediatamente

// CASO 2: Saldo insuficiente
{
  "requiresDeposit": true,
  "missingAmount": "50",
  "availableBalance": 55,
  "requiredCollateral": "105",
  "walletAddress": "0x1234..."
}

// Frontend:
// - Mostra modal "Deposite 50 USDC no endereço 0x1234..."
// - Usuário deposita
// - Workers detectam depósito
// - Frontend permite criar pedido novamente
```

### 4. Cancelamento de Pedido

```typescript
// Quando pedido é cancelado:
orderService.cancelOrder(orderId);

// Sistema:
// 1. Verifica se tem colateral bloqueado
// 2. Se sim: desbloqueia saldo
// 3. Move de lockedBalance → availableBalance
// 4. Cria WalletTransaction (tipo: UNLOCK)
```

---

## ⚙️ Workers & Monitoramento

### Deposit Monitor Worker

**Frequência:** 30 segundos
**Função:** Detectar depósitos em todas carteiras ativas

```typescript
// Execução:
1. Busca todas UserWallets ativas
2. Para cada carteira:
   - Consulta saldo on-chain
   - Compara com saldo salvo
   - Se diferente: detectou mudança
   - Busca transações desde lastBlockHeight
   - Filtra transações confirmadas
   - Credita saldo + registra WalletTransaction
   - Envia notificação
3. Atualiza lastSyncedAt e lastBlockHeight
```

### Balance Sync Worker

**Frequência:** 5 minutos
**Função:** Reconciliar discrepâncias entre saldo salvo e real

```typescript
// Execução:
1. Busca todas UserWallets ativas
2. Para cada carteira:
   - Consulta saldo on-chain
   - Compara com saldo salvo
   - Se discrepância < 0.00000001: apenas atualiza lastSyncedAt
   - Se discrepância detectada:
     * Log warning
     * Se > 10%: ALERTA crítico
     * Atualiza saldo
     * Cria WalletTransaction (tipo: SYNC/reconciliação)
```

---

## 🎨 Interface do Usuário

### Página de Carteiras (`/wallets`)

**Funcionalidades:**
- ✅ Visualizar todas carteiras agrupadas por crypto
- ✅ Criar carteiras HD por rede (BTC/BITCOIN, USDC/ETHEREUM, etc)
- ✅ Ver saldo disponível vs bloqueado
- ✅ Copiar endereço com um clique
- ✅ Sincronizar saldo manualmente
- ✅ Ver histórico de transações (modal)

**Layout:**
```
💳 Minhas Carteiras HD

[BTC Card]
  ├─ BITCOIN
  │  ├─ Disponível: 0.05 BTC
  │  ├─ Bloqueado: 0.02 BTC
  │  ├─ Total: 0.07 BTC
  │  ├─ Endereço: bc1q... [📋 Copiar] [🔄 Sync]
  │  └─ [📜 Ver Histórico]
  └─ [➕ Criar outras redes]

[USDC Card]
  ├─ ETHEREUM
  │  ├─ Disponível: 500 USDC
  │  ├─ Bloqueado: 200 USDC
  │  └─ ...
  ├─ BASE
  └─ ARBITRUM

[USDT Card]
  └─ TRC20
```

---

## 🔧 Administração

### Setup Inicial

1. **Gerar Master Seed:**
   ```bash
   cd apps/api
   npx tsx scripts/setup-hd-wallet.ts
   ```

   Output:
   ```
   ✅ Master HD Wallet Setup Completo!

   📋 Adicione ao .env:
   MASTER_SEED_ENCRYPTION_KEY=abc123...
   WALLET_ENCRYPTION_KEY=def456...
   MASTER_SEED_ENCRYPTED=ghi789...

   🔐 BACKUP MNEMÔNICO (24 palavras):
   word1 word2 word3 ... word24

   ⚠️  CRÍTICO: Guarde o mnemônico offline!
   ```

2. **Atualizar .env:**
   ```env
   # HD Wallet System
   MASTER_SEED_ENCRYPTION_KEY=...
   WALLET_ENCRYPTION_KEY=...
   MASTER_SEED_ENCRYPTED=...
   ```

3. **Aplicar Schema:**
   ```bash
   npx prisma db push
   ```

4. **Validar Sistema:**
   ```bash
   npx tsx scripts/validate-hd-wallet.ts
   ```

### Monitoramento

**Verificar Workers:**
```
GET /api/v1/workers/status
Authorization: Bearer <admin-token>
```

**Forçar Sincronização:**
```
POST /api/v1/wallets/:id/sync
Authorization: Bearer <user-token>
```

**Auditar Transações:**
```sql
SELECT * FROM WalletTransaction
WHERE createdAt > NOW() - INTERVAL '24 hours'
ORDER BY createdAt DESC;
```

---

## 🚨 Troubleshooting

### Saldo não atualiza após depósito

1. Verificar confirmações mínimas:
   - Bitcoin: aguarde 3 confirmações (~30min)
   - Ethereum: aguarde 12 confirmações (~3min)

2. Forçar sincronização manual:
   ```
   POST /api/v1/wallets/:id/sync
   ```

3. Verificar logs do Deposit Monitor:
   ```bash
   # No console do servidor
   grep "Deposit Monitor" logs/*.log
   ```

### Discrepância de saldo (> 10%)

**Causas possíveis:**
- Saque feito fora da plataforma (se usuário tem private key)
- Falha no worker de sincronização
- Race condition no bloqueio de saldo

**Ação:**
1. Balance Sync Worker já detectou e logou ALERTA
2. Admin deve investigar transações on-chain
3. Reconciliar manualmente se necessário

### Private key perdida

**Recovery:**
1. Ter backup do mnemônico (24 palavras)
2. Executar script de recuperação:
   ```bash
   npx tsx scripts/recover-from-mnemonic.ts
   ```
3. Sistema re-deriva todas as carteiras

**Prevenção:**
- ✅ Backup do mnemônico offline
- ✅ Múltiplas cópias em locais seguros
- ✅ Considerar hardware wallet para master seed

---

## 📊 Métricas de Sucesso

Após implementação do HD Wallet System:

✅ **Funcionalidades Completas:**
- [x] Derivação BIP32/BIP44 para 6 redes
- [x] Criptografia AES-256-GCM
- [x] Deposit monitoring (30s)
- [x] Balance sync (5min)
- [x] Wallet management API
- [x] Frontend redesenhado
- [x] Histórico de transações
- [x] Bloqueio/desbloqueio de saldo

✅ **Melhorias vs Sistema Antigo:**
- -50% complexidade código (removido CollateralAddress, InternalBalance)
- -100% input manual (endereços gerados automaticamente)
- +100% transparência (histórico completo de transações)
- +Segurança (BIP32/BIP44 padrão da indústria)

---

## 📖 Referências

- [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) - Hierarchical Deterministic Wallets
- [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) - Mnemonic code for generating deterministic keys
- [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) - Multi-Account Hierarchy for Deterministic Wallets
- [AES-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode) - Authenticated encryption
- [PBKDF2](https://en.wikipedia.org/wiki/PBKDF2) - Password-Based Key Derivation Function

---

## 🔐 Segurança & Compliance

### Práticas Recomendadas

1. **Nunca** compartilhar:
   - Master mnemonic (24 palavras)
   - MASTER_SEED_ENCRYPTION_KEY
   - WALLET_ENCRYPTION_KEY

2. **Backup obrigatório:**
   - Mnemônico em papel (múltiplas cópias)
   - Encryption keys em vault seguro
   - Documentação de recovery

3. **Monitoramento:**
   - Alertas automáticos para discrepâncias > 10%
   - Logs de todas operações sensíveis
   - Auditoria regular de transações

4. **Rotação de keys:**
   - Considerar rotação anual de WALLET_ENCRYPTION_KEY
   - Testar processo de recovery periodicamente

---

**Data da Implementação:** Novembro 2025
**Versão:** 1.0.0
**Status:** ✅ Produção

Para dúvidas ou suporte, consulte a equipe de desenvolvimento.
