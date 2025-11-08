# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

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
