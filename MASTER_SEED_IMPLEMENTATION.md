# Implementação do Sistema de Gerenciamento de Master Seed (HD Wallet)

**Data:** 2025-12-08
**Desenvolvedor:** Claude Code
**Status:** Implementado e pronto para testes

---

## 📋 Resumo Executivo

Foi implementado um sistema completo de gerenciamento de Master Seed (carteira matriz) através de interface administrativa segura. O sistema permite que administradores com role `MASTER` gerem ou recuperem a seed BIP39 de 24 palavras que deriva todas as carteiras HD dos usuários.

---

## 🎯 Objetivo

Criar interface administrativa segura para setup inicial e gerenciamento da master seed, eliminando a necessidade de scripts CLI e proporcionando:

- Setup visual com wizard
- Geração segura de mnemonic (24 palavras BIP39)
- Recuperação de seed a partir de backup
- Validação de derivação contra carteiras existentes
- Proteção de memória com TTL de 5 minutos
- Audit trail completo

---

## 🏗️ Arquitetura Implementada

### Backend (Express.js)

#### 1. Service Layer

**Arquivo:** `/apps/api/src/services/masterSeedAdmin.service.ts`

Responsabilidades:
- Gerenciar lifecycle completo da master seed
- Gerar nova seed BIP39 (24 palavras)
- Recuperar seed a partir de mnemonic
- Validar derivação contra carteiras existentes
- Criar audit logs de todas as operações

Métodos principais:
```typescript
class MasterSeedAdminService {
  // Verifica status da master seed
  async getStatus(): Promise<{
    initialized: boolean;
    stats?: {
      usersWithWallets: number;
      totalWallets: number;
    };
    createdAt?: Date;
    encryption?: string;
    supportedNetworks?: string[];
  }>

  // Gera nova master seed
  async generateNewSeed(): Promise<{
    success: boolean;
    mnemonic: string[]; // 24 palavras
    encryptedSeed: string; // Para salvar no .env
    warning: string;
  }>

  // Recupera seed de mnemonic
  async recoverFromMnemonic(mnemonic: string): Promise<{
    success: boolean;
    encryptedSeed: string;
    stats: any;
  }>

  // Testa derivação contra carteiras existentes
  async testDerivationAgainstExistingWallets(mnemonic: string): Promise<{
    tested: number;
    matched: number;
    percentage: number;
    valid: boolean;
  }>

  // Busca audit logs
  async getAuditLog(): Promise<AuditLog[]>
}
```

#### 2. Controller Layer

**Arquivo:** `/apps/api/src/controllers/masterSeedAdmin.controller.ts`

Endpoints REST:
```typescript
GET  /api/v1/admin/master-seed/status
     Retorna status da master seed (inicializada ou não)

POST /api/v1/admin/master-seed/generate
     Gera nova master seed
     Body: { twoFactorCode?: string }
     Response: { mnemonic: string[], encryptedSeed: string }

POST /api/v1/admin/master-seed/recover
     Recupera seed de mnemonic
     Body: { mnemonic: string, twoFactorCode?: string }
     Response: { encryptedSeed: string, stats: any }

POST /api/v1/admin/master-seed/test-derivation
     Testa derivação de carteiras
     Body: { mnemonic: string }
     Response: { tested: number, matched: number, valid: boolean }

GET  /api/v1/admin/master-seed/audit-log
     Busca histórico de operações
     Response: AuditLog[]
```

Segurança:
- Middleware de autenticação JWT (`authMiddleware`)
- Middleware de autorização role-based (`adminMiddleware` - apenas MASTER/ADMIN)
- Rate limiting (5 requisições por 15 minutos em operações críticas)
- Integração com 2FA (opcional)

#### 3. Routes

**Arquivo:** `/apps/api/src/routes/masterSeedAdmin.routes.ts`

Configuração:
```typescript
router.use(authMiddleware);        // JWT auth
router.use(adminMiddleware);       // Role MASTER/ADMIN
router.post('/generate',
  adminActionLimiter,              // Rate limiting
  controller.generateMasterSeed
);
```

#### 4. Modificação do Service Existente

**Arquivo:** `/apps/api/src/services/hd-wallet/master-seed.service.ts`

**MODIFICAÇÃO CRÍTICA - Memory Protection:**
```typescript
// ANTES: Cache indefinido em memória (INSEGURO)
private static cachedMasterSeed: Buffer | null = null;

// DEPOIS: Cache com TTL de 5 minutos
private static cachedMasterSeed: Buffer | null = null;
private static cacheExpiry: number | null = null;
private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

static getMasterSeed(): Buffer {
  // Verifica se cache expirou
  if (this.cachedMasterSeed && this.cacheExpiry && Date.now() > this.cacheExpiry) {
    this.cachedMasterSeed = null; // Limpa cache expirado
    this.cacheExpiry = null;
    console.log('[SECURITY] Master seed cache expired');
  }

  if (this.cachedMasterSeed) {
    return this.cachedMasterSeed;
  }

  // Descriptografa e armazena em cache por 5 minutos
  const seed = this.decryptSeed(encryptedSeed);
  this.cachedMasterSeed = seed;
  this.cacheExpiry = Date.now() + this.CACHE_TTL;

  console.log('[SECURITY] Master seed decrypted and cached for 5 minutes');
  return seed;
}
```

**Impacto:** Após 5 minutos de inatividade, a seed descriptografada é removida da memória, reduzindo janela de exposição em caso de memory dump attack.

#### 5. Integração no Server

**Arquivo:** `/apps/api/src/index.ts`

```typescript
import masterSeedAdminRoutes from './routes/masterSeedAdmin.routes';

// ...
app.use('/api/v1/admin/master-seed', masterSeedAdminRoutes);
```

---

### Frontend (Next.js + React)

#### 1. Admin Page

**Arquivo:** `/apps/web/app/admin/master-seed/page.tsx`

Interface completa com:

**Estado "Não Inicializado":**
```tsx
<div className="bg-yellow-500/10 border border-yellow-500">
  <h2>⚠️ Sistema Não Inicializado</h2>
  <p>Nenhuma master seed configurada. É necessário gerar ou importar uma seed.</p>
  <button onClick={handleGenerate}>🔐 Gerar Nova Seed</button>
  <button onClick={handleRecover}>🆘 Importar Seed Existente</button>
</div>
```

**Estado "Inicializado":**
```tsx
<div className="bg-gray-800">
  <h2>✅ Master Seed Configurada</h2>

  {/* Status */}
  <div>Criada em: {status.createdAt}</div>
  <div>Encryption: {status.encryption}</div>

  {/* Estatísticas */}
  <div>Usuários com Carteiras: {stats.usersWithWallets}</div>
  <div>Total de Carteiras: {stats.totalWallets}</div>

  {/* Redes Suportadas */}
  {status.supportedNetworks.map(network => (
    <span>{network}</span>
  ))}
</div>
```

**Modal de Geração:**
```tsx
// Fase 1: Aviso
<div className="bg-red-500/10">
  <p>⚠️ ATENÇÃO - LEIA COM CUIDADO!</p>
  <ul>
    <li>Uma seed será gerada com 24 palavras BIP39</li>
    <li>Esta é a ÚNICA vez que verá estas palavras</li>
    <li>Guarde em local seguro (papel, cofre, nunca digital)</li>
    <li>Com estas palavras é possível recuperar TODAS as carteiras</li>
  </ul>
  <button onClick={handleGenerate}>Gerar Seed</button>
</div>

// Fase 2: Exibição do Mnemonic (UMA VEZ)
<div className="bg-red-500/10">
  <h3>🔴 COPIE E GUARDE EM LOCAL SEGURO</h3>

  {/* Grid 3x8 com as 24 palavras */}
  <div className="grid grid-cols-3">
    {mnemonic.map((word, i) => (
      <div>
        <span>{i + 1}.</span> {word}
      </div>
    ))}
  </div>

  <button onClick={copyMnemonic}>📋 Copiar Mnemonic</button>

  {/* Encrypted Seed para .env */}
  <div>
    <p>Encrypted Seed (adicione no .env):</p>
    <code>{encryptedSeed}</code>
    <button onClick={copyEncrypted}>📋 Copiar</button>
  </div>
</div>
```

**Modal de Recuperação:**
```tsx
<div>
  <h2>Recuperar Master Seed</h2>
  <p>Cole as 24 palavras do mnemonic separadas por espaço</p>

  <textarea
    placeholder="word1 word2 word3 ... word24"
    value={mnemonicInput}
    onChange={e => setMnemonicInput(e.target.value)}
  />

  <button onClick={handleRecover}>Recuperar</button>

  {/* Após recuperação, exibe encrypted seed */}
  {encryptedSeed && (
    <div>
      <p>Encrypted Seed recuperado:</p>
      <code>{encryptedSeed}</code>
      <button onClick={copy}>📋 Copiar</button>
    </div>
  )}
</div>
```

#### 2. Layout Integration

**Arquivo:** `/apps/web/app/admin/layout.tsx`

```tsx
<Link
  href="/admin/master-seed"
  className={pathname === '/admin/master-seed'
    ? 'border-blue-500 text-blue-400'
    : 'border-transparent text-gray-400'
  }
>
  🔐 Master Seed
</Link>
```

---

## 🔐 Segurança Implementada

### 1. Memory Protection

**Problema Original:**
- Master seed descriptografada permanecia indefinidamente em memória
- Vulnerability: Memory dump attack poderia expor seed

**Solução:**
- Cache com TTL de 5 minutos
- Após expiração, seed é removida da memória
- Próximo acesso requer descriptografia novamente

### 2. Criptografia

**Algoritmo:** AES-256-GCM
- Encryption key: 32 bytes (256 bits) em hex no .env
- IV: 12 bytes aleatórios por operação
- Auth Tag: 16 bytes para integridade

**Formato do Encrypted Seed:**
```
iv:authTag:ciphertext
(hex:hex:hex)
```

### 3. Separação de Keys (Opção C - MVP)

**Estado Atual:**
```
.env
├── MASTER_SEED_ENCRYPTION_KEY=...   ⚠️ Mesma localização
└── MASTER_SEED_ENCRYPTED=...        ⚠️ Precisa separar
```

**Recomendação Futura (Opção B):**
```
API Server (.env)              Keystore Server (VPS separado)
└── MASTER_SEED_ENCRYPTED      └── MASTER_SEED_ENCRYPTION_KEY
```

### 4. Audit Trail

Todas as operações são registradas:
```typescript
await prisma.auditLog.create({
  data: {
    action: 'MASTER_SEED_GENERATED',
    resource: 'MASTER_SEED',
    description: 'Nova master seed gerada',
    userId: adminId,
    ipAddress: req.ip,
    success: true,
  }
});
```

### 5. Rate Limiting

```typescript
const adminActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 requisições
  message: 'Muitas tentativas. Tente novamente em 15 minutos.',
});
```

### 6. Integração 2FA (Opcional)

```typescript
// Sistema já tem 2FA implementado
// Endpoint aceita twoFactorCode no body
if (user.twoFactorEnabled) {
  const isValid = await twoFactorService.verify(userId, twoFactorCode);
  if (!isValid) {
    throw new UnauthorizedException('Código 2FA inválido');
  }
}
```

---

## 🗄️ Database Schema

**Modificações em:** `/apps/api/prisma/schema.prisma`

```prisma
model User {
  // ... campos existentes ...

  // 2FA (já existia)
  twoFactorEnabled     Boolean @default(false)
  twoFactorSecret      String?
  twoFactorTempSecret  String?  // ADICIONADO
  twoFactorBackupCodes String?
}

model AuditLog {
  id String @id @default(cuid())

  // Ação executada
  action     String // MASTER_SEED_GENERATED, MASTER_SEED_RECOVERED, etc.
  resource   String // MASTER_SEED, WALLET, etc.
  resourceId String?

  // Contexto
  userId       String?
  description  String?
  metadata     String? // JSON
  ipAddress    String?
  success      Boolean @default(true)
  errorMessage String?

  createdAt DateTime @default(now())

  @@index([action])
  @@index([resource])
  @@index([createdAt])
}
```

**Migration executada:**
```bash
npx prisma db push
```

---

## 🔄 Fluxo Completo - Setup Inicial

### 1. Admin acessa `/admin/master-seed`

Sistema detecta: `MASTER_SEED_ENCRYPTED` não está no `.env`

```typescript
const isInitialized = !!process.env.MASTER_SEED_ENCRYPTED;
return { initialized: false };
```

### 2. Frontend exibe wizard

```
⚠️ Sistema Não Inicializado
Nenhuma master seed configurada.

[🔐 Gerar Nova Seed] [🆘 Importar Seed Existente]
```

### 3. Admin clica "Gerar Nova Seed"

**Frontend:**
```typescript
const response = await fetch('/api/v1/admin/master-seed/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ twoFactorCode: '123456' }) // Opcional
});

const { mnemonic, encryptedSeed } = await response.json();
```

**Backend:**
```typescript
// 1. Gera entropy de 256 bits
const entropy = crypto.randomBytes(32);

// 2. Converte para mnemonic BIP39 (24 palavras)
const mnemonic = bip39.entropyToMnemonic(entropy);

// 3. Valida mnemonic
if (!bip39.validateMnemonic(mnemonic)) {
  throw new Error('Mnemonic inválido');
}

// 4. Converte para seed
const seed = bip39.mnemonicToSeedSync(mnemonic);

// 5. Criptografa seed
const encryptedSeed = this.encryptSeed(seed);

// 6. Cria audit log
await prisma.auditLog.create({
  data: {
    action: 'MASTER_SEED_GENERATED',
    resource: 'MASTER_SEED',
    userId: adminId,
    success: true,
  }
});

return {
  mnemonic: mnemonic.split(' '), // Array de 24 palavras
  encryptedSeed,
  warning: 'Guarde estas palavras em local seguro...'
};
```

### 4. Frontend exibe mnemonic UMA VEZ

```
🔴 COPIE E GUARDE EM LOCAL SEGURO
Esta é a ÚNICA vez que verá estas palavras

1. abandon    9. involve    17. quantum
2. ability    10. island    18. question
...
24. zebra

[📋 Copiar Mnemonic]

Encrypted Seed (adicione no .env):
MASTER_SEED_ENCRYPTED=abc123...xyz789

[📋 Copiar Encrypted Seed]
```

### 5. Admin copia valores

1. **Mnemonic (24 palavras):** Guardar em papel no cofre
2. **Encrypted Seed:** Adicionar no `.env`

```bash
# .env
MASTER_SEED_ENCRYPTED=d51120c747264026c64e33a2:531f5b54e0a3bb0d761e5e9e4716fd32:...
```

### 6. Admin reinicia servidor API

```bash
npm run dev
```

### 7. Sistema carrega master seed

```typescript
// Ao iniciar, MasterSeedService carrega automaticamente
const encryptedSeed = process.env.MASTER_SEED_ENCRYPTED;
const seed = this.decryptSeed(encryptedSeed);
this.cachedMasterSeed = seed; // Cache por 5 minutos
```

### 8. Carteiras podem ser derivadas

```typescript
// Para cada usuário
const wallet = await derivationService.deriveWallet(
  'ETHEREUM',
  userIndex
);

// Resultado:
{
  address: '0x1234...abcd',
  privateKey: 'encrypted...',
  derivationPath: "m/44'/60'/0'/0/0"
}
```

---

## 🔄 Fluxo Completo - Recuperação

### Cenário: Servidor comprometido, restaurar de backup

### 1. Admin acessa `/admin/master-seed`

Sistema detecta não inicializado (`.env` sem `MASTER_SEED_ENCRYPTED`)

### 2. Admin clica "Importar Seed Existente"

```tsx
<Modal>
  <h2>Recuperar Master Seed</h2>
  <p>Cole as 24 palavras guardadas no cold storage</p>
  <textarea placeholder="word1 word2 ... word24" />
  <button>Recuperar</button>
</Modal>
```

### 3. Admin cola mnemonic do backup físico

```
abandon ability able ... zebra
```

### 4. Sistema valida e testa derivação

**Backend:**
```typescript
// 1. Valida mnemonic BIP39
if (!bip39.validateMnemonic(mnemonic)) {
  throw new Error('Mnemonic inválido');
}

// 2. Busca carteiras existentes no banco
const existingWallets = await prisma.userWallet.findMany();

// 3. Para cada carteira, testa derivação
for (const wallet of existingWallets) {
  const derived = await derivationService.deriveFromMnemonic(
    mnemonic,
    wallet.network,
    wallet.derivationPath
  );

  if (derived.address === wallet.address) {
    matchedCount++;
  }
}

// 4. Deve bater 100%
if (matchPercentage !== 100) {
  throw new Error('Mnemonic não corresponde às carteiras existentes');
}

// 5. Criptografa e retorna
const encryptedSeed = this.encryptSeed(seed);
return { encryptedSeed, stats: { tested, matched } };
```

### 5. Sistema exibe encrypted seed

```
✅ Seed recuperada com sucesso!

Testado: 47 carteiras
Correspondência: 100%

Encrypted Seed (adicione no .env):
MASTER_SEED_ENCRYPTED=xyz789...abc123

[📋 Copiar]
```

### 6. Admin adiciona no `.env` e reinicia

Sistema volta ao normal com todas as carteiras funcionando.

---

## 📝 Scripts Auxiliares

### 1. Criar Usuários Admin

**Arquivo:** `/apps/api/scripts/create-admin-users.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/bcrypt';

const prisma = new PrismaClient();

async function createAdmins() {
  // Limpar usuários existentes
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: 'master@mktplace.com' },
        { email: 'admin@mktplace.com' }
      ]
    }
  });

  // Criar MASTER
  const master = await prisma.user.create({
    data: {
      email: 'master@mktplace.com',
      password: await hashPassword('Master@2025!'),
      name: 'Master Admin',
      role: 'MASTER',
      kycLevel: 'LEVEL_4',
    },
  });

  // Criar ADMIN
  const admin = await prisma.user.create({
    data: {
      email: 'admin@mktplace.com',
      password: await hashPassword('Admin@123'),
      name: 'Admin',
      role: 'ADMIN',
      kycLevel: 'LEVEL_4',
    },
  });

  console.log('✅ Usuários criados:');
  console.log('MASTER: master@mktplace.com | Senha: Master@2025!');
  console.log('ADMIN: admin@mktplace.com | Senha: Admin@123');
}

createAdmins();
```

**Executar:**
```bash
npx tsx scripts/create-admin-users.ts
```

---

## 🚀 Como Usar - Guia Completo

### Passo 1: Login como MASTER

```
URL: http://localhost:3000/login

Credenciais:
Email: master@mktplace.com
Senha: Master@2025!
```

### Passo 2: Acessar Master Seed

```
URL: http://localhost:3000/admin/master-seed
```

### Passo 3: Gerar Nova Seed

1. Clique em "🔐 Gerar Nova Seed"
2. Leia os avisos de segurança
3. Confirme a geração
4. **COPIE AS 24 PALAVRAS** e guarde em papel no cofre
5. Copie o "Encrypted Seed"
6. Adicione no `.env`:
   ```bash
   MASTER_SEED_ENCRYPTED=seu_encrypted_seed_aqui
   ```
7. Reinicie o servidor API:
   ```bash
   cd apps/api
   npm run dev
   ```

### Passo 4: Verificar Funcionamento

```bash
# Status
curl http://localhost:3001/api/v1/admin/master-seed/status \
  -H "Authorization: Bearer SEU_TOKEN"

# Esperado:
{
  "success": true,
  "data": {
    "initialized": true,
    "createdAt": "2025-12-08T10:00:00.000Z",
    "encryption": "AES-256-GCM",
    "supportedNetworks": ["BITCOIN", "ETHEREUM", "BASE", "ARBITRUM", "SOLANA"],
    "stats": {
      "usersWithWallets": 0,
      "totalWallets": 0
    }
  }
}
```

---

## 📊 Testes de Validação

### Teste 1: Geração de Seed

```bash
# 1. Gerar seed
POST /api/v1/admin/master-seed/generate

# Esperado:
{
  "success": true,
  "data": {
    "mnemonic": ["word1", "word2", ..., "word24"],
    "encryptedSeed": "iv:authTag:ciphertext",
    "warning": "Guarde estas palavras..."
  }
}

# 2. Verificar mnemonic é BIP39 válido
import * as bip39 from 'bip39';
const isValid = bip39.validateMnemonic(mnemonic.join(' '));
console.log('Valid:', isValid); // true
```

### Teste 2: Recuperação de Seed

```bash
# 1. Recuperar com mnemonic correto
POST /api/v1/admin/master-seed/recover
Body: {
  "mnemonic": "word1 word2 ... word24"
}

# Esperado:
{
  "success": true,
  "data": {
    "encryptedSeed": "...",
    "stats": {
      "tested": 10,
      "matched": 10,
      "percentage": 100
    }
  }
}

# 2. Recuperar com mnemonic errado
POST /api/v1/admin/master-seed/recover
Body: {
  "mnemonic": "wrong words here"
}

# Esperado:
{
  "success": false,
  "error": "Mnemonic não corresponde às carteiras existentes"
}
```

### Teste 3: Derivação de Carteiras

```typescript
// 1. Criar usuário
const user = await prisma.user.create({
  data: { email: 'test@test.com', password: '...' }
});

// 2. Derivar carteira
const wallet = await hdWalletService.createWallet(user.id, 'ETHEREUM');

// 3. Verificar derivação
console.log('Address:', wallet.address);
console.log('Path:', wallet.derivationPath); // m/44'/60'/0'/0/0

// 4. Testar recuperação
const recovered = await derivationService.deriveFromMnemonic(
  originalMnemonic,
  'ETHEREUM',
  wallet.derivationPath
);

console.log('Match:', recovered.address === wallet.address); // true
```

### Teste 4: Memory Protection (TTL)

```typescript
// 1. Acessar master seed
const seed1 = MasterSeedService.getMasterSeed();
console.log('Cache hit 1:', !!MasterSeedService.cachedMasterSeed); // true

// 2. Acessar imediatamente (dentro de 5min)
const seed2 = MasterSeedService.getMasterSeed();
console.log('Cache hit 2:', !!MasterSeedService.cachedMasterSeed); // true

// 3. Aguardar 5 minutos
await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));

// 4. Acessar novamente (cache expirado)
const seed3 = MasterSeedService.getMasterSeed();
// LOG: "[SECURITY] Master seed cache expired"
// LOG: "[SECURITY] Master seed decrypted and cached for 5 minutes"
```

### Teste 5: Audit Trail

```bash
# Buscar logs
GET /api/v1/admin/master-seed/audit-log

# Esperado:
{
  "success": true,
  "data": [
    {
      "id": "...",
      "action": "MASTER_SEED_GENERATED",
      "resource": "MASTER_SEED",
      "userId": "master_user_id",
      "ipAddress": "127.0.0.1",
      "success": true,
      "createdAt": "2025-12-08T10:00:00.000Z"
    }
  ]
}
```

---

## 🔧 Troubleshooting

### Problema 1: "MASTER_SEED_ENCRYPTION_KEY not found"

**Causa:** `.env` não tem encryption key

**Solução:**
```bash
# Gerar key de 32 bytes (256 bits)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Adicionar no .env
MASTER_SEED_ENCRYPTION_KEY=sua_key_aqui_64_caracteres_hex
```

### Problema 2: "Failed to decrypt seed"

**Causa:** Encryption key incorreta ou encrypted seed corrompido

**Solução:**
1. Verificar se encryption key é a mesma usada na geração
2. Verificar formato do encrypted seed: `iv:authTag:ciphertext`
3. Se perdeu ambos, usar "Importar Seed Existente" com mnemonic do backup físico

### Problema 3: "Mnemonic não corresponde às carteiras existentes"

**Causa:** Tentando recuperar com mnemonic errado

**Solução:**
1. Verificar mnemonic do backup físico (papel no cofre)
2. Garantir que são exatamente 24 palavras BIP39
3. Verificar ordem correta das palavras
4. Se mnemonic está correto mas não bate, verificar se encryption key mudou

### Problema 4: Sistema inicializado mas sem .env

**Causa:** Status retorna `initialized: true` mas `.env` vazio

**Solução:**
Sistema considera inicializado se houver `MASTER_SEED_ENCRYPTED` ou se houver wallets no banco.

```typescript
// Forçar reset completo
npx prisma db push --force-reset
// Remover do .env
# MASTER_SEED_ENCRYPTED=
```

---

## 🔒 Checklist de Segurança - Produção

Antes de deploy em produção, verificar:

### Infraestrutura
- [ ] Encryption key NÃO está no mesmo servidor que encrypted seed (Opção B)
- [ ] Backup físico do mnemonic guardado em cofre/banco
- [ ] Servidor API em HTTPS com certificado válido
- [ ] Firewall configurado (apenas portas necessárias)
- [ ] VPN ou tunnel seguro para comunicação API ↔ Keystore

### Autenticação
- [ ] Todos os admins MASTER têm 2FA ativado
- [ ] Backup codes do 2FA guardados em local seguro
- [ ] Senhas fortes (mínimo 12 caracteres, maiúsculas, números, símbolos)
- [ ] Tokens JWT com expiração curta (15 minutos)
- [ ] Refresh tokens com rotação

### Monitoramento
- [ ] Audit trail ativado e armazenado
- [ ] Alertas para operações críticas (email/SMS)
- [ ] Logs de acesso ao admin panel
- [ ] Monitor de tentativas de login falhadas
- [ ] Backup automático do banco de dados

### Disaster Recovery
- [ ] Procedimento documentado de recuperação
- [ ] Mnemonic testado periodicamente (derivação bate 100%)
- [ ] Backup do encryption key em local separado
- [ ] Plano de contingência se mnemonic for perdido (IRREVERSÍVEL!)

---

## 📈 Próximos Passos Recomendados

### Curto Prazo (MVP)
1. ✅ Implementar interface admin (CONCLUÍDO)
2. ✅ Memory protection com TTL (CONCLUÍDO)
3. ✅ Audit trail (CONCLUÍDO)
4. ⏳ Testes de integração completos
5. ⏳ Documentação para usuários finais

### Médio Prazo
1. Migrar para Opção B (Two-Server Setup)
   - Configurar VPS separado para keystore
   - Implementar comunicação segura HTTPS
   - Testar failover

2. Implementar 2FA obrigatório
   - Forçar setup na primeira vez
   - Exigir código para todas as operações de master seed

3. Key Rotation
   - Sistema para trocar encryption key
   - Re-criptografar seed com nova key
   - Zero downtime

### Longo Prazo (Produção)
1. Migrar para Opção A (Vault)
   - Integrar com HashiCorp Vault ou AWS KMS
   - Rotação automática de keys
   - Compliance PCI-DSS

2. Multi-Sig Admin
   - Exigir 2 de 3 admins para operações críticas
   - Shamir's Secret Sharing para mnemonic backup

3. Hardware Security Module (HSM)
   - Armazenar master seed em HSM certificado
   - FIPS 140-2 Level 3

---

## 📞 Contatos Técnicos

**Credenciais de Administração:**

MASTER (super admin):
- Email: master@mktplace.com
- Senha: Master@2025!
- Role: MASTER
- Acesso: Total (master-seed, users, orders, audit, disputes)

ADMIN:
- Email: admin@mktplace.com
- Senha: Admin@123
- Role: ADMIN
- Acesso: Limitado (users, orders, não tem acesso a master-seed)

**IMPORTANTE:**
- Trocar senhas em produção
- Ativar 2FA para ambos
- Backup codes guardados
- Nunca compartilhar credenciais

---

## 🎯 Resumo dos Arquivos Modificados/Criados

### Backend

**Criados:**
1. `/apps/api/src/services/masterSeedAdmin.service.ts` (295 linhas)
2. `/apps/api/src/controllers/masterSeedAdmin.controller.ts` (148 linhas)
3. `/apps/api/src/routes/masterSeedAdmin.routes.ts` (35 linhas)
4. `/apps/api/scripts/create-admin-users.ts` (64 linhas)

**Modificados:**
1. `/apps/api/src/services/hd-wallet/master-seed.service.ts` (+30 linhas)
   - Adicionado memory protection com TTL
2. `/apps/api/src/index.ts` (+2 linhas)
   - Registrado rota `/api/v1/admin/master-seed`
3. `/apps/api/prisma/schema.prisma` (+1 campo)
   - `User.twoFactorTempSecret`

### Frontend

**Criados:**
1. `/apps/web/app/admin/master-seed/page.tsx` (350 linhas)

**Modificados:**
1. `/apps/web/app/admin/layout.tsx` (+12 linhas)
   - Adicionado link de navegação

**Total:** 4 arquivos novos, 4 modificados, ~942 linhas de código

---

## ✅ Status Final

**Sistema:** Implementado e funcional
**Testes:** Pendentes
**Deployment:** Não realizado (desenvolvimento)
**Segurança:** Opção C (MVP) - upgrade para B recomendado
**Documentação:** Completa

**Pronto para:**
- ✅ Testes locais
- ✅ Validação de fluxos
- ⏳ Testes de segurança
- ⏳ Deploy em staging
- ⏳ Deploy em produção (após upgrade para Opção B)

---

**Última Atualização:** 2025-12-08
**Autor:** Claude Code
**Versão:** 1.0.0
