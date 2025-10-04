# Mktplace da Liberdade - API

API REST para o marketplace P2P de pagamento de contas com criptomoedas.

## 📋 Descrição

Esta API permite que usuários:
- Criem pedidos de pagamento (boleto/PIX) oferecendo crypto
- Aceitem pedidos pagando em BRL e recebendo crypto + 1% cashback
- Plataforma recebe apenas crypto (1.5% de taxa)

## 🚀 Tecnologias

- **Node.js** + **TypeScript**
- **Express** - Framework web
- **Prisma** - ORM
- **SQLite** - Database (desenvolvimento)
- **JWT** - Autenticação
- **Zod** - Validação de dados
- **bcryptjs** - Hash de senhas

## 📦 Instalação

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## 🔐 Autenticação

Todas as rotas protegidas requerem token JWT no header:
```
Authorization: Bearer <token>
```

## 📚 Endpoints

### Authentication (`/api/v1/auth`)

#### POST /register
Registrar novo usuário

**Body:**
```json
{
  "email": "user@example.com",
  "cpf": "12345678900",
  "password": "senha123",
  "name": "João Silva",
  "phone": "11999999999"
}
```

**Response:**
```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "cpf": "12345678900",
    "kycLevel": "NONE"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /login
Login de usuário

**Body:**
```json
{
  "email": "user@example.com",
  "password": "senha123"
}
```

#### GET /me
Obter dados do usuário autenticado (requer auth)

---

### KYC (`/api/v1/kyc`)

Todos os endpoints requerem autenticação.

#### POST /level1
Submeter dados KYC Level 1 (limite R$ 500)

**Body:**
```json
{
  "fullName": "João Silva",
  "dateOfBirth": "1990-01-01",
  "address": {
    "street": "Rua ABC",
    "number": "123",
    "complement": "Apto 45",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234567"
  }
}
```

#### GET /status
Obter status KYC do usuário

**Response:**
```json
{
  "kycLevel": "LEVEL_1",
  "kycData": { ... },
  "transactionLimit": 500
}
```

#### POST /check-limit
Verificar se pode realizar transação

**Body:**
```json
{
  "amount": 300.00
}
```

---

### Prices (`/api/v1/prices`)

#### GET /
Obter todas as cotações

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "crypto": "BTC",
      "brlPrice": "350000.00",
      "usdPrice": "70000.00",
      "timestamp": "2025-10-04T..."
    }
  ]
}
```

#### GET /:crypto
Obter cotação específica (BTC, ETH, XMR, ZEC, USDC, USDT)

#### POST /convert
Converter BRL <-> Crypto

**Body:**
```json
{
  "amount": 1000,
  "crypto": "BTC",
  "direction": "brl_to_crypto"
}
```

---

### Wallets (`/api/v1/wallets`)

Todos os endpoints requerem autenticação.

#### POST /
Criar carteira

**Body:**
```json
{
  "crypto": "BTC",
  "network": "BITCOIN",
  "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
}
```

#### GET /
Listar carteiras do usuário

#### GET /:walletId
Obter carteira específica

#### DELETE /:walletId
Desativar carteira (requer saldo zero)

---

### Orders (`/api/v1/orders`)

Todos os endpoints requerem autenticação.

#### POST /
Criar pedido

**Body:**
```json
{
  "type": "PIX",
  "cryptoType": "BTC",
  "cryptoNetwork": "BITCOIN",
  "cryptoAmount": "0.01",
  "brlAmount": "3500.00",
  "orderData": {
    "pixKey": "11999999999",
    "pixKeyType": "PHONE",
    "recipientName": "João Silva"
  }
}
```

Para boleto:
```json
{
  "type": "BOLETO",
  "cryptoType": "BTC",
  "cryptoNetwork": "BITCOIN",
  "cryptoAmount": "0.01",
  "brlAmount": "3500.00",
  "orderData": {
    "barcode": "34191790010104351004791020150008884370026000",
    "dueDate": "2025-10-10",
    "recipientName": "Empresa XYZ",
    "recipientDocument": "12345678000190"
  }
}
```

#### GET /marketplace
Listar pedidos disponíveis (exclui pedidos do próprio usuário)

#### GET /my-orders
Listar pedidos do usuário

#### GET /:orderId
Obter detalhes do pedido

#### POST /:orderId/match
Aceitar pedido (fazer match)

#### POST /:orderId/cancel
Cancelar pedido

---

### Transactions (`/api/v1/transactions`)

Todos os endpoints requerem autenticação.

#### POST /submit-proof
Submeter comprovante de pagamento

**Body:**
```json
{
  "transactionId": "...",
  "comprovanteData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..."
}
```

#### GET /my-transactions
Listar transações do usuário

#### GET /:transactionId
Obter detalhes da transação

#### POST /:transactionId/validate
Validar comprovante (admin/system)

**Body:**
```json
{
  "approved": true,
  "validationScore": 95,
  "reason": "Comprovante válido"
}
```

#### POST /:transactionId/dispute
Criar disputa

**Body:**
```json
{
  "reason": "Pagamento não foi reconhecido pelo vendedor",
  "disputeData": { ... }
}
```

---

## 💰 Sistema de Taxas

- **Taxa da Plataforma**: 1.5% (em crypto)
- **Cashback do Pagador**: 1% (em crypto)
- **Taxa Total**: 2.5% (em crypto)

### Exemplo:
- Pedido: R$ 1.000 em BTC
- Cotação BTC: R$ 350.000
- BTC total: 0.00285714
- Taxa plataforma (1.5%): 0.00004286 BTC
- Cashback pagador (1%): 0.00002857 BTC
- Taxa total (2.5%): 0.00007143 BTC
- **Criador recebe**: 0.00278571 BTC
- **Pagador recebe**: 0.00002857 BTC

## 🎯 Limites KYC

| Nível | Limite | Requisitos |
|-------|--------|-----------|
| NONE | R$ 0 | Cadastro básico |
| LEVEL_1 | R$ 500 | Nome, data nascimento, endereço |
| LEVEL_2 | R$ 2.000 | Documento com foto (RG/CNH) |
| LEVEL_3 | R$ 10.000 | Selfie + liveness |
| LEVEL_4 | Ilimitado | Comprovante de residência |

## 🔄 Fluxo de Transação

1. **Usuário A** cria pedido oferecendo crypto
2. Pedido aparece no marketplace
3. **Usuário B** aceita (match)
4. **Usuário B** efetua pagamento PIX/Boleto
5. **Usuário B** envia comprovante
6. Sistema valida comprovante (auto ou manual)
7. Se aprovado:
   - Crypto transferido para carteiras
   - Taxas calculadas e distribuídas
   - Reputação atualizada

## 🛡️ Segurança

- Senhas hasheadas com bcrypt (salt rounds: 10)
- JWT com expiração de 7 dias
- CORS configurado
- Helmet para headers de segurança
- Validação de dados com Zod
- Rate limiting (TODO)

## 📊 Status Codes

- `200` - Sucesso
- `201` - Criado
- `400` - Erro de validação
- `401` - Não autenticado
- `403` - Não autorizado
- `404` - Não encontrado
- `500` - Erro interno

## 🧪 Desenvolvimento

```bash
# Modo desenvolvimento com hot reload
npm run dev

# Build para produção
npm run build

# Executar produção
npm start

# Gerar cliente Prisma
npx prisma generate

# Criar nova migration
npx prisma migrate dev --name nome_da_migration

# Reset database
npx prisma migrate reset
```

## 📝 Variáveis de Ambiente

Ver arquivo `.env.example`

## 🚧 TODO

- [ ] Implementar rate limiting
- [ ] Adicionar upload real de imagens (S3/CloudFlare)
- [ ] Validação OCR de comprovantes
- [ ] Sistema de notificações (email/SMS)
- [ ] Webhooks para integrações
- [ ] Admin dashboard
- [ ] Logs estruturados
- [ ] Métricas e monitoring
- [ ] Testes automatizados
