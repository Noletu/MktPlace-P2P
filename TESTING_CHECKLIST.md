# Checklist de Testes - Feature: Remove Tron & Cleanup Legacy

## Status Atual
- ✅ Branch: `feature/remove-tron-cleanup-legacy`
- ✅ Commit: `81f6f74`
- ✅ Backend: Rodando em `http://localhost:3001`
- ✅ Frontend: Rodando em `http://localhost:3000`
- ✅ Compilação TypeScript: OK
- ✅ Console: Limpo

---

## Testes Críticos (OBRIGATÓRIOS)

### 1. Worker de Release de Colateral ⚠️ CRÍTICO
**Por que é crítico**: Fundos podem ficar travados se este worker falhar

**Como testar**:
1. Criar um pedido com colateral
2. Completar o pedido (marcar como concluído)
3. Verificar logs do backend: `🔓 Liberando colateral do pedido`
4. Verificar que saldo foi desbloqueado corretamente na carteira do usuário

**O que esperar**:
```
✅ Sem erros no console do backend
✅ Log mostrando "Colateral liberado com sucesso"
✅ Saldo disponível aumentou na carteira do usuário
```

**Se falhar**: Colateral ficará bloqueado permanentemente - REPORTAR IMEDIATAMENTE

---

### 2. Criação de Pedidos
**Como testar**:
1. Ir em: `http://localhost:3000/orders/create`
2. Selecionar cada tipo de cripto:
   - BTC → Verificar: Apenas BITCOIN disponível
   - USDT → Verificar: ETHEREUM, BASE, ARBITRUM, SOLANA disponíveis
   - USDC → Verificar: ETHEREUM, BASE, ARBITRUM, SOLANA disponíveis
3. Tentar criar pedido com cada combinação
4. Verificar que pedido é criado com sucesso

**O que NÃO deve aparecer**:
- ❌ Opção TRC20 em qualquer dropdown
- ❌ Referência a "Tron" em qualquer lugar da UI

---

### 3. Admin - Gerenciamento de Wallets
**Como testar**:
1. Ir em: `http://localhost:3000/admin/wallets`
2. Clicar em "Adicionar Endereço"
3. Verificar dropdown de "Rede"

**O que deve aparecer**:
- ✅ BITCOIN
- ✅ ETHEREUM
- ✅ BASE
- ✅ ARBITRUM
- ✅ SOLANA

**O que NÃO deve aparecer**:
- ❌ TRC20
- ❌ TRON

---

### 4. Admin - Platform Wallets
**Como testar**:
1. Ir em: `http://localhost:3000/admin/platform-wallets`
2. Verificar wallets listadas
3. Tentar adicionar novo endereço

**O que verificar**:
- ✅ Nenhuma wallet Tron listada
- ✅ Dropdown não tem opção TRC20
- ✅ SOLANA está disponível nas opções

---

### 5. Homepage
**Como testar**:
1. Ir em: `http://localhost:3000`
2. Verificar seção "Redes Suportadas"

**O que deve mostrar**:
```
BTC: Bitcoin
USDC: Ethereum, Base, Arbitrum, Solana
USDT: Ethereum, Base, Arbitrum, Solana
```

**Dica no rodapé deve dizer**:
"💡 Dica: Use Layer 2 (Base/Arbitrum) ou Solana para taxas mais baixas!"

**O que NÃO deve aparecer**:
- ❌ "TRC20" em qualquer lugar
- ❌ "Tron" em qualquer lugar

---

## Testes de Console (Verificar Ausência de Erros)

### Console do Browser (http://localhost:3000)
**Abrir DevTools → Console**

**Erros que NÃO devem aparecer**:
- ❌ React hydration warnings
- ❌ `Prop dangerouslySetInnerHTML did not match`
- ❌ Favicon 404

**Warnings aceitáveis (IGNORAR)**:
- ⚠️ MetaMask extension warnings (normal, apenas extensão do browser)

---

### Console do Backend (Terminal)
**Verificar terminal onde backend está rodando**

**O que deve aparecer no início**:
```
✅ SQLite configured for better concurrency
🚀 API rodando em http://localhost:3001
📊 Swagger docs: http://localhost:3001/api-docs
🔄 Workers ativos:
   ✅ CollateralReleaseWorker rodando
   ✅ DepositMonitorWorker rodando
   ✅ BalanceSyncWorker rodando
   ✅ OrderExpirationWorker rodando
   ✅ PresenceMonitorWorker rodando
   ✅ ChatArchiveWorker rodando
```

**Erros que NÃO devem aparecer**:
- ❌ `Invalid prisma.$executeRaw() invocation`
- ❌ `order.internalBalanceId` não encontrado
- ❌ Qualquer erro relacionado a Tron/TRC20

---

## Testes de Integração (Recomendado)

### Fluxo Completo: Criar → Completar Pedido
1. **Criar pedido**:
   - Ir em `/orders/create`
   - Selecionar: USDT, BASE, valor qualquer
   - Criar pedido

2. **Verificar colateral bloqueado**:
   - Ir em `/wallet` ou perfil
   - Verificar que saldo disponível diminuiu
   - Verificar que "Bloqueado" aumentou

3. **Completar pedido** (via admin ou API):
   - Marcar pedido como COMPLETED

4. **Verificar colateral liberado**:
   - Esperar ~30 segundos (worker roda a cada 30s)
   - Verificar logs do backend: `🔓 Liberando colateral`
   - Ir em `/wallet`
   - Verificar que saldo disponível voltou ao normal
   - Verificar que "Bloqueado" diminuiu

**✅ SUCESSO SE**: Saldo foi corretamente desbloqueado
**❌ FALHA SE**: Saldo continua bloqueado após 2 minutos

---

## Verificações Técnicas (Opcional mas Recomendado)

### 1. Grep por Referências Tron
```bash
cd /home/nicode/MktPlace-P2P
grep -r "TRC20\|TRON\|tron" apps/api/src apps/web/app packages/shared/src --exclude-dir=node_modules
```
**Resultado esperado**: Nenhum resultado (0 matches)

### 2. TypeScript Compilation
```bash
cd /home/nicode/MktPlace-P2P
npx tsc --noEmit
```
**Resultado esperado**: 1 erro pré-existente em test file (não relacionado)

### 3. Verificar Workers Ativos
```bash
# No terminal do backend, verificar que todos os 6 workers estão rodando
# Deve mostrar checkmark verde ✅ para cada worker
```

### 4. Verificar Favicon
```bash
# Abrir http://localhost:3000 no browser
# Verificar que ícone "M" verde aparece na tab do browser
# Não deve ter erro 404 para favicon no console
```

---

## Critérios de Aprovação

### Para aprovar este PR, TODOS os itens devem passar:

**Funcionalidade**:
- [ ] Worker de colateral libera fundos corretamente
- [ ] Pedidos podem ser criados sem erro
- [ ] TRC20 não aparece em nenhum dropdown/UI
- [ ] SOLANA aparece nas opções de rede

**Console/Erros**:
- [ ] Nenhum erro no console do browser (exceto MetaMask warning)
- [ ] Nenhum erro no console do backend
- [ ] Favicon carrega corretamente

**Código**:
- [ ] Zero referências a TRC20/TRON no código fonte (grep)
- [ ] TypeScript compila (apenas 1 erro pré-existente não relacionado)
- [ ] Todos os 6 workers iniciam corretamente

---

## Se Encontrar Problemas

### Problema: Worker não libera colateral
**Verificar**:
1. Logs do backend: procurar por `🔓 Liberando colateral`
2. Se não aparecer: verificar status do pedido (deve estar COMPLETED)
3. Se aparecer mas com erro: copiar erro completo

**Reportar**: Mensagem de erro completa + status do pedido

---

### Problema: Erro no console do browser
**Verificar**:
1. Se é erro real ou warning do MetaMask
2. Se for erro real: copiar mensagem completa

**Reportar**: Screenshot + mensagem de erro

---

### Problema: TRC20 ainda aparece em algum lugar
**Verificar**:
1. Hard refresh do browser (Ctrl+Shift+R)
2. Limpar cache do browser
3. Se ainda aparecer: tirar screenshot

**Reportar**: Screenshot + URL da página

---

## Comandos Úteis Durante Testes

### Reiniciar Backend
```bash
# Ctrl+C no terminal do backend
cd /home/nicode/MktPlace-P2P/apps/api
npm run dev
```

### Reiniciar Frontend
```bash
# Ctrl+C no terminal do frontend
cd /home/nicode/MktPlace-P2P/apps/web
npm run dev
```

### Ver Logs do Backend em Tempo Real
```bash
# Já está visível no terminal onde o backend está rodando
# Procurar por:
# - 🔓 (release de colateral)
# - ⚠️ (warnings)
# - ❌ (erros)
```

### Verificar Banco de Dados (SQLite)
```bash
cd /home/nicode/MktPlace-P2P/apps/api
npx prisma studio
# Abre interface web em http://localhost:5555
# Ver tabelas: Order, UserWallet, User
```

---

## Após Todos os Testes Passarem

### Próximo Passo: Push para GitHub
```bash
cd /home/nicode/MktPlace-P2P

# Verificar branch
git branch

# Ver mudanças
git log --oneline -5

# Push para GitHub
git push origin feature/remove-tron-cleanup-legacy

# Criar Pull Request no GitHub
# Título: "feat: Remove Tron/TRC20 support and refactor legacy code"
```

---

## Resumo Rápido

**O que mudou**:
- ❌ Removido: Tron/TRC20 (160+ referências)
- 🔧 Refatorado: Worker de colateral (crítico)
- 🧹 Limpo: Código legado e erros no console
- ➕ Adicionado: SOLANA em admin interfaces

**O que testar**:
1. Worker libera colateral ✓
2. Criar pedidos sem TRC20 ✓
3. Admin wallets sem TRC20 ✓
4. Console limpo ✓

**Status**: Pronto para testes ✅
**Próximo**: Push para GitHub após aprovação

---

**Checklist criado em**: 04 de Dezembro de 2025
**Branch**: feature/remove-tron-cleanup-legacy
**Commit**: 81f6f74
