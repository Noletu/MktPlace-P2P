# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### 🎉 Adicionado

#### 🔐 Sistema de Autenticação de Dois Fatores (2FA) (2025-11-12 - Sessão 3)

**Sistema completo de 2FA com TOTP e backup codes**

- **Backend (API)**:
  - Service completo em `apps/api/src/services/twoFactor.service.ts`
    - `generateSecret()` - Gera secret TOTP e QR Code
    - `enableTwoFactor()` - Ativa 2FA com validação de token
    - `disableTwoFactor()` - Desativa 2FA com validação
    - `verifyToken()` - Verifica TOTP ou backup code
    - `regenerateBackupCodes()` - Gera novos códigos de recuperação
    - `getBackupCodesCount()` - Retorna quantidade de códigos disponíveis

  - Controller em `apps/api/src/controllers/twoFactor.controller.ts`
    - GET `/api/v1/2fa/status` - Status e contagem de backup codes
    - POST `/api/v1/2fa/generate` - Gerar secret e QR Code
    - POST `/api/v1/2fa/enable` - Habilitar 2FA
    - POST `/api/v1/2fa/disable` - Desabilitar 2FA
    - POST `/api/v1/2fa/regenerate-backup-codes` - Regenerar códigos

  - Rotas com rate limiting em `apps/api/src/routes/twoFactor.routes.ts`

  - Schema do banco atualizado (`apps/api/prisma/schema.prisma`):
    - `twoFactorEnabled` - Flag booleano
    - `twoFactorSecret` - Secret TOTP
    - `twoFactorBackupCodes` - JSON array de hashes bcrypt

- **Frontend (Web)**:
  - Página completa de configuração em `apps/web/app/2fa/setup/page.tsx`
    - QR Code display para setup inicial
    - Campo para validação de token
    - Exibição de 10 backup codes (mostrados apenas UMA VEZ)
    - Botões para copiar/baixar códigos
    - Fluxo de ativação/desativação
    - Interface para regenerar backup codes

  - Integração no login em `apps/web/components/forms/LoginForm.tsx`
    - Detecção automática de 2FA ativo
    - Campo para token 2FA (TOTP ou backup code)
    - Fluxo de login em duas etapas

  - Security Banner em `apps/web/components/dashboard/SecurityBanner.tsx`
    - Aparece apenas quando 2FA está INATIVO
    - Desaparece automaticamente após ativação
    - Botão direto para ativação

  - Seção "Segurança" no perfil (`apps/web/app/profile/page.tsx`)
    - Status visual com badges (verde = ativo, laranja = inativo)
    - Mensagens contextuais
    - Botão "Ativar 2FA" ou "Gerenciar 2FA"
    - Informações educativas sobre 2FA
    - Lista de apps recomendados

- **Segurança**:
  - ✅ Backup codes hasheados com bcrypt (nunca em plain text)
  - ✅ Rate limiting em todos endpoints 2FA
  - ✅ Audit logging de todas operações
  - ✅ One-time use de backup codes (removidos após uso)
  - ✅ Validação de token antes de operações críticas
  - ✅ Window TOTP configurável via env

- **Compatibilidade**:
  - Google Authenticator
  - Microsoft Authenticator
  - Authy
  - Qualquer app compatível com TOTP RFC 6238

- **Testes**:
  - Suite completa em `test-2fa-complete.js`
  - 5 testes automatizados (100% de aprovação):
    1. Ativar 2FA pela primeira vez
    2. Login com TOTP
    3. Login com backup code
    4. Regenerar backup codes
    5. Desativar 2FA

- **Documentação**:
  - Manual completo em `docs/2FA-SYSTEM.md`
  - Arquitetura detalhada
  - Guia de uso para usuários
  - Referência para desenvolvedores
  - Troubleshooting

#### ⏱️ Display de Tempo de Expiração (2025-11-12 - Sessão 2)
- **Página "Meus Pedidos"** (`/orders/my-orders`):
  - Nova coluna no grid de informações mostrando tempo de expiração
  - Função `getTimeRemaining()` para calcular tempo restante
  - Formato amigável: "2d 5h 30min", "23h 4min", "45min"
  - Exibido apenas para pedidos PENDING e MATCHED
  - Cor laranja com ícone ⏱️ para destacar urgência
  - Arquivo: `apps/web/app/orders/my-orders/page.tsx`

- **Countdown Timer Melhorado** (`CountdownTimer` component):
  - Formato amigável substituindo "minutos:segundos" por "dias, horas, minutos"
  - Exemplo: "1384:00" agora exibe "23h 4min"
  - Limiares de cores ajustados:
    - 🟢 Verde: >2 horas (tranquilo)
    - 🟠 Laranja: 30min-2h (atenção)
    - 🟡 Amarelo: 5-30min (urgente)
    - 🔴 Vermelho: <5min (crítico)
  - Suporte completo a dark mode
  - Texto mais discreto e elegante
  - Arquivo: `apps/web/components/CountdownTimer.tsx`

- **Countdown Timer em Pedidos PENDING**:
  - Timer agora visível também para status PENDING (antes só MATCHED)
  - Permite usuário ver tempo restante ao editar pedido
  - Facilita decisão de quanto tempo adicionar/remover
  - Arquivo: `apps/web/app/orders/[orderId]/page.tsx` (linha 778)

#### ✏️ Sistema de Edição de Pedidos (2025-11-12 - Sessão 1)
- **Edição de Pedidos PENDING**: Usuários agora podem editar pedidos que ainda não foram aceitos
  - **Backend**:
    - Método `updateOrder()` em `apps/api/src/services/order.service.ts` (linhas 888-1045)
    - Controller em `apps/api/src/controllers/order.controller.ts` (linhas 239-294)
    - Rota PATCH `/api/v1/orders/:orderId` em `src/routes/order.routes.ts`
  - **Frontend**:
    - Modal completo `apps/web/components/EditOrderModal.tsx` (373 linhas)
    - Integração em `apps/web/app/orders/[orderId]/page.tsx`
    - Suporte completo para PIX e BOLETO
  - **Campos Editáveis**:
    - ✅ Tempo de expiração (1-720 horas / 1-30 dias)
    - ✅ Dados PIX: chave, tipo, nome do beneficiário
    - ✅ Dados BOLETO: código de barras, vencimento, nome, CPF/CNPJ
  - **Restrições de Segurança**:
    - ❌ Valores BRL/Crypto não podem ser alterados (requer cancelar e recriar)
    - ❌ Apenas owner pode editar
    - ❌ Apenas status PENDING pode ser editado
    - ❌ Após MATCHED (aceito), edição é bloqueada
  - **Recursos**:
    - Detecção automática de mudanças
    - Preview de valores atuais
    - Botão "Salvar" desabilitado se não houver mudanças
    - Audit logging de todas as edições

#### 🔍 Sistema de Monitoramento de Workers (2025-11-12)
- **Novo Endpoint Administrativo**: `GET /api/v1/workers/status` (apenas ADMIN)
  - Status de todos os workers em tempo real
  - Contador de execuções
  - Timestamp da última execução
  - Intervalo de verificação
  - Arquivo: `apps/api/src/routes/workers.routes.ts` (108 linhas)
- **Endpoints de Controle** (apenas ADMIN):
  - `POST /api/v1/workers/collateral-release/check-orphaned` - Forçar verificação de órfãos
  - `POST /api/v1/workers/collateral-release/process-now` - Forçar processamento imediato
- **Método `getStatus()`**: Adicionado ao `CollateralReleaseWorker` para monitoramento

#### 📝 Scripts de Diagnóstico e Correção (2025-11-12)
Criados em `apps/api/scripts/`:
1. **`check-nicolas-balance.ts`** (122 linhas)
   - Diagnóstico completo de saldos bloqueados
   - Lista pedidos ativos e finalizados
   - Identifica inconsistências automaticamente
2. **`fix-nicolas-stuck-balance.ts`** (123 linhas)
   - Correção automática de saldos bloqueados
   - Transação atômica para garantir consistência
   - Atualiza `collateralLocked` e `InternalBalance`
3. **`check-worker-status.ts`** (33 linhas)
   - Verificação de status do worker
   - Forçar execução manual para testes
   - Validação de funcionamento

### 🎉 Adicionado

#### 💰 UX de Depósito de Colateral (2025-11-08)
- **Botão "Depositar Colateral" em Carteiras**: Adicionado botão em cada card de carteira na página `/wallets`
  - Botão estilizado com ícone 💰 e texto "Depositar Colateral"
  - Redireciona para `/collateral-balance` com query params pré-selecionados
  - Melhora significativa na descoberta da funcionalidade de depósito
  - Resolve problema de navegação onde usuários não encontravam como depositar colateral

#### 🗑️ Sistema de Limpeza do Banco de Dados (2025-11-08)
- **Script de Limpeza Completa**: `clean-database-full.ts`
  - Limpa TODOS os dados preservando apenas usuários MASTER e ADMIN
  - Backup automático com timestamp antes de qualquer operação
  - Limpeza em 7 níveis respeitando foreign keys (28 tabelas)
  - Transação atômica (tudo ou nada - rollback em caso de erro)
  - Logs coloridos e informativos com progresso detalhado
  - Verificação final de consistência
  - Mostra credenciais dos usuários preservados

- **Comando NPM**: `npm run db:clean`
  - Adicionado ao `package.json` para fácil execução
  - Executa script TypeScript de limpeza completa

- **Scripts Executáveis Batch/Shell**:
  - **LIMPAR-BANCO.bat** (Windows - 3.7 KB)
    - Banner visual consistente com INICIAR-SIMPLES.bat
    - Confirmação obrigatória do usuário (s/N)
    - Detecção de servidor rodando (porta 3001)
    - Opção de parar servidor automaticamente
    - Integração com PARAR-SIMPLES.bat
    - Exibe credenciais preservadas em box formatado
    - Instruções de restauração de backup

  - **limpar-banco.sh** (Linux/Mac/Git Bash - 6.0 KB)
    - Output colorido profissional (vermelho/verde/amarelo/azul)
    - Banner visual com emojis UTF-8
    - Confirmação interativa colorida
    - Detecção multiplataforma de servidor (lsof/netstat)
    - Listagem de backups existentes com tamanho
    - Integração com stop.sh
    - Dicas de comandos úteis
    - Box de credenciais formatado com Unicode

- **Documentação Expandida**:
  - Nova seção "Limpeza Completa do Banco" em `apps/api/scripts/README.md`
  - Seção "Limpeza do Banco de Dados" em `COMO_INICIAR.md`
  - Instruções detalhadas de uso para Windows e Linux/Mac
  - Exemplo completo de output do script
  - Como restaurar backups

#### 🎯 Funcionalidades Anteriores (já implementadas)
- **Botão de Cancelamento para Pagador**: Compradores agora podem cancelar pedidos após aceitar, mas antes de enviar o pagamento (status MATCHED)
  - Pedido volta automaticamente ao marketplace (status PENDING)
  - Colateral do vendedor permanece bloqueado
  - Sem penalidade para o comprador
  - Notificações automáticas para ambas as partes
- **Modal de Confirmação**: Interface clara explicando o que acontece ao cancelar
- **Nova Rota API**: `POST /api/v1/orders/:orderId/cancel-by-payer`
- **Novos métodos backend**: `cancelOrderByPayer()` em `order.service.ts` e `order.controller.ts`

### 🐛 Corrigido

#### 🔐 Bugs do Sistema 2FA (2025-11-12 - Sessão 3)

**Bug #1: Campo twoFactorToken removido na validação**
- **Problema Identificado**: Login com 2FA sempre falhava, retornando `requiresTwoFactor: true` mesmo após enviar token
  - **Causa Raiz**: `loginSchema` em `packages/shared/src/validations.ts` não incluía campo `twoFactorToken`
  - **Sintoma**: Zod removia o campo durante validação, API nunca recebia o token
  - **Impacto**: Sistema 2FA completamente quebrado no login
- **Correção Aplicada**:
  - Adicionado campo opcional ao schema: `twoFactorToken: z.string().optional()`
  - Token agora passa pela validação e chega no authService
- **Resultado**:
  - ✅ Login com TOTP funciona corretamente
  - ✅ Login com backup codes funciona corretamente
  - ✅ Testes automatizados passando (100%)
- **Arquivo Modificado**: `packages/shared/src/validations.ts` (linha 55)

**Bug #2: Banner 2FA não desaparecia após ativação**
- **Problema Identificado**: Security Banner continuava mostrando "Ativar 2FA" mesmo após usuário ativar
  - **Causa Raiz**: Campo `has2FA` não estava sendo retornado pelo endpoint `/auth/me`
  - **Sintoma**: Banner sempre visível, causando confusão no usuário
  - **Impacto**: UX ruim, usuário não tinha feedback visual de 2FA ativo
- **Correção Aplicada**:
  - Adicionado mapeamento no `getUserById()`: `has2FA: user.twoFactorEnabled`
  - Frontend agora recebe informação correta do status 2FA
- **Resultado**:
  - ✅ Banner desaparece automaticamente após ativação
  - ✅ Status 2FA exibido corretamente no perfil
  - ✅ UX consistente e intuitiva
- **Arquivo Modificado**: `apps/api/src/services/auth.service.ts` (linha 186)

#### 🔧 Bug no Modal de Edição de Pedidos (2025-11-12 - Sessão 2)
- **Problema Identificado**: Campos do modal resetavam para valores originais durante digitação
  - **Causa Raiz**: `useEffect` tinha `currentData` nas dependências, causando reset a cada re-render
  - **Sintoma**: Usuário tentava alterar tempo de expiração mas valor voltava rapidamente
  - **Impacto**: Experiência de edição extremamente frustrante e impossível de usar
- **Correção Aplicada**:
  - Removido `currentData` das dependências do `useEffect` de reset (linha 63)
  - Mantido apenas `isOpen` como dependência
  - Campos agora só resetam quando modal abre, não durante edição
  - Adicionado `eslint-disable` comentário para ignorar warning intencional
- **Resultado**:
  - ✅ Edição de campos funciona suavemente
  - ✅ Valores permanecem enquanto usuário digita
  - ✅ Reset acontece apenas ao abrir modal (comportamento esperado)
- **Arquivo Modificado**: `apps/web/components/EditOrderModal.tsx` (linha 51-63)

#### 🔒 Correção Crítica de Saldo Bloqueado (2025-11-12 - Sessão 1)
- **Problema Identificado**: Usuário Nicolas tinha 0.01520386 BTC bloqueado sem pedidos ativos
  - **Causa Raiz**: 2 pedidos cancelados (`cmhukzj1` e `cmhul0bm`) não desbloquearam saldo
  - **Diagnóstico**: Script `check-nicolas-balance.ts` confirmou inconsistência
  - **Pedidos Afetados**:
    - Pedido 1: 0.00570145 BTC bloqueado (CANCELLED sem `cancelledAt`)
    - Pedido 2: 0.00950241 BTC bloqueado (CANCELLED com `cancelledAt`)
  - **Correção Aplicada**:
    - Script `fix-nicolas-stuck-balance.ts` executado com sucesso
    - Transação atômica atualizou `collateralLocked: false` nos pedidos
    - `InternalBalance` desbloqueado: `lockedAmount` de 0.01520386 → 0.00000000
  - **Resultado**:
    - ✅ Saldo 100% liberado (0.49620188 BTC disponível)
    - ✅ Nenhum outro usuário afetado (verificação em toda a base)
    - ✅ Worker agora detecta e corrige automaticamente este tipo de problema
  - **Arquivos Envolvidos**:
    - `apps/api/src/services/order.service.ts:703-722` (código de desbloqueio)
    - `apps/api/src/workers/collateral-release.worker.ts` (verificação automática)

### 🐛 Corrigido

#### 🔧 API de Preços (2025-11-08)
- **Erro 500 em `/api/v1/prices`**: Corrigido falha completa quando uma única criptomoeda não conseguia ser cotada
  - **Problema**: `Promise.all()` falhava completamente se qualquer crypto falhasse (rate limiting, network, etc)
  - **Solução**: Substituído por `Promise.allSettled()` em `price.service.ts:78-102`
  - **Resultado**: Sistema retorna preços parciais mesmo com falhas individuais
  - **Impacto**: Frontend pode calcular conversão BRL→Crypto e criar pedidos mesmo com cotações parciais
- **Logging aprimorado**: Adicionado logs detalhados com stack trace no `price.controller.ts:34-53`
- **Flag `partial`**: API agora indica quando alguns preços falharam via campo `partial: true`
- **Erro que causava**: "Não foi possível calcular o valor em criptomoeda. Aguarde o carregamento dos preços."

#### Sistema de Limpeza (2025-11-08)
- **Erro no clean-database-full.ts**: Corrigido nome do model `kycVerification` → `kYCVerification`
  - Script estava falhando na linha 166 ao tentar deletar dados de KYC
  - Ajustado para usar nome correto do modelo Prisma

#### Funcionalidades Anteriores
- **Chat Tab para Pedidos PENDING**: Chat agora é visível em pedidos com status PENDING quando existe um chat ativo
- **Página em Branco**: Corrigido fallback defensivo que previne páginas em branco quando tab solicitada não existe
- **URLs de Notificação de Chat**:
  - Corrigido formato de URL de `/orders/{id}/chat` para `/orders/{id}?tab=chat`
  - Criada função `normalizeNotificationUrl()` para compatibilidade com URLs antigas
  - Script de migração criado: `fix-chat-notification-urls.ts` (8 notificações atualizadas)
- **Botão "Marcar todas como lidas"**: Corrigido HTTP method (PATCH → POST) e endpoint correto
- **Erro Prisma no cancelamento**: Removido campo inexistente `matchedAt` do update

### 🔄 Modificado

#### 🎨 Melhorias de UX - Sistema 2FA (2025-11-12 - Sessão 3)

**Reorganização da Interface de Segurança**

1. **Seção "Segurança" movida para o Perfil**
   - Antes: Informações de 2FA apenas em página dedicada `/2fa/setup`
   - Depois: Seção "🔐 Segurança" adicionada em `/profile`
   - **Posicionamento**: Logo após "Informações Básicas" (antes de KYC)
   - **Conteúdo**:
     - Status visual com badges (verde = ativo, laranja = inativo)
     - Mensagem contextual sobre estado de 2FA
     - Botão "Ativar 2FA" ou "Gerenciar 2FA"
     - Informações educativas sobre 2FA
     - Lista de apps recomendados
   - **Benefício**: Centralização de configurações de conta
   - Arquivo: `apps/web/app/profile/page.tsx` (linhas 308-373)

2. **Security Banner reposicionado no Dashboard**
   - Antes: Banner aparecia depois de métricas e saldo
   - Depois: Banner logo após boas-vindas e antes de saldo de colateral
   - **Hierarquia Visual Melhorada**:
     - Boas-vindas + Mini card KYC (canto direito)
     - ↓ Security Banner (alertas KYC/2FA)
     - ↓ Saldo de Colateral
     - ↓ Métricas
   - **Benefício**: Mini card de KYC fica próximo dos alertas de limite
   - **UX**: Usuário vê seu nível atual e sugestões lado a lado
   - Arquivo: `apps/web/app/dashboard/page.tsx` (linhas 128-131)

3. **Banner 2FA Contextual**
   - Comportamento inteligente: aparece APENAS quando necessário
   - Desaparece automaticamente após ativação
   - Evita "banner blindness" e não incomoda usuário
   - Arquivo: `apps/web/components/dashboard/SecurityBanner.tsx`

#### 📊 Otimização dos Banners de Segurança no Dashboard (2025-11-12 - Sessão 2)
- **Layout Horizontal Compacto**: Banners de KYC e 2FA agora ocupam ~40% menos espaço
  - **Antes**: Layout vertical com ícone/texto em cima e botões embaixo
  - **Depois**: Layout horizontal com ícone/texto à esquerda e botões à direita
  - Mudança de `items-start` para `items-center justify-between`
- **Melhorias Visuais**:
  - Ícones reduzidos: `text-3xl` → `text-2xl` (mais discreto)
  - Botões com `whitespace-nowrap` e `flex-shrink-0` (não quebram)
  - Espaçamento interno otimizado (removidos `mb-1`, `mb-3`)
- **Benefícios**:
  - Dashboard mais limpo e profissional
  - Menos scroll necessário
  - Informação mais escanável
  - Melhor uso do espaço horizontal
- **Arquivo Modificado**: `apps/web/components/dashboard/SecurityBanner.tsx`
  - Banner KYC (amarelo): linhas 81-112
  - Banner 2FA (laranja): linhas 118-137

#### 🔓 Melhorias no Worker de Liberação de Colateral (2025-11-12 - Sessão 1)
**Arquivo**: `apps/api/src/workers/collateral-release.worker.ts`
- **Logs Aprimorados**:
  - Prefixo `[COLLATERAL WORKER]` em todos os logs
  - Contador de execuções com timestamp (`executionCount`, `lastExecution`)
  - Logs informativos a cada execução (antes era debug, podia não aparecer)
  - Contador de sucessos/erros em cada processamento
  - Logs mais descritivos e profissionais
- **Alertas de Colaterais Órfãos**:
  - Reduzido de 48h para **24h** (detecção mais rápida)
  - Logs detalhados com tempo bloqueado em horas
  - Registro automático no audit log
  - Informações completas do pedido (ID, status, valor, tempo bloqueado)
- **Novo Método `getStatus()`**:
  - Retorna estado atual do worker
  - Útil para monitoramento e debugging
  - Usado pelo endpoint `/api/v1/workers/status`
- **Exemplo de Logs**:
  ```
  🔓 [COLLATERAL WORKER] Starting...
  🔓 [COLLATERAL WORKER] Execution #1 at 2025-11-12T14:56:00.433Z
  🔓 [COLLATERAL WORKER] No collateral to release (all clean)
  🔓 [COLLATERAL WORKER] Processing completed: 5 released, 0 errors
  ⚠️ [COLLATERAL WORKER] ALERT: 2 orders with collateral locked for >24h!
  ```

#### 🔗 Integração de Rotas (2025-11-12)
- **Arquivo**: `apps/api/src/index.ts`
  - Importado `workersRoutes` (linha 26)
  - Adicionada rota `/api/v1/workers` (linha 217)
  - Endpoints administrativos agora acessíveis

### 🔄 Modificado

#### Frontend (2025-11-08)
- **Página de Carteiras (`/wallets`)**: Melhorada UX com botão de depósito de colateral
  - Arquivo modificado: `apps/web/app/wallets/page.tsx:314-321`
  - Navegação inteligente com query params pré-preenchidos

#### Backend (2025-11-08)
- **Price Service**: Refatorado para graceful degradation
  - Arquivo modificado: `apps/api/src/services/price.service.ts:78-102`
  - Arquivo modificado: `apps/api/src/controllers/price.controller.ts:34-53`

#### Anteriormente
- **Função `shouldShowChat()`**:
  - Adicionado status `PENDING` aos statuses permitidos
  - Priorizada verificação `chatId !== null` para sempre mostrar chat quando existe
- **Detecção de Tab via URL**: Sistema agora detecta parâmetro `?tab=chat` na URL e abre a tab corretamente

### 📝 Documentação
- **apps/api/scripts/README.md**: Adicionada documentação completa do script `clean-database-full.ts`
- **COMO_INICIAR.md**: Nova seção sobre limpeza do banco de dados
- **apps/api/package.json**: Adicionado comando `db:clean`

---

## [0.4.1] - 2025-11-02

### 🐛 Corrigido
- **WebSocket Consolidation**: Corrigido crash do servidor causado por múltiplas inicializações do Socket.IO
- **Sistema de Notificações**: Estabilizado namespace `/notifications`

---

## [0.4.0] - Data Anterior

### 🎉 Adicionado
- Sistema de notificações em tempo real via WebSocket
- Sistema de chat criptografado ponto-a-ponto
- Sistema de disputas
- Sistema de avaliações (reviews)
- Sistema KYC com 4 níveis
- Sistema de carteiras multi-rede
- Suporte a múltiplas criptomoedas (BTC, USDC, USDT)
- Suporte a múltiplas redes (Bitcoin, Ethereum, TRC20, Base, Arbitrum)

---

## Tipos de Mudanças
- 🎉 Adicionado para novas funcionalidades
- 🔄 Modificado para mudanças em funcionalidades existentes
- ⚠️ Descontinuado para funcionalidades que serão removidas
- 🗑️ Removido para funcionalidades removidas
- 🐛 Corrigido para correção de bugs
- 🔒 Segurança para correções de vulnerabilidades

---

## Links

- [Unreleased]: Mudanças ainda não lançadas em produção
