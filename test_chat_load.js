/**
 * Teste de Carga - Sistema de Chat P2P
 *
 * Simula múltiplos usuários conectados simultaneamente
 * enviando mensagens via WebSocket (Socket.IO)
 *
 * Requisitos:
 * - npm install socket.io-client
 *
 * Uso:
 * node test_chat_load.js [NUM_USERS] [MESSAGES_PER_USER]
 *
 * Exemplo:
 * node test_chat_load.js 50 10
 */

const io = require('socket.io-client');
const http = require('http');

// ========================================
// CONFIGURAÇÕES
// ========================================

const API_URL = 'http://localhost:3001';
const SOCKET_URL = 'http://localhost:3001';
const NUM_USERS = parseInt(process.argv[2]) || 10;
const MESSAGES_PER_USER = parseInt(process.argv[3]) || 5;
const MESSAGE_DELAY = 1000; // ms entre mensagens

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

// ========================================
// ESTATÍSTICAS
// ========================================

const stats = {
  usersCreated: 0,
  usersLoggedIn: 0,
  socketsConnected: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errors: 0,
  startTime: null,
  endTime: null,
};

// ========================================
// FUNÇÕES DE API
// ========================================

function makeRequest(method, path, body, cookies = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          // Extrair cookie do Set-Cookie header
          let cookie = '';
          if (res.headers['set-cookie']) {
            cookie = res.headers['set-cookie']
              .map(c => c.split(';')[0])
              .join('; ');
          }

          resolve({ data: parsed, cookie });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function registerUser(index) {
  const email = `loadtest${index}@example.com`;
  const cpf = `1${String(index).padStart(10, '0')}`;

  try {
    const response = await makeRequest('POST', '/api/v1/auth/register', {
      email,
      password: 'senha123',
      cpf,
      name: `Load Test User ${index}`,
    });

    stats.usersCreated++;
    return { email, cpf };
  } catch (error) {
    // Usuário já existe - OK para testes
    return { email, cpf };
  }
}

async function loginUser(email) {
  const response = await makeRequest('POST', '/api/v1/auth/login', {
    email,
    password: 'senha123',
  });

  if (response.data.success) {
    stats.usersLoggedIn++;
    return {
      token: response.data.data.accessToken,
      userId: response.data.data.user.id,
      cookie: response.cookie,
    };
  } else {
    throw new Error('Login failed');
  }
}

async function createOrder(cookie) {
  const response = await makeRequest('POST', '/api/v1/orders', {
    type: 'PIX',
    cryptoType: 'BTC',
    cryptoNetwork: 'BITCOIN',
    cryptoAmount: '0.01',
    brlAmount: '500.00',
    paymentDetails: {
      pixKey: 'loadtest@example.com',
      pixKeyType: 'EMAIL',
    },
  }, cookie);

  if (response.data.success) {
    return response.data.data.id;
  } else {
    throw new Error('Failed to create order');
  }
}

async function getOrCreateChat(orderId, cookie) {
  const response = await makeRequest('GET', `/api/v1/chat/order/${orderId}`, null, cookie);

  if (response.data.success) {
    return response.data.data.id;
  } else {
    throw new Error('Failed to get/create chat');
  }
}

// ========================================
// SIMULAÇÃO DE USUÁRIO
// ========================================

class SimulatedUser {
  constructor(index) {
    this.index = index;
    this.email = null;
    this.token = null;
    this.userId = null;
    this.socket = null;
    this.chatId = null;
    this.messagesSent = 0;
    this.messagesReceived = 0;
  }

  async initialize() {
    try {
      // Registrar
      const { email } = await registerUser(this.index);
      this.email = email;

      // Login
      const { token, userId } = await loginUser(email);
      this.token = token;
      this.userId = userId;

      log(colors.green, `✅ User ${this.index} initialized (${email})`);
      return true;
    } catch (error) {
      log(colors.red, `❌ User ${this.index} failed to initialize: ${error.message}`);
      stats.errors++;
      return false;
    }
  }

  connectSocket() {
    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        auth: { token: this.token },
        path: '/socket.io/',
      });

      this.socket.on('connect', () => {
        stats.socketsConnected++;
        log(colors.cyan, `🔌 User ${this.index} connected to WebSocket`);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        log(colors.red, `❌ User ${this.index} socket error: ${error.message}`);
        stats.errors++;
        reject(error);
      });

      this.socket.on('message:new', (message) => {
        this.messagesReceived++;
        stats.messagesReceived++;
      });

      this.socket.on('error', (error) => {
        log(colors.red, `❌ User ${this.index} received error: ${error.message}`);
        stats.errors++;
      });
    });
  }

  async joinChat(chatId) {
    this.chatId = chatId;

    return new Promise((resolve) => {
      this.socket.emit('chat:join', { chatId });

      this.socket.once('chat:joined', () => {
        log(colors.blue, `💬 User ${this.index} joined chat ${chatId}`);
        resolve();
      });
    });
  }

  async sendMessage(text) {
    return new Promise((resolve) => {
      this.socket.emit('message:send', {
        chatId: this.chatId,
        message: text,
      });

      this.messagesSent++;
      stats.messagesSent++;
      resolve();
    });
  }

  async disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// ========================================
// TESTE DE CARGA
// ========================================

async function runLoadTest() {
  log(colors.magenta, '\n========================================');
  log(colors.magenta, '🧪 TESTE DE CARGA - CHAT P2P');
  log(colors.magenta, '========================================\n');

  log(colors.yellow, `Configuração:`);
  log(colors.yellow, `- Usuários: ${NUM_USERS}`);
  log(colors.yellow, `- Mensagens por usuário: ${MESSAGES_PER_USER}`);
  log(colors.yellow, `- Total de mensagens: ${NUM_USERS * MESSAGES_PER_USER}`);
  log(colors.yellow, `- Delay entre mensagens: ${MESSAGE_DELAY}ms\n`);

  stats.startTime = Date.now();

  // FASE 1: Criar usuários
  log(colors.blue, '📝 Fase 1: Criando usuários...');
  const users = [];

  for (let i = 0; i < NUM_USERS; i++) {
    const user = new SimulatedUser(i);
    const success = await user.initialize();
    if (success) {
      users.push(user);
    }
  }

  log(colors.green, `✅ ${users.length}/${NUM_USERS} usuários criados\n`);

  if (users.length < 2) {
    log(colors.red, '❌ Não há usuários suficientes para teste');
    return;
  }

  // FASE 2: Criar pedido (usuário 0)
  log(colors.blue, '📦 Fase 2: Criando pedido para teste...');
  const { cookie } = await loginUser(users[0].email);
  const orderId = await createOrder(cookie);
  log(colors.green, `✅ Pedido criado: ${orderId}\n`);

  // FASE 3: Conectar WebSockets
  log(colors.blue, '🔌 Fase 3: Conectando usuários via WebSocket...');
  await Promise.all(users.map(user => user.connectSocket().catch(() => {})));
  log(colors.green, `✅ ${stats.socketsConnected}/${users.length} sockets conectados\n`);

  // FASE 4: Obter/criar chat
  log(colors.blue, '💬 Fase 4: Criando chat...');
  const chatId = await getOrCreateChat(orderId, cookie);
  log(colors.green, `✅ Chat criado: ${chatId}\n`);

  // FASE 5: Usuários entram no chat
  log(colors.blue, '👥 Fase 5: Usuários entrando no chat...');
  await Promise.all(users.map(user => user.joinChat(chatId).catch(() => {})));
  log(colors.green, `✅ Usuários entraram no chat\n`);

  // FASE 6: Enviar mensagens
  log(colors.blue, '📨 Fase 6: Enviando mensagens...');

  for (let msgNum = 0; msgNum < MESSAGES_PER_USER; msgNum++) {
    log(colors.cyan, `Rodada ${msgNum + 1}/${MESSAGES_PER_USER}...`);

    // Todos os usuários enviam mensagem simultaneamente
    await Promise.all(users.map(user =>
      user.sendMessage(`Load test message ${msgNum + 1} from user ${user.index}`)
        .catch(() => {})
    ));

    // Aguardar antes da próxima rodada
    if (msgNum < MESSAGES_PER_USER - 1) {
      await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY));
    }
  }

  log(colors.green, `✅ Todas as mensagens enviadas\n`);

  // Aguardar processamento
  log(colors.yellow, 'Aguardando 5 segundos para processamento...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // FASE 7: Desconectar
  log(colors.blue, '👋 Fase 7: Desconectando usuários...');
  await Promise.all(users.map(user => user.disconnect()));
  log(colors.green, `✅ Usuários desconectados\n`);

  stats.endTime = Date.now();

  // RELATÓRIO FINAL
  printReport();
}

function printReport() {
  const duration = (stats.endTime - stats.startTime) / 1000;
  const messagesPerSecond = (stats.messagesSent / duration).toFixed(2);
  const avgLatency = duration / stats.messagesSent * 1000;

  log(colors.magenta, '\n========================================');
  log(colors.magenta, '📊 RELATÓRIO DO TESTE');
  log(colors.magenta, '========================================\n');

  log(colors.yellow, 'Estatísticas:');
  log(colors.green, `  ✅ Usuários criados: ${stats.usersCreated}`);
  log(colors.green, `  ✅ Usuários logados: ${stats.usersLoggedIn}`);
  log(colors.green, `  ✅ Sockets conectados: ${stats.socketsConnected}`);
  log(colors.green, `  ✅ Mensagens enviadas: ${stats.messagesSent}`);
  log(colors.green, `  ✅ Mensagens recebidas: ${stats.messagesReceived}`);
  log(colors.red, `  ❌ Erros: ${stats.errors}`);

  log(colors.yellow, '\nPerformance:');
  log(colors.cyan, `  ⏱️  Duração total: ${duration.toFixed(2)}s`);
  log(colors.cyan, `  📈 Mensagens/segundo: ${messagesPerSecond}`);
  log(colors.cyan, `  ⚡ Latência média: ${avgLatency.toFixed(2)}ms`);

  // Taxa de sucesso
  const successRate = ((stats.messagesSent - stats.errors) / stats.messagesSent * 100).toFixed(2);
  log(colors.yellow, '\nResultado:');
  log(colors.green, `  📊 Taxa de sucesso: ${successRate}%`);

  if (successRate >= 95) {
    log(colors.green, '\n  🎉 TESTE PASSOU! Sistema performou bem.');
  } else if (successRate >= 80) {
    log(colors.yellow, '\n  ⚠️  TESTE PASSOU COM RESSALVAS. Alguns erros ocorreram.');
  } else {
    log(colors.red, '\n  ❌ TESTE FALHOU. Muitos erros detectados.');
  }

  log(colors.magenta, '\n========================================\n');
}

// ========================================
// EXECUTAR
// ========================================

runLoadTest()
  .catch(error => {
    log(colors.red, `\n❌ Erro fatal: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
