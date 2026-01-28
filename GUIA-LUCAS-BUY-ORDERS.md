# Guia para Lucas - Continuação do Desenvolvimento

**Data:** 2026-01-28
**Branch:** `feature/buy-orders-complete`
**Repositório:** https://github.com/Noletu/MktPlace-P2P

---

## Como Começar

```bash
# Clonar o repositório (se ainda não tiver)
git clone https://github.com/Noletu/MktPlace-P2P.git
cd MktPlace-P2P

# Ou se já tiver, atualizar
git fetch origin
git checkout feature/buy-orders-complete
git pull origin feature/buy-orders-complete

# Instalar dependências
npm install

# Configurar ambiente
cp apps/api/.env.example apps/api/.env
# Editar .env com suas configurações

# Gerar Prisma Client
cd apps/api
npx prisma generate
npx prisma db push
cd ../..

# Iniciar servidores
npm run dev
# Ou em terminais separados:
# Terminal 1: cd apps/api && npm run dev
# Terminal 2: cd apps/web && npm run dev
```

---

## O Que Foi Implementado

### Sistema de Ordens BUY (Compra de Crypto)
Usuários sem crypto podem criar pedidos de compra, e provedores de liquidez aceitam fornecendo o colateral.

### Fluxo Completo:
1. **Comprador** cria ordem BUY especificando quanto crypto quer
2. Sistema calcula valor em BRL (com markup 2.5%)
3. **Provedor** aceita e deposita colateral (crypto + 1.5% fee)
4. Provedor informa dados PIX para receber pagamento
5. Comprador paga via PIX e envia comprovante
6. Provedor confirma recebimento
7. Crypto é liberada para comprador, fee vai para plataforma

### Arquivos Principais:
- `apps/api/src/services/order.service.ts` - Lógica de ordens BUY
- `apps/api/src/services/transaction.service.ts` - Transferências e fees
- `apps/web/app/orders/create/page.tsx` - Criar ordem BUY
- `apps/web/app/marketplace/page.tsx` - Listar ordens BUY/SELL
- `apps/web/app/orders/[orderId]/page.tsx` - Detalhes da ordem

### Documentação Detalhada:
- `apps/api/IMPLEMENTACAO_BUY_ORDERS.md` - Documentação completa

---

## Usuários de Teste

| Nome | Email | ID | Papel |
|------|-------|-----|-------|
| Infinity X | infx@gmail.com | cmkk6b9ac00058rmx97uzzpkg | Comprador |
| Infinity Y | infy@gmail.com | cmkk6cues000i8rmxqj64qem6 | Provedor |

**Senha padrão:** Verifique com o Nicode

---

## O Que Falta Fazer

### Prioridade Alta:
1. [ ] Testar fluxo de cancelamento para BUY orders
2. [ ] Testar disputas em BUY orders
3. [ ] Testar múltiplas ordens BUY consecutivas

### Prioridade Média:
4. [ ] Adicionar notificações específicas para BUY orders
5. [ ] Melhorar UX do formulário de aceite (provedor)
6. [ ] Adicionar histórico de ordens BUY no dashboard

### Prioridade Baixa:
7. [ ] Testes automatizados para fluxo BUY
8. [ ] Documentação de API (Swagger/OpenAPI)

---

## Endpoints da API

### Ordens BUY:
```
POST   /api/orders/buy              - Criar ordem BUY
POST   /api/orders/:id/accept-buy   - Aceitar ordem BUY (provedor)
GET    /api/orders/available        - Listar ordens (filtro: orderType=BUY|SELL|ALL)
```

### Transações:
```
POST   /api/transactions/:id/upload-proof     - Enviar comprovante
POST   /api/transactions/:id/confirm-payment  - Confirmar recebimento
```

---

## Matemática das Fees

### BUY Order:
- **Colateral** = cryptoAmount × 1.015 (crypto + 1.5% fee)
- **Platform Fee** = 1.5%
- **Markup BRL** = 2.5% sobre cotação

### Exemplo:
- Comprador quer: 0.01 BTC
- Cotação: R$ 500.000/BTC
- BRL base: R$ 5.000
- BRL com markup: R$ 5.125 (comprador paga)
- Provedor deposita: 0.01015 BTC
- Comprador recebe: 0.01 BTC
- Plataforma recebe: 0.00015 BTC

---

## Contato

Dúvidas? Fale com Nicode.

---

*Última atualização: 2026-01-28 15:45*
