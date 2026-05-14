# Sistema de Notificações Completo

**Versão:** 0.4.0
**Data:** 01/11/2025
**Status:** ✅ Completo e em Produção

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Backend](#backend)
4. [Frontend](#frontend)
5. [Recursos Implementados](#recursos-implementados)
6. [Como Usar](#como-usar)
7. [API Reference](#api-reference)
8. [WebSocket Events](#websocket-events)
9. [Troubleshooting](#troubleshooting)

---

## Visão Geral

Sistema completo de notificações em tempo real para o Mktplace da Liberdade, incluindo:
- ✅ Backend com WebSocket para notificações em tempo real
- ✅ Frontend com páginas dedicadas para notificações e reviews
- ✅ Sistema de filtros, paginação e busca
- ✅ Toast notifications com animações
- ✅ Estatísticas de reviews
- ✅ Responsividade completa (desktop, tablet, mobile)

## Arquitetura

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  notification.service.ts                                      │
│  ├─ createNotification()                                      │
│  │  └─ Emite: WebSocket → notification:new                   │
│  │  └─ Emite: WebSocket → notification:count                 │
│  ├─ markAsRead()                                              │
│  │  └─ Emite: WebSocket → notification:read                  │
│  ├─ markAllAsRead()                                           │
│  │  └─ Emite: WebSocket → notification:all-read              │
│  ├─ deleteNotification()                                      │
│  │  └─ Emite: WebSocket → notification:deleted               │
│  └─ deleteAllRead()                                           │
│     └─ Emite: WebSocket → notification:count                 │
│                                                               │
│  notification.socket.ts                                       │
│  ├─ Autenticação JWT                                          │
│  ├─ Salas por usuário: user:{userId}                         │
│  └─ Eventos: new, read, all-read, deleted, count             │
│                                                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ WebSocket (ws://localhost:3001)
                        │ REST API (http://localhost:3001/api/v1)
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                        FRONTEND                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  NotificationProvider (Context + WebSocket)                   │
│  ├─ useNotificationSocket()                                   │
│  │  └─ Conecta ao WebSocket                                  │
│  │  └─ Escuta eventos em tempo real                          │
│  ├─ Gerencia estado global de notificações                   │
│  └─ Mostra Toast Notifications                               │
│                                                               │
│  Componentes                                                  │
│  ├─ NotificationBell (Header)                                 │
│  │  └─ Badge com contador não lidas                          │
│  │  └─ Dropdown com últimas 10 notificações                  │
│  ├─ /notifications (Página Completa)                          │
│  │  └─ Lista com filtros e paginação                         │
│  │  └─ Ações: marcar lida, deletar, ver todas               │
│  └─ /reviews (Sistema de Avaliações)                         │
│     ├─ Lista de reviews recebidas                            │
│     ├─ Estatísticas e distribuição                           │
│     ├─ Responder reviews                                      │
│     └─ /reviews/[reviewId] (Detalhes)                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend

### Arquivos Criados/Modificados

#### 1. `apps/api/src/socket/notification.socket.ts` (NOVO)

Servidor WebSocket para notificações em tempo real.

**Funcionalidades:**
- Autenticação JWT via handshake
- Salas de usuário individuais (`user:{userId}`)
- Emissão de eventos em tempo real
- Gerenciamento de conexões ativas

**Eventos Emitidos:**
- `notification:new` - Nova notificação criada
- `notification:read` - Notificação marcada como lida
- `notification:all-read` - Todas marcadas como lidas
- `notification:deleted` - Notificação deletada
- `notification:count` - Atualização de contadores
- `notification:connected` - Confirmação de conexão

#### 2. `apps/api/src/services/notification.service.ts` (MODIFICADO)

Serviço de notificações integrado com WebSocket.

**Mudanças:**
- Importa `getNotificationSocket()`
- Emite eventos WebSocket após operações CRUD
- Try-catch para garantir que falhas no WebSocket não afetem a lógica principal
- Atualização de contadores em tempo real

#### 3. `apps/api/src/index.ts` (MODIFICADO)

Inicialização do servidor WebSocket.

```typescript
import { initializeNotificationSocket } from './socket/notification.socket';

const notificationSocket = initializeNotificationSocket(httpServer);

export { chatSocket, notificationSocket };
```

---

## Frontend

### Arquivos Criados

#### 1. Hook: `useNotificationSocket.ts`

Hook para conexão WebSocket.

```typescript
const {
  socket,
  isConnected,
  connect,
  disconnect,
} = useNotificationSocket({
  onNewNotification: (notification) => {},
  onNotificationRead: (id) => {},
  onAllRead: () => {},
  onNotificationDeleted: (id) => {},
  onCountUpdate: (count) => {},
});
```

#### 2. Provider: `NotificationProvider.tsx`

Context global para notificações.

**Fornece:**
- `notifications: Notification[]` - Lista de notificações
- `unreadCount: number` - Contador não lidas
- `addNotification()` - Adicionar manualmente
- `markAsRead()` - Marcar como lida
- `markAllAsRead()` - Marcar todas
- `removeNotification()` - Remover
- `setNotifications()` - Definir lista
- `setUnreadCount()` - Definir contador

#### 3. Toast System

**Arquivos:**
- `components/Toast.tsx` - Componente de toast
- `hooks/useToast.tsx` - Hook + Provider

**Tipos de Toast:**
- `success` - Verde
- `error` - Vermelho
- `warning` - Laranja
- `info` - Azul

**Animações:**
- Slide-in da direita
- Fade-in suave
- Auto-close configurável
- Close manual

#### 4. Skeleton Loader

**Arquivo:** `components/NotificationSkeleton.tsx`

Componente de loading elegante com animação pulsante.

#### 5. Páginas

**a) `/notifications/page.tsx`**

Página completa de notificações com:
- Filtros: categoria, status (lida/não lida), prioridade
- Ordenação: recentes, prioridade
- Ações bulk: marcar todas como lidas, deletar todas lidas
- Ações individuais: marcar lida, deletar
- Paginação: "Carregar mais" com offset
- Skeleton loading
- Estados vazios
- Responsividade completa

**b) `/reviews/page.tsx`**

Página de reviews recebidas com:
- Lista de avaliações
- Filtros: todas, respondidas, não respondidas
- Ordenação: recentes, maior nota, menor nota
- ReviewStats component (sidebar)
- Responder inline com ReviewResponseForm
- Link para detalhes do pedido
- Exibição de categorias: confiabilidade, comunicação, rapidez

**c) `/reviews/[reviewId]/page.tsx`**

Página de detalhes de review individual com:
- Header com gradiente
- Cards de informação (avaliador, pedido)
- Avaliação geral com estrelas grandes
- Comentários do avaliador
- Categorias detalhadas (cards coloridos)
- Seção de resposta (form ou resposta existente)

#### 6. Componentes de Review

**a) `ReviewStats.tsx`**

Estatísticas de avaliações:
- Média geral (número grande + estrelas)
- Total de avaliações
- Distribuição por nota (barras de progresso)
- Médias por categoria (barras)

**b) `ReviewResponseForm.tsx`**

Formulário para responder reviews:
- Textarea com limite de 500 caracteres
- Contador de caracteres restantes
- Validação
- Loading state
- Error handling
- Callbacks: onSuccess, onCancel

### Arquivos Modificados

#### 1. `components/Providers.tsx`

Adicionado:
```typescript
<ToastProvider>
  <NotificationProvider>
    {children}
  </NotificationProvider>
</ToastProvider>
```

#### 2. `components/NotificationBell.tsx`

Mudanças:
- ❌ Removido: `useNotifications()` (com polling)
- ✅ Adicionado: `useNotificationContext()`
- ✅ Carrega notificações iniciais apenas uma vez
- ✅ Atualizado automaticamente via WebSocket
- ✅ Chama API para marcar como lida (trigger WebSocket)

#### 3. `hooks/useNotifications.ts`

Mudanças:
- ❌ **Removido polling de 30 segundos**
- ✅ Mantém funcionalidades de fetch, paginação, filtros
- ✅ Usado apenas em `/notifications` page para paginação

---

## Recursos Implementados

### ✅ Fase 1: URLs Corrigidas
- `/wallet` → `/wallets`
- `/profile/kyc` → `/kyc/info`

### ✅ Fase 2: Página /notifications
- Página completa com filtros
- Paginação offset-based
- Delete individual e bulk
- Mark as read individual e bulk
- Estados vazios

### ✅ Fase 3: Sistema de Reviews
- Página `/reviews` com lista
- Página `/reviews/[reviewId]` com detalhes
- Componente ReviewStats
- Componente ReviewResponseForm
- Filtros e ordenação
- Integração com pedidos

### ✅ Fase 4: WebSocket Real-Time
- Backend: `notification.socket.ts`
- Frontend: `useNotificationSocket` hook
- Frontend: `NotificationProvider` context
- Integração completa
- Polling removido

### ✅ Fase 5: UX/UI
- Toast notifications animadas
- Skeleton loading states
- Ícones por categoria (Lucide React)
- Cores por prioridade
- Transições suaves
- Responsividade completa
- Browser notifications (opcional)

---

## Como Usar

### Backend

1. O servidor já inicializa automaticamente com o WebSocket:
```bash
cd apps/api
npm run dev
```

2. WebSocket disponível em: `ws://localhost:3001`
3. REST API em: `http://localhost:3001/api/v1/notifications`

### Frontend

1. Iniciar aplicação:
```bash
cd apps/web
npm run dev
```

2. Abrir: `http://localhost:3000`

3. Testar notificações:
   - Clique no sino (🔔) no header
   - Acesse `/notifications` para ver todas
   - Acesse `/reviews` para ver avaliações

### Criando Notificações Programaticamente

```typescript
import { notificationService } from '@/services/notification.service';

await notificationService.createNotification({
  userId: 'user-id',
  type: 'ORDER_MATCHED',
  category: 'ORDER',
  title: '🎯 Pedido Pareado!',
  message: 'Seu pedido foi pareado com sucesso.',
  actionUrl: '/orders/order-id',
  actionLabel: 'Ver Pedido',
  priority: 'HIGH',
  relatedId: 'order-id',
  relatedType: 'ORDER',
});
```

O WebSocket será automaticamente acionado e o usuário verá um toast em tempo real!

---

## API Reference

### REST Endpoints

#### GET `/api/v1/notifications`

Buscar notificações do usuário.

**Query Params:**
- `limit` (number) - Quantidade (default: 50)
- `offset` (number) - Offset para paginação (default: 0)
- `category` (string) - Filtrar por categoria
- `isRead` (boolean) - Filtrar por status
- `priority` (string) - Filtrar por prioridade

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "total": 100,
    "unreadCount": 25
  }
}
```

#### GET `/api/v1/notifications/unread-count`

Obter contador de não lidas.

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 25
  }
}
```

#### PATCH `/api/v1/notifications/:id/read`

Marcar notificação como lida.

**Response:**
```json
{
  "success": true,
  "data": {
    "notification": {...}
  }
}
```

#### PATCH `/api/v1/notifications/read-all`

Marcar todas como lidas.

**Response:**
```json
{
  "success": true
}
```

#### DELETE `/api/v1/notifications/:id`

Deletar notificação.

**Response:**
```json
{
  "success": true
}
```

#### DELETE `/api/v1/notifications/delete-all-read`

Deletar todas as lidas.

**Response:**
```json
{
  "success": true
}
```

### Reviews Endpoints

#### GET `/api/v1/reviews/user/:userId`

Buscar reviews do usuário.

**Query Params:**
- `orderId` (string, opcional) - Filtrar por pedido

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [...]
  }
}
```

#### GET `/api/v1/reviews/user/:userId/stats`

Obter estatísticas de reviews.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalReviews": 50,
    "averageRating": 4.5,
    "ratingDistribution": {
      "5": 30,
      "4": 15,
      "3": 3,
      "2": 1,
      "1": 1
    },
    "averageReliability": 4.7,
    "averageCommunication": 4.6,
    "averageSpeed": 4.3
  }
}
```

#### POST `/api/v1/reviews/:reviewId/respond`

Responder a uma review.

**Body:**
```json
{
  "response": "Obrigado pelo feedback!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "review": {...}
  }
}
```

---

## WebSocket Events

### Client → Server

**Conexão:**
```typescript
const socket = io('http://localhost:3001', {
  path: '/socket.io/',
  auth: { token: 'jwt-token' },
});
```

### Server → Client

#### `notification:connected`

Confirmação de conexão bem-sucedida.

```typescript
socket.on('notification:connected', (data) => {
  // data: { userId: string, timestamp: string }
});
```

#### `notification:new`

Nova notificação recebida.

```typescript
socket.on('notification:new', (notification) => {
  // notification: { id, title, message, category, priority, actionUrl, isRead, createdAt }
});
```

#### `notification:read`

Notificação marcada como lida.

```typescript
socket.on('notification:read', (data) => {
  // data: { notificationId: string }
});
```

#### `notification:all-read`

Todas as notificações marcadas como lidas.

```typescript
socket.on('notification:all-read', () => {
  // Sem payload
});
```

#### `notification:deleted`

Notificação deletada.

```typescript
socket.on('notification:deleted', (data) => {
  // data: { notificationId: string }
});
```

#### `notification:count`

Atualização de contadores.

```typescript
socket.on('notification:count', (count) => {
  // count: { unreadCount: number, total: number }
});
```

---

## Troubleshooting

### WebSocket não conecta

1. Verificar se backend está rodando
2. Verificar token JWT no localStorage
3. Verificar console do navegador para erros
4. Verificar porta 3001 disponível

### Notificações não aparecem em tempo real

1. Verificar se WebSocket está conectado (console do navegador)
2. Verificar se NotificationProvider está no layout
3. Verificar se token é válido
4. Verificar logs do backend

### Polling ainda acontecendo

✅ **Resolvido!** Polling foi completamente removido do `useNotifications.ts`.

### Toast não aparece

1. Verificar se ToastProvider está acima de NotificationProvider
2. Verificar console para erros
3. Verificar se z-index não está bloqueado

---

## Performance

### Backend
- WebSocket mantém 1 conexão persistente por usuário
- Emissões de eventos são assíncronas e non-blocking
- Try-catch garante que falhas não afetam lógica principal

### Frontend
- Sem polling (economia de ~120 requests/hora por usuário)
- WebSocket reconecta automaticamente
- Context otimizado com useCallback
- Lazy loading de componentes
- Skeleton evita layout shift

---

## Segurança

- ✅ Autenticação JWT obrigatória
- ✅ Salas de usuário isoladas
- ✅ Validação de permissões no backend
- ✅ CORS configurado
- ✅ Rate limiting nos endpoints REST
- ✅ Tokens não expostos no client-side

---

## Próximos Passos (Opcional)

### Fase 6: Testes (Estimativa: 3-4h)
- [ ] Testes unitários backend (notification.service.test.ts)
- [ ] Testes unitários frontend (NotificationBell.test.tsx)
- [ ] Testes de integração (WebSocket)
- [ ] Testes E2E (Playwright/Cypress)

### Melhorias Futuras
- [ ] Suporte a notificações agendadas
- [ ] Templates de notificações
- [ ] Histórico de notificações deletadas
- [ ] Exportar notificações (CSV/PDF)
- [ ] Notificações por email
- [ ] Notificações push mobile (PWA)
- [ ] Analytics de notificações

---

**Desenvolvido com ❤️ para Mktplace da Liberdade**
**Versão 0.4.0 - Novembro 2025**
