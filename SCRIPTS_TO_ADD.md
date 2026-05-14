# Scripts para Adicionar aos package.json

## 📦 apps/api/package.json

Adicione estes scripts na seção `"scripts"`:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "tsx prisma/seed.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:verbose": "jest --verbose"
  }
}
```

---

## 📦 apps/web/package.json

Adicione estes scripts na seção `"scripts"`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:verbose": "jest --verbose"
  }
}
```

---

## 📦 Raiz (package.json)

Se houver um package.json na raiz (monorepo), adicione:

```json
{
  "scripts": {
    "test": "npm run test --workspaces",
    "test:api": "npm test --workspace=apps/api",
    "test:web": "npm test --workspace=apps/web",
    "test:coverage": "npm run test:coverage --workspaces",
    "install:test-deps": "cd apps/api && npm install --save-dev jest @types/jest ts-jest @types/supertest supertest && cd ../web && npm install --save-dev jest @types/jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom"
  }
}
```

---

## 🚀 Como Aplicar

1. Abra `apps/api/package.json`
2. Copie os scripts acima para a seção `"scripts"`
3. Abra `apps/web/package.json`
4. Copie os scripts acima para a seção `"scripts"`
5. Se tiver `package.json` na raiz, adicione os scripts de monorepo

---

## ✅ Verificar Instalação

Após adicionar os scripts, teste:

```bash
# Backend
cd apps/api
npm run test

# Frontend
cd apps/web
npm run test
```

Se aparecer erro de dependências não encontradas, execute:

```bash
# Backend
cd apps/api
npm install --save-dev jest @types/jest ts-jest @types/supertest supertest

# Frontend
cd apps/web
npm install --save-dev jest @types/jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

---

## 📊 Comandos Disponíveis Após Instalação

### Backend (apps/api)

```bash
npm test                # Executar testes
npm run test:watch      # Modo watch (desenvolvimento)
npm run test:coverage   # Com relatório de cobertura
npm run test:verbose    # Saída detalhada
```

### Frontend (apps/web)

```bash
npm test                # Executar testes
npm run test:watch      # Modo watch (desenvolvimento)
npm run test:coverage   # Com relatório de cobertura
npm run test:verbose    # Saída detalhada
```

### Da Raiz (monorepo)

```bash
npm test                     # Todos os testes
npm run test:api             # Apenas backend
npm run test:web             # Apenas frontend
npm run test:coverage        # Coverage de todos
npm run install:test-deps    # Instalar dependências de teste
```
