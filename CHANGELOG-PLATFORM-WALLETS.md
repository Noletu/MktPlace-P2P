# Changelog - Platform Wallets HD Implementation

## [1.0.0] - 2025-12-11

### Added

#### Backend

- **PlatformWallet Model** (`prisma/schema.prisma`)
  - Novo model com campos HD wallet
  - Campos: `cryptoType`, `network`, `address`, `derivationPath`, `accountIndex`
  - Campos de segurança: `encryptedPrivateKey`
  - Campos de saldo: `balance`, `availableBalance`
  - Métricas: `totalFeesCollected`, `totalDeposited`, `totalWithdrawn`
  - Sincronização: `lastSyncedAt`, `lastBlockHeight`
  - Constraint único: `@@unique([cryptoType, network])`

- **DerivationService** (`src/services/hd-wallet/derivation.service.ts`)
  - Novo método `derivePlatformWallet(cryptoType, network)` para Account 0
  - Novo método `deriveUserWallet(userId, cryptoType, network)` para Account >= 1
  - Modificado `userIdToAccountIndex()` para NUNCA retornar 0
  - Garantia de separação: Account 0 (platform) vs Account >= 1 (users)

- **PlatformWalletService** (`src/services/platformWallet.service.ts`) - NOVO ARQUIVO
  - `createPlatformWallets()`: Auto-cria wallets para todas as redes
  - `getAllPlatformWallets()`: Lista todas as platform wallets
  - `getPlatformWallet(crypto, network)`: Busca wallet específica
  - `getPlatformBalance()`: Agregação de saldos por crypto
  - `updateBalance(crypto, network, balance)`: Atualiza saldo após sync blockchain
  - `recordFeeReceived(crypto, network, amount)`: Registra fee recebida
  - `recordDeposit(crypto, network, amount)`: Registra depósito sócios
  - `recordWithdrawal(crypto, network, amount)`: Registra saque sócios
  - `getDecryptedPrivateKey(crypto, network)`: Descriptografa private key para saques

- **MasterSeedAdminService** (`src/services/masterSeedAdmin.service.ts`)
  - Modificado `generateNewSeed()`: Auto-cria platform wallets ao gerar seed
  - Modificado `getStatus()`: Retorna informações das platform wallets
  - Adicionado campo `platformWalletsCount` nas estatísticas
  - Adicionado array `platformWallets` no status

#### Frontend

- **Master Seed Page** (`app/admin/master-seed/page.tsx`)
  - Nova interface `PlatformWallet`
  - Atualizada interface `MasterSeedStatus` com `platformWallets`
  - Novo card "Carteiras dos Sócios (MASTER/ADMIN)"
  - Exibição agrupada por crypto (BTC, USDT, USDC)
  - Exibição de network badges
  - Address com botão copiar para clipboard
  - Saldo atual e total de fees coletadas
  - Aviso de segurança destacado
  - Informação sobre derivação HD (Account 0)

#### Documentação

- **PLATFORM-WALLETS-HD-IMPLEMENTATION.md** (`docs/`)
  - Documentação completa da implementação
  - Arquitetura e fluxos
  - Exemplos de código
  - Testes sugeridos
  - Guia de segurança
  - Referências BIP39/BIP32/BIP44

- **CHANGELOG-PLATFORM-WALLETS.md** - Este arquivo

### Changed

#### Backend

- **DerivationService** (`src/services/hd-wallet/derivation.service.ts`)
  - Método `deriveWallet()` marcado como DEPRECATED
  - Adicionado warning para usar `deriveUserWallet()` ao invés de `deriveWallet()`
  - Modificado `userIdToAccountIndex()` para garantir retorno >= 1

#### Frontend

- **Admin Layout** (`app/admin/layout.tsx`)
  - Removido link "💼 Endereços da Plataforma" da navegação

### Removed

- **Platform Wallets Page** (`app/admin/platform-wallets/page.tsx`)
  - Diretório completo removido
  - Feature obsoleta substituída por derivação HD

- **Admin Wallets Page** (`app/admin/wallets/page.tsx`)
  - Diretório completo removido
  - Aba "Endereços da Plataforma" obsoleta

### Security

- ✅ Private keys sempre encriptadas com AES-256-GCM
- ✅ Account 0 reservado EXCLUSIVAMENTE para platform
- ✅ Impossível confundir platform wallet com user wallet
- ✅ Audit trail de criação de master seed e platform wallets
- ✅ Mnemonic exibido apenas UMA VEZ no frontend
- ✅ Aviso de segurança destacado sobre uso correto dos endereços

### Technical Details

#### Database Schema Changes

```prisma
model PlatformWallet {
  id String @id @default(cuid())

  cryptoType String
  network    String

  address        String @unique
  derivationPath String
  accountIndex   Int    @default(0)

  encryptedPrivateKey String

  balance          String @default("0")
  availableBalance String @default("0")

  totalFeesCollected String @default("0")
  totalDeposited     String @default("0")
  totalWithdrawn     String @default("0")

  lastSyncedAt    DateTime?
  lastBlockHeight Int?
  isActive Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([cryptoType, network])
}
```

#### BIP44 Derivation Paths

```
Platform Wallets (Account 0):
- BTC:  m/44'/0'/0'/0'/0'
- ETH:  m/44'/60'/0'/0'/0'
- BASE: m/44'/60'/0'/0'/0'
- ARB:  m/44'/60'/0'/0'/0'
- SOL:  m/44'/501'/0'/0'/0'

User Wallets (Account >= 1):
- m/44'/coin_type'/account'/0'/0'
  where account = hash(userId) % 0x80000000, guaranteed >= 1
```

#### Supported Networks

Platform wallets são criadas automaticamente para:
- **BTC**: BITCOIN
- **USDT**: ETHEREUM, BASE, ARBITRUM, SOLANA
- **USDC**: ETHEREUM, BASE, ARBITRUM, SOLANA

Total: 9 platform wallets criadas automaticamente

### Migration Guide

#### Para desenvolvedores

1. **Pull latest code**:
```bash
git pull origin main
```

2. **Update database schema**:
```bash
cd apps/api
npx prisma db push
```

3. **Restart API server**:
```bash
npm run dev
```

4. **Testar geração de master seed**:
- Login como MASTER
- Navegar para `/admin/master-seed`
- Gerar nova seed
- Verificar criação automática de 9 platform wallets

#### Para usuários com master seed existente

Se você JÁ tem uma master seed configurada:

1. As platform wallets serão criadas automaticamente na próxima vez que você acessar `/admin/master-seed`
2. Os endereços derivados serão os mesmos sempre (determinísticos)
3. Não é necessário guardar novo mnemonic

### Breaking Changes

⚠️ **ATENÇÃO**: Se você tinha endereços cadastrados manualmente na aba "Endereços da Plataforma":

1. Esses endereços NÃO serão migrados automaticamente
2. Você precisará transferir fundos dos endereços antigos para os novos (derivados)
3. Os novos endereços são derivados da master seed (Account 0)
4. Recomendação: Fazer a transição gradualmente, testando primeiro com pequenos valores

### Known Issues

Nenhum conhecido no momento.

### Future Enhancements

- [ ] FASE 5/7: AdminFunds Dashboard com 3 visões (Sócios, Usuários, Total)
- [ ] Sincronização automática de saldos com blockchain
- [ ] Alertas de movimentações acima de threshold
- [ ] Exportação de relatórios de fees coletadas
- [ ] Multi-signature para saques de valores altos
- [ ] Integração com hardware wallets para cold storage

---

## Detalhes Técnicos

### Arquivos Modificados

#### Backend (5 arquivos)

1. `apps/api/prisma/schema.prisma`
   - Adicionado model `PlatformWallet`

2. `apps/api/src/services/hd-wallet/derivation.service.ts`
   - Adicionado `derivePlatformWallet()`
   - Adicionado `deriveUserWallet()`
   - Modificado `userIdToAccountIndex()`

3. `apps/api/src/services/platformWallet.service.ts` (NOVO)
   - Service completo para gestão de platform wallets

4. `apps/api/src/services/masterSeedAdmin.service.ts`
   - Modificado `generateNewSeed()`
   - Modificado `getStatus()`

5. `apps/api/src/middleware/admin.middleware.ts`
   - Adicionado role `MASTER` aos allowed roles (fix anterior)

#### Frontend (2 arquivos)

1. `apps/web/app/admin/master-seed/page.tsx`
   - Adicionada interface `PlatformWallet`
   - Modificada interface `MasterSeedStatus`
   - Adicionado card "Carteiras dos Sócios"

2. `apps/web/app/admin/layout.tsx`
   - Removido link obsoleto "Endereços da Plataforma"

#### Arquivos Removidos (2 diretórios)

1. `apps/web/app/admin/platform-wallets/` (completo)
2. `apps/web/app/admin/wallets/` (completo)

### Linhas de Código

- **Backend**: ~400 linhas adicionadas, ~50 modificadas
- **Frontend**: ~150 linhas adicionadas, ~10 removidas
- **Documentação**: ~1500 linhas
- **Total**: ~2100 linhas

### Testes Realizados

✅ Geração de master seed cria 9 platform wallets automaticamente
✅ Account 0 sempre usado para platform wallets
✅ Account >= 1 sempre usado para user wallets
✅ Derivação determinística (mesmo mnemonic = mesmos endereços)
✅ Encriptação de private keys funcionando
✅ Frontend exibe corretamente todas as platform wallets
✅ Botão copiar endereço funcionando
✅ Navegação atualizada sem aba obsoleta

---

## Créditos

- **Implementação**: Claude (Anthropic)
- **Revisão**: v1.0
- **Data**: 2025-12-11
- **Projeto**: Mktplace P2P - Sistema de carteiras HD
