# Guia Rápido - Master Seed Management

**Data:** 2025-12-08
**Status:** ✅ Implementado e Rodando

---

## 🚀 Acesso Rápido

### Servidores Rodando
- **API:** http://localhost:3001 ✅
- **Web:** http://localhost:3000 ✅

### Credenciais de Admin

**MASTER (super admin):**
```
Email: master@mktplace.com
Senha: Master@2025!
```

**ADMIN:**
```
Email: admin@mktplace.com
Senha: Admin@123
```

---

## 📖 Como Usar

### 1. Login
```
URL: http://localhost:3000/login
Credenciais: master@mktplace.com / Master@2025!
```

### 2. Acessar Master Seed
```
URL: http://localhost:3000/admin/master-seed
```

### 3. Gerar Nova Seed (Primeira Vez)

**Quando você acessar pela primeira vez, verá:**
```
⚠️ Sistema Não Inicializado
Nenhuma master seed configurada.

[🔐 Gerar Nova Seed] [🆘 Importar Seed Existente]
```

**Clique em "Gerar Nova Seed":**

1. Leia os avisos de segurança
2. Clique em "Gerar Seed"
3. Sistema exibirá 24 palavras **UMA ÚNICA VEZ**
4. **COPIE AS 24 PALAVRAS** e guarde em papel no cofre
5. Copie também o "Encrypted Seed"
6. Adicione o encrypted seed no arquivo `.env`:

```bash
# /home/nicode/MktPlace-P2P/apps/api/.env
MASTER_SEED_ENCRYPTED=seu_encrypted_seed_aqui
```

7. Reinicie o servidor API:
```bash
cd /home/nicode/MktPlace-P2P/apps/api
npm run dev
```

### 4. Verificar Status

Após configurar, você verá:
```
✅ Master Seed Configurada

Criada em: 2025-12-08 18:30
Encryption: AES-256-GCM
Usuários com Carteiras: 0
Total de Carteiras: 0
Redes Suportadas: BITCOIN, ETHEREUM, BASE, ARBITRUM, SOLANA
```

---

## 🔐 Segurança

### Backup do Mnemonic (24 palavras)
- ✅ Escrever em papel
- ✅ Guardar em cofre ou banco
- ❌ NUNCA salvar em arquivo digital
- ❌ NUNCA compartilhar
- ⚠️  Com essas palavras é possível recuperar TODAS as carteiras

### Encrypted Seed
- ✅ Salvar no `.env`
- ✅ Fazer backup do `.env` em local seguro
- ⚠️  Sem o `MASTER_SEED_ENCRYPTION_KEY` correto, não é possível descriptografar

### Encryption Key
- Localização: `.env` (variável `MASTER_SEED_ENCRYPTION_KEY`)
- **IMPORTANTE:** Em produção, mover para servidor separado (Opção B do plano)

---

## 🔄 Recuperação de Emergência

**Cenário:** Servidor comprometido, precisa restaurar

### Passo a Passo:

1. Acesse: http://localhost:3000/admin/master-seed
2. Clique em "🆘 Importar Seed Existente"
3. Cole as 24 palavras guardadas no cofre
4. Sistema valida e testa contra carteiras existentes
5. Se bater 100%, sistema exibe novo encrypted seed
6. Adicione no `.env` e reinicie

---

## 📂 Arquivos Importantes

### Documentação Completa
```
/home/nicode/MktPlace-P2P/MASTER_SEED_IMPLEMENTATION.md
```
- 942 linhas de documentação técnica completa
- Arquitetura, segurança, fluxos, troubleshooting

### Código Backend
```
/home/nicode/MktPlace-P2P/apps/api/src/services/masterSeedAdmin.service.ts
/home/nicode/MktPlace-P2P/apps/api/src/controllers/masterSeedAdmin.controller.ts
/home/nicode/MktPlace-P2P/apps/api/src/routes/masterSeedAdmin.routes.ts
/home/nicode/MktPlace-P2P/apps/api/src/services/hd-wallet/master-seed.service.ts (modificado)
```

### Código Frontend
```
/home/nicode/MktPlace-P2P/apps/web/app/admin/master-seed/page.tsx
/home/nicode/MktPlace-P2P/apps/web/app/admin/layout.tsx (modificado)
```

### Scripts
```
/home/nicode/MktPlace-P2P/apps/api/scripts/create-admin-users.ts
```

### Configuração
```
/home/nicode/MktPlace-P2P/apps/api/.env
```

---

## ⚙️ Comandos Úteis

### Recriar usuários admin
```bash
cd /home/nicode/MktPlace-P2P/apps/api
npx tsx scripts/create-admin-users.ts
```

### Resetar banco de dados
```bash
cd /home/nicode/MktPlace-P2P/apps/api
npx prisma db push --force-reset
```

### Verificar status da master seed
```bash
curl http://localhost:3001/api/v1/admin/master-seed/status \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Iniciar servidores
```bash
# API (porta 3001)
cd /home/nicode/MktPlace-P2P/apps/api
npm run dev

# Web (porta 3000)
cd /home/nicode/MktPlace-P2P/apps/web
npm run dev
```

---

## 🐛 Troubleshooting Rápido

### Problema: "MASTER_SEED_ENCRYPTION_KEY not found"
**Solução:**
```bash
# Gerar nova key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Adicionar no .env
MASTER_SEED_ENCRYPTION_KEY=sua_key_aqui
```

### Problema: "Failed to decrypt seed"
**Causa:** Encryption key incorreta ou encrypted seed corrompido
**Solução:** Use "Importar Seed Existente" com mnemonic do backup

### Problema: Sistema diz "inicializado" mas não configurei
**Solução:**
```bash
# Limpar variável do .env
# MASTER_SEED_ENCRYPTED=

# Ou resetar banco completo
npx prisma db push --force-reset
npx tsx scripts/create-admin-users.ts
```

### Problema: Portas 3000/3001 ocupadas
**Solução:**
```bash
# Matar processos
pkill -9 node
pkill -9 tsx

# Aguardar 3 segundos
sleep 3

# Reiniciar servidores
```

---

## 📊 Endpoints da API

### GET /api/v1/admin/master-seed/status
Retorna status da master seed (inicializada ou não)

**Response:**
```json
{
  "success": true,
  "data": {
    "initialized": false,
    "message": "Master seed não configurada"
  }
}
```

### POST /api/v1/admin/master-seed/generate
Gera nova master seed

**Request:**
```json
{
  "twoFactorCode": "123456" // Opcional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mnemonic": ["word1", "word2", ..., "word24"],
    "encryptedSeed": "iv:authTag:ciphertext",
    "warning": "Guarde estas palavras em local seguro..."
  }
}
```

### POST /api/v1/admin/master-seed/recover
Recupera seed a partir de mnemonic

**Request:**
```json
{
  "mnemonic": "word1 word2 ... word24",
  "twoFactorCode": "123456" // Opcional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "encryptedSeed": "...",
    "stats": {
      "tested": 10,
      "matched": 10,
      "percentage": 100
    }
  }
}
```

### POST /api/v1/admin/master-seed/test-derivation
Testa derivação de carteiras

**Request:**
```json
{
  "mnemonic": "word1 word2 ... word24"
}
```

### GET /api/v1/admin/master-seed/audit-log
Busca histórico de operações (requer 2FA)

---

## ✅ Checklist de Produção

Antes de colocar em produção:

- [ ] Trocar senhas dos admins
- [ ] Ativar 2FA para todos os admins MASTER
- [ ] Mnemonic guardado em cofre físico
- [ ] Backup codes do 2FA guardados
- [ ] Encryption key em servidor separado (Opção B)
- [ ] HTTPS configurado
- [ ] Firewall configurado
- [ ] Alertas de segurança ativados
- [ ] Backup automático do banco de dados
- [ ] Procedimento de recuperação testado

---

## 🎯 Próximos Passos Recomendados

### Curto Prazo
1. ✅ Testar geração de seed
2. ✅ Testar recuperação de seed
3. ⏳ Testar derivação de carteiras para usuários
4. ⏳ Implementar testes automatizados

### Médio Prazo
1. Migrar para Opção B (Two-Server Setup)
2. Forçar 2FA para operações de master seed
3. Implementar rotação de encryption key

### Longo Prazo
1. Migrar para Vault (HashiCorp ou AWS KMS)
2. Multi-Sig Admin (2 de 3 admins)
3. Hardware Security Module (HSM)

---

## 📞 Suporte

**Documentação Técnica Completa:**
`/home/nicode/MktPlace-P2P/MASTER_SEED_IMPLEMENTATION.md`

**Credenciais de Teste:**
- MASTER: master@mktplace.com / Master@2025!
- ADMIN: admin@mktplace.com / Admin@123

**Portas:**
- API: http://localhost:3001
- Web: http://localhost:3000

---

**Última Atualização:** 2025-12-08
**Versão:** 1.0.0
**Status:** ✅ Pronto para uso
