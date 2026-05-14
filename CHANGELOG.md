# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [4.2.0] - 2026-02-15

### Adicionado

#### Swap BRL/CRYPTO em Ordens BUY
- **Funcionalidade**: Ordens BUY agora suportam input em BRL alem de crypto
- **Antes**: Usuario so podia digitar quantidade em crypto (ex: 0.001 BTC)
- **Depois**: Usuario pode alternar entre digitar em crypto OU em BRL (ex: R$ 500)
- **Botao swap**: Pill com setas identico ao existente nas ordens SELL
- **Calculos**:
  - Crypto -> BRL: `cryptoAmount * price * 1.025` (2.5% markup)
  - BRL -> Crypto: `brlAmount / price / 1.025` (reverso com markup)
  - Decimais: 8 para BTC, 2 para USDC/USDT
- **States adicionados**: `buyInputCurrency`, `buyBrlInput` (separados do SELL)
- **Memos adicionados**: `buyCalculatedCrypto`, `effectiveBuyCryptoAmount`
- **Arquivo modificado**: `apps/web/app/orders/create/page.tsx`

### Em Desenvolvimento

#### Historico de Reputacao (Planejado)
- **Objetivo**: Mostrar ao usuario um historico detalhado de pontos ganhos/perdidos
- **Status**: Plano aprovado, implementacao pendente
- **Escopo**:
  - Novo model `ReputationHistory` no Prisma (change, previous, current, reason, referenceId)
  - Registro automatico em `transaction.service.ts` (+10 por transacao) e `dispute.service.ts` (-20 por disputa perdida)
  - Novo endpoint `GET /auth/reputation-history`
  - Nova secao visual no perfil (`/profile`) com timeline de alteracoes

---

## [4.1.3] - 2026-01-17

### Corrigido

#### Segurança - Usuários Bloqueados Podiam Aceitar Pedidos
- **Bug Crítico**: FASE 11 (v4.1.2) bloqueou criação de pedidos, mas usuários bloqueados ainda podiam aceitar pedidos no marketplace
- **Causa**: Método `matchOrder()` não verificava `accountFrozen` do pagador
- **Solução**: Adicionada verificação de conta congelada em `matchOrder()` com desbloqueio automático para freezes temporários expirados
- **Arquivo modificado**: `apps/api/src/services/order.service.ts`

---

## [4.1.2] - 2026-01-17

### Corrigido

#### Segurança - Usuários Bloqueados Podiam Criar Pedidos
- **Bug Crítico**: Usuários com conta congelada (bloqueados pelo admin) ainda conseguiam criar pedidos
- **Evidência**: Audit log mostrava FREEZE_ACCOUNT seguido de ORDER_CREATE pelo mesmo usuário
- **Solução**: Implementada validação em 3 camadas (defense in depth):
  1. **Backend Service** (`order.service.ts`): Verificação em `validateOrderCreation()` com desbloqueio automático para freezes temporários expirados
  2. **Backend Controller** (`order.controller.ts`): Verificação rápida como segunda camada de segurança
  3. **Frontend** (`orders/create/page.tsx`): Banner vermelho "Conta Suspensa" + botão desabilitado
- **Arquivos modificados**:
  - `apps/api/src/services/order.service.ts`
  - `apps/api/src/controllers/order.controller.ts`
  - `apps/web/app/orders/create/page.tsx`

### Melhorado
- Mensagens de erro mais claras para usuários bloqueados (mostra motivo e data de expiração)
- Desbloqueio automático quando `frozenUntil` expira

---

## [4.1.1] - 2026-01-17

### Melhorado

#### Menu Admin - Alinhamento de Ícones
- **Ícones centralizados** no menu de navegação do painel admin
- Layout vertical com ícone em cima e texto embaixo
- Itens com múltiplas palavras agora quebram corretamente:
  - "Audit Log" → duas linhas centralizadas
  - "Master Seed" → duas linhas centralizadas
  - "Criar Pedido" → duas linhas centralizadas
  - "Controle de Fundos" → duas linhas centralizadas
- Menu centralizado horizontalmente na página
- **Arquivo**: `apps/web/app/admin/layout.tsx`

---

## [4.1.0] - 2026-01-16

### Adicionado

#### Sistema de Cupons - Melhorias de UX
- **Visualização de desconto em tempo real** na tela de criação de pedido (`/orders/create`)
  - Banner destacado mostrando cupom ativo com código e percentual
  - Taxa original riscada vs taxa com desconto
  - Economia em crypto exibida em destaque
  - Taxa total recalculada dinamicamente
- **Opção "Ilimitado"** para limite de uso por usuário (`maxUsesPerUser = 0`)
  - Checkbox no formulário de criação de cupom
  - Exibição "Ilimitado" na tabela admin
  - Exibição "Uso ilimitado" no perfil do usuário

### Corrigido

#### Sistema de Cupons - Bugs Críticos
- **Bug: Cupom criado mas sem efeito nas taxas**
  - **Causa**: `applyCouponToOrder()` era chamado FORA da transaction, podendo falhar silenciosamente
  - **Solução**: Movido incremento de contadores para DENTRO da transaction com `tx.$executeRaw`
  - **Arquivo**: `apps/api/src/services/order.service.ts`

- **Bug: Simulação de pagamento de colateral retornando 400**
  - **Causa**: Frontend não enviava parâmetro `amount` no body da requisição
  - **Solução**: Adicionado `Content-Type: application/json` e body com `amount`
  - **Arquivos**: `apps/web/app/orders/create/page.tsx`, `apps/web/app/admin/orders/create/page.tsx`

- **Bug: Cupom expirado ainda mostrava status "Ativo"**
  - **Causa**: Frontend verificava apenas campo `isActive`, ignorando `expiresAt`
  - **Solução**: Adicionada função `getCouponStatus()` que verifica ambos os campos
  - **Arquivo**: `apps/web/app/admin/coupons/page.tsx`

- **Bug: Hora não aparecia na coluna "Validade"**
  - **Causa**: Usava `toLocaleDateString()` ao invés de `toLocaleString()`
  - **Solução**: Alterado para `toLocaleString('pt-BR')`
  - **Arquivo**: `apps/web/app/admin/coupons/page.tsx`

- **Bug: Erro "Invalid datetime" ao criar cupom**
  - **Causa**: Input `datetime-local` não retorna formato ISO 8601
  - **Solução**: Conversão explícita com `new Date().toISOString()`
  - **Arquivo**: `apps/web/app/admin/coupons/page.tsx`

### Alterado
- Validação de `maxUsesPerUser` alterada de `min(1)` para `min(0)` no backend
- Lógica de verificação de limite de uso agora ignora verificação quando `maxUsesPerUser === 0`

---

## [4.0.0] - 2026-01-14

### Adicionado

#### Sistema de Cupons de Desconto (Feature Completa)
- **Backend**
  - Models Prisma: `Coupon` e `UserCoupon`
  - Campos de tracking em `Order`: `appliedCouponId`, `appliedCouponCode`, `appliedCouponDiscount`, `originalPlatformFee`, `discountAmount`
  - Service: `coupon.service.ts` com CRUD completo
  - Controller: `coupon.controller.ts`
  - Routes: `coupon.routes.ts` (user + admin endpoints)
  - Validator: `coupon.validator.ts` (schemas Zod)
  - Integração com `order.service.ts` para aplicação automática de desconto

- **Frontend Admin** (`/admin/coupons`)
  - Página de listagem com filtros (status, visibilidade, busca)
  - Cards de estatísticas (total, ativos, usos, desconto médio)
  - Modal de criação de cupom
  - Modal de edição de cupom
  - Modal de confirmação de exclusão
  - Link no menu admin

- **Frontend User** (`/profile`)
  - Seção de cupons de desconto
  - Exibição de cupom ativo
  - Formulário para ativar cupom por código
  - Lista de cupons públicos disponíveis
  - Botão para desativar cupom

#### Endpoints de API
- `GET /api/v1/coupons/public` - Listar cupons públicos
- `GET /api/v1/coupons/active` - Obter cupom ativo do usuário
- `POST /api/v1/coupons/activate` - Ativar cupom
- `POST /api/v1/coupons/deactivate` - Desativar cupom
- `GET /api/v1/coupons` - Listar todos (admin)
- `GET /api/v1/coupons/stats` - Estatísticas (admin)
- `GET /api/v1/coupons/:id` - Detalhes (admin)
- `POST /api/v1/coupons` - Criar (admin)
- `PUT /api/v1/coupons/:id` - Editar (admin)
- `DELETE /api/v1/coupons/:id` - Deletar (admin)

### Regras de Negócio
- Desconto de 1-100% aplicado SOMENTE à taxa da plataforma (1.5%)
- Cashback do comprador (1%) permanece inalterado
- Apenas 1 cupom ativo por usuário
- Cupom pode ser público ou secreto
- Cupom pode ter limite de usos por usuário
- Cupom pode ter data de expiração
- Aplicação automática ao criar pedido

---

## Bugs Conhecidos / Em Investigação

Nenhum bug crítico conhecido no momento.

---

## Arquivos Principais Modificados (v4.1.0)

### Backend
- `apps/api/src/services/order.service.ts` - Transaction atômica para cupons
- `apps/api/src/services/coupon.service.ts` - Suporte a ilimitado
- `apps/api/src/validators/coupon.validator.ts` - Validação min(0)

### Frontend
- `apps/web/app/orders/create/page.tsx` - Visualização de desconto + fix simulate-payment
- `apps/web/app/admin/orders/create/page.tsx` - Fix simulate-payment
- `apps/web/app/admin/coupons/page.tsx` - Status expirado, hora, ilimitado
- `apps/web/app/profile/page.tsx` - Exibição ilimitado
- `apps/web/app/admin/layout.tsx` - Menu com ícones centralizados (v4.1.1)

---

## Contribuidores

- Desenvolvimento: Claude Code (Anthropic)
- Revisão: Equipe MktPlace-P2P
