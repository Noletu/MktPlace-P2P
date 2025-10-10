# Sistema de Notificações - Mktplace P2P

## 📋 Visão Geral

Sistema completo de notificações em tempo real para informar usuários sobre eventos importantes na plataforma. As notificações são criadas automaticamente quando eventos ocorrem e podem ser consultadas, marcadas como lidas ou deletadas pelos usuários.

## 🗄️ Modelo de Dados

### Notification

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation("notifications", fields: [userId], references: [id])

  type      String   // ORDER_MATCHED, PAYMENT_RECEIVED, etc
  category  String   // ORDER, TRANSACTION, DISPUTE, REVIEW, WALLET, KYC, SYSTEM

  title     String
  message   String

  actionUrl String?  // URL de ação
  actionLabel String? // Texto do botão de ação

  relatedId String?  // ID do recurso relacionado
  relatedType String? // ORDER, TRANSACTION, DISPUTE, REVIEW

  priority  String   @default("NORMAL") // LOW, NORMAL, HIGH, URGENT
  metadata  String?  // JSON com dados adicionais

  isRead    Boolean  @default(false)
  readAt    DateTime?

  createdAt DateTime @default(now())
}
```

## 📡 Endpoints da API

### 1. Buscar Notificações do Usuário

```bash
GET /api/v1/notifications
```

**Query Parameters:**
- `category` (opcional): Filtrar por categoria (ORDER, TRANSACTION, DISPUTE, etc)
- `isRead` (opcional): Filtrar por status de leitura (true/false)
- `priority` (opcional): Filtrar por prioridade (LOW, NORMAL, HIGH, URGENT)
- `limit` (opcional): Número de notificações por página (padrão: 50)
- `offset` (opcional): Offset para paginação (padrão: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_123",
        "type": "ORDER_MATCHED",
        "category": "ORDER",
        "title": "🎯 Pedido Pareado!",
        "message": "Seu pedido foi pareado! Realize o pagamento para continuar.",
        "actionUrl": "/orders/order_abc",
        "actionLabel": "Pagar Agora",
        "relatedId": "order_abc",
        "relatedType": "ORDER",
        "priority": "HIGH",
        "isRead": false,
        "readAt": null,
        "createdAt": "2025-10-09T12:00:00Z"
      }
    ],
    "total": 25,
    "unreadCount": 8
  }
}
```

### 2. Buscar Contagem de Não Lidas

```bash
GET /api/v1/notifications/unread-count
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 8
  }
}
```

### 3. Marcar Notificação como Lida

```bash
POST /api/v1/notifications/:notificationId/read
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "notif_123",
    "isRead": true,
    "readAt": "2025-10-09T12:05:00Z"
  },
  "message": "Notificação marcada como lida"
}
```

### 4. Marcar Todas como Lidas

```bash
POST /api/v1/notifications/mark-all-read
```

**Response:**
```json
{
  "success": true,
  "message": "Todas as notificações foram marcadas como lidas"
}
```

### 5. Deletar Notificação

```bash
DELETE /api/v1/notifications/:notificationId
```

**Response:**
```json
{
  "success": true,
  "message": "Notificação deletada com sucesso"
}
```

### 6. Deletar Todas as Lidas

```bash
DELETE /api/v1/notifications/delete-all-read
```

**Response:**
```json
{
  "success": true,
  "message": "Notificações lidas deletadas com sucesso"
}
```

## 👨‍💼 Endpoints Admin

### 1. Broadcast para Múltiplos Usuários

```bash
POST /api/v1/notifications/broadcast
Authorization: Bearer <admin_token>
```

**Body:**
```json
{
  "userIds": ["user1", "user2", "user3"],
  "type": "MAINTENANCE_ALERT",
  "category": "SYSTEM",
  "title": "Manutenção Programada",
  "message": "O sistema entrará em manutenção amanhã às 2h.",
  "priority": "HIGH",
  "actionUrl": "/status",
  "actionLabel": "Ver Detalhes"
}
```

### 2. Anúncio do Sistema (Todos os Usuários)

```bash
POST /api/v1/notifications/system-announcement
Authorization: Bearer <admin_token>
```

**Body:**
```json
{
  "title": "Nova Funcionalidade!",
  "message": "Agora você pode avaliar outros usuários após completar transações!",
  "priority": "NORMAL"
}
```

## 🔔 Tipos de Notificações

### Notificações de Pedidos (ORDER)

| Tipo | Quando é Criada | Destinatário |
|------|----------------|--------------|
| `ORDER_MATCHED` | Pedido é pareado | Vendedor e Comprador |
| `PAYMENT_SENT` | Comprovante enviado | Vendedor |
| `PAYMENT_VALIDATED` | Pagamento aprovado | Comprador |
| `ORDER_COMPLETED` | Pedido concluído | Vendedor e Comprador |
| `ORDER_EXPIRED` | Pedido expirou | Criador do pedido |
| `ORDER_CANCELLED` | Pedido cancelado | Ambas as partes |

### Notificações de Disputas (DISPUTE)

| Tipo | Quando é Criada | Destinatário |
|------|----------------|--------------|
| `DISPUTE_CREATED` | Disputa aberta | Outra parte |
| `DISPUTE_MESSAGE` | Nova mensagem na disputa | Outra parte |
| `DISPUTE_RESOLVED` | Disputa resolvida | Ambas as partes |

### Notificações de Avaliações (REVIEW)

| Tipo | Quando é Criada | Destinatário |
|------|----------------|--------------|
| `REVIEW_RECEIVED` | Usuário recebe avaliação | Usuário avaliado |
| `REVIEW_RESPONSE` | Avaliação recebe resposta | Avaliador |

### Notificações de Carteira (WALLET)

| Tipo | Quando é Criada | Destinatário |
|------|----------------|--------------|
| `DEPOSIT_CONFIRMED` | Depósito confirmado | Dono da carteira |
| `WITHDRAWAL_PROCESSED` | Saque processado | Dono da carteira |

### Notificações de KYC (KYC)

| Tipo | Quando é Criada | Destinatário |
|------|----------------|--------------|
| `KYC_APPROVED` | KYC aprovado | Usuário |
| `KYC_REJECTED` | KYC rejeitado | Usuário |

### Notificações de Sistema (SYSTEM)

| Tipo | Quando é Criada | Destinatário |
|------|----------------|--------------|
| `SYSTEM_ANNOUNCEMENT` | Admin envia anúncio | Usuários especificados |

## 🔧 Integração com Serviços

As notificações são criadas automaticamente quando eventos ocorrem nos seguintes serviços:

### Order Service
- `matchOrder()` → `notifyOrderMatched()`
- `cancelOrder()` → `notifyOrderCancelled()`

### Transaction Service
- `submitProof()` → `notifyPaymentSent()`
- `validateProof(approved)` → `notifyPaymentValidated()` + `notifyOrderCompleted()`

### Dispute Service
- `createDispute()` → `notifyDisputeCreated()`
- `addMessage()` → `notifyDisputeMessage()`
- `resolveDispute()` → `notifyDisputeResolved()`

### Review Service
- `createReview()` → `notifyReviewReceived()`
- `respondToReview()` → `notifyReviewResponse()`

## 💻 Exemplo de Uso no Frontend

### Buscar Notificações

```typescript
async function getNotifications() {
  const response = await fetch('/api/v1/notifications?limit=20&isRead=false', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  return data.data;
}
```

### Polling de Notificações (Atualização Automática)

```typescript
// Atualizar notificações a cada 30 segundos
setInterval(async () => {
  const { unreadCount } = await getUnreadCount();
  updateBadge(unreadCount);
}, 30000);

async function getUnreadCount() {
  const response = await fetch('/api/v1/notifications/unread-count', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.data;
}
```

### Marcar como Lida ao Clicar

```typescript
async function handleNotificationClick(notificationId: string) {
  await fetch(`/api/v1/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // Atualizar UI
  refreshNotifications();
}
```

## 🎨 Componente React Exemplo

```tsx
import { useState, useEffect } from 'react';

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Buscar inicial
    loadNotifications();

    // Polling a cada 30s
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadUnreadCount() {
    const res = await fetch('/api/v1/notifications/unread-count', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setUnreadCount(data.data.unreadCount);
  }

  async function loadNotifications() {
    const res = await fetch('/api/v1/notifications?limit=10', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setNotifications(data.data.notifications);
    setUnreadCount(data.data.unreadCount);
  }

  async function markAsRead(notificationId: string) {
    await fetch(`/api/v1/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    loadNotifications();
  }

  return (
    <div className="notification-bell">
      <button onClick={() => setIsOpen(!isOpen)}>
        🔔 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          {notifications.length === 0 ? (
            <p>Nenhuma notificação</p>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                className={notif.isRead ? 'read' : 'unread'}
                onClick={() => markAsRead(notif.id)}
              >
                <h4>{notif.title}</h4>
                <p>{notif.message}</p>
                {notif.actionUrl && (
                  <a href={notif.actionUrl}>{notif.actionLabel}</a>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

## 🧪 Testando o Sistema

### 1. Criar Pedido e Parear (Gera Notificação)

```bash
# 1. Login como vendedor
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@example.com","password":"senha123"}'

# 2. Criar pedido (após depósito de colateral)
# (Assumindo que já tem colateral confirmado)

# 3. Login como comprador
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com","password":"senha123"}'

# 4. Aceitar pedido (isso cria notificação ORDER_MATCHED para ambos)
curl -X POST http://localhost:3001/api/v1/orders/order_id/match \
  -H "Authorization: Bearer <buyer_token>"

# 5. Verificar notificações
curl http://localhost:3001/api/v1/notifications \
  -H "Authorization: Bearer <seller_token>"
```

### 2. Testar Broadcast (Admin)

```bash
curl -X POST http://localhost:3001/api/v1/notifications/system-announcement \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Teste de Anúncio",
    "message": "Este é um teste do sistema de notificações",
    "priority": "NORMAL"
  }'
```

## 📊 Prioridades

| Prioridade | Uso | Cor Sugerida |
|------------|-----|--------------|
| `LOW` | Informações não urgentes | Cinza |
| `NORMAL` | Notificações padrão | Azul |
| `HIGH` | Requer atenção | Laranja |
| `URGENT` | Crítico, requer ação imediata | Vermelho |

## 🔒 Segurança

- ✅ Todas as rotas requerem autenticação (`authMiddleware`)
- ✅ Usuários só podem acessar suas próprias notificações
- ✅ Rotas de admin protegidas com `adminMiddleware`
- ✅ Validação de permissões em todas as operações
- ✅ Notificações são enviadas de forma assíncrona (não bloqueante)

## 🚀 Performance

- As notificações são criadas usando `setImmediate()` para não bloquear operações principais
- Índices no banco de dados para queries rápidas:
  - `userId`, `type`, `category`, `isRead`, `createdAt`, `priority`
- Suporte a paginação para grandes volumes de notificações
- Broadcast eficiente usando `Promise.all()` para envios paralelos

## 📝 Próximos Passos (Futuro)

1. **WebSocket/Server-Sent Events**: Notificações em tempo real sem polling
2. **Push Notifications**: Notificações no navegador/mobile mesmo quando app está fechado
3. **Email Notifications**: Enviar emails para notificações importantes
4. **Configurações de Notificação**: Usuário escolher quais tipos quer receber
5. **Agrupamento**: Agrupar notificações similares ("3 novos pedidos" ao invés de 3 separadas)

## 🐛 Troubleshooting

### Notificações não estão sendo criadas

1. Verifique se o serviço está importando `notificationService`
2. Verifique logs do console para erros nas chamadas assíncronas
3. Confirme que os eventos estão sendo disparados corretamente

### Erro ao buscar notificações

1. Verifique se o token de autenticação é válido
2. Confirme que o usuário existe no banco de dados
3. Verifique logs do servidor para erros específicos

---

✅ **Sistema de Notificações Implementado e Testado com Sucesso!**

Data de Implementação: 09/10/2025
