# Scripts de Manutenção - Mktplace P2P

## 🔧 Scripts Disponíveis

### `fix-disputed-orders.ts`

**Propósito**: Corrigir pedidos que ficaram com status `DISPUTED` após resolução de disputa.

**Quando usar**:
- Após atualizar o código de resolução de disputas
- Quando pedidos resolvidos ainda aparecem como "Em Disputa"
- Para corrigir inconsistências históricas no banco de dados

**Como executar**:

```bash
# Navegar para o diretório da API
cd C:\Projects\Mktplace-p2p\apps\api

# Executar o script
npx tsx scripts/fix-disputed-orders.ts
```

**O que o script faz**:
1. Busca todos os pedidos com status `DISPUTED`
2. Verifica se têm disputas resolvidas (`RESOLVED_BUYER`, `RESOLVED_SELLER`, `CANCELLED`)
3. Atualiza o status do pedido para:
   - `COMPLETED` se a disputa foi `RESOLVED_SELLER`
   - `CANCELLED` se a disputa foi `RESOLVED_BUYER` ou `CANCELLED`
4. Mostra relatório detalhado de cada correção

**Segurança**:
- ✅ Script é idempotente (pode executar múltiplas vezes sem problemas)
- ✅ Apenas atualiza pedidos que REALMENTE precisam de correção
- ✅ Não afeta pedidos com disputas ainda abertas
- ✅ Mostra preview antes de aplicar mudanças

**Exemplo de saída**:
```
🔍 Buscando pedidos com disputa resolvida mas status DISPUTED...

📋 Encontrados 1 pedidos com status DISPUTED

📝 Pedido: cmh18twu
   Disputa resolvida por: Admin
   Status da disputa: RESOLVED_BUYER
   ✅ Corrigindo: DISPUTED → CANCELLED

🎉 Correção concluída: 1 pedidos atualizados!
✅ Os pedidos agora mostram o status correto no frontend.
```

---

## 📝 Como Criar Novos Scripts

1. Criar arquivo `.ts` na pasta `scripts/`
2. Importar `PrismaClient`
3. Implementar lógica com try/catch
4. Adicionar logs informativos
5. Sempre chamar `prisma.$disconnect()` no final
6. Documentar no README.md

**Template**:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function myScript() {
  console.log('🔍 Iniciando script...');

  try {
    // Sua lógica aqui

    console.log('✅ Script concluído!');
  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  }
}

myScript()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## ⚠️ Avisos Importantes

1. **Sempre fazer backup do banco** antes de executar scripts de correção
2. **Testar em ambiente de desenvolvimento** primeiro
3. **Ler o código do script** antes de executar
4. **Verificar logs** para entender o que foi modificado

---

## 🛠️ Troubleshooting

**Erro: "Cannot find module 'tsx'"**
```bash
npm install -g tsx
# ou
npx tsx scripts/fix-disputed-orders.ts
```

**Erro: "PrismaClient is not a constructor"**
```bash
cd apps/api
npx prisma generate
```

**Erro de conexão com banco de dados**
- Verificar se o arquivo `.env` está configurado
- Verificar se o banco de dados está acessível
- Executar `npx prisma db push` se necessário

---

**Última atualização**: 21/10/2025
