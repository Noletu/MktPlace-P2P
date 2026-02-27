# Setup Completo - MktPlace-P2P

## Pre-requisitos
- Node.js v24+ (npm v11+)
- Git

## 1. Clonar e instalar dependencias

```bash
git clone https://github.com/Noletu/MktPlace-P2P.git
cd MktPlace-P2P
git checkout feature/v5.0-omnibus-audit-360
npm install
```

## 2. Configurar arquivos de ambiente

Copiar os arquivos da pasta `setup/` para os locais corretos:

```bash
# .env do backend (configuracoes, SMTP, chaves)
cp setup/api.env apps/api/.env

# .env.keys do backend (chave de criptografia do master seed)
cp setup/api.env.keys apps/api/.env.keys
```

## 3. Criar o banco de dados

```bash
cd apps/api
npx prisma generate
npx prisma db push
npx prisma db seed
```

O seed cria os roles RBAC (USER, SUPPORT, GERENTE, ADMIN, MASTER).

## 4. Iniciar o sistema

**Terminal 1 - Backend (porta 3002):**
```bash
cd apps/api
npx tsx watch src/index.ts
```

**Terminal 2 - Frontend (porta 3000):**
```bash
cd apps/web
npm run dev
```

## 5. Primeiro acesso

1. Acesse `http://localhost:3000/register`
2. Crie uma conta com email real (voce recebera email de boas-vindas)
3. Para promover a MASTER: abrir outro terminal e rodar:
   ```bash
   cd apps/api
   npx tsx -e "
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();
   async function main() {
     const masterRole = await prisma.role.findUnique({ where: { slug: 'master' } });
     await prisma.user.updateMany({
       where: { email: 'SEU_EMAIL_AQUI' },
       data: { roleId: masterRole.id, legacyRole: 'MASTER' }
     });
     console.log('Promovido a MASTER!');
   }
   main().then(() => process.exit());
   "
   ```

## 6. O que funciona

### Sistema de Email (SMTP Gmail configurado)
- **Email de boas-vindas**: Enviado automaticamente apos registro
- **Email de reset de senha**: Enviado via `/forgot-password`
- **Admin reset de senha**: Admin pode resetar senha de qualquer usuario em `/admin/users`
- Todos os emails chegam na caixa de entrada real (Gmail: btalktoc@gmail.com)

### Fluxo de Reset de Senha
1. `/forgot-password` → digita email → recebe link por email
2. Clica no link → `/reset-password` → define nova senha
3. Se usuario tem 2FA ativado → campo extra aparece pedindo codigo TOTP

### Admin Reset de Senha
1. Login como ADMIN/MASTER → `/admin/users`
2. Botao 🔑 (laranja) em cada usuario
3. Modal com opcao de desabilitar 2FA do usuario
4. Sistema envia email de reset automaticamente

### Funcionalidades Completas
- Registro/Login com 2FA (TOTP + backup codes)
- HD Wallet (BTC, USDT, USDC) com derivacao BIP44
- Ordens BUY/SELL com colateral
- Sistema de disputas
- Saques automaticos
- Painel admin completo (dashboard, usuarios, pedidos, audit log)
- Limites personalizados + reputacao composta
- Transferencias de platform wallets
- Omnibus architecture (hot wallet)

## Portas

| Servico  | Porta |
|----------|-------|
| Backend  | 3002  |
| Frontend | 3000  |

## Problemas Comuns

- **`prisma generate` falha com EPERM**: Pare o backend antes de rodar
- **BlockCypher 429**: Rate limit da API Bitcoin — normal, nao afeta funcionamento
- **BigInt warning**: `bigint: Failed to load bindings` — inofensivo, JS puro usado como fallback
