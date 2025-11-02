# Guia de Testes - Mktplace da Liberdade

**Versão:** 0.4.0
**Data:** 01/11/2025

## 📋 Índice

1. [Instalação](#instalação)
2. [Executando Testes](#executando-testes)
3. [Estrutura de Testes](#estrutura-de-testes)
4. [Cobertura](#cobertura)
5. [Testes Backend](#testes-backend)
6. [Testes Frontend](#testes-frontend)
7. [Testes de Integração](#testes-de-integração)
8. [CI/CD](#cicd)

---

## Instalação

### Backend (API)

```bash
cd apps/api

# Instalar dependências de teste
npm install --save-dev \
  jest \
  @types/jest \
  ts-jest \
  @types/supertest \
  supertest
```

### Frontend (Web)

```bash
cd apps/web

# Instalar dependências de teste
npm install --save-dev \
  jest \
  @types/jest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jest-environment-jsdom
```

---

## Executando Testes

### Backend

```bash
cd apps/api

# Executar todos os testes
npm test

# Executar em modo watch (desenvolvimento)
npm run test:watch

# Executar com coverage
npm run test:coverage

# Executar apenas testes de unidade
npm test -- notification.service.test

# Executar apenas testes de integração
npm test -- notification.socket.test
```

### Frontend

```bash
cd apps/web

# Executar todos os testes
npm test

# Executar em modo watch
npm run test:watch

# Executar com coverage
npm run test:coverage

# Executar apenas componente específico
npm test -- NotificationBell.test
```

### Executar Testes de Todo o Projeto (Raiz)

```bash
# Da raiz do monorepo
npm test
```

---

## Estrutura de Testes

### Backend (`apps/api`)

```
apps/api/
├── jest.config.js                           # Configuração Jest
├── src/
│   ├── __tests__/
│   │   └── setup.ts                          # Setup global
│   ├── services/
│   │   └── __tests__/
│   │       └── notification.service.test.ts  # Testes unitários
│   └── socket/
│       └── __tests__/
│           └── notification.socket.test.ts   # Testes de integração
```

### Frontend (`apps/web`)

```
apps/web/
├── jest.config.js                                  # Configuração Jest
├── jest.setup.js                                   # Setup global
└── components/
    └── __tests__/
        ├── NotificationBell.test.tsx               # Testes de componente
        ├── ReviewResponseForm.test.tsx             # Testes de componente
        └── Toast.test.tsx                          # Testes de componente
```

---

## Cobertura

### Metas de Cobertura

Configuradas no `jest.config.js`:

**Backend:**
- Statements: 80%
- Branches: 70%
- Functions: 80%
- Lines: 80%

**Frontend:**
- Statements: 70%
- Branches: 65%
- Functions: 70%
- Lines: 70%

### Gerar Relatório de Cobertura

```bash
# Backend
cd apps/api && npm run test:coverage

# Frontend
cd apps/web && npm run test:coverage
```

Relatórios serão gerados em:
- Backend: `apps/api/coverage/`
- Frontend: `apps/web/coverage/`

Abra `coverage/lcov-report/index.html` no navegador para visualizar.

---

## Testes Backend

### 1. Testes Unitários - NotificationService

**Arquivo:** `apps/api/src/services/__tests__/notification.service.test.ts`

**Cobertura:**
- ✅ `createNotification()` - Criação de notificações
- ✅ `getUserNotifications()` - Busca com filtros
- ✅ `markAsRead()` - Marcar como lida
- ✅ `markAllAsRead()` - Marcar todas como lidas
- ✅ `deleteNotification()` - Deletar notificação
- ✅ `deleteAllRead()` - Deletar todas lidas
- ✅ `getUnreadCount()` - Contar não lidas

**Total:** 19 testes

**Casos Testados:**
- ✅ Criação com dados válidos
- ✅ Valores padrão (prioridade NORMAL)
- ✅ Erros de validação
- ✅ Permissões de usuário
- ✅ Notificações já lidas (idempotência)
- ✅ Contadores

**Exemplo de Teste:**

```typescript
it('deve criar uma notificação com sucesso', async () => {
  const mockNotification = {
    id: 'notification-1',
    userId: 'user-1',
    type: 'ORDER_MATCHED',
    category: 'ORDER',
    title: 'Pedido Pareado',
    message: 'Seu pedido foi pareado',
    priority: 'HIGH',
    isRead: false,
    createdAt: new Date(),
  };

  prisma.notification.create.mockResolvedValue(mockNotification);

  const result = await notificationService.createNotification({
    userId: 'user-1',
    type: 'ORDER_MATCHED',
    category: 'ORDER',
    title: 'Pedido Pareado',
    message: 'Seu pedido foi pareado',
    priority: 'HIGH',
  });

  expect(result).toEqual(mockNotification);
});
```

### 2. Testes de Integração - WebSocket

**Arquivo:** `apps/api/src/socket/__tests__/notification.socket.test.ts`

**Cobertura:**
- ✅ Autenticação JWT
- ✅ Conexão/Desconexão
- ✅ Eventos em tempo real
- ✅ Isolamento de usuários
- ✅ Gerenciamento de salas

**Total:** 11 testes

**Casos Testados:**
- ✅ Aceitar conexão com token válido
- ✅ Rejeitar sem token
- ✅ Rejeitar com token inválido
- ✅ Receber `notification:connected`
- ✅ Receber `notification:new`
- ✅ Receber `notification:read`
- ✅ Receber `notification:all-read`
- ✅ Receber `notification:deleted`
- ✅ Receber `notification:count`
- ✅ Isolamento entre usuários
- ✅ Rastreamento de conexões

**Exemplo de Teste:**

```typescript
it('deve receber evento notification:new quando notificação for enviada', (done) => {
  clientSocket = Client(`http://localhost:${port}`, {
    path: '/socket.io/',
    auth: { token },
  });

  clientSocket.on('connect', () => {
    const notification = {
      id: 'notification-1',
      title: 'Teste',
      message: 'Mensagem de teste',
      category: 'TEST',
      priority: 'NORMAL',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    notificationSocket.sendNotificationToUser('user-1', notification);
  });

  clientSocket.on('notification:new', (notification) => {
    expect(notification.id).toBe('notification-1');
    expect(notification.title).toBe('Teste');
    done();
  });
});
```

---

## Testes Frontend

### 1. Testes de Componente - NotificationBell

**Arquivo:** `apps/web/components/__tests__/NotificationBell.test.tsx`

**Cobertura:**
- ✅ Renderização básica
- ✅ Badge de contador
- ✅ Dropdown
- ✅ Listagem de notificações
- ✅ Navegação
- ✅ Ações (marcar lida, ver todas)

**Total:** 12 testes

**Casos Testados:**
- ✅ Renderizar sino
- ✅ Mostrar badge com número correto
- ✅ Mostrar "9+" quando > 9
- ✅ Abrir/fechar dropdown
- ✅ Mostrar "Nenhuma notificação"
- ✅ Listar notificações
- ✅ Navegar ao clicar em notificação
- ✅ Botão "Marcar todas como lidas"
- ✅ Chamar API ao marcar
- ✅ Link "Ver todas as notificações"
- ✅ Navegar para /notifications
- ✅ Fechar ao clicar fora

### 2. Testes de Componente - ReviewResponseForm

**Arquivo:** `apps/web/components/__tests__/ReviewResponseForm.test.tsx`

**Cobertura:**
- ✅ Renderização
- ✅ Validação
- ✅ Contador de caracteres
- ✅ Estados de loading
- ✅ Envio de formulário
- ✅ Tratamento de erros

**Total:** 13 testes

**Casos Testados:**
- ✅ Renderizar formulário
- ✅ Contador de caracteres
- ✅ Atualizar contador ao digitar
- ✅ Warning < 50 caracteres
- ✅ Desabilitar botão quando vazio
- ✅ Habilitar com texto
- ✅ Erro resposta vazia
- ✅ Erro > 500 caracteres
- ✅ Enviar com sucesso
- ✅ Loading state
- ✅ Desabilitar durante loading
- ✅ Mostrar erro ao falhar
- ✅ Chamar onCancel
- ✅ Limpar após sucesso
- ✅ Trimmar espaços

### 3. Testes de Componente - Toast

**Arquivo:** `apps/web/components/__tests__/Toast.test.tsx`

**Cobertura:**
- ✅ Tipos de toast (success, error, warning, info)
- ✅ Auto-close
- ✅ Classes e estilos
- ✅ Container múltiplos toasts

**Total:** 10 testes

---

## Scripts package.json

### Backend (`apps/api/package.json`)

Adicione à seção `scripts`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:verbose": "jest --verbose"
  }
}
```

### Frontend (`apps/web/package.json`)

Adicione à seção `scripts`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:verbose": "jest --verbose"
  }
}
```

### Raiz (`package.json`)

Adicione à seção `scripts`:

```json
{
  "scripts": {
    "test": "npm run test --workspaces",
    "test:api": "npm test --workspace=apps/api",
    "test:web": "npm test --workspace=apps/web",
    "test:coverage": "npm run test:coverage --workspaces"
  }
}
```

---

## CI/CD

### GitHub Actions

Crie `.github/workflows/tests.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd apps/api && npm ci
      - name: Run tests
        run: cd apps/api && npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/api/coverage/lcov.info
          flags: backend

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd apps/web && npm ci
      - name: Run tests
        run: cd apps/web && npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/web/coverage/lcov.info
          flags: frontend
```

---

## Boas Práticas

### 1. Nomenclatura

```typescript
// ✅ BOM
describe('NotificationService', () => {
  describe('createNotification', () => {
    it('deve criar uma notificação com sucesso', () => {});
    it('deve lançar erro quando dados inválidos', () => {});
  });
});

// ❌ RUIM
test('notification test', () => {});
```

### 2. AAA Pattern (Arrange, Act, Assert)

```typescript
it('deve marcar notificação como lida', async () => {
  // Arrange
  const mockNotification = { id: '1', isRead: false };
  prisma.notification.findUnique.mockResolvedValue(mockNotification);

  // Act
  const result = await notificationService.markAsRead('1', 'user-1');

  // Assert
  expect(result.isRead).toBe(true);
});
```

### 3. Mocking

```typescript
// ✅ Mock apenas o necessário
jest.mock('../socket/notification.socket', () => ({
  getNotificationSocket: jest.fn(() => ({
    sendNotificationToUser: jest.fn(),
  })),
}));

// ❌ Evitar mocks globais excessivos
```

### 4. Limpeza

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

---

## Troubleshooting

### Erro: "Cannot find module '@testing-library/react'"

```bash
cd apps/web
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

### Erro: "ReferenceError: TextEncoder is not defined"

Adicione ao `jest.setup.js`:

```javascript
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
```

### Testes de WebSocket falhando

Certifique-se de que a porta 3002 está livre ou ajuste no teste.

### Coverage não está sendo gerado

Verifique se o `collectCoverageFrom` no `jest.config.js` está correto.

---

## Estatísticas de Testes

### Backend
- **Arquivos de teste:** 2
- **Total de testes:** 30
- **Coverage alvo:** 80%

### Frontend
- **Arquivos de teste:** 3
- **Total de testes:** 35
- **Coverage alvo:** 70%

### Total Geral
- **Arquivos de teste:** 5
- **Total de testes:** 65+
- **Tempo de execução:** ~10-15 segundos

---

## Comandos Rápidos

```bash
# Instalar tudo (raiz)
npm run install:test-deps

# Executar todos os testes
npm test

# Backend apenas
npm run test:api

# Frontend apenas
npm run test:web

# Com coverage
npm run test:coverage

# Watch mode (desenvolvimento)
cd apps/api && npm run test:watch
cd apps/web && npm run test:watch
```

---

**Desenvolvido com ❤️ para Mktplace da Liberdade**
**Versão 0.4.0 - Novembro 2025**
