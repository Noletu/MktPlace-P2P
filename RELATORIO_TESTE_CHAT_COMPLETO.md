# 🧪 Plano Completo de Testes - Sistema de Chat P2P

**Projeto**: Mktplace da Liberdade
**Versão**: 0.2.4
**Data de Criação**: 20/10/2025
**Responsável**: [A preencher]

---

## 📋 Índice

1. [Objetivo dos Testes](#objetivo-dos-testes)
2. [Escopo e Tecnologias](#escopo-e-tecnologias)
3. [Matriz de Cenários (72 testes)](#matriz-de-cenários)
4. [Instruções de Execução](#instruções-de-execução)
5. [Critérios de Aprovação](#critérios-de-aprovação)
6. [Template de Relatório](#template-de-relatório)

---

## 🎯 Objetivo dos Testes

Validar **exaustivamente** o sistema de chat em tempo real, garantindo que:

- ✅ Chat funciona em **todos os status de pedido** relevantes
- ✅ Mensagens são entregues **em tempo real** via WebSocket
- ✅ **Criptografia E2E** funciona corretamente
- ✅ **Sistema de negociação** com timeout de 10 minutos opera conforme esperado
- ✅ **Segurança e permissões** estão implementadas
- ✅ **Performance** é aceitável (latência < 100ms)
- ✅ **Integração** com outros sistemas (notificações, audit logs, etc.) funciona
- ✅ **Edge cases** são tratados adequadamente

---

## 🔧 Escopo e Tecnologias

### Componentes Testados

- **Backend**: Socket.IO server + REST API (`chat.service.ts`, `chat.socket.ts`)
- **Frontend**: Cliente Socket.IO + Criptografia E2E (`useChat.ts`)
- **Banco de Dados**: Models `Chat` e `ChatMessage` (Prisma + SQLite)
- **Workers**: Negotiation timeout worker, Presence monitor
- **Integrações**: Notificações, Audit logs, Sistema de negociação

### Status de Pedidos Relevantes

| Status | Chat Disponível? | Observações |
|--------|------------------|-------------|
| `PENDING` | ❌ Não | Pedido no marketplace, sem negociação |
| `IN_NEGOTIATION` | ✅ Sim | Primeira mensagem enviada, reservado por 10 min |
| `MATCHED` | ✅ Sim | Pedido aceito, transaction criada |
| `PAYMENT_SENT` | ✅ Sim | Comprovante enviado |
| `VALIDATING` | ✅ Sim | Validando pagamento |
| `COMPLETED` | ✅ Sim (histórico) | Transação concluída |
| `CANCELLED` | ⚠️ Depende | Chat acessível mas pode ser read-only |

---

## 📊 Matriz de Cenários

### FASE 1: Testes Funcionais Básicos (30 cenários)

#### 1.1 Criação e Acesso ao Chat (8 cenários)

| ID | Cenário | Prioridade | Status | Observações |
|----|---------|------------|--------|-------------|
| 1.1.1 | Primeiro comprador inicia negociação | 🔴 CRÍTICO | ⏳ Pendente | **Bug em investigação** |
| 1.1.2 | Owner tenta acessar chat antes de negociação | 🟡 Médio | ⏳ Pendente | Deve bloquear |
| 1.1.3 | Owner acessa chat após negociação iniciada | 🔴 CRÍTICO | ⏳ Pendente | **Correção v0.2.4** |
| 1.1.4 | Segundo comprador tenta entrar em negociação ativa | 🟡 Médio | ⏳ Pendente | Deve bloquear |
| 1.1.5 | Chat após pedido MATCHED | 🟢 Alto | ⏳ Pendente | |
| 1.1.6 | Chat após PAYMENT_SENT | 🟢 Alto | ⏳ Pendente | |
| 1.1.7 | Chat em pedido COMPLETED | 🟡 Médio | ⏳ Pendente | Histórico |
| 1.1.8 | Chat em pedido CANCELLED | 🟡 Médio | ⏳ Pendente | |

**Passos Detalhados - Cenário 1.1.1** (Mais Crítico):

1. **Preparação**:
   - Deletar banco de dados: `rm apps/api/dev.db`
   - Recriar: `cd apps/api && npx prisma db push && npx prisma db seed`
   - Iniciar backend: `cd apps/api && npm run dev`
   - Iniciar frontend: `cd apps/web && npm run dev`

2. **Execução**:
   - Abrir navegador 1 (Chrome): http://localhost:3000
   - Registrar usuário "teste" (teste@example.com / senha123)
   - Logar como "teste"
   - Criar pedido PIX de R$ 500 (BTC/BITCOIN)
   - **Verificar**: Pedido aparece em "Meus Pedidos" com status PENDING

3. **Negociação**:
   - Abrir navegador 2 (Firefox ou janela anônima): http://localhost:3000
   - Registrar usuário "teste2" (teste2@example.com / senha123)
   - Logar como "teste2"
   - Acessar Marketplace
   - Encontrar pedido de "teste"
   - Clicar em "Enviar Mensagem"
   - Digitar: "Olá, tenho interesse no seu pedido!"
   - Clicar "Enviar"

4. **Validações (Navegador 2 - teste2)**:
   - ✅ Mensagem aparece no chat de teste2
   - ✅ Nenhum erro no console
   - ✅ Nenhum erro 400 na Network tab

5. **Validações (Navegador 1 - teste)**:
   - ✅ Notificação aparece ("Negociação Iniciada")
   - ✅ Acessar detalhes do pedido
   - ✅ Status mudou para IN_NEGOTIATION
   - ✅ **VERIFICAR CRÍTICO**: Botão "💬 Abrir Chat" está visível
   - ✅ Clicar no botão de chat
   - ✅ Chat abre sem erro
   - ✅ Mensagem de teste2 está visível: "Olá, tenho interesse no seu pedido!"
   - ✅ Consegue digitar resposta
   - ✅ Digitar: "Olá! Sim, o pedido está disponível."
   - ✅ Enviar mensagem

6. **Validações Finais**:
   - ✅ Mensagem de "teste" aparece no chat de "teste2" em tempo real
   - ✅ Indicador "está digitando..." funciona
   - ✅ Contador de não lidas funciona
   - ✅ Backend logs: `[SOCKET] Message sent` aparece
   - ✅ Backend logs: `💬 First message sent - negotiation started` aparece

**Critério de Sucesso**: Todas as verificações acima passam ✅

---

#### 1.2 Envio e Recebimento de Mensagens (10 cenários)

| ID | Cenário | Prioridade | Status | Observações |
|----|---------|------------|--------|-------------|
| 1.2.1 | Mensagem de texto simples (não criptografada) | 🟢 Alto | ⏳ Pendente | |
| 1.2.2 | Mensagem criptografada E2E | 🔴 CRÍTICO | ⏳ Pendente | RSA + AES-GCM |
| 1.2.3 | Mensagem vazia | 🟡 Médio | ⏳ Pendente | Deve bloquear |
| 1.2.4 | Mensagem muito longa (>10k chars) | 🟢 Alto | ⏳ Pendente | |
| 1.2.5 | Múltiplas mensagens rápidas (spam) | 🟢 Alto | ⏳ Pendente | Rate limiting |
| 1.2.6 | Mensagem com caracteres especiais | 🟡 Médio | ⏳ Pendente | Emojis, acentos |
| 1.2.7 | Mensagem de sistema | 🟡 Médio | ⏳ Pendente | "🤝 Chat iniciado!" |
| 1.2.8 | Mensagem após reconexão WebSocket | 🟢 Alto | ⏳ Pendente | |
| 1.2.9 | Mensagem via REST API (fallback) | 🟡 Médio | ⏳ Pendente | |
| 1.2.10 | Mensagem com anexo (URL) | ⬜ Baixo | ⏳ Pendente | Se implementado |

---

#### 1.3 Indicadores de Status (6 cenários)

| ID | Cenário | Prioridade | Status | Observações |
|----|---------|------------|--------|-------------|
| 1.3.1 | Indicador "está digitando..." | 🟢 Alto | ⏳ Pendente | Debounce 1s |
| 1.3.2 | Marcação de mensagens como lidas | 🟢 Alto | ⏳ Pendente | `messages:read` |
| 1.3.3 | Contador de mensagens não lidas | 🟢 Alto | ⏳ Pendente | Badge com pulse |
| 1.3.4 | Status online/offline | 🟡 Médio | ⏳ Pendente | `user:online/offline` |
| 1.3.5 | Usuário entra no chat | 🟡 Médio | ⏳ Pendente | `chat:join` |
| 1.3.6 | Usuário sai do chat | 🟡 Médio | ⏳ Pendente | `chat:leave` |

---

#### 1.4 Sistema de Negociação (6 cenários)

| ID | Cenário | Prioridade | Status | Observações |
|----|---------|------------|--------|-------------|
| 1.4.1 | Timeout de negociação (10 minutos) | 🔴 CRÍTICO | ⏳ Pendente | Worker automático |
| 1.4.2 | Negociação cancelada manualmente | 🟢 Alto | ⏳ Pendente | |
| 1.4.3 | Negociação bem-sucedida (match) | 🔴 CRÍTICO | ⏳ Pendente | IN_NEGOTIATION → MATCHED |
| 1.4.4 | Negociação com múltiplos compradores (fila) | 🟡 Médio | ⏳ Pendente | |
| 1.4.5 | Limpeza de mensagens ao voltar para PENDING | 🟢 Alto | ⏳ Pendente | Chat zerado |
| 1.4.6 | Owner responde antes de timeout | 🟡 Médio | ⏳ Pendente | Sem renovação |

---

### FASE 2: Testes de Segurança e Permissões (12 cenários)

#### 2.1 Autenticação e Autorização (6 cenários)

| ID | Cenário | Prioridade | Status | Observações |
|----|---------|------------|--------|-------------|
| 2.1.1 | Conexão WebSocket sem token | 🔴 CRÍTICO | ⏳ Pendente | Deve rejeitar |
| 2.1.2 | Token JWT inválido | 🔴 CRÍTICO | ⏳ Pendente | Deve rejeitar |
| 2.1.3 | Usuário tenta acessar chat de outro pedido | 🔴 CRÍTICO | ⏳ Pendente | 403 Forbidden |
| 2.1.4 | Usuário tenta enviar mensagem em chat que não participa | 🔴 CRÍTICO | ⏳ Pendente | Socket.IO error |
| 2.1.5 | CSRF/Token hijacking | 🟢 Alto | ⏳ Pendente | |
| 2.1.6 | Rate limiting de mensagens | 🟡 Médio | ⏳ Pendente | Se implementado |

---

#### 2.2 Criptografia E2E (6 cenários)

| ID | Cenário | Prioridade | Status | Observações |
|----|---------|------------|--------|-------------|
| 2.2.1 | Geração de chaves RSA | 🔴 CRÍTICO | ⏳ Pendente | 2048 bits |
| 2.2.2 | Troca de chaves públicas | 🔴 CRÍTICO | ⏳ Pendente | Via API |
| 2.2.3 | Criptografia de mensagem com AES-GCM | 🔴 CRÍTICO | ⏳ Pendente | + IV único |
| 2.2.4 | Descriptografia de mensagem | 🔴 CRÍTICO | ⏳ Pendente | Texto original |
| 2.2.5 | Backend não consegue ler mensagens criptografadas | 🔴 CRÍTICO | ⏳ Pendente | Zero-knowledge |
| 2.2.6 | Fallback para mensagens não criptografadas | 🟡 Médio | ⏳ Pendente | isEncrypted=false |

---

### FASE 3: Testes de Performance (8 cenários)

| ID | Cenário | Prioridade | Status | Tempo Esperado | Resultado |
|----|---------|------------|--------|----------------|-----------|
| 3.1.1 | Múltiplos chats simultâneos (10 chats) | 🟢 Alto | ⏳ Pendente | Latência < 100ms | |
| 3.1.2 | Histórico de mensagens longo (1000+) | 🟡 Médio | ⏳ Pendente | Paginação 50/vez | |
| 3.1.3 | Muitos usuários online (50 usuários) | 🟡 Médio | ⏳ Pendente | Sem crash | |
| 3.1.4 | Reconexões frequentes (10x) | 🟡 Médio | ⏳ Pendente | Sem memory leak | |
| 3.2.1 | Latência de mensagem | 🟢 Alto | ⏳ Pendente | < 100ms local | |
| 3.2.2 | Indicador de digitação (throttling) | 🟡 Médio | ⏳ Pendente | Debounce 1s | |
| 3.2.3 | Notificação em tempo real | 🟢 Alto | ⏳ Pendente | Instantâneo | |
| 3.2.4 | Sincronização entre múltiplos dispositivos | 🟡 Médio | ⏳ Pendente | 2 navegadores | |

---

### FASE 4: Testes de Integração (10 cenários)

#### 4.1 Fluxo Completo de Negociação (5 cenários)

| ID | Cenário | Prioridade | Status | Observações |
|----|---------|------------|--------|-------------|
| 4.1.1 | Fluxo completo bem-sucedido (8 etapas) | 🔴 CRÍTICO | ⏳ Pendente | PENDING → COMPLETED |
| 4.1.2 | Negociação com timeout | 🔴 CRÍTICO | ⏳ Pendente | 10 min → PENDING |
| 4.1.3 | Cancelamento manual pelo owner | 🟢 Alto | ⏳ Pendente | → CANCELLED |
| 4.1.4 | Cancelamento manual pelo comprador | 🟢 Alto | ⏳ Pendente | → PENDING |
| 4.1.5 | Múltiplas tentativas de negociação | 🟡 Médio | ⏳ Pendente | B, C, D |

---

#### 4.2 Integração com Outros Sistemas (5 cenários)

| ID | Cenário | Prioridade | Status | Observações |
|----|---------|------------|--------|-------------|
| 4.2.1 | Notificações | 🟢 Alto | ⏳ Pendente | Criadas no banco |
| 4.2.2 | Audit Logs | 🟡 Médio | ⏳ Pendente | CHAT_CREATED |
| 4.2.3 | Sistema de presença | 🟡 Médio | ⏳ Pendente | Online/offline |
| 4.2.4 | Sistema de disputas | 🟡 Médio | ⏳ Pendente | Chat acessível |
| 4.2.5 | Workers | 🟢 Alto | ⏳ Pendente | 4 workers ativos |

---

### FASE 5: Testes de Edge Cases (12 cenários)

| ID | Cenário | Prioridade | Status | Observações |
|----|---------|------------|--------|-------------|
| 5.1 | Desconexão durante envio de mensagem | 🟢 Alto | ⏳ Pendente | Retry ou fallback |
| 5.2 | Reconexão após longa desconexão | 🟡 Médio | ⏳ Pendente | Histórico sync |
| 5.3 | Dois usuários digitando ao mesmo tempo | 🟡 Médio | ⏳ Pendente | Sem conflito |
| 5.4 | Deletar chat (admin) | ⬜ Baixo | ⏳ Pendente | Soft delete |
| 5.5 | Chat sem mensagens | 🟡 Médio | ⏳ Pendente | "Sem mensagens" |
| 5.6 | Usuário bloqueado/banido | ⬜ Baixo | ⏳ Pendente | Se implementado |
| 5.7 | Ordem de mensagens com clock skew | 🟡 Médio | ⏳ Pendente | Server timestamp |
| 5.8 | WebSocket atinge max connections | ⬜ Baixo | ⏳ Pendente | Graceful reject |
| 5.9 | Banco de dados offline | 🟢 Alto | ⏳ Pendente | Sem crash |
| 5.10 | Redis offline (se implementado) | ⬜ Baixo | ⏳ Pendente | N/A |
| 5.11 | Ataque de XSS no chat | 🔴 CRÍTICO | ⏳ Pendente | HTML escaped |
| 5.12 | SQL Injection no chat | 🟢 Alto | ⏳ Pendente | Prisma sanitiza |

---

## 🛠️ Instruções de Execução

### Pré-requisitos

1. **Banco de dados limpo**:
   ```bash
   cd /c/Projects/Mktplace-p2p/apps/api
   rm -f dev.db dev.db-journal
   npx prisma db push
   npx prisma db seed
   ```

2. **Servidores rodando**:
   ```bash
   # Terminal 1 - Backend
   cd apps/api && npm run dev

   # Terminal 2 - Frontend
   cd apps/web && npm run dev
   ```

3. **2 navegadores prontos**:
   - Chrome (Usuário A - "teste")
   - Firefox ou Chrome Anônimo (Usuário B - "teste2")
   - DevTools Console aberto em ambos
   - Network tab visível

### Executando Testes Manualmente

#### Teste Rápido (Validação Crítica - 30 min)

Execute apenas os cenários marcados como 🔴 CRÍTICO:
- 1.1.1, 1.1.3 (Criação e acesso)
- 1.2.2 (Criptografia E2E)
- 1.4.1, 1.4.3 (Negociação)
- 2.1.1, 2.1.2, 2.1.3, 2.1.4 (Segurança)
- 2.2.1 a 2.2.5 (Criptografia)
- 4.1.1, 4.1.2 (Fluxo completo)
- 5.11 (XSS)

**Se todos passarem**: Bug crítico está resolvido ✅

#### Teste Completo (12-13 horas)

Executar todas as 5 fases em ordem:
1. Fase 1: ~4 horas
2. Fase 2: ~2 horas
3. Fase 3: ~1.5 horas
4. Fase 4: ~2 horas
5. Fase 5: ~2 horas
6. Documentação: ~1 hora

### Executando Testes Automatizados

```bash
# API REST tests
cd /c/Projects/Mktplace-p2p
chmod +x test_chat_api.sh
./test_chat_api.sh

# Ver resultados
cat test_chat_results.log
```

---

## ✅ Critérios de Aprovação

### Mínimo Viável (MUST PASS)

- ✅ **Cenário 1.1.1** (Primeiro comprador inicia negociação) - PASSA
- ✅ **Cenário 1.1.3** (Owner acessa após negociação) - PASSA
- ✅ **Cenário 1.2.2** (Mensagem criptografada E2E) - PASSA
- ✅ **Cenário 1.4.3** (Negociação → MATCHED) - PASSA
- ✅ **Cenário 4.1.1** (Fluxo completo) - PASSA
- ✅ **Cenário 2.1.1 a 2.1.4** (Autenticação) - PASSA
- ✅ **Zero erros 400/500** em fluxo normal

### Desejável (SHOULD PASS)

- ✅ **80%+ dos cenários da Fase 1** (24/30) - PASSA
- ✅ **Todos os cenários da Fase 2** (Segurança) - PASSA
- ✅ **Latência < 100ms** (Fase 3) - PASSA

### Opcional (NICE TO HAVE)

- ✅ **90%+ de todos os cenários** (65/72) - PASSA
- ✅ **Testes automatizados** implementados
- ✅ **Teste de carga** realizado (100+ usuários)

---

## 📝 Template de Relatório

### Cabeçalho

```markdown
# Relatório de Testes - Sistema de Chat P2P

**Data**: [DD/MM/YYYY]
**Testador**: [Nome]
**Versão Testada**: 0.2.4
**Ambiente**: Desenvolvimento (localhost)
**Navegadores**: Chrome 120 + Firefox 121
```

### Resumo Executivo

```markdown
## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Total de cenários | 72 |
| Executados | X |
| Aprovados | Y |
| Reprovados | Z |
| Não executados | W |
| **Taxa de sucesso** | **XX%** |

**Status Geral**: ✅ APROVADO / ⚠️ APROVADO COM RESSALVAS / ❌ REPROVADO
```

### Detalhamento por Fase

```markdown
## Fase 1: Testes Funcionais Básicos

| ID | Cenário | Status | Tempo | Observações |
|----|---------|--------|-------|-------------|
| 1.1.1 | Primeiro comprador inicia negociação | ✅ PASSOU | 5 min | Sem erros |
| 1.1.2 | Owner tenta acessar antes negociação | ✅ PASSOU | 2 min | Bloqueou corretamente |
| ... | ... | ... | ... | ... |

**Taxa de sucesso Fase 1**: XX/30 (XX%)
```

### Bugs Encontrados

```markdown
## Bugs Encontrados

### Bug #1: Chat não aparece após primeira mensagem
- **Severidade**: 🔴 CRÍTICO
- **Cenário**: 1.1.1
- **Passos para reproduzir**:
  1. Usuário A cria pedido
  2. Usuário B envia primeira mensagem
  3. Usuário A acessa detalhes do pedido

- **Comportamento esperado**: Botão "💬 Abrir Chat" visível
- **Comportamento real**: Botão não aparece
- **Status**: ✅ CORRIGIDO em v0.2.4 / ❌ PENDENTE

### Bug #2: [Título]
...
```

### Melhorias Sugeridas

```markdown
## Melhorias Sugeridas

1. **Renovar timeout ao responder** (Prioridade: Média)
   - Cenário: 1.4.6
   - Descrição: Quando owner responde, renovar os 10 minutos de negociação
   - Benefício: UX melhor, evita timeouts inesperados

2. **Rate limiting de mensagens** (Prioridade: Média)
   - Cenário: 1.2.5
   - Descrição: Limitar 10 mensagens por minuto
   - Benefício: Prevenir spam

...
```

### Conclusão

```markdown
## Conclusão

O sistema de chat P2P foi testado exaustivamente com **72 cenários** cobrindo funcionalidade básica, segurança, performance, integração e edge cases.

**Resultados**:
- ✅ Fluxo principal de negociação funciona corretamente
- ✅ Criptografia E2E implementada e funcionando
- ✅ Segurança e permissões validadas
- ⚠️ [Lista de ressalvas, se houver]
- ❌ [Lista de problemas críticos, se houver]

**Recomendação**:
- ✅ **APROVAR** para produção (se tudo passou)
- ⚠️ **APROVAR COM RESSALVAS** (corrigir bugs não críticos)
- ❌ **REPROVAR** (bugs críticos pendentes)

**Próximos passos**:
1. [Ação 1]
2. [Ação 2]
...

---

**Assinatura**: [Nome]
**Data**: [DD/MM/YYYY]
```

---

## 📊 Rastreabilidade

| Fase | Cenários | Prioridade Crítica | Prioridade Alta | Prioridade Média | Prioridade Baixa |
|------|----------|-------------------|-----------------|------------------|------------------|
| Fase 1 | 30 | 3 | 11 | 14 | 2 |
| Fase 2 | 12 | 9 | 1 | 2 | 0 |
| Fase 3 | 8 | 0 | 3 | 5 | 0 |
| Fase 4 | 10 | 2 | 4 | 4 | 0 |
| Fase 5 | 12 | 1 | 2 | 6 | 3 |
| **TOTAL** | **72** | **15** | **21** | **31** | **5** |

**Priorização**: Executar primeiro os 15 cenários críticos (~4h) para validação rápida.

---

## 🔗 Referências

- **Documentação do Chat**: `CHAT_SYSTEM.md`
- **Sessão de Correção**: `SESSAO_19_10_2025.md`
- **Código Chat Service**: `apps/api/src/services/chat.service.ts`
- **Código Chat Socket**: `apps/api/src/socket/chat.socket.ts`
- **Frontend useChat**: `apps/web/hooks/useChat.ts`

---

## 📅 Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0 | 20/10/2025 | Claude Code | Criação inicial do plano de testes |
| 1.1 | [DATA] | [NOME] | [Primeira execução] |

---

**FIM DO DOCUMENTO**
