# Sistema de Chat em Tempo Real - Mktplace P2P

## 📋 Visão Geral

Sistema completo de chat em tempo real usando **WebSocket (Socket.io)** para comunicação instantânea entre compradores e vendedores durante transações. O sistema também oferece API REST como fallback.

## 🏗️ Arquitetura

### Tecnologias
- **Socket.io** - WebSocket para comunicação em tempo real
- **Express HTTP Server** - Servidor base
- **JWT** - Autenticação de conexões WebSocket
- **Prisma** - ORM para persistência de mensagens

### Fluxo de Dados
```
Frontend <--> Socket.io Client <--> Socket.io Server <--> Chat Service <--> Database
                                          ↓
                                  Notification Service
```

## 🗄️ Modelos de Dados

### Chat

```prisma
model Chat {
  id             String   @id
  orderId        String   @unique
  participant1Id String   // Vendedor
  participant2Id String   // Comprador
  isActive       Boolean
  lastMessageAt  DateTime?
  unreadCount1   Int      // Não lidas pelo participant1
  unreadCount2   Int      // Não lidas pelo participant2
  messages       ChatMessage[]
}
```

### ChatMessage

```prisma
model ChatMessage {
  id          String   @id
  chatId      String
  senderId    String
  message     String
  attachments String?  // JSON array de URLs
  type        String   // TEXT, IMAGE, SYSTEM
  isRead      Boolean
  readAt      DateTime?
  createdAt   DateTime
}
```

## 🔌 WebSocket Events

### Cliente → Servidor

| Event | Payload | Descrição |
|-------|---------|-----------|
| `chat:join` | `{ chatId }` | Entrar em uma sala de chat |
| `chat:leave` | `{ chatId }` | Sair de uma sala de chat |
| `message:send` | `{ chatId, message, attachments? }` | Enviar mensagem |
| `typing:start` | `{ chatId }` | Começar a digitar |
| `typing:stop` | `{ chatId }` | Parar de digitar |
| `messages:read` | `{ chatId }` | Marcar mensagens como lidas |

### Servidor → Cliente

| Event | Payload | Descrição |
|-------|---------|-----------|
| `chat:joined` | `{ chatId }` | Confirmação de entrada no chat |
| `message:new` | `{ message }` | Nova mensagem recebida |
| `user:joined` | `{ userId, userName }` | Usuário entrou no chat |
| `user:left` | `{ userId }` | Usuário saiu do chat |
| `user:typing` | `{ userId, isTyping }` | Indicador de digitação |
| `messages:read` | `{ userId, chatId }` | Mensagens foram lidas |
| `user:online` | `{ userId }` | Usuário ficou online |
| `user:offline` | `{ userId }` | Usuário ficou offline |
| `error` | `{ message }` | Erro ocorrido |

## 📡 REST API Endpoints

### 1. Buscar Chats do Usuário

```bash
GET /api/v1/chat
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "chat_123",
      "orderId": "order_abc",
      "lastMessageAt": "2025-10-09T12:00:00Z",
      "unreadCount": 3,
      "otherParticipant": {
        "id": "user_456",
        "name": "João Silva",
        "reputationScore": 95
      },
      "order": {
        "type": "PIX",
        "status": "MATCHED",
        "brlAmount": "500.00",
        "cryptoAmount": "0.01",
        "cryptoType": "BTC"
      },
      "messages": [
        {
          "id": "msg_1",
          "senderId": "user_456",
          "message": "Olá! Já fiz o pagamento.",
          "createdAt": "2025-10-09T12:00:00Z",
          "sender": {
            "id": "user_456",
            "name": "João Silva"
          }
        }
      ]
    }
  ]
}
```

### 2. Obter ou Criar Chat para um Pedido

```bash
GET /api/v1/chat/order/:orderId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "chat_123",
    "orderId": "order_abc",
    "participant1": {
      "id": "user_123",
      "name": "Maria Santos",
      "reputationScore": 98
    },
    "participant2": {
      "id": "user_456",
      "name": "João Silva",
      "reputationScore": 95
    },
    "messages": []
  }
}
```

### 3. Buscar Chat por ID

```bash
GET /api/v1/chat/:chatId
Authorization: Bearer <token>
```

### 4. Buscar Mensagens do Chat

```bash
GET /api/v1/chat/:chatId/messages?limit=50&before=msg_id
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (opcional): Número de mensagens (padrão: 50)
- `before` (opcional): Message ID para paginação (carregar mensagens anteriores)

### 5. Enviar Mensagem (REST Fallback)

```bash
POST /api/v1/chat/:chatId/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Olá! Recebi o pagamento.",
  "attachments": ["https://example.com/image.jpg"]
}
```

**Nota:** Preferir usar WebSocket `message:send` para melhor experiência em tempo real.

### 6. Marcar Mensagens como Lidas

```bash
POST /api/v1/chat/:chatId/read
Authorization: Bearer <token>
```

### 7. Contar Chats Não Lidos

```bash
GET /api/v1/chat/unread-count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 2
  }
}
```

## 💻 Exemplo de Uso no Frontend (TypeScript)

### Conexão WebSocket

```typescript
import { io, Socket } from 'socket.io-client';

class ChatClient {
  private socket: Socket;

  constructor(token: string) {
    this.socket = io('http://localhost:3001', {
      auth: { token },
      path: '/socket.io/',
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log('✅ Connected to chat server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from chat server');
    });

    this.socket.on('error', (error) => {
      console.error('Error:', error.message);
    });

    // Listeners de mensagens
    this.socket.on('message:new', (message) => {
      this.handleNewMessage(message);
    });

    this.socket.on('user:typing', (data) => {
      this.handleTypingIndicator(data);
    });

    this.socket.on('user:online', (data) => {
      console.log('User online:', data.userId);
    });

    this.socket.on('user:offline', (data) => {
      console.log('User offline:', data.userId);
    });
  }

  // Entrar em um chat
  joinChat(chatId: string) {
    this.socket.emit('chat:join', { chatId });

    this.socket.once('chat:joined', () => {
      console.log('✅ Joined chat:', chatId);
    });
  }

  // Enviar mensagem
  sendMessage(chatId: string, message: string) {
    this.socket.emit('message:send', {
      chatId,
      message,
    });
  }

  // Indicador de digitação
  startTyping(chatId: string) {
    this.socket.emit('typing:start', { chatId });
  }

  stopTyping(chatId: string) {
    this.socket.emit('typing:stop', { chatId });
  }

  // Marcar como lido
  markAsRead(chatId: string) {
    this.socket.emit('messages:read', { chatId });
  }

  // Sair do chat
  leaveChat(chatId: string) {
    this.socket.emit('chat:leave', { chatId });
  }

  // Handlers
  private handleNewMessage(message: any) {
    console.log('New message:', message);
    // Atualizar UI
  }

  private handleTypingIndicator(data: any) {
    console.log('User typing:', data.userId, data.isTyping);
    // Mostrar "Usuário está digitando..."
  }

  // Desconectar
  disconnect() {
    this.socket.disconnect();
  }
}

// Uso
const token = 'your-jwt-token';
const chatClient = new ChatClient(token);

// Entrar em um chat
chatClient.joinChat('chat_123');

// Enviar mensagem
chatClient.sendMessage('chat_123', 'Olá! Tudo bem?');

// Digitando
chatClient.startTyping('chat_123');
setTimeout(() => chatClient.stopTyping('chat_123'), 1000);
```

### Componente React Exemplo

```tsx
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

function ChatComponent({ chatId, token }: { chatId: string; token: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Conectar WebSocket
    socketRef.current = io('http://localhost:3001', {
      auth: { token },
    });

    const socket = socketRef.current;

    // Entrar no chat
    socket.emit('chat:join', { chatId });

    // Listeners
    socket.on('message:new', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('user:typing', (data) => {
      setOtherUserTyping(data.isTyping);
    });

    // Cleanup
    return () => {
      socket.emit('chat:leave', { chatId });
      socket.disconnect();
    };
  }, [chatId, token]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socketRef.current) return;

    socketRef.current.emit('message:send', {
      chatId,
      message: newMessage.trim(),
    });

    setNewMessage('');
    stopTyping();
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!isTyping && socketRef.current) {
      setIsTyping(true);
      socketRef.current.emit('typing:start', { chatId });
    }

    // Resetar timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const stopTyping = () => {
    if (isTyping && socketRef.current) {
      setIsTyping(false);
      socketRef.current.emit('typing:stop', { chatId });
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <strong>{msg.sender.name}:</strong> {msg.message}
          </div>
        ))}
        {otherUserTyping && <div className="typing">Usuário está digitando...</div>}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={newMessage}
          onChange={handleTyping}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Digite sua mensagem..."
        />
        <button onClick={handleSendMessage}>Enviar</button>
      </div>
    </div>
  );
}
```

## 🔒 Segurança

### Autenticação WebSocket
- ✅ Token JWT obrigatório na conexão (`socket.handshake.auth.token`)
- ✅ Verificação do token em cada conexão
- ✅ Socket desconectado automaticamente se token inválido

### Autorização
- ✅ Usuários só podem entrar em chats que participam
- ✅ Mensagens só podem ser enviadas por participantes
- ✅ Validação de permissões em todas as operações

### Rate Limiting
- ✅ Limite de mensagens por segundo (implementar se necessário)
- ✅ Proteção contra spam

## 🚀 Performance

### Otimizações Implementadas:
1. **Salas do Socket.io**: Usuários só recebem mensagens dos chats que participam
2. **Índices no Banco**: Queries rápidas em `chatId`, `senderId`, `createdAt`
3. **Paginação**: Carregamento lazy de mensagens antigas
4. **Notificações Assíncronas**: Não bloqueiam envio de mensagens
5. **Conexões Persistentes**: WebSocket mantém conexão aberta

### Escalabilidade:
- **Redis Adapter**: Para múltiplos servidores (implementar quando necessário)
- **Load Balancer**: Sticky sessions com Socket.io
- **Horizontal Scaling**: Socket.io suporta clustering

## 🧪 Testando o Sistema

### 1. Teste de Conexão WebSocket

```bash
# Instalar wscat
npm install -g wscat

# Conectar (com token)
wscat -c "ws://localhost:3001/socket.io/?token=YOUR_JWT_TOKEN"
```

### 2. Teste REST - Criar Chat

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"senha123"}' \
  | jq -r '.data.token')

# Obter chat de um pedido
curl http://localhost:3001/api/v1/chat/order/ORDER_ID \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Teste de Mensagem

```bash
# Enviar mensagem via REST
curl -X POST http://localhost:3001/api/v1/chat/CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Olá! Teste de mensagem"}'
```

## 📊 Monitoramento

### Logs
```javascript
// Logs disponíveis
[SOCKET] User authenticated - userId, socketId
[SOCKET] Client connected - userId, socketId
[SOCKET] User joined chat - userId, chatId
[SOCKET] Message sent - messageId, chatId, senderId
[SOCKET] User left chat - userId, chatId
[SOCKET] Client disconnected - userId, socketId
[CHAT] Created - chatId, orderId, participants
[CHAT] Message sent - messageId, chatId, senderId
```

### Métricas Úteis
- `chatSocket.getConnectedUsersCount()` - Usuários online
- `chatSocket.isUserOnline(userId)` - Status de usuário
- Contadores de mensagens por chat
- Taxa de entrega de mensagens

## 🐛 Troubleshooting

### WebSocket não conecta

1. Verificar se o servidor está rodando: `curl http://localhost:3001/health`
2. Verificar token JWT válido
3. Verificar CORS configurado corretamente
4. Verificar firewall/proxy

### Mensagens não chegam em tempo real

1. Verificar se usuário entrou no chat (`chat:join`)
2. Verificar logs do servidor
3. Verificar eventos sendo emitidos corretamente
4. Testar com REST API como fallback

### Erro "Authentication token required"

1. Token não está sendo enviado no `auth` do Socket.io
2. Token expirado - fazer novo login
3. Formato do token incorreto

## 📝 Próximos Passos (Futuro)

### Curto Prazo:
1. ✅ **Chat funcional com WebSocket**
2. **Upload de imagens/anexos**
3. **Emojis e formatação de texto**
4. **Histórico de mensagens paginado**

### Médio Prazo:
1. **Redis para múltiplos servidores**
2. **Indicador de "lido por" (checkmarks)**
3. **Busca de mensagens**
4. **Arquivar chats antigos**

### Longo Prazo:
1. **Chamadas de voz/vídeo (WebRTC)**
2. **Compartilhamento de arquivos**
3. **Chat em grupo (suporte técnico)**
4. **Criptografia end-to-end**

---

✅ **Sistema de Chat em Tempo Real Implementado e Funcional!**

**WebSocket:** `ws://localhost:3001`
**REST API:** `http://localhost:3001/api/v1/chat`

Data de Implementação: 09/10/2025
