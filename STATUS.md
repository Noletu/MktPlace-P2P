# 📊 Status do Projeto - Mktplace da Liberdade

**Última atualização**: 30 de Outubro de 2025
**Versão**: 0.3.10
**Status**: 🟢 Desenvolvimento Ativo (Versionamento Corrigido - Pronto para v0.4.0)

---

## ✅ Completado

### Estrutura Base
- [x] Monorepo Turborepo configurado
- [x] Git repository inicializado (commit inicial feito)
- [x] `.gitignore` configurado
- [x] README.md completo com documentação
- [x] SETUP.md com guia de instalação
- [x] Scripts de inicialização automatizada (Windows + Linux)

### Frontend (`apps/web`)
- [x] Next.js 14 com App Router
- [x] TypeScript configurado
- [x] TailwindCSS configurado
- [x] Landing page inicial
- [x] Layout base
- [x] Globals CSS com tema
- [x] Sistema de autenticação completo
- [x] Dashboard de usuário
- [x] Sistema KYC multi-nível (4 níveis)
- [x] Formulário de criação de pedidos (PIX + Boleto)
- [x] Marketplace P2P
- [x] Painel administrativo de carteiras
- [x] Sistema de transações e comprovantes
- [x] Chat P2P em tempo real (Socket.IO)
- [x] Criptografia E2E no chat (RSA + AES-GCM)

### Backend (`apps/api`)
- [x] Node.js + Express setup
- [x] TypeScript configurado
- [x] Prisma ORM configurado (SQLite)
- [x] Schema database completo
- [x] Health check endpoint
- [x] .env.example criado
- [x] Sistema de autenticação JWT + Refresh Tokens
- [x] 2FA (Two-Factor Authentication)
- [x] Sistema KYC completo (4 níveis)
- [x] Sistema de pedidos P2P
- [x] Sistema de matching automático
- [x] Sistema de transações
- [x] Sistema de negociação com timeout
- [x] Sistema de presença (online/offline)
- [x] Chat WebSocket (Socket.IO)
- [x] Sistema de disputas completo
- [x] Sistema de saldo interno (colateral pré-depositado)
- [x] Sistema de simulação de depósito (testes)
- [x] Rate limiting adaptativo
- [x] Logging centralizado (Winston)
- [x] Audit logs
- [x] Background workers (5 ativos: deposit-monitor, order-expiration, negotiation-timeout, presence-monitor, collateral-release)

### Database
- [x] SQLite schema definido e em uso
- [x] Migrações Prisma configuradas
- [x] Seed data para testes
- [x] **v0.3.8**: Banco completamente restaurado e sincronizado
- [x] **v0.3.8**: 23 tabelas criadas e operacionais
- [x] **v0.3.8**: 14 carteiras da plataforma configuradas com endereços de teste válidos

### Shared Package
- [x] Types compartilhados (3 criptos: BTC, USDC, USDT)
- [x] 6 networks suportadas: BITCOIN, ETHEREUM, TRC20, BASE, ARBITRUM, **SOLANA**
- [x] Validações Zod (CPF, boleto, PIX)
- [x] Enums e interfaces
- [x] Utilitários (formatação, cálculo de fees)
- [x] Limites KYC por nível

### Infraestrutura
- [x] Scripts de inicialização (`INICIAR-SIMPLES.bat`, `start.sh`)
- [x] Scripts de parada (`PARAR-SIMPLES.bat`, `stop.sh`)
- [x] Documentação completa e atualizada

---

## 🔄 Em Progresso

### ✅ Sistema de Disputas (COMPLETO - v0.2.8)

**Status**: Sistema 100% funcional após correções críticas ✅

**v0.2.8 (21/10/2025)** - Resolução de Disputas Completa:
- ✅ Corrigido erro 400 ao resolver disputas (incompatibilidade de enum)
- ✅ Corrigido bug: pedido permanecia "Em Disputa" após resolução
- ✅ Criado script de correção para casos históricos (`fix-disputed-orders.ts`)
- ✅ Todos os 6 tipos de resolução funcionando corretamente
- ✅ Status do pedido atualizado automaticamente (COMPLETED/CANCELLED)
- ✅ Testado e validado pelo usuário

**Mapeamento de Resoluções Implementado**:
- `REFUND_BUYER_FULL` → Disputa: `RESOLVED_BUYER` | Pedido: `CANCELLED`
- `REFUND_BUYER_PARTIAL` → Disputa: `RESOLVED_BUYER` | Pedido: `CANCELLED`
- `RELEASE_SELLER` → Disputa: `RESOLVED_SELLER` | Pedido: `COMPLETED`
- `CANCEL_NO_PENALTY` → Disputa: `CANCELLED` | Pedido: `CANCELLED`
- `PENALTY_BUYER` → Disputa: `RESOLVED_SELLER` | Pedido: `COMPLETED`
- `PENALTY_SELLER` → Disputa: `RESOLVED_BUYER` | Pedido: `CANCELLED`

**Fluxo Completo de Disputa Funcionando**:
1. ✅ Cliente cria disputa → Status: `OPEN`
2. ✅ Outra parte responde → Status: `UNDER_REVIEW`
3. ✅ Admin resolve disputa → Status: `RESOLVED_BUYER/SELLER` ou `CANCELLED`
4. ✅ Pedido atualiza automaticamente → `COMPLETED` ou `CANCELLED`
5. ✅ Clientes veem status correto no perfil

---

### ✅ Sistema de Chat P2P e Negociação (COMPLETO)

**Status**: Todos os bugs críticos corrigidos e validados ✅

**Versões Recentes**:

**v0.2.7 (20/10/2025)**:
- ✅ 14 endereços da plataforma criados para todas as moedas/redes
- ✅ Suporte completo: BTC, ETH, USDT (6 redes), USDC (6 redes)

**v0.2.6 (20/10/2025)**:
- ✅ Bug de match durante negociação corrigido
- ✅ Match agora funciona em status `IN_NEGOTIATION`
- ✅ Validação de segurança: apenas negociador pode aceitar
- ✅ Testado e validado pelo usuário

**v0.2.4 (19/10/2025)**:
- ✅ Bug de visibilidade do chat corrigido
- ✅ Owner consegue ver chat durante `IN_NEGOTIATION`
- ✅ Testado e validado pelo usuário

**Fluxo Completo Funcionando**:
1. ✅ Cliente A cria pedido → `PENDING`
2. ✅ Cliente B envia primeira mensagem → `IN_NEGOTIATION`
3. ✅ Ambos conseguem trocar mensagens via chat
4. ✅ Cliente B clica "Aceitar Pedido" → `MATCHED`
5. ✅ Timer de 30 min inicia para pagamento

---

## ⏳ Próximos Passos

### 1. Melhorias de Código

- [ ] **Centralizar NETWORK_OPTIONS** (Prioridade: Baixa)
  - Importar diretamente de `@mktplace/shared` ao invés de duplicar em cada arquivo frontend
  - Arquivos a modificar: `apps/web/app/orders/create/page.tsx`, `apps/web/app/admin/platform-wallets/page.tsx`
  - Benefício: Evita inconsistências futuras ao adicionar novas redes

- [ ] **Validação de endereços Solana** (Prioridade: Média)
  - Implementar validação específica para formato base58 de endereços Solana
  - Local: `packages/shared/src/validators.ts` ou backend
  - Benefício: Prevenir erros ao cadastrar carteiras da plataforma

### 2. Features Planejadas

- [ ] **Sistema de notificações em tempo real**
  - WebSocket para notificações de transações
  - Alertas de matching de pedidos

- [ ] **Dashboard administrativo completo**
  - Gerenciamento de usuários
  - Estatísticas de transações
  - Logs de auditoria visíveis

- [ ] **OCR para comprovantes**
  - Validação automática de comprovantes de pagamento
  - Redução de trabalho manual

### 3. Preparação para Produção

- [ ] HTTPS obrigatório
- [ ] JWT blacklist (Redis)
- [ ] reCAPTCHA obrigatório
- [ ] WAF implementado
- [ ] Monitoring (Datadog/Sentry)
- [ ] Backup automático de banco de dados

---

## 📋 Funcionalidades Implementadas

### ✅ Sprint 1: Auth + KYC (COMPLETO)
- [x] Sistema de autenticação JWT + Refresh Tokens
- [x] Páginas de login e registro
- [x] Dashboard de usuário
- [x] Validação de CPF
- [x] KYC com 4 níveis (NONE, LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4)
- [x] Limites diários por nível KYC
- [x] Rate limiting adaptativo
- [x] 2FA (Two-Factor Authentication)

### ✅ Sprint 2: Sistema de Pedidos P2P (COMPLETO)
- [x] Criação de pedidos (PIX e Boleto)
- [x] Marketplace de pedidos disponíveis
- [x] Sistema de matching automático
- [x] Aceitar pedidos do marketplace
- [x] Validação de limites por KYC

### ✅ Sprint 3: Sistema de Transações (COMPLETO)
- [x] Upload de comprovantes de pagamento
- [x] Sistema de validação de transações
- [x] Estados de transação (PENDING, VALIDATING, APPROVED, REJECTED, DISPUTED)
- [x] Histórico de transações

### ✅ Sprint 4: Painel Administrativo (COMPLETO)
- [x] Gerenciamento de carteiras da plataforma
- [x] CRUD de endereços de depósito
- [x] Ativação/desativação de carteiras
- [x] Suporte a múltiplas redes (Bitcoin, Ethereum, TRC20, Base, Arbitrum, Solana)

### ✅ Infraestrutura e DevOps (COMPLETO)
- [x] Scripts de inicialização automatizada
- [x] Logging centralizado (Winston)
- [x] Audit logs
- [x] Sistema de testes automatizados (26 testes, 100% passando)
- [x] Documentação completa

---

## 🐛 Issues Conhecidos

### ✅ Bugs Corrigidos Recentemente

#### v3.0.8 (26 de Outubro de 2025)

1. **Banco de Dados - Schema Desatualizado** ✅ RESOLVIDO
   - **Problema**: 12 tabelas críticas nunca foram criadas (CollateralAddress, InternalBalance, etc.)
   - **Causa**: Migrações nunca foram executadas para essas tabelas
   - **Correção**: Script `create_missing_tables.js` criou todas as 12 tabelas faltantes
   - **Status**: ✅ Todas as tabelas criadas e operacionais

2. **Tabela Order - Colunas Faltantes** ✅ RESOLVIDO
   - **Problema**: 15 colunas do schema.prisma não existiam na tabela Order
   - **Causa**: Alterações no schema nunca foram migradas
   - **Correção**: Scripts `add_order_columns.js` e `add_remaining_order_columns.js`
   - **Colunas Adicionadas**: collateralSource, internalBalanceId, collateralLocked, collateralLockedAmount, collateralUnlockedAt, refundStatus, refundMethod, refundTxHash, refundAmount, refundNetworkFee, refundProcessingFee, refundedAt, cancelReason, customExpirationHours, manualCancelOnly
   - **Status**: ✅ Todas as 15 colunas adicionadas

3. **Tabela User - Campo CPF Indevido** ✅ RESOLVIDO
   - **Problema**: Campo `cpf` estava na tabela User mas não no schema.prisma
   - **Causa**: CPF deve estar apenas em KYCVerification
   - **Correção**: Migração `20251026000000_remove_cpf_from_user` + atualização do seed.ts
   - **Status**: ✅ Campo removido, schema sincronizado

4. **Tabela PlatformWallet - Tabela Inexistente** ✅ RESOLVIDO
   - **Problema**: Tabela não existia no banco de dados
   - **Correção**: Adicionada criação na migração `20251026000000_remove_cpf_from_user`
   - **Status**: ✅ Tabela criada com 14 carteiras configuradas

5. **Endereços da Plataforma - Constraint UNIQUE Incorreta** ✅ RESOLVIDO
   - **Problema**: Endereços EVM não podiam ser reutilizados em múltiplas redes
   - **Causa**: Constraint UNIQUE no campo `address`
   - **Correção**: Removida constraint, mudada lógica de verificação para cryptoType+network
   - **Status**: ✅ 14 carteiras criadas com sucesso usando 4 endereços

### ✅ Bugs Corrigidos Recentemente

#### v0.2.8 (21 de Outubro de 2025)

1. **Sistema de Disputas - Erro 400 ao Resolver** ✅ RESOLVIDO
   - **Problema**: Admin recebia erro 400 ao tentar resolver disputas
   - **Causa**: Incompatibilidade entre enum do frontend (6 valores) e backend (4 valores antigos)
   - **Correção**: `apps/api/src/controllers/dispute.controller.ts:27`
   - **Solução**: Atualizado schema Zod para aceitar todos os 6 tipos de resolução
   - **Status**: ✅ Testado e validado pelo usuário

2. **Sistema de Disputas - Pedido Permanece "Em Disputa"** ✅ RESOLVIDO
   - **Problema**: Após admin resolver disputa, pedido continuava mostrando status "Em Disputa"
   - **Causa**: Função `getResolvedStatus()` e lógica de atualização usando enum antigo
   - **Correção**:
     - `apps/api/src/services/dispute.service.ts:448-473` - Lógica de atualização
     - `apps/api/src/services/dispute.service.ts:852-868` - Função getResolvedStatus()
     - `apps/api/scripts/fix-disputed-orders.ts` - Script de correção para casos históricos
   - **Solução**: Status do pedido agora atualiza corretamente para COMPLETED ou CANCELLED
   - **Status**: ✅ Testado e validado pelo usuário

#### v0.2.7 (20 de Outubro de 2025)

1. **Endereços da Plataforma Incompletos** ✅ RESOLVIDO
   - **Problema**: Apenas 3 endereços da plataforma (BTC, USDT-TRC20, USDC-BASE)
   - **Solução**: Expandido para 14 endereços cobrindo todas as redes suportadas
   - **Arquivo**: `apps/api/prisma/seed.ts`
   - **Status**: ✅ Testado e validado

#### v0.2.6 (20 de Outubro de 2025)

1. **Match de Pedido em Negociação** ✅ RESOLVIDO
   - **Problema**: Erro 400 "Este pedido não está mais disponível" ao aceitar pedido durante negociação
   - **Causa**: Validação só aceitava status `PENDING`, mas chat muda para `IN_NEGOTIATION`
   - **Correção**: `apps/api/src/services/order.service.ts:328-339`
   - **Solução**: Aceitar `PENDING` OU `IN_NEGOTIATION` com validação de segurança
   - **Status**: ✅ Testado e validado pelo usuário

#### v0.2.4 (19 de Outubro de 2025)

1. **Chat P2P - Visibilidade do botão** ✅ RESOLVIDO
   - **Problema**: Chat não aparecia para owner do pedido após outro usuário enviar primeira mensagem
   - **Causa**: Botão só aparecia para status MATCHED/PAYMENT_SENT/VALIDATING, faltava IN_NEGOTIATION
   - **Correção Frontend**: `apps/web/app/orders/[orderId]/page.tsx:776` - Adicionado IN_NEGOTIATION
   - **Correção Backend**: `apps/api/src/services/chat.service.ts:65` - Permitir acesso durante negociação ativa
   - **Status**: ✅ Testado e validado pelo usuário

2. **Banco de dados com schema desatualizado** ✅ RESOLVIDO
   - **Problema**: Workers falhando com erro de coluna `negotiatingUserId` não encontrada
   - **Causa**: Múltiplas instâncias de backend conectadas a banco antigo
   - **Resolução**: Banco deletado e recriado, backends duplicados eliminados

#### v0.2.3 (12 de Outubro de 2025)

1. **KYC Info Page - Status incorreto** ✅ CORRIGIDO
   - Página `/kyc/info` agora mostra corretamente quais níveis foram completados
   - Arquivo: `apps/web/app/kyc/info/page.tsx`

2. **Solana não aparecia nos dropdowns** ✅ CORRIGIDO
   - Arrays hardcoded atualizados para incluir Solana
   - Arquivos: `apps/web/app/orders/create/page.tsx`, `apps/web/app/admin/platform-wallets/page.tsx`

### 🔴 Bugs Críticos Ativos

**Nenhum bug crítico no momento** ✅

Todos os bugs críticos identificados foram corrigidos e validados.

**Última validação**: 26 de Outubro de 2025 (v3.0.8)

**Sistemas 100% Funcionais**:
- ✅ Autenticação e KYC
- ✅ Chat P2P e Negociação
- ✅ Match de Pedidos
- ✅ Sistema de Disputas (completamente funcional)
- ✅ Resolução de Disputas (admin)
- ✅ Atualização de Status de Pedidos
- ✅ **v3.0.8**: Banco de Dados (23 tabelas, schema 100% sincronizado)
- ✅ **v3.0.8**: Sistema de Depósito de Colateral
- ✅ **v3.0.8**: Sistema de Saldo Interno
- ✅ **v3.0.8**: Sistema de Reembolso
- ✅ **v3.0.8**: Carteiras da Plataforma (14 configuradas)

### 📝 Melhorias Sugeridas (Não Críticas)

1. **Alinhamento da Textarea em Disputas** (Prioridade: Baixa) 🆕
   - **Problema**: Borda inferior da textarea de mensagens não perfeitamente alinhada
   - **Arquivo**: `apps/web/components/DisputeMessageThread.tsx`
   - **Impacto**: Visual apenas, não afeta funcionalidade
   - **Status**: Documentado, correção adiada

2. **Centralizar NETWORK_OPTIONS** (Prioridade: Baixa)
   - Importar de `@mktplace/shared` ao invés de duplicar
   - Benefício: Evita inconsistências futuras

3. **Validação de endereços Solana** (Prioridade: Média)
   - Implementar validação de formato base58
   - Benefício: Prevenir erros ao cadastrar carteiras

---

## 📈 Métricas de Progresso

**Setup e Infraestrutura**: 100% ✅
- Estrutura: 100% ✅
- Configuração: 100% ✅
- Dependências: 100% ✅
- Database: 100% ✅ (SQLite funcionando)
- Scripts de inicialização: 100% ✅

**MVP Total**: 95% 🎉
- Sprint 1 (Auth + KYC): 100% ✅
- Sprint 2 (Pedidos P2P): 100% ✅
- Sprint 3 (Transações): 100% ✅
- Sprint 4 (Admin): 100% ✅
- Testes: 100% ✅ (26/26 passando)
- Documentação: 95% ✅

**Próximas Milestones**:
- v0.3.0: Preparação para produção (HTTPS, monitoring, etc.)
- v0.4.0: Features avançadas (notificações, OCR, etc.)
- v1.0.0: Produção

---

## 🔗 Links Úteis

### Documentação
- [README.md](./README.md) - Overview completo
- [SETUP.md](./SETUP.md) - Guia de instalação
- [apps/api/prisma/schema.prisma](./apps/api/prisma/schema.prisma) - Schema database

### External Docs
- [Prisma](https://www.prisma.io/docs)
- [Next.js](https://nextjs.org/docs)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [TailwindCSS](https://tailwindcss.com/docs)

---

## 💡 Comandos Rápidos

```bash
# Ver status Git
git status

# Ver estrutura de pastas
tree -L 3 -I 'node_modules'

# Verificar processos npm
ps aux | grep npm

# Verificar portas em uso
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :5432
sudo lsof -i :6379

# Limpar tudo e recomeçar
rm -rf node_modules apps/*/node_modules packages/*/node_modules
npm install --legacy-peer-deps
```

---

## 📝 Changelog Recente

### v3.0.8 - 26 de Outubro de 2025

**Restauração Completa do Banco de Dados:**
- ✅ Banco de dados deletado e recriado do zero
- ✅ 12 tabelas críticas criadas (CollateralAddress, InternalBalance, etc.)
- ✅ 15 colunas adicionadas à tabela Order (colateral, reembolso, expiração)
- ✅ Campo CPF removido da tabela User (agora só em KYCVerification)
- ✅ Tabela PlatformWallet criada com 14 carteiras configuradas
- ✅ Endereços de teste válidos para todas as redes
- ✅ Usuários MASTER e ADMIN recriados
- ✅ Schema 100% sincronizado com schema.prisma

**Arquivos Criados/Modificados:**
- Migração: `20251026000000_remove_cpf_from_user`
- Scripts: `create_missing_tables.js`, `add_order_columns.js`, `add_remaining_order_columns.js`
- Seed: `apps/api/prisma/seed.ts` (linhas 89-209)

**Status**: ✅ Banco completamente restaurado e pronto para testes

### v0.2.7 - 20 de Outubro de 2025

**Adicionado:**
- ✅ 14 endereços da plataforma para todas as moedas/redes suportadas
- ✅ BTC (1), ETH (1), USDT (6 redes), USDC (6 redes)
- ✅ Suporte completo: TRC20, ETHEREUM, BASE, ARBITRUM, POLYGON, BSC, SOLANA

**Arquivo Modificado:**
- `apps/api/prisma/seed.ts` - Expandido array de platformWallets

**Status**: ✅ Testado e validado

### v0.2.6 - 20 de Outubro de 2025

**Corrigido:**
- ✅ Bug crítico: Match durante negociação
- ✅ Erro 400 "Este pedido não está mais disponível" resolvido
- ✅ Match agora funciona em status `IN_NEGOTIATION`
- ✅ Validação de segurança: apenas negociador pode aceitar

**Arquivo Modificado:**
- `apps/api/src/services/order.service.ts:328-339`

**Status**: ✅ Testado e validado pelo usuário

### v0.2.4 - 19 de Outubro de 2025

**Corrigido:**
- Chat P2P não aparecia para owner do pedido durante negociação
- Botão de chat agora inclui status `IN_NEGOTIATION`
- Validação de acesso ao chat corrigida no backend
- Banco de dados recriado e sincronizado com schema atual
- Múltiplas instâncias de backend eliminadas

**Infraestrutura:**
- Recriação completa do banco de dados SQLite
- Correção de backends duplicados
- Todos os workers funcionando corretamente

**Status**: ✅ Testado e validado pelo usuário

### v0.2.3 - 12 de Outubro de 2025

**Adicionado:**
- Suporte à rede Solana para USDC e USDT
- Solana é a rede mais rápida (0.4s) e barata ($0.00025) de todas

**Corrigido:**
- KYC Info page agora mostra status correto dos níveis completados
- Solana agora aparece corretamente nos dropdowns de rede

**Detalhes:** Ver `CHANGELOG.md` para informações completas

---

**Autor**: Claude Code + Dev Team
**Repositório**: (privado)
**Licença**: Proprietary
**Versão Atual**: 3.0.8
**Última Atualização**: 26 de Outubro de 2025
