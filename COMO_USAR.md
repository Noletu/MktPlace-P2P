# Como Usar o Sistema - MktPlace P2P

## 🏦 1. CONFIGURANDO ENDEREÇOS DA PLATAFORMA

### O que são Endereços da Plataforma?

São os endereços de carteiras onde os **colaterais** dos usuários serão depositados. Quando um usuário cria um pedido, ele precisa depositar cripto como garantia, e esse depósito vai para um endereço da plataforma.

### Como cadastrar endereços?

**Via Interface Web (MASTER/ADMIN apenas):**

1. Faça login com usuário MASTER:
   - Email: `master@mktplace.com`
   - Senha: `Master@2025!`

2. Acesse: `http://localhost:3000/admin/platform-wallets`

3. Clique em "➕ Adicionar Endereço"

4. Preencha os dados:
   - **Criptomoeda**: BTC, USDC ou USDT
   - **Rede**: Escolha a rede blockchain (Bitcoin, Ethereum, TRC20, Base, Arbitrum)
   - **Endereço**: Cole o endereço completo da carteira
   - **Label**: (opcional) Nome identificador, ex: "Carteira Principal BTC"

5. Clique em "✅ Criar Endereço"

**Via API (Postman/cURL):**

```bash
curl -X POST http://localhost:3001/api/v1/admin/platform-wallets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_MASTER" \
  -d '{
    "cryptoType": "BTC",
    "network": "BITCOIN",
    "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "label": "Carteira Principal Bitcoin"
  }'
```

### ⚠️ IMPORTANTE:

- **Apenas UM endereço** pode estar ATIVO por combinação de cripto + rede
- **NUNCA remova** um endereço que tem depósitos pendentes
- Certifique-se que você tem **acesso às chaves privadas** desses endereços
- Quando desativa um endereço, novos pedidos não poderão ser criados para aquela cripto/rede

### Gerenciando Endereços:

- **Ativar/Desativar**: Clique no botão amarelo/verde ao lado do endereço
- **Remover**: Clique no botão vermelho "🗑️ Remover" (confirme duas vezes)

---

## ⚡ 2. TESTANDO CRIAÇÃO DE PEDIDOS (MODO SIMULAÇÃO)

### Por que preciso de simulação?

Para testar o fluxo completo de criação de pedidos **sem precisar fazer depósitos reais** na blockchain, que:
- Custam taxas de rede (gas fees)
- Demoram para confirmar (minutos ou horas)
- Requerem cripto real

### Como funciona a simulação?

O botão "**⚡ SIMULAR PAGAMENTO (TESTE)**" faz o sistema **fingir** que um depósito foi confirmado na blockchain.

### Passo a passo para testar:

**1. Cadastre um endereço da plataforma** (se ainda não tiver):
```
Acesse: http://localhost:3000/admin/platform-wallets
Crie um endereço para BTC/BITCOIN (ou qualquer outra cripto que quiser testar)
```

**2. Faça login como usuário normal** (não precisa ser MASTER):
```
Crie uma conta ou use uma existente
```

**3. Crie um novo pedido**:
```
Acesse: http://localhost:3000/orders/create
Preencha o formulário:
  - Tipo: PIX ou Boleto
  - Valor em BRL: ex: 100.00
  - Criptomoeda: BTC (ou outra que você cadastrou)
  - Rede: BITCOIN (ou a rede que você cadastrou)
  - Dados do PIX/Boleto
Clique em "🔒 Depositar Colateral em Cripto"
```

**4. Tela de Depósito de Colateral aparecerá**:
```
Você verá:
  ✅ QR Code com o endereço
  ✅ Timer de 30 minutos
  ✅ Instruções de depósito
  ✅ Caixa verde "MODO DE TESTE"
  ✅ Botão "⚡ SIMULAR PAGAMENTO (TESTE)"
```

**5. Clique no botão de simulação**:
```
Clique em: "⚡ SIMULAR PAGAMENTO (TESTE)"

O que vai acontecer:
  ✅ Sistema marca colateral como CONFIRMADO
  ✅ Cria o pedido automaticamente
  ✅ Redireciona para "Meus Pedidos"
  ✅ Pedido aparece no MARKETPLACE
```

**6. Verifique o marketplace**:
```
Acesse: http://localhost:3000/marketplace
Você deve ver o pedido que acabou de criar!
```

### 🎯 Fluxo Completo Simulado:

```
1. Criar pedido → Tela de depósito com QR Code
2. Clicar em "Simular Pagamento" → Colateral marcado como confirmado
3. Pedido criado automaticamente → Aparece em "Meus Pedidos"
4. Pedido vai para marketplace → Aparece para outros usuários aceitarem
```

### 🔧 Logs para acompanhar:

Abra o terminal do backend e veja os logs:

```bash
tail -f /home/nicode/MktPlace-P2P/logs/api.log
```

Você verá:
```
⚠️ SIMULANDO RECEBIMENTO DE PAGAMENTO (desenvolvimento)
✅ Colateral confirmado: abc123
✅ Colateral confirmado! TxHash: 0xabc...
📝 Order xyz789 created with CONFIRMED collateral - Will appear in marketplace ✅
📊 Marketplace: found 1 orders with confirmed collateral
```

---

## 📊 3. VERIFICANDO RESULTADOS

### Ver pedidos criados:

**Como criador do pedido:**
```
Acesse: http://localhost:3000/orders/my-orders
Você verá todos os seus pedidos, incluindo o que acabou de criar
```

**Como outro usuário (para aceitar):**
```
Faça login com outro usuário
Acesse: http://localhost:3000/marketplace
Você verá o pedido disponível para aceitar
```

### Verificar colaterais confirmados:

**Via API (como MASTER):**
```bash
curl http://localhost:3001/api/v1/admin/platform-wallets \
  -H "Authorization: Bearer SEU_TOKEN_MASTER"
```

### Ver logs do sistema:

```bash
# Ver últimas 50 linhas do log da API
tail -50 /home/nicode/MktPlace-P2P/logs/api.log

# Ver últimas 50 linhas do log do frontend
tail -50 /home/nicode/MktPlace-P2P/logs/web.log
```

---

## 🚨 4. TROUBLESHOOTING

### "Nenhum endereço da plataforma ativo encontrado"

**Causa**: Não existe endereço cadastrado para a cripto/rede escolhida

**Solução**:
1. Acesse `/admin/platform-wallets`
2. Cadastre um endereço para a cripto e rede que você quer usar
3. Certifique-se que está ATIVO (botão verde)

### "Marketplace está vazio (0 pedidos)"

**Possíveis causas:**

1. **Nenhum pedido foi criado ainda**
   - Crie um pedido usando o fluxo de simulação acima

2. **Pedidos criados mas colateral não confirmado**
   - Use o botão "Simular Pagamento" para confirmar
   - Ou aguarde confirmação real na blockchain (se depositou de verdade)

3. **Filtro do marketplace muito restritivo**
   - Marketplace só mostra pedidos com `collateralConfirmed = true`
   - Isso é CORRETO para segurança!

### "Erro ao criar pedido"

**Verifique**:
1. Usuário está autenticado? (localStorage tem `accessToken`)
2. Endereço da plataforma está ativo?
3. Valor do pedido está dentro do limite KYC do usuário?
4. Dados do PIX/Boleto estão corretos?

### Logs de erro:

```bash
# Ver erros da API
grep "ERROR\|Erro" /home/nicode/MktPlace-P2P/logs/api.log | tail -20

# Ver status do sistema
curl http://localhost:3001/health
```

---

## 🎨 5. PRÓXIMOS PASSOS (ESTÉTICA)

Agora que o fluxo funcional está completo, você pode trabalhar na estética:

### Marketplace:
- Layout dos cards de pedidos
- Cores e espaçamento
- Animações
- Filtros e ordenação
- Responsividade mobile

### Tela de Depósito:
- Melhorar visual do QR Code
- Animação do timer
- Feedback visual de confirmação
- Tutorial de como fazer depósito

### Dashboard Admin:
- Gráficos e estatísticas
- Lista de transações recentes
- Alertas e notificações

---

## 📝 6. CHECKLIST DE TESTE

Antes de começar mudanças estéticas, teste tudo:

- [ ] Cadastrar endereço da plataforma como MASTER
- [ ] Criar conta de usuário normal
- [ ] Criar pedido PIX
- [ ] Simular pagamento de colateral
- [ ] Ver pedido em "Meus Pedidos"
- [ ] Ver pedido no Marketplace
- [ ] Fazer login com outro usuário
- [ ] Aceitar pedido do marketplace
- [ ] Cancelar pedido (com modal de aviso de taxas)
- [ ] Desativar endereço da plataforma
- [ ] Tentar criar pedido com endereço inativo (deve falhar)
- [ ] Reativar endereço
- [ ] Criar pedido Boleto
- [ ] Testar com diferentes criptos (BTC, USDC, USDT)
- [ ] Testar com diferentes redes (Bitcoin, Ethereum, Base, etc)

---

## 🔒 7. SEGURANÇA

### Lembre-se:

- ✅ Sistema SEMPRE verifica colateral antes de mostrar no marketplace
- ✅ Apenas pedidos com `collateralConfirmed = true` aparecem
- ✅ Simulação só funciona em desenvolvimento (`NODE_ENV !== 'production'`)
- ✅ Todas as ações de ADMIN são registradas em `AdminAction` (audit log)
- ✅ Endereços da plataforma são protegidos por autenticação MASTER/ADMIN

### Em produção:

- **REMOVER** botão de simulação (ou deixar condicionado a `process.env.NODE_ENV`)
- Configurar **endereços reais** da plataforma
- Implementar **monitoramento** de depósitos 24/7
- Configurar **alertas** para depósitos grandes
- Fazer **backup** das chaves privadas dos endereços da plataforma

---

## 📞 8. SUPORTE

Se algo não funcionar:

1. **Verifique os logs**: `tail -f logs/api.log`
2. **Veja o console do navegador**: F12 → Console
3. **Teste a API diretamente**: Use Postman ou cURL
4. **Reinicie o sistema**: `./parar-simples.sh && ./iniciar-simples.sh`

---

**Versão**: 1.0
**Última atualização**: 07/10/2025
**Autor**: Claude (Anthropic)
