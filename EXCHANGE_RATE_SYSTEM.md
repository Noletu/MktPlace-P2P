# Sistema de Cotação Multi-Fonte (ExchangeRateService)

## Visão Geral

O **ExchangeRateService** é um sistema robusto de obtenção de taxa de câmbio USD/BRL com múltiplas fontes e fallback em cascata, implementado especificamente para garantir cotações precisas e em tempo real para stablecoins (USDC/USDT).

## Problema Resolvido

Antes da implementação, o sistema usava preços diretos do CoinGecko para USDC/USDT, que retornavam valores com spread e atrasos, causando discrepâncias significativas:

- **Antes:** 120 BRL → 22.30 USDC (taxa implícita: 5.38 BRL/USD)
- **Esperado:** 120 BRL → 22.14 USDC (taxa real: 5.56 BRL/USD)
- **Diferença:** ~0.16 USDC de sobrecarga (2.9% a mais)

## Solução Implementada

### Princípio Fundamental

**Stablecoins = 1 USD**

Ao invés de buscar o preço de USDC/USDT em BRL (que pode ter spread), o sistema agora:
1. Reconhece que USDC = USDT = 1 USD (por definição)
2. Busca a cotação USD/BRL de fontes confiáveis
3. Usa essa cotação diretamente para conversão

### Arquitetura de Fallback em Cascata

```
┌─────────────────────────────────────────────────────────┐
│ FONTE 1: AwesomeAPI (Primária)                         │
│ - Rápida, sem autenticação                              │
│ - Atualização em tempo real                             │
│ - Timeout: 5 segundos                                   │
└────────────────────┬────────────────────────────────────┘
                     ├── Falhou? ↓
┌─────────────────────────────────────────────────────────┐
│ FONTE 2: Banco Central do Brasil (Oficial)             │
│ - Fonte governamental oficial                           │
│ - PTAX (cotação de fechamento)                          │
│ - Timeout: 5 segundos                                   │
└────────────────────┬────────────────────────────────────┘
                     ├── Falhou? ↓
┌─────────────────────────────────────────────────────────┐
│ FONTE 3: CoinGecko BRZ (Crypto)                        │
│ - Inverter preço do BRZ token                           │
│ - 1 / BRZ_USD_PRICE                                     │
│ - Timeout: 5 segundos                                   │
└────────────────────┬────────────────────────────────────┘
                     ├── Falhou? ↓
┌─────────────────────────────────────────────────────────┐
│ FONTE 4: Cache Local (Último valor conhecido)          │
│ - Banco de dados (tabela ExchangeRate)                 │
│ - Máximo 5 minutos de idade                            │
│ - Marca como "stale"                                    │
└────────────────────┬────────────────────────────────────┘
                     ├── Falhou? ↓
┌─────────────────────────────────────────────────────────┐
│ FONTE 5: Valor Fixo Conservador (Emergência)           │
│ - 5.50 BRL/USD (valor seguro)                           │
│ - Gera alerta crítico nos logs                         │
│ - Marca como "stale"                                    │
└─────────────────────────────────────────────────────────┘
```

## Funcionalidades

### 1. Timeout Control
- Cada fonte tem timeout de **5 segundos**
- Usa `AbortController` para cancelar requisições lentas
- Previne travamentos por APIs indisponíveis

### 2. Health Monitoring
Rastreia métricas de cada fonte:
- **Success Count:** Número de requisições bem-sucedidas
- **Failure Count:** Número de falhas
- **Last Success:** Timestamp da última requisição bem-sucedida
- **Last Failure:** Timestamp da última falha
- **Average Response Time:** Tempo médio de resposta em ms
- **Uptime %:** Porcentagem de disponibilidade

### 3. Cache Inteligente

**Cache em Memória:**
- Duração: 60 segundos
- Evita requisições desnecessárias
- Limpa automaticamente

**Cache em Database:**
- Duração máxima: 5 minutos
- Usado quando todas as fontes falham
- Registrado na tabela `ExchangeRate`

### 4. Validação de Divergência

Compara taxas de múltiplas fontes simultaneamente:
- Busca de todas as fontes em paralelo
- Calcula divergência máxima entre elas
- **Alerta** se divergência > 5%
- Endpoint: `GET /api/v1/exchange-rate/validate`

### 5. Limites de Sanidade

Rejeita taxas fora dos limites razoáveis:
- **Mínimo:** 4.0 BRL/USD
- **Máximo:** 7.0 BRL/USD
- Previne uso de dados corrompidos

### 6. Auditoria Completa

Registra no banco de dados:
- Taxa obtida
- Fonte usada
- Timestamp
- Tempo de resposta
- Tabela: `ExchangeRate`

## APIs Utilizadas

### 1. AwesomeAPI (Primária)
```bash
GET https://economia.awesomeapi.com.br/json/last/USD-BRL
```

**Resposta:**
```json
{
  "USDBRL": {
    "code": "USD",
    "codein": "BRL",
    "name": "Dólar Americano/Real Brasileiro",
    "high": "5.5250",
    "low": "5.5100",
    "varBid": "0.0050",
    "pctChange": "0.09",
    "bid": "5.5215",  // ← Usado (preço de compra)
    "ask": "5.5225",
    "timestamp": "1702911234",
    "create_date": "2023-12-18 15:20:34"
  }
}
```

**Vantagens:**
- Atualização em tempo real
- Sem necessidade de API key
- Rápida (< 200ms normalmente)
- Brasileira (latência baixa)

### 2. Banco Central do Brasil (Oficial)
```bash
GET https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='20231218'&$format=json
```

**Resposta:**
```json
{
  "value": [
    {
      "cotacaoCompra": 5.5193,  // ← Usado
      "cotacaoVenda": 5.5199,
      "dataHoraCotacao": "2023-12-18 13:10:00.000"
    }
  ]
}
```

**Vantagens:**
- Fonte oficial do governo brasileiro
- PTAX (cotação oficial do dia)
- Alta confiabilidade
- Sem limite de requisições

**Limitações:**
- Atualizada apenas 1x por dia (horário comercial)
- Pode não ter cotação em finais de semana/feriados

### 3. CoinGecko BRZ
```bash
GET https://api.coingecko.com/api/v3/simple/price?ids=brz&vs_currencies=usd
```

**Resposta:**
```json
{
  "brz": {
    "usd": 0.18  // BRZ = $0.18
  }
}
```

**Cálculo:**
```
USD/BRL = 1 / BRZ_USD_PRICE
USD/BRL = 1 / 0.18 = 5.56
```

**Vantagens:**
- Sempre disponível
- Atualização frequente (crypto market)
- Sem API key necessária

**Limitações:**
- Pode ter pequeno spread
- Sujeito à volatilidade do BRZ

## Integração com PriceService

O `PriceService` foi modificado para usar o `ExchangeRateService` apenas para stablecoins:

```typescript
async getPrice(crypto: CryptoType): Promise<PriceQuote> {
  // Para USDC e USDT, usar ExchangeRateService
  if (crypto === CryptoType.USDC || crypto === CryptoType.USDT) {
    const exchangeRate = await ExchangeRateService.getUsdBrlRate();

    return {
      crypto,
      brlPrice: exchangeRate.rate.toString(),
      usdPrice: '1.00', // Stablecoin sempre = 1 USD
      timestamp: exchangeRate.timestamp,
    };
  }

  // Para outras criptos (BTC, etc), continuar usando CoinGecko
  // ...
}
```

## Frontend - Display da Cotação

A interface mostra a cotação atual e a fonte para transparência:

```typescript
{(crypto === 'USDC' || crypto === 'USDT') && currentRate && (
  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
    <div className="flex items-center justify-between text-sm">
      <span>Cotação atual (1 USD):</span>
      <span className="font-semibold">R$ {currentRate}</span>
    </div>
    <div className="text-xs text-gray-500 mt-1">
      Fonte: {rateSource === 'awesomeapi' ? 'AwesomeAPI' :
              rateSource === 'banco_central' ? 'Banco Central' :
              'CoinGecko BRZ'}
    </div>
  </div>
)}
```

## Endpoints Admin

### 1. GET /api/v1/exchange-rate/current
Retorna a taxa atual com metadados.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "rate": 5.5215,
    "source": "awesomeapi",
    "timestamp": "2023-12-18T21:10:26.906Z",
    "responseTime": 187,
    "isStale": false
  }
}
```

### 2. GET /api/v1/exchange-rate/health
Retorna métricas de saúde de todas as fontes.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "source": "awesomeapi",
      "successCount": 145,
      "failureCount": 2,
      "lastSuccess": "2023-12-18T21:10:26.906Z",
      "lastFailure": "2023-12-18T18:30:15.123Z",
      "averageResponseTime": 198.5,
      "uptime": 98.63
    },
    // ... outras fontes
  ]
}
```

### 3. GET /api/v1/exchange-rate/validate
Valida consistência entre múltiplas fontes.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "isConsistent": true,
    "rates": [
      { "source": "AwesomeAPI", "rate": 5.5215 },
      { "source": "BancoCentral", "rate": 5.5193 },
      { "source": "CoinGeckoBRZ", "rate": 5.5556 }
    ],
    "maxDivergence": 0.65
  },
  "warning": null
}
```

**Se divergência > 5%:**
```json
{
  "success": true,
  "data": {
    "isConsistent": false,
    "rates": [
      { "source": "AwesomeAPI", "rate": 5.5215 },
      { "source": "BancoCentral", "rate": 5.2000 }
    ],
    "maxDivergence": 6.18
  },
  "warning": "Divergência detectada entre fontes!"
}
```

## Logs do Sistema

O serviço gera logs detalhados:

```
📊 [ExchangeRateService] Buscando taxa USD/BRL...
✅ [ExchangeRateService] Taxa obtida: 5.5215 (fonte: awesomeapi)
💰 [PriceService] USDC price: 1 USDC = R$ 5.5215 (fonte: awesomeapi)
```

**Em caso de falha:**
```
❌ [ExchangeRateService] Erro em fetchFromAwesomeAPI: timeout
⚠️ [ExchangeRateService] Tentando Banco Central...
✅ [ExchangeRateService] Taxa obtida: 5.5193 (fonte: banco_central)
```

**Todas as fontes falharam:**
```
⚠️ [ExchangeRateService] Todas fontes falharam, tentando cache antigo...
⚠️ [ExchangeRateService] Usando cache antigo: 5.5200 (idade: 3.2 min)
```

**Emergência (valor fixo):**
```
🚨 [ExchangeRateService] ALERTA: Usando valor fixo de emergência!
```

## Modelo de Dados

### Tabela: ExchangeRate

```prisma
model ExchangeRate {
  id String @id @default(cuid())

  rate         String   // Taxa USD/BRL
  source       String   // awesomeapi, banco_central, coingecko_brz, etc
  responseTime Int      // Tempo de resposta em ms
  timestamp    DateTime @default(now())

  createdAt DateTime @default(now())

  @@index([source])
  @@index([timestamp])
}
```

**Exemplo de registros:**
```sql
SELECT * FROM ExchangeRate ORDER BY timestamp DESC LIMIT 5;

| id       | rate   | source       | responseTime | timestamp           |
|----------|--------|--------------|--------------|---------------------|
| abc123   | 5.5215 | awesomeapi   | 187          | 2023-12-18 21:10:26 |
| def456   | 5.5193 | banco_central| 423          | 2023-12-18 21:05:15 |
| ghi789   | 5.5200 | awesomeapi   | 201          | 2023-12-18 21:00:00 |
```

## Testes

### Teste 1: Verificar Fontes Externas
```bash
# AwesomeAPI
curl https://economia.awesomeapi.com.br/json/last/USD-BRL

# Banco Central (usar data atual YYYYMMDD)
curl "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='20231218'&\$format=json"

# CoinGecko BRZ
curl https://api.coingecko.com/api/v3/simple/price?ids=brz&vs_currencies=usd
```

### Teste 2: Sistema de Fallback

Simular falhas progressivas:

1. **Teste normal:** Todas as fontes disponíveis → usa AwesomeAPI
2. **AwesomeAPI down:** Bloquear no firewall → usa Banco Central
3. **BC também down:** Bloquear ambos → usa CoinGecko BRZ
4. **Todas down:** Bloquear todas → usa cache (se disponível)
5. **Cache expirado:** Limpar DB → usa valor fixo 5.50

### Teste 3: Validação de Consistência

```bash
# Login como admin
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mktplace.com","password":"admin123"}' \
  | jq -r '.data.accessToken')

# Validar consistência
curl -s http://localhost:3001/api/v1/exchange-rate/validate \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Métricas de Performance

### Tempos de Resposta Típicos

- **AwesomeAPI:** 150-250ms
- **Banco Central:** 300-500ms (pode ser mais lento)
- **CoinGecko BRZ:** 200-400ms
- **Cache (memory):** < 1ms
- **Cache (database):** 5-10ms

### Disponibilidade Esperada

- **AwesomeAPI:** ~99.5%
- **Banco Central:** ~98% (indisponível fora de horário comercial)
- **CoinGecko:** ~99.9%
- **Sistema completo (com fallback):** ~99.99%

### Taxa de Acerto de Cache

- Cache em memória (60s): ~70-80% dos requests
- Requisições reais às APIs: ~20-30%

## Segurança

### Validações Implementadas

1. **Range Check:** Rejeita taxas fora de 4.0-7.0 BRL/USD
2. **Timeout:** Previne requisições infinitas (5s por fonte)
3. **Error Handling:** Todas as falhas são tratadas gracefully
4. **No Secrets:** Nenhuma API key necessária (todas são públicas)
5. **Rate Limiting:** Cache reduz chamadas às APIs externas

### Auditoria

Todas as cotações são registradas no banco com:
- Fonte usada
- Timestamp exato
- Tempo de resposta
- Valor retornado

## Monitoramento Recomendado

### Alertas Sugeridos

1. **Divergência Alta:** Alertar se divergência > 5% entre fontes
2. **Uso de Fallback:** Notificar se fonte primária (AwesomeAPI) falhou
3. **Cache Antigo:** Alertar se usando cache > 2 minutos
4. **Valor Fixo:** Alerta crítico se usando valor fixo de emergência
5. **Response Time:** Alertar se tempo médio > 1 segundo

### Dashboard Sugerido

- Gráfico de uptime de cada fonte
- Tempo de resposta médio (últimas 24h)
- Taxa de uso de cache vs requisições reais
- Histórico de cotações (últimos 7 dias)
- Log de divergências detectadas

## Manutenção

### Atualização de Limites

Para ajustar limites de sanidade, modificar `ExchangeRateService`:

```typescript
private static isValidRate(rate: number): boolean {
  // Ajustar conforme necessário
  return rate >= 4.0 && rate <= 7.0;
}
```

### Adicionar Nova Fonte

1. Criar método `fetchFromNovaFonte()`
2. Adicionar ao enum `ExchangeRateSource`
3. Adicionar ao array `sources` em `getUsdBrlRate()`
4. Documentar API e resposta esperada

### Ajustar Timeouts

```typescript
private static readonly TIMEOUT_MS = 5000; // Ajustar conforme necessário
```

## Troubleshooting

### Problema: Todas as fontes falhando

**Sintomas:**
- Sistema usando cache antigo ou valor fixo constantemente
- Logs mostrando timeouts em todas as fontes

**Diagnóstico:**
```bash
# Testar conectividade
curl -I https://economia.awesomeapi.com.br
curl -I https://olinda.bcb.gov.br
curl -I https://api.coingecko.com
```

**Soluções:**
- Verificar firewall/proxy
- Verificar conectividade internet
- Aumentar timeout se conexão for lenta

### Problema: Divergência alta entre fontes

**Sintomas:**
- Endpoint `/validate` retorna `isConsistent: false`
- Diferença > 5% entre taxas

**Causas Possíveis:**
- Horário: Banco Central pode ter cotação desatualizada fora do horário comercial
- Volatilidade: BRZ pode ter spread maior em momentos de alta volatilidade

**Ação:**
- Verificar qual fonte está divergente
- Considerar remover temporariamente fonte problemática
- Validar manualmente se alguma taxa está incorreta

### Problema: Performance lenta

**Sintomas:**
- Criação de pedidos lenta
- Timeout frequente

**Diagnóstico:**
```bash
# Verificar tempo de resposta de cada fonte
curl -w "\nTime: %{time_total}s\n" https://economia.awesomeapi.com.br/json/last/USD-BRL
```

**Soluções:**
- Aumentar duração de cache em memória (60s → 120s)
- Reduzir timeout (5s → 3s)
- Adicionar índices no banco ExchangeRate

## Referências

- [AwesomeAPI Docs](https://docs.awesomeapi.com.br/)
- [Banco Central PTAX](https://www.bcb.gov.br/estabilidadefinanceira/taxasdecambio)
- [CoinGecko API](https://www.coingecko.com/en/api/documentation)
- [BRZ Token Info](https://www.coingecko.com/en/coins/brz)

---

**Implementado em:** 18/12/2025
**Versão:** 1.0
**Status:** Produção
**Arquivos:** 4 criados + 4 modificados
**Linhas de código:** ~600 (ExchangeRateService + Controller + Routes + Types)
