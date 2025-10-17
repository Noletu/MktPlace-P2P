# 🔐 Sistema de Chat com Criptografia End-to-End

## Visão Geral

O MktPlace P2P implementa um sistema de chat criptografado end-to-end (E2E) que garante que apenas os participantes da conversa possam ler as mensagens.

## Arquitetura de Segurança

### Criptografia Híbrida

- **RSA-OAEP 2048 bits**: Troca segura de chaves
- **AES-GCM 256 bits**: Criptografia de mensagens
- **IV único**: Por mensagem

### Fluxo de Segurança

1. Usuário gera par de chaves RSA ao entrar no chat
2. Chave pública enviada ao servidor
3. Mensagens criptografadas com chave pública do destinatário
4. Apenas destinatário pode descriptografar
5. Servidor armazena apenas conteúdo criptografado

## Componentes

### Backend
- `apps/api/src/services/encryption.service.ts` - Gerenciamento de chaves
- `apps/api/src/socket/chat.socket.ts` - WebSocket com suporte a E2E

### Frontend
- `apps/web/utils/encryption.utils.ts` - Utilitários de criptografia
- `apps/web/hooks/useChat.ts` - Hook principal do chat

## Teste

```bash
cd apps/api
node check-encryption.js
```

Para mais detalhes, veja CHANGELOG.md
