# Bugs Críticos

Este arquivo lista todos os bugs críticos conhecidos que estão sendo trabalhados ou aguardando correção.

---

## 🔴 Bugs Ativos

*Nenhum bug crítico ativo no momento.*

---

## ✅ Bugs Resolvidos Recentemente

### 1. ❌ Erro Prisma ao Cancelar Pedido pelo Pagador
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

### 2. ❌ Notificações de Chat Gerando Erro 404
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

### 3. ❌ Página em Branco ao Clicar em Notificação de Chat (Pedidos PENDING)
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

### 4. ❌ Botão "Marcar todas como lidas" Não Funcionava
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

**Última atualização**: 02/11/2025
