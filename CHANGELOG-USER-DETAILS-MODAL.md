# Melhorias na Tela de Detalhes do Usuario (Admin)

**Data:** 2026-01-22
**Branch:** feature/coupon-system-v4.1.3
**Status:** Implementado - Aguardando testes

---

## Arquivos Modificados

| Arquivo | Alteracoes |
|---------|-----------|
| `apps/api/src/services/admin.service.ts` | +85 linhas |
| `apps/web/components/admin/modals/UserDetailsModal.tsx` | +145 linhas |

---

## Problema 1: Enderecos de Carteira Nao Visiveis

### Antes
- Card "Saldos por Criptomoeda" mostrava apenas valores agregados
- Enderecos individuais das carteiras eram perdidos na agregacao
- Admins nao conseguiam ver os enderecos para correcoes manuais

### Depois
- Cada criptomoeda agora mostra lista de carteiras individuais
- Cada carteira exibe:
  - Network (badge roxo)
  - Endereco completo (com botao de copiar)
  - Saldo disponivel (verde)
  - Saldo bloqueado (amarelo, se > 0)

### Alteracoes no Backend (`admin.service.ts`)

```typescript
// Estrutura atualizada do balancesByCrypto
const balancesByCrypto: Record<string, {
  total: string;
  available: string;
  locked: string;
  wallets: number;
  walletList: Array<{  // NOVO
    id: string;
    address: string;
    network: string;
    balance: string;
    availableBalance: string;
    lockedBalance: string;
  }>;
}> = {};

// Cada carteira e adicionada a lista
balancesByCrypto[wallet.cryptoType].walletList.push({
  id: wallet.id,
  address: wallet.address,
  network: wallet.network,
  balance: wallet.balance || '0',
  availableBalance: wallet.availableBalance || '0',
  lockedBalance: wallet.lockedBalance || '0',
});

// Retorno inclui a lista de carteiras
balances: Object.entries(balancesByCrypto).map(([crypto, data]) => ({
  // ... campos existentes
  wallets: data.walletList,
})),
```

### Alteracoes no Frontend (`UserDetailsModal.tsx`)

```typescript
// Interface atualizada
balances: Array<{
  // ... campos existentes
  wallets: Array<{
    id: string;
    address: string;
    network: string;
    balance: string;
    availableBalance: string;
    lockedBalance: string;
  }>;
}>;

// Funcao de copiar endereco
const copyToClipboard = async (address: string) => {
  await navigator.clipboard.writeText(address);
  setCopiedAddress(address);
  setTimeout(() => setCopiedAddress(null), 2000);
};

// UI para cada carteira
{balance.wallets.map((wallet) => (
  <div key={wallet.id}>
    <span>{wallet.network}</span>
    <code>{wallet.address}</code>
    <button onClick={() => copyToClipboard(wallet.address)}>
      {copiedAddress === wallet.address ? 'Copiado!' : 'Copiar'}
    </button>
    <span>{wallet.availableBalance}</span>
    {parseFloat(wallet.lockedBalance) > 0 && (
      <span>Bloq: {wallet.lockedBalance}</span>
    )}
  </div>
))}
```

---

## Problema 2: Pedidos Incompletos na Aba "Pedidos"

### Antes
- Query buscava apenas pedidos CRIADOS pelo usuario (`where: { userId }`)
- Nao mostrava pedidos onde o usuario era PAGADOR (aceitou pedido de outro)
- Limite de 50 pedidos podia ocultar historico

### Depois
- Busca pedidos como CRIADOR e como PAGADOR
- Nova coluna "Papel" identifica se e Criador (azul) ou Pagador (verde)
- Filtro de status: Todos, PENDING, MATCHED, COMPLETED, CANCELLED, DISPUTED
- Limite aumentado para 100 pedidos

### Alteracoes no Backend (`admin.service.ts`)

```typescript
// Buscar pedidos como CRIADOR
const ordersAsCreator = await prisma.order.findMany({
  where: { userId },
  take: 100,
  // ...
});

// Buscar pedidos como PAGADOR
const ordersAsPayer = await prisma.order.findMany({
  where: {
    transactions: {
      some: { payerId: userId },
    },
  },
  take: 100,
  // ...
});

// Combinar e remover duplicados
const orderIds = new Set<string>();
const allOrdersCombined = [];

for (const order of ordersAsCreator) {
  if (!orderIds.has(order.id)) {
    orderIds.add(order.id);
    allOrdersCombined.push({ ...order, userRole: 'CREATOR' });
  }
}

for (const order of ordersAsPayer) {
  if (!orderIds.has(order.id)) {
    orderIds.add(order.id);
    allOrdersCombined.push({ ...order, userRole: 'PAYER' });
  }
}

// Ordenar por data
const orders = allOrdersCombined.sort((a, b) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
);
```

### Alteracoes no Frontend (`UserDetailsModal.tsx`)

```typescript
// Interface atualizada
orders: Array<{
  // ... campos existentes
  userRole: 'CREATOR' | 'PAYER';
}>;

// Estado para filtro
const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');

// Filtro de status
<div className="flex gap-2 mb-4">
  {['ALL', 'PENDING', 'MATCHED', 'COMPLETED', 'CANCELLED', 'DISPUTED'].map((status) => (
    <button
      onClick={() => setOrderStatusFilter(status)}
      className={orderStatusFilter === status ? 'bg-blue-600' : 'bg-gray-200'}
    >
      {status === 'ALL' ? 'Todos' : status}
    </button>
  ))}
</div>

// Coluna "Papel" na tabela
<th>Papel</th>
<td>
  <span className={order.userRole === 'CREATOR' ? 'text-blue-500' : 'text-green-500'}>
    {order.userRole === 'CREATOR' ? 'Criador' : 'Pagador'}
  </span>
</td>
```

---

## Verificacao (Testes Manuais)

### Carteiras com enderecos
- [ ] Abrir detalhes de usuario com carteiras criadas
- [ ] Verificar que cada carteira mostra: endereco, network, saldos individuais
- [ ] Clicar no botao de copiar e verificar que endereco vai para clipboard

### Pedidos completos
- [ ] Verificar usuario que criou pedidos E aceitou pedidos de outros
- [ ] Filtrar por status COMPLETED, CANCELLED
- [ ] Confirmar que coluna "Papel" mostra corretamente CRIADOR vs PAGADOR

### Contagem correta
- [ ] Total de pedidos deve incluir ambos os papeis
- [ ] Saldo agregado deve bater com soma das carteiras individuais

---

## Status de Cores Adicionados

O `getStatusColor` foi expandido para incluir:
- `MATCHED`: azul
- `DISPUTED`: vermelho
- `PAYMENT_SENT`: roxo
- `VALIDATING`: laranja
- `APPROVED`: verde
- `REJECTED`: vermelho
- `OPEN`: amarelo
- `UNDER_REVIEW`: laranja
- `RESOLVED`: verde

---

## Proximos Passos

1. Testar as mudancas em ambiente de desenvolvimento
2. Verificar se os dados estao sendo exibidos corretamente
3. Ajustar estilos se necessario
4. Merge para branch principal apos aprovacao
