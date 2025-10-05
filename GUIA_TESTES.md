# 🧪 GUIA DE TESTES - MktPlace P2P v0.3.0

**Versão com Correções de Segurança Aplicadas**

---

## 🚀 PASSO 1: Iniciar o Servidor (Backend)

### Terminal 1 - API Backend

```bash
cd "C:\Projects\MktPlace-P2P\apps\api"
npm run dev
```

**Resposta esperada:**
```
⚡️ [server]: Server is running at http://localhost:3001
🚀 [server]: Mktplace da Liberdade API v0.1.0
```

**Verificar Health Check:**
```bash
curl http://localhost:3001/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-04T...",
  "service": "Mktplace da Liberdade API"
}
```

---

## 🧪 PASSO 2: Testar Novas Funcionalidades de Segurança

### ✅ Teste 1: Registro com Senha Forte (NOVO)

**❌ Falha Esperada - Senha Fraca:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@exemplo.com",
    "cpf": "12345678909",
    "password": "senha123",
    "name": "João Teste"
  }'
```

**Resposta esperada (ERRO):**
```json
{
  "success": false,
  "error": "Dados inválidos",
  "details": [
    {
      "message": "Senha deve conter pelo menos uma letra maiúscula"
    },
    {
      "message": "Senha deve conter pelo menos um caractere especial"
    }
  ]
}
```

**✅ Sucesso Esperado - Senha Forte:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@exemplo.com",
    "cpf": "12345678909",
    "password": "Senha@123!",
    "name": "João Teste"
  }'
```

**Resposta esperada (SUCESSO):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cm...",
      "email": "teste@exemplo.com",
      "name": "João Teste",
      "kycLevel": "NONE"
    }
  },
  "message": "Usuário registrado com sucesso"
}
```

**🔒 IMPORTANTE:** Note que o token **NÃO** aparece mais no JSON! Agora está em um **HttpOnly cookie** seguro.

---

### ✅ Teste 2: Validação de CPF Completa (NOVO)

**❌ CPF Inválido - Dígitos Verificadores Errados:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste2@exemplo.com",
    "cpf": "12345678900",
    "password": "Senha@123!",
    "name": "Maria Teste"
  }'
```

**Resposta esperada (ERRO):**
```json
{
  "success": false,
  "error": "Dados inválidos",
  "details": [
    {
      "message": "CPF inválido (dígitos verificadores incorretos)"
    }
  ]
}
```

**✅ CPF Válido - Use um CPF real ou gerado:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste2@exemplo.com",
    "cpf": "11144477735",
    "password": "Senha@123!",
    "name": "Maria Teste"
  }'
```

---

### ✅ Teste 3: Login com HttpOnly Cookies (NOVO)

**Login:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "teste@exemplo.com",
    "password": "Senha@123!"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cm...",
      "email": "teste@exemplo.com",
      "name": "João Teste"
    }
  },
  "message": "Login realizado com sucesso"
}
```

**🔒 Verificar Cookie Seguro:**
```bash
cat cookies.txt
```

**Conteúdo esperado:**
```
#HttpOnly_localhost	FALSE	/	FALSE	0	accessToken	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
#HttpOnly_localhost	FALSE	/	FALSE	0	refreshToken	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**🎯 Note:** O `#HttpOnly_` indica que JavaScript não pode acessar (proteção XSS)!

---

### ✅ Teste 4: Requisição Autenticada com Cookie (NOVO)

```bash
curl -X GET http://localhost:3001/api/v1/auth/me \
  -b cookies.txt
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "email": "teste@exemplo.com",
    "name": "João Teste",
    "cpf": "12345678909",
    "kycLevel": "NONE",
    "role": "USER"
  }
}
```

**🎯 Sem cookies, deve falhar:**
```bash
curl -X GET http://localhost:3001/api/v1/auth/me
```

**Resposta esperada (ERRO):**
```json
{
  "error": "Token não fornecido"
}
```

---

### ✅ Teste 5: CORS Whitelist Estrita (NOVO)

**❌ Origem Não Autorizada:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://site-malicioso.com" \
  -d '{"email":"teste@exemplo.com","password":"Senha@123!"}'
```

**Resposta esperada (BLOQUEADO):**
```
Error: Not allowed by CORS
```

**✅ Origem Autorizada:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"teste@exemplo.com","password":"Senha@123!"}'
```

**Resposta esperada (PERMITIDO):**
```json
{
  "success": true,
  "data": { /* ... */ }
}
```

---

## 🌐 PASSO 3: Testar Frontend (Opcional)

### Terminal 2 - Frontend Next.js

```bash
cd "C:\Projects\MktPlace-P2P\apps\web"
npm run dev
```

**Acessar:** http://localhost:3000

### Fluxo de Teste no Navegador:

1. **Clicar em "Criar Conta"**
2. **Preencher com senha FRACA** (ex: "senha123")
   - ❌ Deve mostrar erro: "Senha deve conter maiúscula, caractere especial..."
3. **Preencher com senha FORTE** (ex: "Senha@123!")
   - ✅ Deve registrar com sucesso
4. **Abrir DevTools → Application → Cookies**
   - ✅ Deve ver cookies `accessToken` e `refreshToken` com flag `HttpOnly`
5. **Tentar acessar token via JavaScript no Console:**
   ```javascript
   document.cookie
   ```
   - ✅ Deve retornar vazio (HttpOnly bloqueia acesso)

---

## 🔐 PASSO 4: Testar Segurança Avançada

### ✅ Teste 6: Rate Limiting

**Tentar 10 logins rápidos:**
```bash
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"teste@exemplo.com","password":"errado"}'
  echo ""
done
```

**Após 5 tentativas, deve retornar:**
```json
{
  "error": "Muitas tentativas de login. Tente novamente em 15 minutos."
}
```

---

### ✅ Teste 7: Logout com Revogação de Token

**Logout:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

**Tentar usar token revogado:**
```bash
curl -X GET http://localhost:3001/api/v1/auth/me \
  -b cookies.txt
```

**Resposta esperada (ERRO):**
```json
{
  "error": "Token não fornecido"
}
```

**🎯 Cookies foram limpos pelo servidor!**

---

## 📊 PASSO 5: Verificar Logs de Segurança

```bash
cd "C:\Projects\MktPlace-P2P\apps\api"
ls -la logs/
```

**Arquivos esperados:**
- `combined-2025-01-04.log` - Logs gerais
- `security-2025-01-04.log` - Logs de segurança
- `audit-2025-01-04.log` - Audit logs

**Ver logs de segurança:**
```bash
cat logs/security-*.log | tail -20
```

**Conteúdo esperado:**
```json
{"level":"info","message":"[SECURITY] User registered","userId":"cm...","timestamp":"..."}
{"level":"info","message":"[SECURITY] User logged in","userId":"cm...","timestamp":"..."}
{"level":"warn","message":"[SECURITY] CORS blocked unauthorized origin","origin":"https://site-malicioso.com"}
```

---

## 🎯 CHECKLIST DE TESTES

### Funcionalidades Básicas
- [ ] Health check respondendo
- [ ] Registro de usuário
- [ ] Login de usuário
- [ ] GET /me (autenticado)
- [ ] Logout

### Segurança (NOVAS)
- [ ] ✅ Senha forte obrigatória (uppercase + número + especial)
- [ ] ✅ CPF validado com dígitos verificadores
- [ ] ✅ HttpOnly cookies funcionando
- [ ] ✅ CORS bloqueando origens não autorizadas
- [ ] ✅ Rate limiting em login (5 tentativas/15min)
- [ ] ✅ Logs sanitizados (sem stack trace em produção)
- [ ] ✅ Timeout em requisições externas (5s)

### KYC e Funcionalidades Avançadas
- [ ] KYC Level 1 (CPF + endereço)
- [ ] Criação de carteira
- [ ] Criação de pedido
- [ ] Matching de pedido
- [ ] Upload de comprovante

---

## 🐛 TROUBLESHOOTING

### Erro: "JWT_SECRET must be at least 32 characters"
**Solução:** O `.env` foi copiado corretamente. Reinicie o servidor.

### Erro: "Not allowed by CORS"
**Solução:** Certifique-se que a requisição vem de `http://localhost:3000` ou adicione a origem em `ALLOWED_ORIGINS` no `.env`.

### Cookies não aparecem
**Solução:** Use flag `-c cookies.txt` no curl para salvar cookies, e `-b cookies.txt` para enviá-los.

### Senha não aceita
**Solução:** Use senha forte: mínimo 8 chars + 1 maiúscula + 1 minúscula + 1 número + 1 especial.
**Exemplo válido:** `Senha@123!`

---

## 📝 PRÓXIMOS PASSOS

Após validar todos os testes acima:

1. **Implementar blacklist JWT com Redis** (logout real)
2. **Rate limit por usuário** (não apenas IP)
3. **Refresh token rotation** (segurança de sessão)
4. **Validação de comprovantes** (MIME type + size)
5. **CSRF protection**

---

## 🎉 SUCESSO!

Se todos os testes passaram, o sistema está:
- ✅ **Funcionando corretamente**
- ✅ **Seguro contra as 7 vulnerabilidades críticas corrigidas**
- ✅ **Pronto para desenvolvimento contínuo**

**Versão testada:** 0.3.0 (com correções de segurança)
**Data:** 2025-01-04
