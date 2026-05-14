# 📊 Crypto Price Cards - Documentação Completa

**Data de Implementação:** 04/01/2026
**Versão:** 1.0.0

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Arquitetura](#arquitetura)
4. [Arquivos Criados](#arquivos-criados)
5. [Arquivos Modificados](#arquivos-modificados)
6. [APIs Utilizadas](#apis-utilizadas)
7. [Estrutura de Dados](#estrutura-de-dados)
8. [Layout e Responsividade](#layout-e-responsividade)
9. [Configurações de Atualização](#configurações-de-atualização)
10. [Uso e Integração](#uso-e-integração)

---

## 🎯 Visão Geral

Sistema de exibição de preços de criptomoedas e taxas de rede em tempo real, integrado ao header da aplicação. Fornece aos usuários informações essenciais sobre BTC, SOL e ETH antes de realizarem transações na plataforma.

### Objetivos Principais

- ✅ Exibir preços atualizados de BTC, SOL e ETH
- ✅ Mostrar taxas de rede estimadas para cada blockchain
- ✅ Atualização automática (preços: 30min, taxas: 15min)
- ✅ Design responsivo (desktop: cards, mobile: dropdown)
- ✅ Tooltips informativos com detalhes adicionais
- ✅ Integração em todos os headers (homepage e admin)

---

## ⚡ Funcionalidades

### 1. Exibição de Preços
- **Bitcoin (BTC)**: Preço em USD + taxa de rede em 3 níveis (lenta, média, rápida)
- **Solana (SOL)**: Preço em USD + taxa de rede estimada
- **Ethereum (ETH)**: Preço em USD + taxas L1 (Ethereum) e L2 (Base)

### 2. Tooltips Interativos
- **BTC**: Mostra detalhes das 3 faixas de taxa (sat/vB e USD)
- **SOL**: Mostra taxa em lamports e SOL
- **ETH**: Mostra taxas em Gwei para L1 e L2

### 3. Auto-Atualização
- **Preços**: Atualização a cada 30 minutos
- **Taxas**: Atualização a cada 15 minutos
- Atualização manual disponível via função `refresh()`

### 4. Design Responsivo
- **Desktop (≥1280px)**: 3 cards lado a lado
- **Mobile (<1280px)**: Dropdown com os 3 cards
- Cores temáticas: BTC (laranja), SOL (roxo), ETH (azul)

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    CryptoPriceCards                         │
│  (Container Component - Gerencia responsividade)            │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ usa
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  useCryptoPrices Hook                       │
│  (Gerencia estado e auto-atualização)                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ chama
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              cryptoPriceService                             │
│  (Busca dados das APIs externas)                            │
│  - fetchCryptoPrices()    → CoinGecko                       │
│  - fetchBTCFees()         → mempool.space                   │
│  - fetchSOLFees()         → (fixo: 5000 lamports)           │
│  - fetchETHFees()         → Etherscan + cálculo L2          │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ retorna dados para
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  CryptoPriceCard                            │
│  (Componente individual para cada crypto)                   │
│  - Renderiza card com ícone, preço e taxa                   │
│  - Tooltip on hover com detalhes                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Arquivos Criados

### 1. `/apps/web/services/cryptoPriceService.ts`
**Responsabilidade:** Integração com APIs externas e cálculos de taxas.

**Funções Principais:**
```typescript
// Buscar preços de BTC, SOL, ETH
export async function fetchCryptoPrices(): Promise<CryptoPrices>

// Buscar taxas BTC (mempool.space)
export async function fetchBTCFees(btcPrice: number): Promise<BTCFees>

// Calcular taxas SOL (fixo)
export async function fetchSOLFees(solPrice: number): Promise<SOLFees>

// Buscar taxas ETH (Etherscan) + calcular L2
export async function fetchETHFees(ethPrice: number): Promise<ETHFees>

// Buscar todos os dados de uma vez
export async function fetchAllCryptoData(): Promise<CryptoData>
```

**Estimativas Utilizadas:**
- BTC: Transação padrão de ~140 vBytes
- SOL: Taxa fixa de 5000 lamports
- ETH L1: Transferência simples de 21000 gas
- ETH L2 (Base): ~1% do custo L1

---

### 2. `/apps/web/hooks/useCryptoPrices.ts`
**Responsabilidade:** Hook customizado para gerenciar estado e atualização automática.

**Retorno:**
```typescript
{
  data: CryptoData | null,    // Dados das criptos
  loading: boolean,            // Estado de carregamento
  error: string | null,        // Mensagem de erro
  refresh: () => Promise<void> // Função de refresh manual
}
```

**Lógica de Atualização:**
- Busca inicial ao montar componente
- Interval de 30min para preços
- Interval de 15min para taxas
- Cleanup automático ao desmontar

---

### 3. `/apps/web/components/CryptoPriceCard.tsx`
**Responsabilidade:** Componente individual para cada criptomoeda.

**Props:**
```typescript
interface CryptoPriceCardProps {
  symbol: 'BTC' | 'SOL' | 'ETH';
  icon: string;              // Emoji: ₿, ◎, Ξ
  name: string;              // Nome completo
  price: number;             // Preço em USD
  fees: BTCFees | SOLFees | ETHFees;
  lastUpdated?: Date;        // Data da última atualização
}
```

**Características:**
- Layout horizontal compacto
- Cores temáticas por crypto
- Tooltip on hover com detalhes
- Formatação automática de valores
- Suporte dark mode

---

### 4. `/apps/web/components/CryptoPriceCards.tsx`
**Responsabilidade:** Container que gerencia exibição responsiva.

**Modos de Exibição:**
- **Desktop View**: 3 cards lado a lado
- **Mobile View**: Botão dropdown com os 3 cards

**Estados:**
- Loading: Spinner de carregamento
- Error: Mensagem de erro
- Success: Cards exibidos

---

## 📝 Arquivos Modificados

### 1. `/apps/web/components/AppHeader.tsx`
**Mudanças:**
- Importação de `CryptoPriceCards`
- Mudança de layout: `flex justify-between` → `grid grid-cols-3`
- Cards centralizados no meio do header
- Navegação desktop movida para linha separada

**Estrutura do Header:**
```
┌──────────────────────────────────────────────────────────┐
│  [Logo]        [CryptoPriceCards]      [Notif|Theme|User]│
├──────────────────────────────────────────────────────────┤
│        [Dashboard | Marketplace | Carteiras | ...]       │
└──────────────────────────────────────────────────────────┘
```

---

### 2. `/apps/web/app/admin/layout.tsx`
**Mudanças:**
- Importação de `CryptoPriceCards`
- Mudança de layout: `flex justify-between` → `grid grid-cols-3`
- Cards centralizados no meio do header
- Badge dinâmico: "MASTER" (roxo) ou "ADMINISTRADOR" (azul)
- Adicionado state `userRole` para diferenciar badges

**Estrutura do Header Admin:**
```
┌──────────────────────────────────────────────────────────┐
│  [Logo + Badge]  [CryptoPriceCards]   [Notif|Theme|User] │
└──────────────────────────────────────────────────────────┘
```

---

### 3. `/apps/web/app/globals.css`
**Mudanças:**
- Adicionada animação `fadeIn` para tooltips

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
```

---

## 🌐 APIs Utilizadas

### 1. CoinGecko API (Preços)
**Endpoint:** `https://api.coingecko.com/api/v3/simple/price`

**Parâmetros:**
```
ids=bitcoin,solana,ethereum
vs_currencies=usd
```

**Resposta:**
```json
{
  "bitcoin": { "usd": 95432.50 },
  "solana": { "usd": 185.23 },
  "ethereum": { "usd": 3567.89 }
}
```

**Rate Limit:** Tier gratuito (sem API key necessária)

---

### 2. mempool.space API (Taxas Bitcoin)
**Endpoint:** `https://mempool.space/api/v1/fees/recommended`

**Resposta:**
```json
{
  "fastestFee": 25,    // sat/vB
  "halfHourFee": 18,   // sat/vB
  "hourFee": 12        // sat/vB
}
```

**Cálculo USD:**
```typescript
const TX_SIZE_VBYTES = 140;
const sats = satPerVB * TX_SIZE_VBYTES;
const btc = sats / 100000000;
const usd = btc * btcPrice;
```

---

### 3. Etherscan API (Gas Ethereum)
**Endpoint:** `https://api.etherscan.io/api`

**Parâmetros:**
```
module=gastracker
action=gasoracle
```

**Resposta:**
```json
{
  "result": {
    "SafeGasPrice": "15",    // Gwei
    "ProposeGasPrice": "20", // Gwei
    "FastGasPrice": "25"     // Gwei
  }
}
```

**Cálculo USD (L1):**
```typescript
const GAS_LIMIT = 21000;
const gweiToEth = gwei / 1e9;
const ethCost = gweiToEth * GAS_LIMIT;
const usd = ethCost * ethPrice;
```

**Cálculo L2 (Base):**
```typescript
// Base L2 é aproximadamente 1% do custo L1
const l2Gwei = l1Gwei * 0.01;
const l2USD = l1USD * 0.01;
```

---

### 4. Solana (Taxas Fixas)
**Valor:** 5000 lamports (típico para transações simples)

**Conversão:**
```typescript
const SOL = lamports / 1_000_000_000;
const USD = SOL * solPrice;
```

---

## 📊 Estrutura de Dados

### Tipos TypeScript

```typescript
// Preços das criptomoedas
export interface CryptoPrices {
  btc: number;  // USD
  sol: number;  // USD
  eth: number;  // USD
}

// Taxas Bitcoin
export interface BTCFees {
  fastest: number;      // sat/vB
  medium: number;       // sat/vB
  slow: number;         // sat/vB
  estimatedUSD: {
    fastest: number;    // USD
    medium: number;     // USD
    slow: number;       // USD
  };
}

// Taxas Solana
export interface SOLFees {
  lamports: number;     // lamports
  estimatedUSD: number; // USD
}

// Taxas Ethereum
export interface ETHFees {
  l1: {
    gwei: number;       // Gwei
    estimatedUSD: number; // USD
  };
  l2: {
    gwei: number;       // Gwei
    estimatedUSD: number; // USD
  };
}

// Dados completos
export interface CryptoData {
  prices: CryptoPrices;
  fees: {
    btc: BTCFees;
    sol: SOLFees;
    eth: ETHFees;
  };
  lastUpdated: Date;
}
```

---

## 🎨 Layout e Responsividade

### Desktop (≥1280px)

**Card Individual:**
- Largura: ~180-200px
- Altura: ~50px
- Layout: Ícone + 2 colunas (Símbolo/Preço | Taxa/Valor)
- Separador vertical entre colunas

**Cores por Crypto:**
```typescript
BTC: {
  bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
  border: 'border-orange-300',
  iconBg: 'bg-orange-500/20',
  iconText: 'text-orange-600'
}

SOL: {
  bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
  border: 'border-purple-300',
  iconBg: 'bg-purple-500/20',
  iconText: 'text-purple-600'
}

ETH: {
  bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
  border: 'border-blue-300',
  iconBg: 'bg-blue-500/20',
  iconText: 'text-blue-600'
}
```

**Dark Mode:**
- Todos os cards adaptam automaticamente
- Backgrounds: `/30` opacity para dark mode
- Textos: Variantes `dark:text-*-100` ou `dark:text-*-400`

---

### Mobile (<1280px)

**Dropdown Button:**
```
┌──────────────┐
│ 💰 Preços ▼ │
└──────────────┘
```

**Dropdown Aberto:**
```
┌────────────────────────────────┐
│ [BTC Card]                     │
│ [SOL Card]                     │
│ [ETH Card]                     │
│                                │
│ ⏱️ Atualizado: 17:30          │
└────────────────────────────────┘
```

---

## ⏰ Configurações de Atualização

### Intervalos de Atualização

```typescript
// Atualização de PREÇOS: a cada 30 minutos
const pricesInterval = setInterval(() => {
  updatePrices();
}, 30 * 60 * 1000);

// Atualização de TAXAS: a cada 15 minutos
const feesInterval = setInterval(() => {
  updateFees();
}, 15 * 60 * 1000);
```

### Por que Frequências Diferentes?

1. **Preços (30min):**
   - Menor volatilidade necessária para decisões gerais
   - Reduz carga nas APIs
   - Usuários não precisam de atualização constante

2. **Taxas (15min):**
   - Mais voláteis (especialmente BTC e ETH)
   - Críticas para decisões de transação
   - Afetam diretamente custos operacionais

### Refresh Manual

```typescript
const { data, loading, error, refresh } = useCryptoPrices();

// Atualizar manualmente
await refresh();
```

---

## 🔧 Uso e Integração

### Importar e Usar

```typescript
import CryptoPriceCards from '@/components/CryptoPriceCards';

export default function Header() {
  return (
    <header>
      {/* Seus elementos de header */}
      <CryptoPriceCards />
    </header>
  );
}
```

### Personalização

#### Alterar Frequência de Atualização

Em `/apps/web/hooks/useCryptoPrices.ts`:

```typescript
// Mudar para 1 hora
const pricesInterval = setInterval(() => {
  updatePrices();
}, 60 * 60 * 1000); // 60 minutos
```

#### Adicionar Novas Criptomoedas

1. **Adicionar ao serviço** (`cryptoPriceService.ts`):
```typescript
export interface CryptoPrices {
  btc: number;
  sol: number;
  eth: number;
  ada: number; // 🆕 Nova crypto
}
```

2. **Buscar preço** (CoinGecko):
```typescript
const response = await fetch(
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana,ethereum,cardano&vs_currencies=usd'
);
```

3. **Adicionar card** (`CryptoPriceCards.tsx`):
```typescript
<CryptoPriceCard
  symbol="ADA"
  icon="₳"
  name="Cardano"
  price={data.prices.ada}
  fees={data.fees.ada}
/>
```

---

## 🚀 Performance

### Otimizações Implementadas

1. **Lazy Loading:** Componentes carregam apenas quando necessário
2. **Memoização:** Cálculos de formatação são feitos apenas quando dados mudam
3. **Cleanup:** Intervals são limpos ao desmontar componentes
4. **Debounce:** Tooltips têm delay antes de aparecer
5. **Cache:** Dados permanecem em estado até próxima atualização

### Métricas Esperadas

- **Tempo de carregamento inicial:** ~500-1000ms (depende das APIs)
- **Tempo de atualização:** ~300-500ms
- **Tamanho do bundle:** ~15-20KB (componentes + hook + service)
- **Memória:** ~1-2MB (estado + dados)

---

## 🧪 Testing

### Testar Manualmente

1. **Preços corretos:**
   - Verificar se preços batem com CoinGecko
   - Conferir formatação (K para milhares)

2. **Taxas corretas:**
   - BTC: Comparar com mempool.space
   - ETH: Comparar com Etherscan
   - SOL: Verificar cálculo de lamports

3. **Tooltips:**
   - Hover em cada card
   - Verificar detalhes (BTC deve ter 3 faixas)
   - Verificar timestamp

4. **Responsividade:**
   - Testar em desktop (≥1280px)
   - Testar em mobile (<1280px)
   - Verificar dropdown mobile

5. **Dark Mode:**
   - Alternar tema
   - Verificar contraste e legibilidade

### Casos de Erro

```typescript
// Simular erro de API
// Em cryptoPriceService.ts, forçar throw:
export async function fetchCryptoPrices(): Promise<CryptoPrices> {
  throw new Error('API indisponível');
}

// Resultado esperado:
// - Mensagem de erro exibida
// - Botão de retry disponível
// - Não quebra a aplicação
```

---

## 📈 Melhorias Futuras

### Curto Prazo

- [ ] Cache em localStorage (persistir entre reloads)
- [ ] Indicador visual de atualização em andamento
- [ ] Gráfico de variação de preço (24h)
- [ ] Notificação quando taxas estiverem baixas

### Médio Prazo

- [ ] WebSocket para updates em tempo real
- [ ] Histórico de preços (últimas 24h, 7d, 30d)
- [ ] Alertas de preço customizáveis
- [ ] Suporte a mais criptomoedas (ADA, DOT, AVAX)

### Longo Prazo

- [ ] API própria agregando múltiplas fontes
- [ ] Machine learning para prever melhores horários de transação
- [ ] Integração com exchanges para preços reais
- [ ] Calculadora de taxas customizada por tipo de transação

---

## 🐛 Troubleshooting

### Problema: Cards não aparecem

**Solução:**
```bash
# Verificar se as APIs estão acessíveis
curl https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
curl https://mempool.space/api/v1/fees/recommended

# Verificar console do navegador para erros
# Verificar se o componente foi importado corretamente
```

### Problema: Preços não atualizam

**Solução:**
- Verificar intervalos no hook `useCryptoPrices`
- Verificar se componente está montado (não desmonta antes de atualizar)
- Verificar rate limits das APIs

### Problema: Layout quebrado no mobile

**Solução:**
- Verificar breakpoint Tailwind (`lg:` = 1280px)
- Verificar se `CryptoPriceCards` está dentro de container responsivo
- Testar com diferentes tamanhos de tela

---

## 📚 Referências

- [CoinGecko API Documentation](https://www.coingecko.com/en/api/documentation)
- [mempool.space API](https://mempool.space/docs/api/rest)
- [Etherscan API](https://docs.etherscan.io/api-endpoints/gasprice)
- [Solana Documentation](https://docs.solana.com/transaction_fees)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Next.js 14](https://nextjs.org/docs)

---

## 👥 Contribuidores

- **Desenvolvimento:** Claude (Anthropic)
- **Product Owner:** nicode
- **Data:** 04/01/2026

---

## 📄 Licença

Este componente faz parte do projeto MktPlace P2P e segue a mesma licença do projeto principal.

---

**Última atualização:** 04/01/2026
**Versão da documentação:** 1.0.0
