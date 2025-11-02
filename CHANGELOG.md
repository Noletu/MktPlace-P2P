# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### 🎉 Adicionado
- **Botão de Cancelamento para Pagador**: Compradores agora podem cancelar pedidos após aceitar, mas antes de enviar o pagamento (status MATCHED)
  - Pedido volta automaticamente ao marketplace (status PENDING)
  - Colateral do vendedor permanece bloqueado
  - Sem penalidade para o comprador
  - Notificações automáticas para ambas as partes
- **Modal de Confirmação**: Interface clara explicando o que acontece ao cancelar
- **Nova Rota API**: `POST /api/v1/orders/:orderId/cancel-by-payer`
- **Novos métodos backend**: `cancelOrderByPayer()` em `order.service.ts` e `order.controller.ts`

### 🐛 Corrigido
- **Chat Tab para Pedidos PENDING**: Chat agora é visível em pedidos com status PENDING quando existe um chat ativo
- **Página em Branco**: Corrigido fallback defensivo que previne páginas em branco quando tab solicitada não existe
- **URLs de Notificação de Chat**:
  - Corrigido formato de URL de `/orders/{id}/chat` para `/orders/{id}?tab=chat`
  - Criada função `normalizeNotificationUrl()` para compatibilidade com URLs antigas
  - Script de migração criado: `fix-chat-notification-urls.ts` (8 notificações atualizadas)
- **Botão "Marcar todas como lidas"**: Corrigido HTTP method (PATCH → POST) e endpoint correto
- **Erro Prisma no cancelamento**: Removido campo inexistente `matchedAt` do update

### 🔄 Modificado
- **Função `shouldShowChat()`**:
  - Adicionado status `PENDING` aos statuses permitidos
  - Priorizada verificação `chatId !== null` para sempre mostrar chat quando existe
- **Detecção de Tab via URL**: Sistema agora detecta parâmetro `?tab=chat` na URL e abre a tab corretamente

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
