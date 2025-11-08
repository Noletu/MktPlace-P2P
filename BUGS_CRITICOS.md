# Bugs Críticos

Este arquivo lista todos os bugs críticos conhecidos que estão sendo trabalhados ou aguardando correção.

---

## 🔴 Bugs Ativos

*Nenhum bug crítico ativo no momento.*

---

## ✅ Bugs Resolvidos Recentemente

### 1. ❌ Erro 500 em `/api/v1/prices` Bloqueando Criação de Pedidos
**Status**: ✅ RESOLVIDO
**Data Resolução**: 08/11/2025
**Prioridade**: 🔴 CRÍTICA

**Descrição**: Endpoint `/api/v1/prices` retornava 500 Internal Server Error, impedindo completamente a criação de pedidos.

**Sintomas**:
- Frontend recebia erro: "Não foi possível calcular o valor em criptomoeda. Aguarde o carregamento dos preços."
- Console mostrava: `price=undefined` na calculação de BRL → Crypto
- Requisição GET para `/api/v1/prices` retornava 500

**Causa**:
- `Promise.all()` em `getAllPrices()` falhava completamente se UMA única criptomoeda não conseguisse cotação
- CoinGecko API pode falhar por rate limiting, network, ou coin ID inválido
- Falha de uma crypto derrubava todas as outras

**Solução**:
1. Substituído `Promise.all()` por `Promise.allSettled()` em `price.service.ts:78-102`
2. Sistema agora retorna preços parciais mesmo com falhas individuais
3. Adicionado logging detalhado para identificar qual crypto falhou
4. API retorna flag `partial: true` quando alguns preços não foram obtidos
5. Apenas lança erro se TODAS as cryptos falharem (não apenas uma)

**Arquivos Modificados**:
- `apps/api/src/services/price.service.ts` (linhas 78-102)
- `apps/api/src/controllers/price.controller.ts` (linhas 34-53)

**Teste**:
```bash
curl -s http://localhost:3001/api/v1/prices
# Retorna 200 OK com array de preços disponíveis
# Campo "partial" indica se alguma crypto falhou
```

**Resultado**: Frontend pode criar pedidos mesmo se uma crypto estiver com problemas de cotação.

**Commit**: Ver CHANGELOG.md [Unreleased]

---

### 2. ❌ Usuários Não Encontravam Como Depositar Colateral
**Status**: ✅ RESOLVIDO
**Data Resolução**: 08/11/2025
**Prioridade**: 🟠 ALTA (UX)

**Descrição**: Usuários não conseguiam encontrar onde depositar colateral, causando confusão e bloqueando uso do sistema.

**Problema**:
- Página de "Saldo Interno" (`/collateral-balance`) não tinha link no menu principal
- Usuários acessavam "Carteiras" (`/wallets`) mas não encontravam botão de depósito
- Funcionalidade estava "escondida" sem navegação clara

**Solução**: Adicionado botão "💰 Depositar Colateral" em cada card de carteira na página `/wallets`
- Botão redireciona para `/collateral-balance` com crypto/network pré-selecionados
- Query params: `/collateral-balance?crypto=BTC&network=BITCOIN`
- UX significativamente melhorada

**Arquivos Modificados**:
- `apps/web/app/wallets/page.tsx` (linhas 314-321)

**Teste**:
1. Acessar `/wallets`
2. Criar carteira BTC
3. Ver botão azul "💰 Depositar Colateral" no card
4. Clicar → redireciona para página de colateral com BTC selecionado

**Commit**: Ver CHANGELOG.md [Unreleased]

---

### 3. ❌ Erro no Script de Limpeza do Banco (clean-database-full.ts)
**Status**: ✅ RESOLVIDO
**Data Resolução**: 08/11/2025
**Prioridade**: 🟠 ALTA

**Descrição**: Ao executar o script de limpeza do banco (`npm run db:clean`), ocorria erro na linha 166:
```
TypeError: Cannot read properties of undefined (reading 'deleteMany')
Invalid model name: kycVerification
```

**Causa**: Nome incorreto do modelo Prisma usado no script. O código usava `tx.kycVerification.deleteMany()` mas o modelo correto no Prisma é `KYCVerification` (com maiúsculas).

**Solução**: Corrigido nome do modelo de `kycVerification` para `kYCVerification` em `apps/api/scripts/clean-database-full.ts:166`

**Arquivos Modificados**:
- `apps/api/scripts/clean-database-full.ts` (linha 166)

**Teste**: Script executado com sucesso, limpando banco completo e preservando apenas MASTER e ADMIN.

**Commit**: Ver CHANGELOG.md [Unreleased]

---

### 4. ❌ Erro Prisma ao Cancelar Pedido pelo Pagador
**Status**: ✅ RESOLVIDO  
**Data Resolução**: 02/11/2025  
**Prioridade**: 🔴 CRÍTICA

**Descrição**: Ao tentar cancelar um pedido como pagador, o sistema retornava erro Prisma:
```
Invalid `prisma.order.update()` invocation
Field 'matchedAt' not found in Order model
```

**Causa**: O método `cancelOrderByPayer()` tentava atualizar o campo `matchedAt` que não existe no schema do Prisma.

**Solução**: Removida a linha `matchedAt: null` do update em `apps/api/src/services/order.service.ts:701`

**Arquivos Modificados**:
- `apps/api/src/services/order.service.ts` (linha 697-702)

**Commit**: Ver CHANGELOG.md [Unreleased]

---

### 5. ❌ Notificações de Chat Gerando Erro 404
**Status**: ✅ RESOLVIDO  
**Data Resolução**: 02/11/2025  
**Prioridade**: 🔴 ALTA

**Descrição**: Ao clicar em notificações de chat, usuários eram redirecionados para `/orders/{id}/chat` que não existe, resultando em erro 404.

**Causa**: 
- Backend gerava URL antiga: `/orders/{id}/chat`
- Rota não existe - chat é acessado via tab no pedido

**Solução**:
1. Backend atualizado para gerar URL correta: `/orders/{id}?tab=chat`
2. Frontend criado função `normalizeNotificationUrl()` para compatibilidade com URLs antigas
3. Script de migração criado para atualizar 8 notificações antigas no banco

**Arquivos Modificados**:
- `apps/api/src/services/chat.service.ts` (linha 273)
- `apps/web/utils/notificationUtils.ts` (arquivo novo)
- `apps/web/components/NotificationBell.tsx`
- `apps/web/app/notifications/page.tsx`
- `apps/api/scripts/fix-chat-notification-urls.ts` (arquivo novo)

**Commit**: Ver CHANGELOG.md [Unreleased]

---

### 6. ❌ Página em Branco ao Clicar em Notificação de Chat (Pedidos PENDING)
**Status**: ✅ RESOLVIDO  
**Data Resolução**: 02/11/2025  
**Prioridade**: 🔴 ALTA

**Descrição**: Quando um pagador clicava em notificação de chat para pedido PENDING, a página ficava completamente em branco.

**Causa**:
- URL tinha parâmetro `?tab=chat`
- Função `shouldShowChat()` não incluía status `PENDING`
- Tab de chat não era adicionada ao array de tabs
- Sistema tentava mostrar tab inexistente, resultando em página vazia

**Solução**:
1. Adicionado `PENDING` aos statuses permitidos em `shouldShowChat()`
2. Priorizada verificação `chatId !== null` (se chat existe, sempre mostrar)
3. Adicionado useEffect de fallback para prevenir páginas em branco

**Arquivos Modificados**:
- `apps/web/app/orders/[orderId]/page.tsx` (linhas 597-611, 118-129)

**Commit**: Ver CHANGELOG.md [Unreleased]

---

### 7. ❌ Botão "Marcar todas como lidas" Não Funcionava
**Status**: ✅ RESOLVIDO  
**Data Resolução**: 02/11/2025  
**Prioridade**: 🟡 MÉDIA

**Descrição**: Ao clicar no botão "Marcar todas como lidas" no sino de notificações, nada acontecia.

**Causa**: 
- HTTP method errado: usando `PATCH` ao invés de `POST`
- Endpoint errado: `/read-all` ao invés de `/mark-all-read`

**Solução**: Corrigido method e endpoint em `NotificationBell.tsx`

**Arquivos Modificados**:
- `apps/web/components/NotificationBell.tsx` (linhas 42, 60-62)

**Commit**: Ver CHANGELOG.md [Unreleased]

---

## 📝 Notas

### Como Reportar um Bug Crítico

1. **Reproduzir o bug** e documentar os passos
2. **Adicionar seção no topo** deste arquivo em "Bugs Ativos"
3. **Incluir**:
   - Descrição clara do problema
   - Passos para reproduzir
   - Comportamento esperado vs. atual
   - Screenshots/logs se aplicável
   - Prioridade (🔴 CRÍTICA, 🟠 ALTA, 🟡 MÉDIA, 🟢 BAIXA)
   - Arquivos/linhas afetados

### Prioridades

- 🔴 **CRÍTICA**: Sistema quebrado, funcionalidade principal não funciona, perda de dados
- 🟠 **ALTA**: Funcionalidade importante quebrada, workaround difícil
- 🟡 **MÉDIA**: Funcionalidade menor quebrada, workaround fácil
- 🟢 **BAIXA**: Problema cosmético, não afeta funcionalidade

---

**Última atualização**: 08/11/2025
