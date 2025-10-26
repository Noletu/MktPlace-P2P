# 🧪 Guia Completo de Testes - Sistema de Chat P2P

**Versão**: 1.0
**Data**: 20/10/2025
**Projeto**: Mktplace da Liberdade

---

## 📋 Visão Geral

Este guia explica como usar os **4 documentos/scripts de teste** criados para validar o sistema de chat em **todos os cenários possíveis**.

---

## 📁 Arquivos de Teste Disponíveis

### 1. `RELATORIO_TESTE_CHAT_COMPLETO.md`
**Tipo**: Documentação completa
**Tempo**: 12-13 horas (teste completo)
**Cenários**: 72 testes

**Descrição**: Plano de testes exaustivo cobrindo 5 fases:
- Fase 1: Funcionais Básicos (30 cenários)
- Fase 2: Segurança e Permissões (12 cenários)
- Fase 3: Performance (8 cenários)
- Fase 4: Integração (10 cenários)
- Fase 5: Edge Cases (12 cenários)

**Quando usar**:
- ✅ Teste completo antes de release de produção
- ✅ Auditoria de qualidade
- ✅ Documentação de bugs encontrados

**Como usar**:
```bash
# Abrir o documento
code RELATORIO_TESTE_CHAT_COMPLETO.md

# Seguir as instruções passo a passo
# Marcar cada cenário como ✅ PASSOU ou ❌ FALHOU
# Preencher template de relatório ao final
```

---

### 2. `CHECKLIST_TESTE_CHAT_RAPIDO.md`
**Tipo**: Checklist manual rápido
**Tempo**: 30-40 minutos
**Cenários**: 6 testes críticos

**Descrição**: Validação rápida dos cenários mais importantes:
- ✅ Primeiro comprador inicia negociação (BUG CRÍTICO)
- ✅ Criptografia E2E
- ✅ Fluxo completo até MATCHED
- ✅ Contador de não lidas
- ✅ Timeout de negociação (opcional)
- ✅ Segurança (XSS, acesso não autorizado)

**Quando usar**:
- ✅ **PRIMEIRO TESTE** após correção do bug v0.2.4
- ✅ Validação rápida após mudanças no código
- ✅ Teste de sanidade antes de commit

**Como usar**:
```bash
# 1. Preparar ambiente
rm apps/api/dev.db
cd apps/api && npx prisma db push && npx prisma db seed

# 2. Iniciar servidores
# Terminal 1
cd apps/api && npm run dev

# Terminal 2
cd apps/web && npm run dev

# 3. Abrir checklist
code CHECKLIST_TESTE_CHAT_RAPIDO.md

# 4. Seguir passo a passo marcando checkboxes
# 5. Anotar bugs na seção final
```

---

### 3. `test_chat_api.sh`
**Tipo**: Script automatizado (Bash)
**Tempo**: 2-3 minutos
**Cenários**: 15 testes de API REST

**Descrição**: Testa automaticamente a API REST do chat:
- Autenticação (registro, login)
- Criação de pedido
- Criação e acesso ao chat
- Envio e recebimento de mensagens
- Segurança e permissões
- Contadores de não lidas

**Quando usar**:
- ✅ Teste rápido de regressão após mudanças
- ✅ CI/CD pipeline (automatização)
- ✅ Validar API sem precisar abrir navegador

**Como usar**:
```bash
# Certifique-se de que o backend está rodando
cd apps/api && npm run dev  # (em outro terminal)

# Executar script
cd /c/Projects/Mktplace-p2p
chmod +x test_chat_api.sh
./test_chat_api.sh

# Ver resultados
cat test_chat_results.log

# Saída esperada:
# ✅ 15 testes passaram
# Taxa de sucesso: 100%
```

**Resultado**:
- Log completo salvo em `test_chat_results.log`
- Estatísticas no final:
  ```
  📊 ESTATÍSTICAS FINAIS
  Total de testes:      15
  Aprovados:            15
  Reprovados:           0
  Taxa de sucesso:      100%
  ```

---

### 4. `test_chat_load.js`
**Tipo**: Script de teste de carga (Node.js)
**Tempo**: 5-10 minutos
**Cenários**: Simula N usuários simultâneos

**Descrição**: Teste de performance com múltiplos usuários conectados via WebSocket enviando mensagens simultaneamente.

**Requisitos**:
```bash
npm install socket.io-client
```

**Quando usar**:
- ✅ Validar performance com carga alta
- ✅ Testar escalabilidade do WebSocket
- ✅ Encontrar gargalos de performance

**Como usar**:
```bash
# Executar com 10 usuários, 5 mensagens cada
node test_chat_load.js 10 5

# Executar com 50 usuários, 10 mensagens cada
node test_chat_load.js 50 10

# Executar com 100 usuários, 20 mensagens cada (stress test)
node test_chat_load.js 100 20
```

**Saída**:
```
========================================
🧪 TESTE DE CARGA - CHAT P2P
========================================

Configuração:
- Usuários: 50
- Mensagens por usuário: 10
- Total de mensagens: 500

📝 Fase 1: Criando usuários...
✅ 50/50 usuários criados

🔌 Fase 3: Conectando usuários via WebSocket...
✅ 50/50 sockets conectados

📨 Fase 6: Enviando mensagens...
✅ Todas as mensagens enviadas

========================================
📊 RELATÓRIO DO TESTE
========================================

Estatísticas:
  ✅ Usuários criados: 50
  ✅ Sockets conectados: 50
  ✅ Mensagens enviadas: 500
  ✅ Mensagens recebidas: 500
  ❌ Erros: 0

Performance:
  ⏱️  Duração total: 12.45s
  📈 Mensagens/segundo: 40.16
  ⚡ Latência média: 24.90ms

Resultado:
  📊 Taxa de sucesso: 100%
  🎉 TESTE PASSOU! Sistema performou bem.
```

---

## 🎯 Plano de Execução Recomendado

### Cenário 1: Validação Rápida (Bug Crítico v0.2.4)

**Objetivo**: Validar se bug de chat está corrigido

**Ordem de execução**:
1. ✅ `CHECKLIST_TESTE_CHAT_RAPIDO.md` - 30 min
   - Foco em Teste Crítico #1 e #2
2. ✅ `test_chat_api.sh` - 2 min
   - Automatizar validação de API

**Critério de sucesso**: Todos os testes críticos passam

**Se falhar**: Documentar bug e retornar ao desenvolvimento

---

### Cenário 2: Teste Completo (Pré-Produção)

**Objetivo**: Validar todo o sistema antes de release

**Ordem de execução**:
1. ✅ `test_chat_api.sh` - 2 min (smoke test)
2. ✅ `CHECKLIST_TESTE_CHAT_RAPIDO.md` - 40 min (validação crítica)
3. ✅ `RELATORIO_TESTE_CHAT_COMPLETO.md` - 12h (teste exaustivo)
4. ✅ `test_chat_load.js` - 10 min (performance)

**Critério de sucesso**:
- 100% dos testes críticos passam
- 90%+ de todos os testes passam
- Performance aceitável (latência < 100ms)

**Documentação**: Preencher relatório final no `RELATORIO_TESTE_CHAT_COMPLETO.md`

---

### Cenário 3: CI/CD Pipeline

**Objetivo**: Automatizar testes em pipeline

**Ordem de execução**:
```yaml
# .github/workflows/test-chat.yml
jobs:
  test-chat:
    steps:
      - name: Start Backend
        run: cd apps/api && npm run dev &

      - name: Run API Tests
        run: ./test_chat_api.sh

      - name: Check Results
        run: |
          if grep -q "100%" test_chat_results.log; then
            echo "✅ Tests passed"
          else
            echo "❌ Tests failed"
            exit 1
          fi
```

---

## 📊 Interpretando Resultados

### Teste Manual (Checklist/Relatório)

**Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU

**Se passou**: Marcar checkbox ✅ e prosseguir

**Se falhou**:
1. Anotar detalhes do bug na seção "Bugs Encontrados"
2. Incluir:
   - Cenário que falhou
   - Passos para reproduzir
   - Comportamento esperado vs real
   - Screenshots (se aplicável)
   - Logs do console

---

### Teste Automatizado (Bash)

**Sucesso**:
```bash
📊 ESTATÍSTICAS FINAIS
Total de testes:      15
Aprovados:            15
Reprovados:           0
Taxa de sucesso:      100%

🎉 TODOS OS TESTES PASSARAM!
```

**Falha**:
```bash
❌ Falha ao enviar primeira mensagem
{"success":false,"error":"Chat não disponível"}

⚠️  ALGUNS TESTES FALHARAM
Verifique os erros acima e corrija antes de prosseguir.
```

**Ação**: Abrir `test_chat_results.log` e procurar linhas com `❌`

---

### Teste de Carga (Node.js)

**Métricas importantes**:

| Métrica | Bom | Aceitável | Ruim |
|---------|-----|-----------|------|
| Taxa de sucesso | 100% | > 95% | < 95% |
| Latência média | < 50ms | < 100ms | > 100ms |
| Mensagens/seg | > 100 | > 50 | < 50 |
| Erros | 0 | < 5% | > 5% |

**Interpretação**:
- ✅ **Bom**: Sistema robusto, pronto para produção
- ⚠️ **Aceitável**: Funciona mas pode ter gargalos
- ❌ **Ruim**: Problemas de performance, não usar em produção

---

## 🐛 Troubleshooting

### Problema 1: Script Bash não executa

**Sintoma**: `permission denied: ./test_chat_api.sh`

**Solução**:
```bash
chmod +x test_chat_api.sh
./test_chat_api.sh
```

---

### Problema 2: Teste de carga falha com erro de módulo

**Sintoma**: `Cannot find module 'socket.io-client'`

**Solução**:
```bash
npm install socket.io-client
node test_chat_load.js 10 5
```

---

### Problema 3: API retorna 401 Unauthorized

**Sintoma**: Testes falham com `Unauthorized`

**Possível causa**: Cookies não estão sendo salvos/enviados

**Solução**:
1. Verificar que backend está rodando
2. Limpar cookies: `rm -f cookies_*.txt`
3. Executar teste novamente

---

### Problema 4: Banco de dados com schema desatualizado

**Sintoma**: `column 'negotiatingUserId' does not exist`

**Solução**:
```bash
cd apps/api
rm -f dev.db dev.db-journal
npx prisma db push
npx prisma db seed
```

---

## 📝 Template de Relatório de Bug

Use este template ao encontrar bugs:

```markdown
### Bug #X: [Título descritivo]

**Severidade**: 🔴 CRÍTICO / 🟡 MÉDIO / 🟢 BAIXO

**Cenário**: [Número do cenário, ex: 1.1.1]

**Arquivo de teste**: [CHECKLIST_TESTE_CHAT_RAPIDO.md / etc]

**Passos para reproduzir**:
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

**Comportamento esperado**:
[O que deveria acontecer]

**Comportamento real**:
[O que realmente aconteceu]

**Evidências**:
- Screenshot: [link ou anexo]
- Console log:
  ```
  [colar log do console]
  ```
- Network tab:
  ```
  GET /api/v1/chat/order/cmg... - 400 Bad Request
  {"success":false,"error":"Chat não disponível"}
  ```

**Ambiente**:
- SO: Windows/Linux/Mac
- Navegador: Chrome 120
- Backend: localhost:3001
- Frontend: localhost:3000

**Status**: [ ] ❌ ABERTO | [ ] 🔄 EM CORREÇÃO | [ ] ✅ CORRIGIDO
```

---

## ✅ Checklist de Pré-Teste

Antes de executar qualquer teste, verificar:

- [ ] Backend rodando (`cd apps/api && npm run dev`)
- [ ] Frontend rodando (`cd apps/web && npm run dev`)
- [ ] Banco de dados limpo e atualizado
- [ ] Health check passa (`curl http://localhost:3001/health`)
- [ ] Nenhum erro no console do backend
- [ ] Portas 3000 e 3001 livres

---

## 🎓 Boas Práticas

### Ao executar testes manuais:
1. ✅ Sempre usar banco de dados limpo
2. ✅ Abrir DevTools Console nos 2 navegadores
3. ✅ Anotar bugs **imediatamente** quando encontrar
4. ✅ Fazer screenshots de erros
5. ✅ Testar em navegadores diferentes (Chrome + Firefox)

### Ao executar testes automatizados:
1. ✅ Garantir que backend está online antes de rodar
2. ✅ Salvar logs para análise posterior
3. ✅ Executar múltiplas vezes para confirmar consistência
4. ✅ Testar com banco limpo e com dados existentes

### Ao encontrar bugs:
1. ✅ Documentar **antes** de tentar corrigir
2. ✅ Incluir passos de reprodução claros
3. ✅ Classificar severidade (crítico/médio/baixo)
4. ✅ Anexar evidências (screenshots, logs)

---

## 📅 Cronograma Sugerido

### Dia 1 (Validação Rápida) - 1h
- [ ] `test_chat_api.sh` (2 min)
- [ ] `CHECKLIST_TESTE_CHAT_RAPIDO.md` (40 min)
- [ ] Documentar resultados (10 min)
- [ ] **Decisão**: Bug corrigido? Prosseguir ou voltar ao dev?

### Dia 2 (Teste Completo) - 4h
- [ ] Fase 1 do `RELATORIO_TESTE_CHAT_COMPLETO.md` (4h)
- [ ] Documentar bugs encontrados

### Dia 3 (Teste Completo cont.) - 4h
- [ ] Fase 2 e 3 do relatório (4h)

### Dia 4 (Finalização) - 4h
- [ ] Fase 4 e 5 do relatório (4h)
- [ ] `test_chat_load.js` (10 min)
- [ ] Preencher relatório final (1h)
- [ ] Apresentar resultados

---

## 🔗 Referências Rápidas

- **Documentação do Chat**: `CHAT_SYSTEM.md`
- **Sessão de Correção**: `SESSAO_19_10_2025.md`
- **Changelog**: `CHANGELOG.md`
- **Status do Projeto**: `STATUS.md`

---

**Última atualização**: 20/10/2025

**Próxima revisão**: Após execução do primeiro teste completo
