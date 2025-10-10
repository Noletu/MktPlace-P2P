# Configuração de Monitoramento Blockchain

Este documento explica como configurar e usar o sistema de monitoramento blockchain para confirmação automática de pagamentos de colateral.

## Visão Geral

O sistema monitora automaticamente a blockchain para detectar quando um usuário deposita colateral em cripto. Quando o pagamento é detectado, o sistema:

1. ✅ Confirma a transação na blockchain
2. ✅ Salva o hash da transação (txHash)
3. ✅ Registra o valor recebido
4. ✅ Marca o timestamp da confirmação
5. ✅ Cria automaticamente o pedido

## Redes Suportadas

### Bitcoin
- **API**: BlockCypher (gratuita para baixo volume)
- **Formato de endereço**: `bc1q...` (Bech32)
- **Confirmações**: Requer pelo menos 1 confirmação

### Ethereum / Base / Arbitrum
- **API**: Etherscan / Basescan / Arbiscan
- **Formato de endereço**: `0x...`
- **Tokens suportados**: ETH, USDT, USDC, DAI

### Tron (TRC20)
- **API**: TronGrid (gratuita)
- **Formato de endereço**: `T...`
- **Tokens suportados**: USDT

## Configuração de API Keys

### 1. Etherscan (Ethereum)

1. Crie uma conta em https://etherscan.io/
2. Vá em "API-KEYs" e crie uma nova key
3. Adicione ao arquivo `.env`:

```env
ETHERSCAN_API_KEY=seu_api_key_aqui
```

### 2. Basescan (Base Network)

1. Crie uma conta em https://basescan.org/
2. Vá em "API-KEYs" e crie uma nova key
3. Adicione ao arquivo `.env`:

```env
BASESCAN_API_KEY=seu_api_key_aqui
```

### 3. Arbiscan (Arbitrum)

1. Crie uma conta em https://arbiscan.io/
2. Vá em "API-KEYs" e crie uma nova key
3. Adicione ao arquivo `.env`:

```env
ARBISCAN_API_KEY=seu_api_key_aqui
```

### 4. BlockCypher (Bitcoin)

BlockCypher tem uma API gratuita sem necessidade de key para baixo volume (até 200 requests/hora).

Para volume maior:
1. Crie uma conta em https://www.blockcypher.com/
2. Obtenha um token
3. Modifique `blockchain.service.ts` para incluir o token nos requests

### 5. TronGrid (Tron)

TronGrid é gratuita e não requer API key para uso básico.

## Como Funciona

### Fluxo de Confirmação Automática

```
1. Usuário cria pedido
   ↓
2. Sistema gera endereço de depósito temporário
   ↓
3. Usuário envia cripto para o endereço
   ↓
4. Frontend faz polling a cada 10s para verificar status
   ↓
5. Backend verifica blockchain via API
   ↓
6. Se pagamento detectado:
   - Salva txHash
   - Marca como CONFIRMED
   - Cria pedido automaticamente
   ↓
7. Frontend redireciona para "Meus Pedidos"
```

### Campos Salvos

Quando um pagamento é confirmado, o sistema salva:

```typescript
{
  status: 'CONFIRMED',
  txHash: '0x123...abc',        // Hash da transação
  actualAmount: '100.50',        // Valor real recebido
  confirmedAt: '2025-10-06...'  // Timestamp da confirmação
}
```

## Endpoints

### Verificar Status de Pagamento

```
GET /api/v1/collateral/:id/status
```

Retorna:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "CONFIRMED",
    "txHash": "0x123...abc",
    "actualAmount": "100.50",
    "confirmedAt": "2025-10-06T10:00:00.000Z"
  }
}
```

### Simular Pagamento (Desenvolvimento)

```
POST /api/v1/collateral/:id/simulate-payment
```

Disponível apenas em ambiente de desenvolvimento.

## Integração com Produção

Para usar em produção, você tem duas opções:

### Opção 1: APIs Públicas (Recomendado para MVP)

✅ Prós:
- Fácil de configurar
- Sem infraestrutura blockchain necessária
- Baixo custo inicial

❌ Contras:
- Depende de serviços terceiros
- Rate limits
- Latência de atualização (~15-30 segundos)

**Recomendado para**: MVP e validação inicial

### Opção 2: Nó Próprio (Recomendado para Escala)

✅ Prós:
- Total controle
- Sem rate limits
- Dados em tempo real
- Maior confiabilidade

❌ Contras:
- Requer infraestrutura
- Custos de servidor
- Manutenção técnica

**Recomendado para**: Após validação do produto

### Opção 3: Serviços de Custódia (Mais Seguro)

Para uma solução profissional, considere:

- **BitGo**: Custódia institucional multi-sig
- **Fireblocks**: API completa de custódia
- **Copper**: Custódia e settlement

## Segurança

### Boas Práticas

1. ✅ **Nunca compartilhe API keys**
   - Use variáveis de ambiente
   - Adicione `.env` ao `.gitignore`

2. ✅ **Valide valores recebidos**
   - Sempre compare `actualAmount >= expectedAmount`
   - Verifique número de confirmações (Bitcoin)

3. ✅ **Use endereços únicos**
   - Cada depósito deve ter um endereço exclusivo
   - Nunca reutilize endereços

4. ✅ **Monitore expiração**
   - Endereços expiram após 30 minutos
   - Execute cleanup periódico

5. ✅ **Log de transações**
   - Salve todos os txHash
   - Mantenha histórico completo

## Monitoramento

O sistema já possui um worker que:

- Verifica colaterais pendentes a cada 1 minuto
- Expira endereços antigos
- Faz cleanup automático

Para ver os logs:
```bash
# Ver todos os logs do worker
docker logs -f api | grep "deposit monitor"

# Ver confirmações
docker logs -f api | grep "✅ Pagamento confirmado"
```

## Troubleshooting

### Pagamento não está sendo detectado

1. Verifique se o endereço está correto
2. Confirme que a transação tem confirmações suficientes
3. Verifique os logs do backend
4. Teste manualmente a API:

```bash
# Bitcoin
curl "https://api.blockcypher.com/v1/btc/main/addrs/SEU_ENDERECO/balance"

# Ethereum
curl "https://api.etherscan.io/api?module=account&action=balance&address=SEU_ENDERECO&tag=latest&apikey=SUA_KEY"
```

### Rate limit excedido

- Aguarde 1 hora (BlockCypher)
- Use API key (Etherscan/Basescan)
- Considere plano pago para volume maior

### Transação confirmada mas sistema não detectou

1. Verifique se o worker está rodando
2. Force uma verificação manual via `/status`
3. Verifique os logs de erro
4. Confirme que as API keys estão corretas

## Próximos Passos

1. Configure as API keys no `.env`
2. Teste com transações reais pequenas
3. Monitore os logs
4. Ajuste timeouts e intervalos conforme necessário
5. Considere implementar notificações (email/SMS) quando pagamento for confirmado

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs do sistema
2. Consulte documentação das APIs
3. Teste endpoints manualmente
