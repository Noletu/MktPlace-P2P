# Credenciais de Administração - MktPlace P2P

## 🔐 Usuário MASTER (Acesso Total)

**Email:** `master@mktplace.com`
**Senha:** `Master@2025!`
**CPF:** `99999999999`
**Role:** `MASTER`
**KYC Level:** `LEVEL_4` (Ilimitado)

### Permissões:
- ✅ Acesso total ao sistema
- ✅ Gerenciar endereços da plataforma
- ✅ Gerenciar usuários
- ✅ Gerenciar pedidos
- ✅ Ver audit logs
- ✅ Dashboard completo com estatísticas

### Como acessar:
1. Acesse: `http://localhost:3000/login`
2. Faça login com as credenciais acima
3. Clique em "Meu Perfil" → Será redirecionado automaticamente para `/admin`
4. Ou acesse diretamente: `http://localhost:3000/admin`

---

## 🔧 Usuário ADMIN (Administrador)

**Email:** `admin@mktplace.com`
**Senha:** `Admin@123`
**CPF:** `00000000000`
**Role:** `ADMIN`
**KYC Level:** `LEVEL_4` (Ilimitado)

### Permissões:
- ✅ Gerenciar endereços da plataforma
- ✅ Gerenciar usuários
- ✅ Gerenciar pedidos
- ✅ Ver audit logs
- ✅ Dashboard completo com estatísticas

### Como acessar:
1. Acesse: `http://localhost:3000/login`
2. Faça login com as credenciais acima
3. Clique em "Meu Perfil" → Será redirecionado automaticamente para `/admin`
4. Ou acesse diretamente: `http://localhost:3000/admin`

---

## 📊 Dashboard Admin

### URL: `http://localhost:3000/admin`

### Estatísticas disponíveis:
- 👥 Total de usuários (+ novos nos últimos 7 dias)
- 📦 Total de pedidos (+ recentes nos últimos 7 dias)
- ⏳ Pedidos ativos
- 💰 Volume total em BRL
- ✅ Pedidos completados
- 💸 Total de transações
- 🔍 KYC pendentes

### Ações rápidas:
- 🏦 **Endereços da Plataforma** → `/admin/platform-wallets`
- 👥 **Gerenciar Usuários** → `/admin/users`
- 📦 **Gerenciar Pedidos** → `/admin/orders`
- 📋 **Ver Audit Log** → `/admin/audit`

---

## 🏦 Gerenciar Endereços da Plataforma

### URL: `http://localhost:3000/admin/platform-wallets`

### O que fazer:
1. Clique em "➕ Adicionar Endereço"
2. Preencha:
   - **Criptomoeda**: BTC, USDC ou USDT
   - **Rede**: BITCOIN, ETHEREUM, TRC20, BASE, ARBITRUM
   - **Endereço**: Endereço completo da carteira da plataforma
   - **Label**: Nome identificador (opcional)
3. Clique em "✅ Criar Endereço"

### Endereços de exemplo (já cadastrados):
⚠️ **Estes são endereços de EXEMPLO. Substitua por endereços REAIS!**

1. **USDT na rede TRC20**
   - Endereço: `TExampleTRC20Address123456789012345`
   - Status: Ativo ✅

2. **USDC na rede BASE**
   - Endereço: `0xExampleBaseAddress1234567890123456789012`
   - Status: Ativo ✅

3. **BTC na rede BITCOIN**
   - Endereço: `bc1qExampleBitcoinAddress123456789012`
   - Status: Ativo ✅

---

## 🔄 Como foi criado

Os usuários MASTER e ADMIN foram criados via seed do banco de dados:

```bash
cd /home/nicode/MktPlace-P2P/apps/api
npx prisma db seed
```

**Arquivo seed:** `/apps/api/prisma/seed.ts`

---

## ⚠️ IMPORTANTE - SEGURANÇA

### Em desenvolvimento:
- ✅ Use as senhas padrão acima
- ✅ Endereços de exemplo estão ativos para testes

### Em produção:
- 🔴 **ALTERE IMEDIATAMENTE** as senhas padrão
- 🔴 **SUBSTITUA** os endereços de exemplo por endereços REAIS
- 🔴 **GUARDE** as chaves privadas dos endereços da plataforma em local seguro
- 🔴 **ATIVE** autenticação de dois fatores (quando implementado)
- 🔴 **MONITORE** os logs de acesso admin (audit logs)
- 🔴 **REMOVA** o botão de simulação de pagamento

### Como alterar senha em produção:

1. **Via seed** (recomendado):
   - Edite `/apps/api/prisma/seed.ts`
   - Altere `masterPassword` e `adminPassword`
   - Execute `npx prisma db seed`

2. **Via banco de dados diretamente**:
   ```bash
   # Gerar hash da nova senha (use Node.js ou script)
   node -e "console.log(require('bcryptjs').hashSync('NovaSenhaSegura@2025!', 12))"

   # Atualizar no banco (via Prisma Studio ou SQL)
   npx prisma studio
   ```

---

## 📝 Histórico de Mudanças

### 07/10/2025
- ✅ Usuário MASTER criado via seed
- ✅ Usuário ADMIN criado via seed
- ✅ Dashboard admin implementado
- ✅ Interface de gerenciamento de endereços da plataforma
- ✅ Redirecionamento automático de "Meu Perfil" para dashboard admin
- ✅ 3 endereços de exemplo cadastrados e ativos

---

## 🆘 Problemas Comuns

### "Credenciais inválidas" ao fazer login:
**Solução:** Execute o seed novamente:
```bash
cd /home/nicode/MktPlace-P2P/apps/api
npx prisma db seed
```

### "Erro ao buscar perfil":
**Solução:** Agora redireciona automaticamente para `/admin` se for ADMIN/MASTER

### "Nenhum endereço da plataforma encontrado":
**Solução:**
1. Faça login como MASTER
2. Acesse `/admin/platform-wallets`
3. Cadastre endereços para as criptos que você quer aceitar

---

**Última atualização:** 07/10/2025
**Versão:** 2.0
**Autor:** Claude (Anthropic)
