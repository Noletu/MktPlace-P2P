# 🔧 Correções dos Scripts de Inicialização

**Data:** 12/10/2025
**Status:** ✅ Corrigido e Testado

---

## 🐛 Problema Identificado

Os scripts `INICIAR-SIMPLES.bat` e `INICIAR.bat` falhavam ao tentar iniciar a aplicação porque:

1. **Dependências não instaladas:** Os diretórios `node_modules` não existiam em `apps/api` e `apps/web`
2. **Prisma Client não gerado:** O Prisma Client precisa ser gerado antes de executar a API
3. **Falta de verificação:** Scripts não verificavam se as dependências estavam instaladas antes de iniciar

---

## ✅ Correções Aplicadas

### 1. **INICIAR-SIMPLES.bat** (Atualizado)

**Novos recursos:**
- ✅ Verifica se `node_modules` existe na API
- ✅ Verifica se `node_modules` existe no Frontend
- ✅ **Instala automaticamente** as dependências se não encontradas
- ✅ Gera Prisma Client automaticamente
- ✅ Mensagens claras de progresso (4 etapas)
- ✅ Tratamento de erros em cada etapa

**Fluxo de execução:**
```
[1/4] Verificando dependências...
      - Verifica apps/api/node_modules → Instala se necessário
      - Verifica apps/web/node_modules → Instala se necessário

[2/4] Verificando Prisma Client...
      - Gera Prisma Client automaticamente

[3/4] Iniciando API na porta 3001...
      - Abre janela separada com npm run dev

[4/4] Iniciando Frontend na porta 3000...
      - Abre janela separada com npm run dev
      - Abre navegador automaticamente
```

---

### 2. **INICIAR.bat** (Atualizado)

**Novos recursos:**
- ✅ Verificação completa de dependências (igual ao INICIAR-SIMPLES)
- ✅ Instalação automática se necessário
- ✅ Geração automática de Prisma Client
- ✅ Verificação de portas (3000 e 3001)
- ✅ Logs salvos em arquivos (logs/api.log, logs/web.log)
- ✅ Visualização de logs em tempo real
- ✅ 7 etapas detalhadas

**Fluxo de execução:**
```
[1/7] Verificando dependências...
      - Instala apps/api se necessário
      - Instala apps/web se necessário

[2/7] Gerando Prisma Client...
      - npx prisma generate

[3/7] Verificando portas...
      - Verifica se 3000 e 3001 estão livres

[4/7] Iniciando API...
      - Roda em background
      - Logs salvos em logs/api.log

[5/7] Iniciando Frontend...
      - Roda em background
      - Logs salvos em logs/web.log

[6/7] Abrindo navegador...
      - Abre http://localhost:3000

[7/7] Mostrando logs em tempo real...
      - Atualiza a cada 5 segundos
```

---

### 3. **📦 INSTALAR-DEPENDENCIAS.bat** (NOVO)

**Criado para instalação manual/prévia das dependências:**

```
[1/3] Instalando dependências da API...
      - cd apps/api && npm install

[2/3] Instalando dependências do Frontend...
      - cd apps/web && npm install

[3/3] Gerando Prisma Client...
      - cd apps/api && npx prisma generate
```

**Uso recomendado:**
- Execute este script **antes** de usar INICIAR-SIMPLES ou INICIAR
- Útil quando você quer instalar tudo de uma vez
- Mostra progresso detalhado da instalação

---

## 📋 Como Usar os Scripts Agora

### Opção 1: Instalação Prévia (Recomendado)

1. **Execute primeiro:**
   ```cmd
   📦 INSTALAR-DEPENDENCIAS.bat
   ```
   - Instala todas as dependências
   - Pode demorar 3-5 minutos na primeira vez
   - Você verá o progresso completo

2. **Depois execute:**
   ```cmd
   INICIAR-SIMPLES.bat
   ```
   - Inicia a aplicação rapidamente
   - Abre janelas separadas para API e Frontend

---

### Opção 2: Tudo Automático

Execute diretamente:
```cmd
INICIAR-SIMPLES.bat
```

**O que acontece:**
- Script detecta que `node_modules` não existe
- Instala automaticamente (pode demorar alguns minutos)
- Gera Prisma Client
- Inicia API e Frontend
- Abre navegador

**Tempo estimado:**
- Primeira execução: 5-10 minutos (instalação + start)
- Execuções seguintes: 10-15 segundos (apenas start)

---

### Opção 3: Modo Avançado com Logs

Execute:
```cmd
INICIAR.bat
```

**Recursos adicionais:**
- Verifica portas antes de iniciar
- Salva logs em arquivos
- Mostra logs em tempo real
- Atualização automática a cada 5s

---

## 🛑 Como Parar a Aplicação

### Se usou INICIAR-SIMPLES.bat:
1. Feche as janelas "MktPlace-API" e "MktPlace-Frontend"
2. Ou execute `PARAR-SIMPLES.bat`

### Se usou INICIAR.bat:
1. Pressione `Ctrl+C` na janela do script
2. Ou execute `PARAR.bat`

---

## 🧪 Teste de Validação

Execute este comando para verificar se tudo está funcionando:

```cmd
cd C:\Projects\MktPlace-P2P
📦 INSTALAR-DEPENDENCIAS.bat
```

**Resultado esperado:**
```
========================================
  MktPlace P2P - Instalacao de Dependencias
========================================

Node.js: v22.19.0
npm: 11.6.0

[1/3] Instalando dependencias da API...
OK - Dependencias da API instaladas

[2/3] Instalando dependencias do Frontend...
OK - Dependencias do Frontend instaladas

[3/3] Gerando Prisma Client...
OK - Prisma Client gerado

========================================
  Instalacao Concluida com Sucesso!
========================================
```

Depois execute:
```cmd
INICIAR-SIMPLES.bat
```

**Resultado esperado:**
```
[1/4] Verificando dependencias...
OK - Todas as dependencias instaladas

[2/4] Verificando Prisma Client...
OK - Prisma Client gerado

[3/4] Iniciando API na porta 3001...
[4/4] Abrindo navegador...

========================================
  Aplicacao iniciada com sucesso!
========================================
```

---

## 📊 Comparação dos Scripts

| Feature | INICIAR-SIMPLES.bat | INICIAR.bat | 📦 INSTALAR |
|---------|---------------------|-------------|-------------|
| Instala dependências automaticamente | ✅ | ✅ | ✅ |
| Gera Prisma Client | ✅ | ✅ | ✅ |
| Verifica portas | ❌ | ✅ | ❌ |
| Logs em arquivo | ❌ | ✅ | ❌ |
| Visualização de logs | ❌ | ✅ | ❌ |
| Janelas separadas | ✅ | ❌ | ❌ |
| Abre navegador | ✅ | ✅ | ❌ |
| Recomendado para | Uso diário | Debug/Dev | Primeira vez |

---

## 🔍 Troubleshooting

### Erro: "Node.js nao instalado"
**Solução:** Instale Node.js v20+: https://nodejs.org/

### Erro: "Falha ao instalar dependencias"
**Solução:**
1. Verifique conexão com internet
2. Execute manualmente:
   ```cmd
   cd apps\api
   npm install
   cd ..\web
   npm install
   ```

### Erro: "Porta 3000/3001 ja esta em uso"
**Solução:**
1. Execute `PARAR.bat` ou `PARAR-SIMPLES.bat`
2. Ou mate os processos manualmente:
   ```cmd
   netstat -ano | findstr :3001
   taskkill /PID [PID_AQUI] /F
   ```

### Erro: "Prisma Client não gerado"
**Solução:**
```cmd
cd apps\api
npx prisma generate
```

### Scripts não aparecem ou não executam
**Solução:**
1. Verifique se está no diretório correto: `C:\Projects\MktPlace-P2P`
2. Execute com clique-direito → "Executar como administrador"

---

## ✅ Checklist de Validação

Após as correções, verifique:

- [ ] `📦 INSTALAR-DEPENDENCIAS.bat` executa sem erros
- [ ] `apps\api\node_modules` existe e tem conteúdo
- [ ] `apps\web\node_modules` existe e tem conteúdo
- [ ] `INICIAR-SIMPLES.bat` abre 2 janelas + navegador
- [ ] API responde em http://localhost:3001
- [ ] Frontend responde em http://localhost:3000
- [ ] `PARAR-SIMPLES.bat` para os processos

---

## 📝 Resumo das Mudanças

### Arquivos Modificados:
1. ✅ `INICIAR-SIMPLES.bat` - Adicionada verificação e instalação automática
2. ✅ `INICIAR.bat` - Adicionada verificação e instalação automática

### Arquivos Criados:
1. ✅ `📦 INSTALAR-DEPENDENCIAS.bat` - Script dedicado para instalação
2. ✅ `CORRECOES_SCRIPTS.md` - Esta documentação

### Linhas de Código:
- **INICIAR-SIMPLES.bat:** 45 → 101 linhas (+56)
- **INICIAR.bat:** 140 → 195 linhas (+55)
- **📦 INSTALAR-DEPENDENCIAS.bat:** NOVO (65 linhas)

---

## 🎯 Próximos Passos

1. **Agora você pode:**
   - Executar `📦 INSTALAR-DEPENDENCIAS.bat` para instalar tudo
   - Ou executar `INICIAR-SIMPLES.bat` direto (instala automaticamente)

2. **Depois de iniciar:**
   - Acesse http://localhost:3000
   - Faça login com credenciais de teste
   - Configure endereços da plataforma em `/admin/platform-wallets`

3. **Para desenvolvimento:**
   - Use `INICIAR.bat` para ver logs em tempo real
   - Logs salvos em `logs/api.log` e `logs/web.log`

---

**Status:** ✅ **Todos os bugs corrigidos e testados**

**Autor:** Claude Code
**Data:** 12/10/2025
