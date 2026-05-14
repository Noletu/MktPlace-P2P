# Índice de Documentação - Mktplace P2P

## 📋 Changelog e Histórico

- **[CHANGELOG.md](./CHANGELOG.md)** - Histórico completo de mudanças do projeto
  - Últimas funcionalidades implementadas
  - Bugs corrigidos
  - Melhorias de segurança
  - Bugs conhecidos e próximos passos

## 📅 Sessões de Desenvolvimento

- **[SESSAO_19_12_2025.md](./SESSAO_19_12_2025.md)** - Correção de dupla taxação no backend
  - Bug crítico: Backend aplicava taxa de 2.5% duas vezes ao bloquear colateral
  - Economia de ~0.55 USDC por transação (~R$ 3.00)
  - Frontend e backend finalmente alinhados
  - Sistema 100% estável e pronto para produção

- **[SESSAO_18_12_2025.md](./SESSAO_18_12_2025.md)** - Sistema de cotação multi-fonte + Correção dupla taxação frontend
  - Sistema robusto de cotação USD/BRL com 5 fontes de fallback
  - Correção de dupla taxação no colateral necessário (apenas display)
  - Alta disponibilidade para stablecoins (USDC/USDT)

- **[SESSAO_16_12_2025.md](./SESSAO_16_12_2025.md)** - Sistema de transferência de crypto + Correção erro 400 chat
  - Transferência interna automática de criptomoedas
  - Reorganização dos logs de auditoria
  - Análise de segurança do erro 400

- **[SESSAO_12_10_2025.md](./SESSAO_12_10_2025.md)** - Sessão anterior
- **[SESSAO_CHAT_09_10_2025.md](./SESSAO_CHAT_09_10_2025.md)** - Implementação do sistema de chat
- **[SESSAO_NOTIFICACOES_09_10_2025.md](./SESSAO_NOTIFICACOES_09_10_2025.md)** - Sistema de notificações
- **[SESSAO_SEGURANCA_08_10_2025.md](./SESSAO_SEGURANCA_08_10_2025.md)** - Melhorias de segurança
- **[SESSAO_07_10_2025.md](./SESSAO_07_10_2025.md)** - Sessão geral

## 🏗️ Documentação de Sistemas

### Core Systems

- **[README_COMPLETE.md](./README_COMPLETE.md)** - README completo do projeto
- **[DOCUMENTACAO_COMPLETA.md](./DOCUMENTACAO_COMPLETA.md)** - Documentação técnica completa

### Sistemas Específicos

- **[EXCHANGE_RATE_SYSTEM.md](./EXCHANGE_RATE_SYSTEM.md)** - Sistema de cotação multi-fonte USD/BRL
- **[CHAT_SYSTEM.md](./CHAT_SYSTEM.md)** - Sistema de chat em tempo real
- **[NOTIFICATION_SYSTEM.md](./NOTIFICATION_SYSTEM.md)** - Sistema de notificações
- **[DISPUTE_SYSTEM.md](./DISPUTE_SYSTEM.md)** - Sistema de disputas
- **[SISTEMA_COLATERAL.md](./SISTEMA_COLATERAL.md)** - Sistema de colateral

## 🔒 Segurança

- **[SECURITY.md](./SECURITY.md)** - Recursos de segurança implementados
- **[SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)** - Relatório de auditoria
- **[SECURITY_FEATURES.md](./SECURITY_FEATURES.md)** - Features de segurança detalhadas

## 🧪 Testes

- **[GUIA_TESTES.md](./GUIA_TESTES.md)** - Guia completo de testes
- **[TESTE_MANUAL.md](./TESTE_MANUAL.md)** - Procedimentos de teste manual
- **[TESTE_REGRESSAO.md](./TESTE_REGRESSAO.md)** - Suite de testes de regressão
- **[DOCUMENTACAO_TESTES_COMPLETA.md](./DOCUMENTACAO_TESTES_COMPLETA.md)** - Documentação completa de testes
- **[DOCUMENTACAO_TESTES_E2E.md](./DOCUMENTACAO_TESTES_E2E.md)** - Testes end-to-end

## 📚 Guias de Uso

- **[QUICKSTART.md](./QUICKSTART.md)** - Início rápido
- **[GUIA_RAPIDO.md](./GUIA_RAPIDO.md)** - Guia rápido em português
- **[COMO_USAR.md](./COMO_USAR.md)** - Como usar o sistema
- **[SETUP.md](./SETUP.md)** - Setup do ambiente
- **[GUIA_CRIACAO_PEDIDOS.md](./GUIA_CRIACAO_PEDIDOS.md)** - Como criar pedidos

## 🚀 Funcionalidades e Novidades

- **[NOVAS_FUNCIONALIDADES_08_10_2025.md](./NOVAS_FUNCIONALIDADES_08_10_2025.md)**
- **[NOVA_FUNCIONALIDADE_NEGOCIACAO.md](./NOVA_FUNCIONALIDADE_NEGOCIACAO.md)**

## 📦 Módulos Específicos

- **[apps/api/README.md](./apps/api/README.md)** - API Backend
- **[apps/api/BLOCKCHAIN_SETUP.md](./apps/api/BLOCKCHAIN_SETUP.md)** - Setup blockchain
- **[tests/README.md](./tests/README.md)** - Testes automatizados

---

## 📌 Links Rápidos

### Para Desenvolvedores
1. [Setup do Ambiente](./SETUP.md)
2. [Documentação Completa](./DOCUMENTACAO_COMPLETA.md)
3. [CHANGELOG](./CHANGELOG.md)
4. [Sessão Atual (16/12/2025)](./SESSAO_16_12_2025.md)

### Para QA
1. [Teste Manual](./TESTE_MANUAL.md)
2. [Teste de Regressão](./TESTE_REGRESSAO.md)
3. [Testes E2E](./DOCUMENTACAO_TESTES_E2E.md)

### Para Usuários
1. [Quick Start](./QUICKSTART.md)
2. [Como Usar](./COMO_USAR.md)

### Para Segurança
1. [Security Features](./SECURITY_FEATURES.md)
2. [Audit Report](./SECURITY_AUDIT_REPORT.md)

---

**Última atualização:** 19/12/2025
