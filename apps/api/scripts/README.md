# Scripts de Manutenção - Mktplace P2P

## 🔧 Scripts Disponíveis

### `clean-database-full.ts` ⭐ NOVO

**Propósito**: Limpar COMPLETAMENTE o banco de dados para testes do zero, preservando apenas usuários MASTER e ADMIN.

**Quando usar**:
- Resetar sistema para testes completos
- Limpar todos os dados de desenvolvimento
- Preparar ambiente limpo para demos
- Resolver inconsistências generalizadas no banco

**⚠️ ATENÇÃO**: Esta operação é **IRREVERSÍVEL**! Um backup automático é criado antes da limpeza.

**Como executar**:

```bash
# Navegar para o diretório da API
cd C:\Projects\Mktplace-p2p\apps\api

# Executar o script (RECOMENDADO - usa comando npm)
npm run db:clean

# OU executar diretamente
npx tsx scripts/clean-database-full.ts
```

**O que o script faz**:
1. **Conta registros atuais** - Mostra quantos registros existem antes da limpeza
2. **Cria backup automático** - `dev.db.backup-YYYYMMDD-HHMMSS` na pasta `prisma/`
3. **Limpa TODAS as tabelas** em ordem correta (respeitando foreign keys):
   - ✅ Nível 6: ChatArchive, ChatMessage, DisputeMessage, Fee
   - ✅ Nível 5: Notification, Chat, Review, Dispute, CollateralTransaction
   - ✅ Nível 4: Transaction
   - ✅ Nível 3: Order
   - ✅ Nível 2: Withdrawal, Deposit, Wallet, InternalBalance
   - ✅ Nível 1: KYCVerification, UserKeys, RefreshToken, AdminAction
   - ✅ Nível 0: CollateralAddress, PlatformWallet, PriceQuote, PhoneVerificationCode, AuditLog
   - ✅ Especial: Deleta apenas usuários comuns (preserva MASTER e ADMIN)
4. **Verifica resultado** - Confirma que apenas admins restaram
5. **Mostra credenciais** - Exibe login dos usuários preservados

**Dados PRESERVADOS**:
- ✅ Usuário MASTER (master@mktplace.com / Master@2025!)
- ✅ Usuário ADMIN (admin@mktplace.com / Admin@123)
- ✅ Estrutura do banco (schema, migrations)

**Dados DELETADOS** (TUDO):
- ❌ Todos os usuários comuns
- ❌ Todas as carteiras (incluindo PlatformWallet)
- ❌ Todos os pedidos e transações
- ❌ Todos os chats e mensagens
- ❌ Todas as notificações
- ❌ Todas as disputas e avaliações
- ❌ Todo o histórico de auditoria
- ❌ Todos os saldos e colaterais

**Segurança**:
- ✅ Backup automático antes de qualquer operação
- ✅ Transação atômica (tudo ou nada - rollback em caso de erro)
- ✅ Logs coloridos e informativos
- ✅ Verificação final de consistência

**Exemplo de saída**:
```
🗑️  LIMPEZA COMPLETA DO BANCO DE DADOS - MKTPLACE P2P

⚠ ══════════════════════════════════════════════════════════════════════
⚠   ATENÇÃO: Esta operação irá DELETAR TODOS os dados do banco!
⚠   Preservando apenas: Usuários MASTER e ADMIN
⚠   Um backup será criado automaticamente.
⚠ ══════════════════════════════════════════════════════════════════════

📊 CONTANDO REGISTROS ATUAIS
  Usuários: 5
  Carteiras: 8
  Pedidos: 12
  Transações: 7
  Chats: 3
  Mensagens: 45
  Notificações: 23
  Disputas: 1
  Avaliações: 2
  Carteiras Plataforma: 6
  Logs Auditoria: 15

💾 CRIANDO BACKUP
✓ Backup criado: dev.db.backup-2025-11-08T14-30-52 (0.86 MB)

🧹 INICIANDO LIMPEZA DO BANCO DE DADOS
ℹ Limpando nível 6 (ChatArchive, ChatMessage, DisputeMessage, Fee)...
✓ Nível 6 limpo
ℹ Limpando nível 5 (Notification, Chat, Review, Dispute, CollateralTransaction)...
✓ Nível 5 limpo
...
✓ Limpeza concluída com sucesso!

🔍 VERIFICANDO RESULTADO
  Total de usuários: 2
  Usuários preservados:
    - master@mktplace.com (MASTER)
    - admin@mktplace.com (ADMIN)
  Total de pedidos: 0
  Total de transações: 0
  Total de notificações: 0
✓ ✨ Banco limpo com sucesso! Apenas admins preservados.

📋 INFORMAÇÕES IMPORTANTES
  Backup salvo em: C:\Projects\Mktplace-p2p\apps\api\prisma\dev.db.backup-2025-11-08T14-30-52

  Credenciais disponíveis:
  ┌─────────────────────────────────────┐
  │ Master:                             │
  │   Email: master@mktplace.com        │
  │   Senha: Master@2025!               │
  │                                     │
  │ Admin:                              │
  │   Email: admin@mktplace.com         │
  │   Senha: Admin@123                  │
  └─────────────────────────────────────┘

ℹ Para restaurar o backup:
  cd apps/api/prisma
  copy "dev.db.backup-2025-11-08T14-30-52" dev.db

✓ 🎉 Limpeza completa! Sistema pronto para testes do zero.
```

**Como restaurar backup**:
```bash
cd C:\Projects\Mktplace-p2p\apps\api\prisma

# Listar backups disponíveis
dir dev.db.backup-*

# Restaurar backup específico (Windows)
copy dev.db.backup-2025-11-08T14-30-52 dev.db

# Restaurar backup específico (Linux/Mac)
cp dev.db.backup-2025-11-08T14-30-52 dev.db
```

**Próximos passos após limpeza**:
1. Reiniciar servidor (se estiver rodando)
2. Fazer login com credenciais admin
3. Cadastrar PlatformWallet novamente (ou executar seed)
4. Começar testes do zero

**Alternativa - Seed completo**:
Se quiser recriar também as carteiras da plataforma:
```bash
npm run prisma:seed
```

---

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
