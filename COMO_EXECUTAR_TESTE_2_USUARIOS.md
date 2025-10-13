# 🚀 Como Executar o Teste de 2 Usuários com KYC Completo

## 📋 Pré-requisitos

✅ Node.js instalado (v20+)
✅ API configurada e funcionando
✅ Git Bash instalado (Windows) ou terminal Bash (Linux/Mac)

---

## 🎯 Passo a Passo

### 1️⃣ Instalar Dependências (se ainda não instalou)

```bash
# Execute o script de instalação
📦 INSTALAR-DEPENDENCIAS.bat
```

Ou manualmente:
```bash
cd C:\Projects\MktPlace-P2P\apps\api
npm install

cd C:\Projects\MktPlace-P2P\apps\web
npm install
```

---

### 2️⃣ Resetar o Database (Limpar Dados Antigos)

**IMPORTANTE:** Este passo apaga todos os dados do banco!

```bash
cd C:\Projects\MktPlace-P2P\apps\api
npx prisma migrate reset --force --skip-seed
```

**Resultado esperado:**
```
✔ Are you sure you want to reset your database? › yes
Database reset successful
```

---

### 3️⃣ Iniciar a API

Abra um novo terminal (Prompt de Comando ou PowerShell) e execute:

```bash
cd C:\Projects\MktPlace-P2P\apps\api
npm run dev
```

**Aguarde aparecer:**
```
⚡️ [server]: Server is running at http://localhost:3001
🚀 [server]: Mktplace da Liberdade API v0.1.0
💬 [socket]: Chat WebSocket enabled at ws://localhost:3001
```

**✅ A API está pronta!**

---

### 4️⃣ Executar o Teste

**Abra um NOVO terminal** (Git Bash no Windows) e execute:

```bash
cd C:\Projects\MktPlace-P2P
bash test_2_users_kyc_complete.sh
```

Ou no PowerShell:
```powershell
cd C:\Projects\MktPlace-P2P
bash .\test_2_users_kyc_complete.sh
```

---

## 📊 O que o Script Faz

### Usuário 1 - João Vendedor
1. ✅ Cadastra João
2. ✅ KYC Level 1 (CPF + endereço)
3. ✅ KYC Level 2 (selfie + RG)
4. ✅ Adiciona carteira BTC
5. ✅ Cria pedido PIX de R$ 450

### Usuário 2 - Maria Compradora
1. ✅ Cadastra Maria
2. ✅ KYC Level 1 (CPF + endereço)
3. ✅ KYC Level 2 (selfie + CNH)
4. ✅ Vê pedido de João no marketplace
5. ✅ Aceita pedido de João (match)
6. ✅ Envia comprovante PIX

### Verificações Finais
1. ✅ João vê pedido com status MATCHED
2. ✅ Maria vê transação com comprovante
3. ✅ Ambos com KYC Level 2 confirmado

---

## ✅ Resultado Esperado

```
🧪 TESTE COMPLETO - MktPlace P2P - 2 USUÁRIOS COM KYC LEVEL 2
==============================================================

✅ João registrado - ID: cm...
✅ KYC L1 completo - João (limite R$10.000/dia)
✅ KYC L2 completo - João (limite R$50.000/dia)
✅ Carteira BTC adicionada - João
✅ Pedido PIX R$450 criado - João

✅ Maria registrada - ID: cm...
✅ KYC L1 completo - Maria (limite R$10.000/dia)
✅ KYC L2 completo - Maria (limite R$50.000/dia)
✅ Marketplace mostra pedido de João (R$450)
✅ Match realizado! Transaction ID: cm...
✅ Comprovante enviado - Maria → João (R$450)

✅ João vê seus pedidos (status: MATCHED)
✅ Maria vê transações (comprovante enviado)
✅ João está com KYC Level 2 confirmado
✅ Maria está com KYC Level 2 confirmado

════════════════════════════════════════════════════════════
📈 ESTATÍSTICAS FINAIS
════════════════════════════════════════════════════════════

⏱️  PERFORMANCE:
  Tempo de execução: 8s
  Testes: 14/14
  Taxa de sucesso: 100%

🎉 TODOS OS TESTES PASSARAM!

Sistema P2P 100% funcional com:
  ✅ 2 usuários autenticados
  ✅ 2 KYC Level 1 (CPF + endereço)
  ✅ 2 KYC Level 2 (selfie + documentos)
  ✅ 1 carteira BTC cadastrada
  ✅ 1 pedido PIX criado (R$450)
  ✅ 1 transação matched
  ✅ 1 comprovante enviado
  ✅ Marketplace operacional
```

---

## 🐛 Troubleshooting

### ❌ Erro: "bash: command not found"
**Problema:** Git Bash não está instalado ou não está no PATH

**Solução Windows:**
1. Baixe Git Bash: https://git-scm.com/download/win
2. Instale com opções padrão
3. Reinicie o terminal

**Solução alternativa:**
Use WSL (Windows Subsystem for Linux)

---

### ❌ Erro: "curl: command not found"
**Problema:** curl não está disponível

**Solução Windows:**
- Git Bash já inclui curl
- Use Git Bash ao invés de CMD/PowerShell

**Solução Linux:**
```bash
sudo apt install curl
```

---

### ❌ Erro: API não responde (Connection refused)
**Problema:** API não está rodando na porta 3001

**Solução:**
1. Verifique se a API está rodando:
   ```bash
   curl http://localhost:3001/health
   ```
2. Se não responder, inicie a API:
   ```bash
   cd C:\Projects\MktPlace-P2P\apps\api
   npm run dev
   ```

---

### ❌ Erro: "Database is locked"
**Problema:** Banco de dados SQLite está sendo usado por outro processo

**Solução:**
1. Feche todos os terminais com API rodando
2. Mate processos Node:
   ```bash
   taskkill /F /IM node.exe
   ```
3. Tente novamente

---

### ❌ Testes falhando com "dados inválidos"
**Problema:** Schema do banco não está atualizado

**Solução:**
```bash
cd C:\Projects\MktPlace-P2P\apps\api
npx prisma migrate reset --force --skip-seed
npx prisma generate
npm run dev
```

---

### ❌ Erro: "CPF inválido"
**Problema:** CPFs no script não passam na validação

**Solução:**
Os CPFs usados são válidos:
- João: `11144477735` ✅
- Maria: `52998224725` ✅

Se alterou os CPFs, use o gerador de CPF válido online.

---

## 📁 Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `test_2_users_kyc_complete.sh` | Script principal de teste |
| `RELATORIO_TESTE_2_USUARIOS_KYC.md` | Relatório detalhado com métricas |
| `COMO_EXECUTAR_TESTE_2_USUARIOS.md` | Este guia |
| `test_5_users_CLEAN.sh` | Script de referência (5 usuários) |

---

## 📚 Próximos Passos

Após executar com sucesso:

1. **Ver os dados no banco:**
   ```bash
   cd C:\Projects\MktPlace-P2P\apps\api
   npx prisma studio
   ```
   Acesse: http://localhost:5555

2. **Testar no Frontend:**
   ```bash
   cd C:\Projects\MktPlace-P2P\apps\web
   npm run dev
   ```
   Acesse: http://localhost:3000
   - Faça login com João ou Maria
   - Veja pedidos e transações

3. **Executar outros testes:**
   ```bash
   bash test_5_users_CLEAN.sh  # Teste com 5 usuários
   ```

---

## 🎯 Checklist de Validação

Antes de executar, certifique-se:

- [ ] Node.js instalado
- [ ] Git Bash instalado (Windows)
- [ ] Dependências instaladas (npm install)
- [ ] Database resetado
- [ ] API rodando em http://localhost:3001
- [ ] Terminal Git Bash aberto
- [ ] No diretório correto: C:\Projects\MktPlace-P2P

---

## 🎉 Pronto!

Se seguiu todos os passos, você deve ver:

```
🎉 TODOS OS TESTES PASSARAM!
```

**Parabéns!** Você simulou com sucesso:
- 2 usuários completos
- KYC Level 1 e Level 2
- Transação P2P com pagamento

---

**Dúvidas?** Consulte:
- `RELATORIO_TESTE_2_USUARIOS_KYC.md` - Documentação completa
- `DOCUMENTACAO_TESTES_COMPLETA.md` - Histórico de testes
- `README.md` - Visão geral do projeto
