# Guia de Instalação Manual das Dependências

## ⚠️ Problema Identificado

O npm está apresentando o erro: `Cannot read properties of null (reading 'location')`

Isso geralmente indica um problema com:
1. Cache corrompido do npm
2. Versão do Node.js/npm incompatível
3. package-lock.json corrompido
4. Permissões de arquivo

---

## ✅ SOLUÇÃO: Instalação Manual

### Opção 1: Reinstalar Node.js (Recomendado)

1. **Desinstalar Node.js atual:**
   - Painel de Controle → Programas → Desinstalar Node.js

2. **Baixar versão LTS mais recente:**
   - https://nodejs.org/
   - Versão recomendada: v20.x.x LTS

3. **Instalar e reiniciar o computador**

4. **Verificar instalação:**
   ```bash
   node --version
   npm --version
   ```

5. **Instalar dependências:**
   ```bash
   cd C:\Projects\Mktplace-p2p\apps\api
   npm install

   cd C:\Projects\Mktplace-p2p\apps\web
   npm install
   ```

---

### Opção 2: Limpar Cache e Reinstalar

```bash
# Limpar cache npm globalmente
npm cache clean --force

# Deletar node_modules e package-lock.json
cd C:\Projects\Mktplace-p2p\apps\api
rmdir /s /q node_modules
del package-lock.json
npm install

cd C:\Projects\Mktplace-p2p\apps\web
rmdir /s /q node_modules
del package-lock.json
npm install
```

---

### Opção 3: Usar Yarn (Alternativa)

Se o npm continuar falhando, use Yarn:

```bash
# Instalar Yarn globalmente
npm install -g yarn

# Instalar dependências com Yarn
cd C:\Projects\Mktplace-p2p\apps\api
yarn install

cd C:\Projects\Mktplace-p2p\apps\web
yarn install

# Executar testes com Yarn
yarn test
```

---

## 📦 Dependências Já Adicionadas aos package.json

### Backend (apps/api/package.json)

✅ **Scripts adicionados:**
```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage",
"test:verbose": "jest --verbose"
```

✅ **Dependências adicionadas:**
```json
"@types/jest": "^29.5.11",
"@types/supertest": "^6.0.2",
"jest": "^29.7.0",
"supertest": "^6.3.3",
"ts-jest": "^29.1.1"
```

### Frontend (apps/web/package.json)

✅ **Scripts adicionados:**
```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage",
"test:verbose": "jest --verbose"
```

✅ **Dependências adicionadas:**
```json
"@testing-library/jest-dom": "^6.1.5",
"@testing-library/react": "^14.1.2",
"@testing-library/user-event": "^14.5.1",
"@types/jest": "^29.5.11",
"jest": "^29.7.0",
"jest-environment-jsdom": "^29.7.0"
```

---

## 🔍 Verificar se Instalação Foi Bem-Sucedida

### Backend
```bash
cd C:\Projects\Mktplace-p2p\apps\api
npm list jest
```

Deve mostrar: `jest@29.7.0`

### Frontend
```bash
cd C:\Projects\Mktplace-p2p\apps\web
npm list jest
```

Deve mostrar: `jest@29.7.0`

---

## ▶️ Executar Testes

Após instalação bem-sucedida:

### Backend
```bash
cd C:\Projects\Mktplace-p2p\apps\api
npm test
```

**Resultado esperado:**
```
PASS  src/services/__tests__/notification.service.test.ts
PASS  src/socket/__tests__/notification.socket.test.ts

Test Suites: 2 passed, 2 total
Tests:       30 passed, 30 total
```

### Frontend
```bash
cd C:\Projects\Mktplace-p2p\apps\web
npm test
```

**Resultado esperado:**
```
PASS  components/__tests__/NotificationBell.test.tsx
PASS  components/__tests__/ReviewResponseForm.test.tsx
PASS  components/__tests__/Toast.test.tsx

Test Suites: 3 passed, 3 total
Tests:       35 passed, 35 total
```

---

## 🚨 Problemas Comuns

### Erro: "Cannot find module 'jest'"

**Solução:** As dependências não foram instaladas
```bash
npm install
```

### Erro: "Cannot find module '@testing-library/react'"

**Solução:** Dependências do frontend faltando
```bash
cd apps/web
npm install
```

### Erro: "SyntaxError: Cannot use import statement outside a module"

**Solução:** Configuração Jest incorreta. Verifique se `jest.config.js` existe.

### Erro: Port 3002 already in use (testes de integração)

**Solução:** Mude a porta no teste ou mate o processo:
```bash
# Windows
netstat -ano | findstr :3002
taskkill /PID <PID> /F
```

---

## 📊 Status Atual

### ✅ Arquivos Já Criados:
- `apps/api/jest.config.js`
- `apps/api/src/__tests__/setup.ts`
- `apps/api/src/services/__tests__/notification.service.test.ts`
- `apps/api/src/socket/__tests__/notification.socket.test.ts`
- `apps/web/jest.config.js`
- `apps/web/jest.setup.js`
- `apps/web/components/__tests__/NotificationBell.test.tsx`
- `apps/web/components/__tests__/ReviewResponseForm.test.tsx`
- `apps/web/components/__tests__/Toast.test.tsx`

### ✅ package.json Atualizados:
- `apps/api/package.json` - Scripts e dependências de teste
- `apps/web/package.json` - Scripts e dependências de teste

### ⏳ Pendente:
- **Instalar dependências** (npm install)

---

## 🎯 Próximos Passos

1. **Escolher uma opção de instalação acima**
2. **Executar `npm install` em ambas as pastas**
3. **Executar `npm test` para verificar**
4. **Se tudo passar, os testes estão funcionando! 🎉**

---

## 💡 Dica Final

Se nada funcionar, considere:
1. Atualizar npm: `npm install -g npm@latest`
2. Usar nvm (Node Version Manager) para gerenciar versões do Node
3. Verificar permissões de administrador
4. Executar cmd/PowerShell como Administrador

---

**Todos os arquivos de teste já estão criados e prontos!**
**Só falta instalar as dependências para executá-los.** 🚀
