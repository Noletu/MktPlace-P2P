# ✅ Checklist de Teste Rápido - Chat P2P

**Versão**: 1.0
**Tempo estimado**: 30-40 minutos
**Objetivo**: Validar funcionalidade crítica do sistema de chat

---

## 📋 Pré-requisitos

### 1. Ambiente Limpo
- [ ] Deletar banco de dados: `rm apps/api/dev.db apps/api/dev.db-journal`
- [ ] Recriar banco: `cd apps/api && npx prisma db push && npx prisma db seed`
- [ ] Backend rodando: Terminal 1 → `cd apps/api && npm run dev`
- [ ] Frontend rodando: Terminal 2 → `cd apps/web && npm run dev`

### 2. Navegadores Prontos
- [ ] **Chrome** aberto em http://localhost:3000
- [ ] **Firefox** (ou Chrome Anônimo) aberto em http://localhost:3000
- [ ] DevTools Console aberto em **ambos** os navegadores
- [ ] Network tab visível em **ambos**

---

## 🔴 TESTE CRÍTICO #1: Primeiro Comprador Inicia Negociação

### Navegador 1 - Chrome (Usuário A: "teste")

#### Registro e Login
- [ ] Clicar em "Registrar"
- [ ] Preencher:
  - Email: `teste@example.com`
  - Senha: `senha123`
  - CPF: `123.456.789-01`
  - Nome: `Usuário Teste`
- [ ] Clicar "Criar Conta"
- [ ] **VERIFICAR**: Redirecionado para dashboard

#### Criar Pedido PIX
- [ ] Clicar em "Criar Pedido" (menu ou botão)
- [ ] Preencher:
  - Tipo: **PIX**
  - Valor BRL: `500.00`
  - Criptomoeda: **BTC**
  - Rede: **BITCOIN**
  - Valor Crypto: `0.01`
  - Chave PIX: `teste@example.com`
  - Tipo de Chave: **Email**
- [ ] Clicar "Criar Pedido"
- [ ] **VERIFICAR**: Mensagem de sucesso
- [ ] Ir para "Meus Pedidos"
- [ ] **VERIFICAR**: Pedido aparece com status **PENDING**
- [ ] Anotar URL do pedido: `/orders/[orderId]`

---

### Navegador 2 - Firefox (Usuário B: "teste2")

#### Registro e Login
- [ ] Clicar em "Registrar"
- [ ] Preencher:
  - Email: `teste2@example.com`
  - Senha: `senha123`
  - CPF: `987.654.321-01`
  - Nome: `Usuário Teste 2`
- [ ] Clicar "Criar Conta"
- [ ] **VERIFICAR**: Redirecionado para dashboard

#### Acessar Marketplace
- [ ] Clicar em "Marketplace" no menu
- [ ] **VERIFICAR**: Pedido de "teste" aparece na lista
- [ ] **VERIFICAR**: Card mostra:
  - R$ 500.00
  - PIX
  - BTC
  - Status: PENDING ou IN_NEGOTIATION

#### Iniciar Negociação (Enviar Primeira Mensagem)
- [ ] Clicar no card do pedido ou botão "Ver Detalhes"
- [ ] Procurar botão "Enviar Mensagem" ou "Iniciar Chat"
- [ ] Clicar no botão
- [ ] **VERIFICAR**: Modal ou chat abre
- [ ] Digitar: `Olá! Tenho interesse no seu pedido de R$ 500.`
- [ ] Clicar "Enviar"
- [ ] **VERIFICAR**: Mensagem aparece no chat
- [ ] **VERIFICAR**: Console sem erros 🚨
- [ ] **VERIFICAR**: Network tab sem erro 400 🚨

---

### Navegador 1 - Chrome (Usuário A: "teste") - VALIDAÇÃO CRÍTICA

#### Receber Notificação
- [ ] **VERIFICAR**: Notificação aparece (top-right ou popup)
- [ ] **VERIFICAR**: Título: "Negociação Iniciada" ou similar
- [ ] Clicar na notificação OU ir para "Meus Pedidos"

#### Acessar Detalhes do Pedido
- [ ] Clicar no pedido criado
- [ ] **VERIFICAR CRÍTICO**: Status mudou para **IN_NEGOTIATION** ⚠️
- [ ] **VERIFICAR CRÍTICO**: Botão **"💬 Abrir Chat"** está VISÍVEL ⚠️
- [ ] **VERIFICAR**: Se houver badge com número, mostra "1" (mensagem não lida)

#### Abrir Chat
- [ ] Clicar no botão "💬 Abrir Chat"
- [ ] **VERIFICAR CRÍTICO**: Chat abre sem erro ⚠️
- [ ] **VERIFICAR CRÍTICO**: Console sem erro 400 ⚠️
- [ ] **VERIFICAR**: Mensagem de teste2 está visível:
  ```
  Usuário Teste 2: Olá! Tenho interesse no seu pedido de R$ 500.
  ```

#### Responder no Chat
- [ ] Input de mensagem está ativo (não bloqueado)
- [ ] Digitar: `Olá! Sim, o pedido está disponível. Podemos prosseguir.`
- [ ] Clicar "Enviar"
- [ ] **VERIFICAR**: Mensagem aparece no chat
- [ ] **VERIFICAR**: Console sem erros

---

### Navegador 2 - Firefox (Usuário B: "teste2") - Confirmação

#### Ver Resposta em Tempo Real
- [ ] **VERIFICAR**: Mensagem de "teste" aparece automaticamente no chat (WebSocket)
- [ ] **VERIFICAR**: Texto: `Olá! Sim, o pedido está disponível. Podemos prosseguir.`
- [ ] **VERIFICAR**: Sender: "Usuário Teste"

#### Testar Indicador de Digitação
- [ ] No chat de teste2, começar a digitar (não enviar)
- [ ] **VERIFICAR** (Chrome - teste): Aparece "Usuário Teste 2 está digitando..."
- [ ] Parar de digitar por 2 segundos
- [ ] **VERIFICAR** (Chrome): Indicador desaparece

---

## ✅ Critérios de Aprovação - Teste Crítico #1

**DEVE PASSAR** (❌ = BUG CRÍTICO):
- ✅ Botão de chat aparece para owner após primeira mensagem
- ✅ Owner consegue abrir o chat sem erro 400
- ✅ Owner vê mensagem do comprador
- ✅ Owner consegue responder
- ✅ Comprador vê resposta em tempo real

**Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU

---

## 🔴 TESTE CRÍTICO #2: Criptografia E2E

### Navegador 1 - Chrome (Usuário A)

#### Habilitar Criptografia (se houver toggle)
- [ ] Procurar toggle/botão "Criptografia E2E" ou similar
- [ ] Habilitar (se não estiver habilitado por padrão)
- [ ] **VERIFICAR**: Mensagem "Criptografia ativa" ou ícone de cadeado 🔒

#### Enviar Mensagem Criptografada
- [ ] Digitar: `Esta mensagem deve ser criptografada E2E 🔐`
- [ ] Enviar
- [ ] **VERIFICAR**: Mensagem aparece no chat de A (descriptografada)

### Navegador 2 - Firefox (Usuário B)

#### Receber e Descriptografar
- [ ] **VERIFICAR**: Mensagem aparece automaticamente
- [ ] **VERIFICAR**: Texto legível: `Esta mensagem deve ser criptografada E2E 🔐`
- [ ] **VERIFICAR**: Ícone de cadeado ou indicador de criptografia

### Backend - Verificar Criptografia

#### Abrir Prisma Studio
- [ ] Novo terminal: `cd apps/api && npx prisma studio`
- [ ] Abrir em http://localhost:5555
- [ ] Ir para tabela `ChatMessage`
- [ ] Encontrar última mensagem

#### Validações
- [ ] Campo `isEncrypted` = `true`
- [ ] Campo `encryptedContent` tem valor (base64)
- [ ] Campo `iv` tem valor (initialization vector)
- [ ] Campo `message` é `null` ou vazio
- [ ] **IMPORTANTE**: Backend NÃO tem acesso ao texto original

---

## 🟢 TESTE ADICIONAL: Fluxo Completo até MATCHED

### Navegador 2 - Firefox (Usuário B)

#### Aceitar Pedido
- [ ] Fechar chat (se estiver aberto)
- [ ] Procurar botão "Aceitar Pedido" ou "Match"
- [ ] Clicar
- [ ] Confirmar (se houver modal de confirmação)
- [ ] **VERIFICAR**: Status muda para **MATCHED**

### Ambos os Navegadores

#### Chat Continua Ativo
- [ ] (Chrome) Abrir chat
- [ ] (Firefox) Abrir chat
- [ ] **VERIFICAR**: Chat continua funcionando
- [ ] **VERIFICAR**: Histórico de mensagens preservado
- [ ] Trocar 2-3 mensagens para confirmar
- [ ] **VERIFICAR**: Mensagens entregues em tempo real

---

## 🟢 TESTE ADICIONAL: Contador de Não Lidas

### Navegador 2 - Firefox (Usuário B)

#### Enviar Mensagens Sem Abrir Chat
- [ ] Fechar chat (clicar fora ou botão X)
- [ ] Enviar mensagem via API OU aguardar A enviar mensagem

### Navegador 1 - Chrome (Usuário A)

#### Verificar Badge
- [ ] Fechar chat (se estiver aberto)
- [ ] Ir para "Meus Pedidos" ou página do pedido
- [ ] **VERIFICAR**: Badge no botão de chat mostra número (ex: "1", "2")
- [ ] **VERIFICAR**: Badge tem animação de pulse (vermelho piscando)
- [ ] Clicar no chat
- [ ] **VERIFICAR**: Badge desaparece
- [ ] **VERIFICAR**: Mensagens marcadas como lidas

---

## 🟡 TESTE DE TIMEOUT (OPCIONAL - 10 minutos)

⚠️ **Só executar se houver tempo disponível**

### Preparação
- [ ] Criar novo pedido (usuário A)
- [ ] Outro usuário envia primeira mensagem (status → IN_NEGOTIATION)
- [ ] **NÃO ACEITAR** o pedido
- [ ] Anotar horário: `___:___`

### Aguardar
- [ ] Esperar 10 minutos (pode fazer outros testes)
- [ ] Após 10 min + 1 min (11 min total)

### Validações
- [ ] Recarregar página do pedido
- [ ] **VERIFICAR**: Status voltou para **PENDING**
- [ ] **VERIFICAR**: `negotiatingUserId` = null (Prisma Studio)
- [ ] Tentar abrir chat
- [ ] **VERIFICAR**: Chat está vazio (mensagens deletadas)
- [ ] **VERIFICAR**: Owner recebeu notificação de timeout

---

## 🔒 TESTE DE SEGURANÇA

### Teste 1: Acesso Não Autorizado

#### Navegador 3 - Janela Anônima (Usuário C)
- [ ] Abrir nova janela anônima
- [ ] Registrar usuário `teste3@example.com`
- [ ] Tentar acessar diretamente URL do chat de A e B:
  ```
  http://localhost:3000/orders/[orderId]/chat
  ```
- [ ] **VERIFICAR**: Acesso bloqueado ou chat vazio
- [ ] Abrir DevTools → Network
- [ ] **VERIFICAR**: API retorna 403 Forbidden

### Teste 2: XSS (Cross-Site Scripting)

#### Navegador 1 - Chrome (Usuário A)
- [ ] Enviar mensagem maliciosa:
  ```
  <script>alert('XSS')</script>
  ```
- [ ] Enviar

#### Navegador 2 - Firefox (Usuário B)
- [ ] **VERIFICAR**: Texto aparece como string (não executa script)
- [ ] **VERIFICAR**: Não há popup de alert
- [ ] **VERIFICAR**: Texto visível: `<script>alert('XSS')</script>`

---

## 📊 RESUMO FINAL

### Testes Críticos
- [ ] ✅ Teste #1: Primeiro comprador inicia negociação - **PASSOU**
- [ ] ✅ Teste #2: Criptografia E2E - **PASSOU**

### Testes Adicionais
- [ ] ✅ Fluxo completo até MATCHED - **PASSOU**
- [ ] ✅ Contador de não lidas - **PASSOU**
- [ ] ✅ Teste de timeout (opcional) - **PASSOU** / **NÃO EXECUTADO**
- [ ] ✅ Teste de segurança - **PASSOU**

### Resultado Geral
- [ ] **TODOS OS CRÍTICOS PASSARAM** → ✅ Sistema aprovado
- [ ] **ALGUM CRÍTICO FALHOU** → ❌ Bug crítico pendente

---

## 📝 Anotações e Bugs Encontrados

```
[Espaço para anotar bugs, comportamentos inesperados, observações]

Exemplo:
- Bug: Chat não abre para owner (Teste #1, passo X)
- Descrição: Ao clicar em "Abrir Chat", erro 400 no console
- URL com erro: GET /api/v1/chat/order/cmg...
- Navegador: Chrome
- Observação: Network tab mostra "Chat não disponível"
```

---

## 🔗 Referências Rápidas

### Credenciais Admin (se necessário)
- Master: `master@mktplace.com` / `Master@2025!`
- Admin: `admin@mktplace.com` / `Admin@123`

### URLs Úteis
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health
- Prisma Studio: http://localhost:5555 (após `npx prisma studio`)

### Comandos Rápidos
```bash
# Recriar banco
cd apps/api && rm -f dev.db && npx prisma db push && npx prisma db seed

# Ver logs do backend
# (Observar terminal do backend)

# Rodar testes automatizados
cd /c/Projects/Mktplace-p2p && ./test_chat_api.sh
```

---

**Tempo Total Estimado**: 30-40 minutos

**Última Atualização**: 20/10/2025
