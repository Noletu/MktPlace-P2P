# Changelog - MktPlace P2P

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [0.2.3] - 2025-10-12

### Adicionado

#### 🚀 Suporte à Rede Solana
- **Solana adicionada como rede suportada** para USDC e USDT
  - Adicionado `SOLANA` ao enum `NetworkType` em `packages/shared/src/types.ts:30`
  - Adicionado Solana ao mapeamento `CRYPTO_SUPPORTED_NETWORKS` para USDC e USDT (`packages/shared/src/types.ts:153-154`)
  - Adicionado Solana ao mapeamento backend `CRYPTO_NETWORKS` em `apps/api/src/types/crypto.types.ts:28`
  - Configurado informações da rede Solana:
    - Taxa média: **$0.00025** (mais barata de todas)
    - Tempo de confirmação: **0.4s** (mais rápida de todas)
    - Prioridade: **5** (máxima recomendação)
- **Frontend atualizado** para incluir Solana nas opções de rede:
  - `apps/web/app/orders/create/page.tsx:44-45` - Formulário de criação de pedidos
  - `apps/web/app/admin/platform-wallets/page.tsx:19-20` - Painel administrativo de carteiras

### Corrigido

#### 🐛 KYC Info Page - Status de Níveis
- **Corrigido display de status dos níveis KYC** em `/kyc/info`
  - **Problema:** Usuários com KYC Level 1 completo ainda viam botão "Fazer KYC Nível 1"
  - **Causa raiz:** Página não consultava o nível atual do usuário
  - **Solução implementada:**
    - Implementado função `getLevelStatus()` para determinar corretamente se um nível está:
      - ✓ **Completo** (completed) - nível já atingido
      - → **Próximo** (next) - próximo nível disponível
      - ○ **Bloqueado** (blocked) - níveis futuros ainda inacessíveis
    - Adicionado `useEffect` para buscar o nível KYC atual do usuário via API
    - Adicionados badges visuais coloridos para indicar status de cada nível
    - Corrigida lógica de botões:
      - Mostrar "Completar Agora" apenas para o próximo nível disponível
      - Mostrar "✓ Completo" para níveis já atingidos
      - Mostrar "Bloqueado" para níveis ainda inacessíveis
  - **Arquivo:** `apps/web/app/kyc/info/page.tsx` (reescrito, 272 linhas)
  - **Impacto:** Usuários agora veem corretamente quais níveis já completaram

#### 🔧 Opções de Rede Hardcoded
- **Corrigido Solana não aparecendo nos dropdowns**
  - **Problema:** Mesmo com Solana adicionada aos tipos compartilhados, não aparecia nas opções de rede
  - **Causa raiz:** Frontend tinha arrays hardcoded `NETWORK_OPTIONS` que não incluíam Solana
  - **Arquivos corrigidos:**
    - `apps/web/app/orders/create/page.tsx:42-46`
    - `apps/web/app/admin/platform-wallets/page.tsx:17-21`
  - **Nota técnica:** Futuramente, considerar importar `CRYPTO_SUPPORTED_NETWORKS` diretamente do pacote `@mktplace/shared` ao invés de duplicar arrays

### 📝 Arquivos Modificados

- `packages/shared/src/types.ts` - Adicionado suporte Solana (enum + mapeamentos + info)
- `apps/api/src/types/crypto.types.ts` - Adicionado Solana para USDT
- `apps/web/app/kyc/info/page.tsx` - Reescrito para corrigir status dos níveis (272 linhas)
- `apps/web/app/orders/create/page.tsx` - Adicionado Solana nas opções de rede
- `apps/web/app/admin/platform-wallets/page.tsx` - Adicionado Solana nas opções de rede

### 🔍 Bugs Críticos Ativos

**✅ Nenhum bug crítico identificado no momento.**

Todas as funcionalidades testadas estão funcionando corretamente:
- ✅ Solana aparece nas opções de rede para USDC e USDT
- ✅ KYC Info page mostra status correto dos níveis
- ✅ Formulário de criação de pedidos funcional
- ✅ Painel admin de carteiras funcional

### 📊 Melhorias Futuras Sugeridas

1. **Centralizar NETWORK_OPTIONS**
   - Prioridade: Baixa
   - Importar diretamente de `@mktplace/shared` ao invés de duplicar em cada arquivo
   - Evita inconsistências futuras

2. **Validação de endereços Solana**
   - Prioridade: Média
   - Implementar validação específica para endereços Solana (formato base58)
   - Prevenir erros ao cadastrar carteiras

---

## [0.2.2] - 2025-10-05

### Adicionado
- **Scripts de inicialização automatizada** para Windows
  - `INICIAR-SIMPLES.bat` - Inicia API + Frontend + abre navegador automaticamente
  - `PARAR-SIMPLES.bat` - Para todos os serviços com um clique
  - Verificação automática de portas (3000 e 3001)
  - Abertura automática do navegador em http://localhost:3000
  - Criação automática de diretório de logs

- **Documentação de inicialização atualizada**
  - `COMO_INICIAR.md` - Guia completo de como iniciar o projeto
  - Instruções específicas para Windows (CMD/PowerShell)
  - Instruções para Linux/Mac/Git Bash
  - Seção de troubleshooting expandida
  - Avisos sobre incompatibilidade do Git Bash com arquivos .bat

- **Scripts para Linux/Mac** (mantidos)
  - `start.sh` - Inicialização em background
  - `stop.sh` - Parada de serviços

### Alterado
- Scripts `.bat` simplificados sem emojis para compatibilidade com CMD do Windows
- Uso de `ping` ao invés de `timeout` para compatibilidade cross-shell
- Janelas separadas para API e Frontend (melhor visibilidade de logs)

### Corrigido
- Problema de codificação em scripts `.bat` quando executados no Git Bash
- Comandos `timeout` incompatíveis entre Git Bash e CMD do Windows
- Caracteres especiais causando erros de interpretação no CMD

### Testado
- ✅ Inicialização completa da aplicação (API + Frontend)
- ✅ Script PARAR-SIMPLES.bat (testado 2x com sucesso)
- ✅ Criação de conta de usuário
- ✅ Navegador abrindo automaticamente
- ✅ Portas 3000 e 3001 funcionando corretamente

---

## [0.2.1] - 2025-10-05

### Adicionado
- **Consolidação completa de testes**
  - `DOCUMENTACAO_TESTES_COMPLETA.md` - Documento único com todos os testes (~800 linhas)
  - Estrutura `tests/archive/` para organizar histórico de testes
  - `tests/archive/scripts/` - 7 scripts antigos de teste preservados
  - `tests/archive/reports/` - 3 relatórios parciais consolidados
  - `tests/README.md` - Navegação e guia da estrutura de testes

- **Organização de arquivos de teste**
  - Movidos 7 scripts desatualizados para archive (preservação histórica)
  - Movidos 3 relatórios parciais para archive
  - Mantido apenas `test_5_users_CLEAN.sh` como script funcional

### Alterado
- `CHECKPOINT.md` atualizado com nova estrutura de testes
- Documentação consolidada evitando dispersão de informações

### Status
- ✅ **100% dos testes passando** (26/26)
- ✅ **Zero bugs críticos** remanescentes
- ✅ **Documentação completa** e organizada

---

## [0.2.0] - 2025-10-04

### Adicionado
- **Sistema completo de testes automatizados**
  - `test_5_users_CLEAN.sh` - Script final 100% funcional
  - Teste completo de 5 usuários com todas funcionalidades
  - Validação de 26 operações (100% sucesso)
  - Performance de 0,42s por teste

- **Documentação de testes**
  - `RELATORIO_TESTE_5_USUARIOS_FINAL.md` - Relatório completo da fase 2
  - `RESUMO_EXECUTIVO.md` - Resumo executivo dos resultados
  - `EVOLUCAO_TESTES.md` - Análise da evolução entre fases
  - `TESTE_REGRESSAO.md` - Validação de correções

### Corrigido
- **Bug #1:** Rota KYC incorreta (`/submit` → `/level1`)
  - Arquivo: `apps/api/src/routes/kyc.routes.ts`
  - Impact: Bloqueava submissão de KYC Level 1

- **Bug #2:** Validação de `comprovanteData`
  - Arquivo: `apps/api/src/controllers/transaction.controller.ts`
  - Impact: Upload de comprovante falhava
  - Solução: Cliente deve enviar JSON stringificado

- **Bug #3:** Rate limiting muito restritivo em desenvolvimento
  - Arquivo: `apps/api/src/middleware/rateLimiter.middleware.ts`
  - Impact: Bloqueava testes automatizados
  - Solução: Limite adaptativo (prod: 3, dev: 100)

- **Bug #4:** Race condition em matching de pedidos
  - Arquivo: `apps/api/src/controllers/order.controller.ts`
  - Impact: Possibilidade de double-matching
  - Solução: Transações atômicas Prisma

### Melhorado
- Performance do sistema de matching P2P
- Validação de dados em endpoints críticos
- Mensagens de erro mais descritivas
- Logs de auditoria mais detalhados

---

## [0.1.0] - 2025-10-03

### Adicionado
- **Backend API REST completo**
  - Express.js + TypeScript
  - Prisma ORM com SQLite
  - Sistema de autenticação JWT + Refresh Tokens
  - 2FA (Two-Factor Authentication) com Google Authenticator
  - Sistema KYC multi-nível (Level 1, 2, 3)
  - Sistema de pedidos P2P (PIX e Boleto)
  - Sistema de transações com comprovantes
  - Rate limiting adaptativo
  - Logging centralizado (Winston)
  - Audit logs completos

- **Frontend Next.js**
  - App Router (Next.js 14)
  - TypeScript
  - Tailwind CSS
  - Componentes React reutilizáveis

- **Segurança**
  - JWT Secret forte (128 caracteres)
  - Bcrypt para senhas (10 salt rounds)
  - Helmet + CSP configurado
  - CORS configurado
  - Validação Zod em todos endpoints
  - IDOR protection
  - User enumeration protection
  - Stack trace ocultado em produção

- **Documentação inicial**
  - `README.md` - Documentação do projeto
  - `SECURITY.md` - Relatório de segurança
  - `CHECKPOINT.md` - Estado do projeto
  - `SETUP.md` - Guia de instalação
  - `QUICKSTART.md` - Início rápido

### Funcionalidades Core
- ✅ Registro e login de usuários
- ✅ Autenticação JWT com refresh tokens
- ✅ 2FA opcional com QR Code
- ✅ KYC com 3 níveis (R$500 / R$5.000 / R$50.000)
- ✅ Criação de carteiras crypto (BTC, ETH, USDT)
- ✅ Criação de pedidos de compra/venda
- ✅ Marketplace P2P
- ✅ Matching automático de pedidos
- ✅ Upload de comprovantes de pagamento
- ✅ Sistema de transações completo

### Limites KYC Implementados
- **NONE:** R$ 0 (apenas cadastro)
- **LEVEL_1:** R$ 500/dia, R$ 500/tx (CPF + Endereço)
- **LEVEL_2:** R$ 5.000/dia, R$ 2.000/tx (+ Selfie)
- **LEVEL_3:** R$ 50.000/dia, R$ 20.000/tx (+ Documento)

### Rate Limits Configurados
- Login: 5 requisições / 15 min
- Registro: 3 (prod) ou 100 (dev) / 1 hora
- Orders: 10 requisições / 1 min
- Proof Upload: 10 requisições / 5 min
- API Geral: 100 requisições / 15 min

---

## Tipos de Mudanças

- `Adicionado` - Novas funcionalidades
- `Alterado` - Mudanças em funcionalidades existentes
- `Descontinuado` - Funcionalidades que serão removidas
- `Removido` - Funcionalidades removidas
- `Corrigido` - Correções de bugs
- `Segurança` - Vulnerabilidades corrigidas
- `Melhorado` - Melhorias de performance ou UX
- `Testado` - Validações e testes realizados

---

## Bugs Críticos Conhecidos

### ⚠️ Nenhum bug crítico no momento

Todos os bugs críticos identificados foram corrigidos na versão 0.2.0.

### 📋 Melhorias Futuras Planejadas

1. **Implementar blacklist de JWT** (Redis)
   - Status: Planejado para v0.3.0
   - Prioridade: Média
   - Necessário para invalidação imediata de tokens

2. **OCR para validação de comprovantes**
   - Status: Planejado para v0.4.0
   - Prioridade: Baixa
   - Melhoria de UX e segurança

3. **Validação rigorosa de endereços crypto**
   - Status: Planejado para v0.3.0
   - Prioridade: Alta
   - Prevenir envios para endereços inválidos

4. **WAF (Web Application Firewall)**
   - Status: Necessário para produção
   - Prioridade: Alta
   - Proteção adicional contra ataques

5. **Monitoring em tempo real**
   - Status: Necessário para produção
   - Prioridade: Alta
   - Datadog ou Sentry

### 🐛 Bugs Menores / Não Críticos

Nenhum bug menor identificado no momento.

---

## Notas de Versão

### v0.2.2 - Automação de Inicialização
Foco em melhorar a experiência do desenvolvedor com scripts de inicialização automatizada.
Agora é possível iniciar toda a aplicação (API + Frontend) com um único clique.

### v0.2.1 - Consolidação de Testes
Foco em organização e documentação. Todos os testes foram consolidados em um único
documento para facilitar navegação e manutenção.

### v0.2.0 - Validação Completa
Versão completamente testada e validada. 100% dos testes passando, todos os bugs
críticos corrigidos. Sistema pronto para evolução para produção.

### v0.1.0 - MVP Funcional
Primeira versão funcional com todas as features core implementadas. Base sólida
para desenvolvimento contínuo.

---

## Roadmap

### v0.3.0 - Preparação para Produção (Planejado)
- [ ] HTTPS obrigatório
- [ ] JWT blacklist (Redis)
- [ ] reCAPTCHA obrigatório
- [ ] WAF implementado
- [ ] Monitoring (Datadog/Sentry)
- [ ] Backup automático de banco de dados
- [ ] Rate limiting por usuário
- [ ] HSTS headers
- [ ] Log aggregation (ELK/CloudWatch)

### v0.4.0 - Melhorias de UX (Planejado)
- [ ] OCR para comprovantes
- [ ] Dashboard de administração
- [ ] Notificações em tempo real
- [ ] Histórico de transações exportável
- [ ] Suporte a múltiplas moedas

### v1.0.0 - Produção (Futuro)
- [ ] Todos os requisitos de segurança implementados
- [ ] Performance otimizada para 1000+ usuários
- [ ] CI/CD pipeline completo
- [ ] Testes E2E automatizados
- [ ] Documentação Swagger/OpenAPI
- [ ] Feature flags
- [ ] A/B testing

---

## Contribuindo

Para contribuir com este projeto:

1. Sempre atualize este CHANGELOG ao fazer mudanças
2. Siga o formato [Keep a Changelog](https://keepachangelog.com/)
3. Use commits semânticos (feat, fix, docs, style, refactor, test, chore)
4. Atualize a versão no package.json seguindo [SemVer](https://semver.org/)

---

**Última atualização:** 12 de Outubro de 2025
**Versão atual:** 0.2.3
**Status:** ✅ Desenvolvimento ativo
