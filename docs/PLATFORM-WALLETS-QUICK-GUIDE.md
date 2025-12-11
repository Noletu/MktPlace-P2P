# Platform Wallets HD - Guia Rápido

**Última atualização**: 2025-12-11

---

## 🚀 Início Rápido

### 1. Gerar Master Seed pela Primeira Vez

```
1. Login como MASTER (master@admin.com)
2. Navegar para: /admin/master-seed
3. Clicar em "🔐 Gerar Nova Seed"
4. Ler e entender os avisos de segurança
5. Clicar em "Gerar Seed"
6. ⚠️ COPIAR as 24 palavras (ÚNICA OPORTUNIDADE)
7. Guardar em PAPEL em local SEGURO (cofre, banco)
8. Copiar "Encrypted Seed" e adicionar ao .env
9. Reiniciar API server
```

**Resultado**:
- ✅ Master seed gerada
- ✅ 9 platform wallets criadas automaticamente
- ✅ Endereços visíveis na página

### 2. Ver Endereços dos Sócios

```
1. Login como MASTER ou ADMIN
2. Navegar para: /admin/master-seed
3. Rolar até "💼 Carteiras dos Sócios (MASTER/ADMIN)"
4. Ver endereços organizados por crypto (BTC, USDT, USDC)
5. Clicar em "📋" para copiar endereço
```

### 3. Depositar Fundos (Cold → Hot Wallet)

```
⚠️ IMPORTANTE: Use APENAS os endereços exibidos na seção "Carteiras dos Sócios"

Exemplo para depositar BTC:
1. Na página Master Seed, encontre "BTC → BITCOIN"
2. Copie o endereço (ex: bc1q...)
3. Na sua cold wallet, envie BTC para este endereço
4. Aguarde confirmações na blockchain
5. Saldo será atualizado automaticamente (após sync)
```

❌ **NUNCA deposite em endereços de usuários!**

### 4. Verificar Saldo dos Sócios

```
1. Navegar para: /admin/master-seed
2. Ver seção "Carteiras dos Sócios"
3. Cada wallet mostra:
   - Saldo Atual
   - Total Fees Recebidas
```

Ou:

```
1. Navegar para: /admin/funds (em desenvolvimento)
2. Selecionar aba "💼 Sócios"
3. Ver saldo agregado por crypto
```

---

## 📊 Estrutura das Carteiras

### Platform Wallets (Account 0)

**Quem usa**: Sócios MASTER e ADMIN

**Para que serve**:
- Receber fees das transações da plataforma
- Receber depósitos dos sócios (cold → hot)
- Pagamentos operacionais da plataforma

**Redes Suportadas**:
```
BTC (1 rede):
- BITCOIN: bc1q...

USDT (4 redes):
- ETHEREUM: 0x...
- BASE: 0x...
- ARBITRUM: 0x...
- SOLANA: ABC...

USDC (4 redes):
- ETHEREUM: 0x...
- BASE: 0x...
- ARBITRUM: 0x...
- SOLANA: DEF...
```

**Total**: 9 endereços

### User Wallets (Account >= 1)

**Quem usa**: Clientes da plataforma

**Para que serve**:
- Receber depósitos dos clientes
- Realizar trades P2P
- Saques para external wallets

**Derivação**: Automática quando usuário se registra

---

## 🔐 Segurança

### ✅ Boas Práticas

1. **Mnemonic (24 palavras)**:
   - ✅ Guardar em PAPEL
   - ✅ Armazenar em COFRE ou BANCO
   - ✅ Fazer MÚLTIPLAS CÓPIAS em locais separados
   - ❌ NUNCA armazenar digitalmente
   - ❌ NUNCA tirar foto
   - ❌ NUNCA enviar por email/whatsapp

2. **Encrypted Seed**:
   - ✅ Adicionar no arquivo `.env` do servidor
   - ✅ Fazer backup do `.env` em local seguro
   - ✅ Usar HTTPS em produção
   - ❌ NUNCA commitar no git

3. **Hot vs Cold Wallet**:
   - ✅ Manter MÍNIMO necessário na hot wallet (master seed)
   - ✅ Maioria dos fundos em cold wallet (offline)
   - ✅ Depósitos periódicos conforme necessidade
   - ✅ Saques para cold wallet regularmente

4. **Separação de Fundos**:
   - ✅ Platform wallets (Account 0) para sócios
   - ✅ User wallets (Account >= 1) para clientes
   - ✅ NUNCA confundir os dois
   - ✅ Usar APENAS endereços da seção "Carteiras dos Sócios"

### ⚠️ Riscos e Como Evitar

| Risco | Como Evitar |
|-------|-------------|
| Perda do mnemonic | Múltiplas cópias em locais físicos diferentes |
| Roubo do mnemonic | NUNCA armazenar digitalmente, guardar em cofre |
| Depósito em endereço errado | SEMPRE verificar que é da seção "Carteiras dos Sócios" |
| Comprometimento do servidor | Manter MÍNIMO na hot wallet, resto em cold |
| Phishing | Verificar URL sempre (HTTPS, domínio correto) |

---

## 🔧 Operações Comuns

### Receber Fee de Transação

**Automático** - O sistema registra automaticamente quando:
1. Usuário completa uma transação P2P
2. Fee é calculada (ex: 0.5%)
3. Fee é creditada na platform wallet correspondente
4. `totalFeesCollected` é incrementado

**Código (backend)**:
```typescript
// Após transação concluída
await platformWalletService.recordFeeReceived(
  'USDT',      // cryptoType
  'ETHEREUM',  // network
  '1.5'        // feeAmount (0.5% de 300 USDT)
);
```

### Depositar da Cold Wallet

**Manual** - Sócio faz:
1. Acessar `/admin/master-seed`
2. Copiar endereço da rede desejada (ex: BTC BITCOIN)
3. Na cold wallet, enviar BTC para o endereço copiado
4. Aguardar confirmações blockchain
5. Saldo atualizado após sync

**Backend registra**:
```typescript
// Após confirmar depósito na blockchain
await platformWalletService.recordDeposit(
  'BTC',      // cryptoType
  'BITCOIN',  // network
  '0.5'       // amount
);
```

### Sacar para Cold Wallet

**Manual** - Sócio faz:
1. Decidir quanto sacar (ex: 0.3 BTC)
2. Na cold wallet, gerar endereço de recebimento
3. No sistema, criar transação de saque
4. Sistema usa private key da platform wallet
5. Envia BTC para endereço da cold wallet
6. Aguardar confirmações blockchain

**Backend registra**:
```typescript
// Antes de sacar, verificar saldo
const wallet = await platformWalletService.getPlatformWallet('BTC', 'BITCOIN');
if (parseFloat(wallet.balance) < 0.3) {
  throw new Error('Saldo insuficiente');
}

// Fazer saque (blockchain transaction)
const privateKey = await platformWalletService.getDecryptedPrivateKey('BTC', 'BITCOIN');
// ... lógica de criar e enviar transação Bitcoin ...

// Registrar saque
await platformWalletService.recordWithdrawal(
  'BTC',      // cryptoType
  'BITCOIN',  // network
  '0.3'       // amount
);
```

---

## 📈 Dashboards e Relatórios

### Dashboard de Fundos (/admin/funds)

**Em desenvolvimento** - Terá 3 visões:

#### 1. Sócios (Platform Wallets)
```
💼 Fundos dos Sócios

BTC Total: 0.5 BTC
├─ Saldo: 0.5 BTC
├─ Fees Coletadas: 0.1 BTC
└─ Depósitos: 0.4 BTC

USDT Total: 10,000 USDT
├─ Saldo: 10,000 USDT
├─ Fees Coletadas: 1,000 USDT
└─ Depósitos: 9,000 USDT
```

#### 2. Usuários (User Wallets)
```
👥 Fundos dos Usuários

BTC Total: 2.5 BTC
├─ 47 carteiras
└─ Breakdown:
    - user-123: 0.5 BTC
    - user-456: 0.3 BTC
    - ...
```

#### 3. Total (Platform + Users)
```
🌍 Total Plataforma

BTC: 3.0 BTC (0.5 sócios + 2.5 usuários)
USDT: 60,000 USDT (10k sócios + 50k usuários)
```

### Relatório de Fees (Futuro)

```
Período: 01/12/2025 - 31/12/2025

Fees Coletadas:
- BTC: 0.05 BTC (~$2,000)
- USDT: 500 USDT
- USDC: 300 USDC

Total: ~$2,800 USD

Breakdown por Rede:
- ETHEREUM: $1,500
- BASE: $800
- BITCOIN: $500
```

---

## 🆘 Troubleshooting

### Master Seed não aparece como configurada

**Sintoma**: Página mostra "Sistema Não Inicializado" mas você já gerou a seed

**Solução**:
1. Verificar arquivo `.env` tem `MASTER_SEED_ENCRYPTED=...`
2. Reiniciar API server: `npm run dev`
3. Verificar logs do servidor para erros

### Platform wallets não foram criadas

**Sintoma**: Master seed configurada mas nenhum endereço aparece

**Solução**:
1. Verificar banco de dados:
```bash
cd apps/api
npx prisma studio
# Abrir model PlatformWallet
# Devem ter 9 registros
```

2. Se vazio, forçar criação:
```typescript
// Console Node.js no servidor
const { platformWalletService } = require('./src/services/platformWallet.service');
await platformWalletService.createPlatformWallets();
```

### Erro "Master seed já configurada"

**Sintoma**: Tentando gerar nova seed mas sistema bloqueia

**Causa**: Já existe `MASTER_SEED_ENCRYPTED` no `.env`

**Solução** (⚠️ CUIDADO - isso apaga a seed atual):
```bash
# 1. Fazer backup do .env
cp apps/api/.env apps/api/.env.backup

# 2. Comentar a linha
# MASTER_SEED_ENCRYPTED=...

# 3. Reiniciar API server
# 4. Gerar nova seed
```

### Endereço copiado está errado

**Sintoma**: Endereço copiado não é o exibido

**Solução**: Bug do browser, tentar:
1. Copiar manualmente (selecionar + Ctrl+C)
2. Usar outro browser
3. Recarregar página

### Saldo não atualiza

**Sintoma**: Fez depósito mas saldo ainda 0

**Causa**: Blockchain sync não implementado ainda

**Solução Temporária**: Atualizar manualmente
```typescript
await platformWalletService.updateBalance(
  'BTC',
  'BITCOIN',
  '0.5', // novo saldo
  800000 // block height
);
```

**Solução Futura**: Implementar blockchain sync automático

---

## 📚 Recursos Adicionais

### Documentação

- [Implementação Completa](./PLATFORM-WALLETS-HD-IMPLEMENTATION.md)
- [Changelog](../CHANGELOG-PLATFORM-WALLETS.md)
- [BIP39 Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP32 Specification](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP44 Specification](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)

### Ferramentas

- [Ian Coleman BIP39 Tool](https://iancoleman.io/bip39/) - Testar derivação (⚠️ NUNCA com seed real)
- [Blockchain Explorers](https://blockchair.com/) - Verificar transações
- [Prisma Studio](https://www.prisma.io/studio) - Visualizar banco de dados

### Suporte

- **Issues**: [GitHub](https://github.com/seu-repo/issues)
- **Documentação**: `/docs`
- **Email**: suporte@exemplo.com

---

## ✅ Checklist de Setup Inicial

Ao configurar pela primeira vez:

- [ ] Master seed gerada
- [ ] 24 palavras copiadas e guardadas em papel
- [ ] Cópias do mnemonic em múltiplos locais seguros
- [ ] `MASTER_SEED_ENCRYPTED` adicionado ao `.env`
- [ ] API server reiniciado
- [ ] 9 platform wallets criadas (verificado)
- [ ] Endereços exibidos corretamente em `/admin/master-seed`
- [ ] Teste de copiar endereço (botão 📋)
- [ ] Documentação lida e compreendida
- [ ] Equipe treinada sobre segurança

---

**Versão**: 1.0
**Data**: 2025-12-11
