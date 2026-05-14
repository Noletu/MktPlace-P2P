# 🎟️ Sistema de Cupons de Desconto

**Data de Implementação**: 14/01/2026
**Última Atualização**: 17/01/2026
**Versão**: v4.1.3
**Status**: ✅ Implementado e Funcional

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Funcionalidades](#funcionalidades)
4. [API Endpoints](#api-endpoints)
5. [Fluxo de Uso](#fluxo-de-uso)
6. [Validações](#validações)
7. [Exemplos de Uso](#exemplos-de-uso)
8. [Como Testar](#como-testar)

---

## Visão Geral

O Sistema de Cupons permite que administradores criem cupons promocionais que concedem descontos nas taxas da plataforma. Os cupons podem ser públicos (visíveis para todos) ou secretos (apenas por código).

### Características Principais

- **Desconto**: 1-100% aplicado SOMENTE à taxa da plataforma (1.5%)
- **Cashback**: O cashback do comprador (1%) permanece INALTERADO
- **Expiração**: Por data OU limite de usos por usuário (o que vier primeiro)
- **Visibilidade**: Híbrido (público ou secreto)
- **Ativação**: Apenas 1 cupom ativo por vez por usuário
- **Aplicação**: Automática ao criar pedido

### Exemplo de Cálculo

```
Sem cupom:
- Taxa da plataforma: 1.5%
- Cashback: 1%
- Taxa total: 2.5%

Com cupom MKTPLACE50 (50% de desconto):
- Taxa da plataforma: 0.75% (1.5% - 50%)
- Cashback: 1% (inalterado)
- Taxa total: 1.75%

Com cupom MKTPLACE100 (100% de desconto):
- Taxa da plataforma: 0% (1.5% - 100%)
- Cashback: 1% (inalterado)
- Taxa total: 1%
```

---

## Arquitetura

### Database Models

#### Coupon
```prisma
model Coupon {
  id                  String      @id @default(cuid())
  code                String      @unique
  discountPercentage  Int
  maxUsesPerUser      Int
  expiresAt           DateTime?
  isPublic            Boolean     @default(false)
  isActive            Boolean     @default(true)
  totalUses           Int         @default(0)
  description         String?
  createdBy           String?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  userCoupons         UserCoupon[]
}
```

#### UserCoupon
```prisma
model UserCoupon {
  id            String    @id @default(cuid())
  userId        String
  couponId      String
  isActive      Boolean   @default(false)
  timesUsed     Int       @default(0)
  activatedAt   DateTime?
  deactivatedAt DateTime?
  firstUsedAt   DateTime?
  lastUsedAt    DateTime?

  @@unique([userId, couponId])
}
```

### Backend Structure

```
apps/api/src/
├── validators/
│   └── coupon.validator.ts       # Zod schemas
├── services/
│   └── coupon.service.ts          # Business logic
├── controllers/
│   └── coupon.controller.ts       # HTTP handlers
└── routes/
    └── coupon.routes.ts           # Route definitions
```

---

## Funcionalidades

### Admin (ADMIN + MASTER)

1. **Criar Cupom**
   - Código único (3-20 caracteres, uppercase, alfanumérico)
   - Desconto de 1-100%
   - Limite de uso por usuário
   - Data de expiração (opcional)
   - Descrição (opcional)
   - Visibilidade (público/secreto)
   - Status (ativo/inativo)

2. **Editar Cupom**
   - Alterar desconto, limite de uso, expiração, visibilidade
   - **Código NÃO pode ser editado**

3. **Deletar Cupom**
   - Remove cupom e todos os relacionamentos (cascade)

4. **Listar Cupons**
   - Filtros: busca por código, status, visibilidade
   - Estatísticas: total, ativos, total de usos

### Usuário (CLIENT)

1. **Visualizar Cupons Públicos**
   - Lista de cupons disponíveis
   - Desconto, limite de uso, expiração

2. **Ativar Cupom**
   - Inserir código manualmente OU clicar em cupom público
   - Apenas 1 cupom ativo por vez

3. **Desativar Cupom**
   - Remover cupom ativo a qualquer momento

4. **Usar Cupom Automaticamente**
   - Ao criar pedido, desconto é aplicado automaticamente
   - Contador de uso incrementado

---

## API Endpoints

### User Endpoints (authMiddleware)

#### GET /api/v1/coupons/public
Lista cupons públicos disponíveis.

#### GET /api/v1/coupons/active
Retorna cupom ativo do usuário.

#### POST /api/v1/coupons/activate
Ativa um cupom por código.

**Body**:
```json
{
  "code": "MKTPLACE50"
}
```

#### POST /api/v1/coupons/deactivate
Desativa cupom ativo.

### Admin Endpoints (adminMiddleware)

#### GET /api/v1/coupons
Lista todos os cupons (com filtros).

**Query Params**:
- `search`: Busca por código
- `status`: ALL | ACTIVE | INACTIVE | EXPIRED
- `visibility`: ALL | PUBLIC | SECRET

#### GET /api/v1/coupons/stats
Estatísticas gerais.

#### GET /api/v1/coupons/:id
Detalhes de um cupom específico.

#### POST /api/v1/coupons
Cria novo cupom.

**Body**:
```json
{
  "code": "MKTPLACE50",
  "discountPercentage": 50,
  "maxUsesPerUser": 3,
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "isPublic": true,
  "isActive": true,
  "description": "Cupom de 50% de desconto"
}
```

#### PUT /api/v1/coupons/:id
Atualiza cupom existente.

#### DELETE /api/v1/coupons/:id
Deleta cupom (cascade).

---

## Fluxo de Uso

### 1. Admin Cria Cupom

```
Admin acessa /admin/coupons
  → Preenche formulário de criação
  → POST /api/v1/coupons
  → Cupom criado no banco
  → Audit log registrado
```

### 2. Usuário Ativa Cupom

```
User acessa /profile
  → Vê lista de cupons públicos OU digita código
  → Clica "Ativar" ou insere código manualmente
  → POST /api/v1/coupons/activate
  → Validações executadas
  → UserCoupon criado/atualizado com isActive=true
  → Cupom aparece como ativo no perfil
```

### 3. Usuário Cria Pedido

```
User acessa /orders/create
  → Preenche formulário de pedido
  → POST /api/v1/orders
  → Backend:
      1. calculateFees(cryptoAmount, userId)
         - Busca cupom ativo
         - Aplica desconto à taxa da plataforma
      2. createOrderWithWalletBalance()
         - Salva order com campos de cupom
         - Incrementa contadores de uso
  → Order criado com desconto aplicado
```

---

## Validações

### Criar Cupom (Admin)
- ✅ Código único (não pode existir outro com mesmo código)
- ✅ Código: 3-20 caracteres, uppercase, alfanumérico
- ✅ Desconto: 1-100%
- ✅ Limite de uso: mínimo 0 (0 = ilimitado)

### Ativar Cupom (User)
- ✅ Cupom existe e está ativo
- ✅ Cupom não expirado
- ✅ Usuário não atingiu limite de uso
- ✅ Usuário não tem outro cupom ativo

---

## Exemplos de Uso

### Exemplo 1: Cupom de Boas-Vindas

**Admin cria**:
```json
{
  "code": "BEMVINDO20",
  "discountPercentage": 20,
  "maxUsesPerUser": 1,
  "isPublic": true,
  "description": "20% de desconto para novos usuários"
}
```

**Resultado**: Taxa 1.5% → 1.2% (economia de 0.3%)

### Exemplo 2: Cupom Secreto VIP

**Admin cria**:
```json
{
  "code": "SECRET50",
  "discountPercentage": 50,
  "maxUsesPerUser": 5,
  "expiresAt": "2025-02-01T00:00:00.000Z",
  "isPublic": false,
  "description": "Cupom exclusivo para clientes VIP"
}
```

**Resultado**: Taxa 1.5% → 0.75% (economia de 0.75%)

### Exemplo 3: Black Friday

**Admin cria**:
```json
{
  "code": "BLACKFRIDAY100",
  "discountPercentage": 100,
  "maxUsesPerUser": 1,
  "isPublic": true,
  "description": "BLACK FRIDAY: Taxa ZERO!"
}
```

**Resultado**: Taxa 1.5% → 0% (taxa ZERO!)

---

## Como Testar

### 1. Teste Admin - Criar Cupom

```bash
POST /api/v1/coupons
Authorization: Bearer <admin_token>
{
  "code": "TESTE50",
  "discountPercentage": 50,
  "maxUsesPerUser": 3,
  "isPublic": true
}
```

### 2. Teste User - Ativar Cupom

```bash
POST /api/v1/coupons/activate
Authorization: Bearer <user_token>
{
  "code": "TESTE50"
}
```

### 3. Teste User - Criar Pedido

```bash
POST /api/v1/orders
Authorization: Bearer <user_token>
{
  "type": "BUY",
  "cryptoType": "BTC",
  "cryptoAmount": "0.01",
  "brlAmount": "3000.00",
  ...
}
```

### 4. Verificar Desconto Aplicado

```bash
GET /api/v1/orders/:orderId
# Verificar campos: appliedCouponCode, discountAmount
```

---

## Observações Importantes

### Performance
- Para alta carga, considerar cache Redis para `getActiveCoupon()`

### Segurança
- Rate limiting aplicado em rotas admin
- Audit log registra todas operações
- Validação server-side estrita

### UX
- Apenas 1 cupom ativo simplifica experiência
- Mensagens de erro claras
- Cupom ativo destacado em verde

### Business Rules
- Cupom aplicado no momento da criação do pedido
- Usuário pode trocar de cupom a qualquer momento
- Admin pode desativar cupom globalmente

---

## Novidades v4.1.0 (16/01/2026)

### Visualização de Desconto em Tempo Real

Na tela de criação de pedido (`/orders/create`), o usuário agora vê:

1. **Banner do Cupom Ativo**
   - Código do cupom em destaque
   - Percentual de desconto

2. **Comparação de Taxas**
   - Taxa original (1.5%) riscada
   - Taxa com desconto calculada
   - Valor da economia em crypto

3. **Taxa Total Atualizada**
   - Percentual recalculado automaticamente

```
┌─────────────────────────────────────┐
│ 🎟️ Cupom TESTE100                   │
│    100% de desconto na taxa   -100% │
└─────────────────────────────────────┘

Taxa original (1.5%)     0.00000300 BTC (riscado)
Taxa com desconto (0%)   0.00000000 BTC

💰 Você economiza: 0.00000300 BTC

Recompensa do pagador (1%)
0.00000200 BTC

Taxa total (1%)
0.00000200 BTC
```

### Opção "Ilimitado" para Limite de Uso

Agora é possível criar cupons com uso ilimitado por usuário:

- **Valor**: `maxUsesPerUser = 0` representa ilimitado
- **Admin**: Checkbox "Ilimitado" no formulário de criação
- **Tabela**: Exibe "Ilimitado" ao invés de "0x"
- **Perfil**: Exibe "Uso ilimitado" para o usuário

### Correções de Bugs

1. **Cupom sem efeito nas taxas** - Corrigido! Incremento de contadores agora é atômico dentro da transaction
2. **Status "Expirado"** - Agora exibe corretamente quando `expiresAt < now`
3. **Hora na validade** - Exibe data E hora no formato pt-BR
4. **Erro ao criar cupom** - Corrigida conversão para ISO 8601

---

**Documentação criada em**: 14/01/2026
**Última atualização**: 17/01/2026
**Versão do documento**: 1.2
