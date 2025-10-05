# Como Iniciar o MktPlace P2P

Guia para iniciar o projeto completo (Backend + Frontend) com um único comando!

---

## Inicio Rapido

### Windows (CMD ou PowerShell)

**IMPORTANTE:** Execute os scripts .bat diretamente no CMD do Windows, NAO no Git Bash!

**Opcao 1 - Duplo clique:**
- Localize o arquivo `INICIAR-SIMPLES.bat` na pasta do projeto
- Clique duas vezes nele

**Opcao 2 - CMD:**
```cmd
INICIAR-SIMPLES.bat
```

**Para parar:**
```cmd
PARAR-SIMPLES.bat
```

### Linux / Mac / Git Bash

```bash
bash start.sh
```

**Para parar:**
```bash
bash stop.sh
```

---

## O Que os Scripts Fazem

### INICIAR-SIMPLES.bat (Windows)

1. Verifica se Node.js esta instalado
2. Cria diretorio de logs (se nao existir)
3. Abre janela separada para API (Backend) → http://localhost:3001
4. Aguarda 5 segundos
5. Abre janela separada para Frontend → http://localhost:3000
6. Aguarda 8 segundos
7. Abre navegador automaticamente em http://localhost:3000

### PARAR-SIMPLES.bat (Windows)

1. Fecha janelas "MktPlace-API" e "MktPlace-Frontend"
2. Libera portas 3001 e 3000
3. Para todos os processos relacionados

---

## URLs Disponiveis

Apos iniciar com sucesso:

| Servico | URL | Descricao |
|---------|-----|-----------|
| **Frontend** | http://localhost:3000 | Interface do usuario (Next.js) |
| **API** | http://localhost:3001 | Backend REST API |
| **API Health** | http://localhost:3001/api/health | Status da API |

---

## Troubleshooting

### Porta ja em uso

**Erro:**
```
Porta 3000/3001 ja esta em uso!
```

**Solucao:**
```cmd
# Windows
PARAR-SIMPLES.bat

# Linux/Mac/Git Bash
bash stop.sh
```

Se ainda estiver em uso, identifique o processo:

**Windows:**
```cmd
netstat -ano | findstr :3001
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
lsof -ti:3001
lsof -ti:3000
kill -9 <PID>
```

---

### Node.js nao encontrado

**Erro:**
```
ERRO: Node.js nao instalado!
```

**Solucao:**
1. Instale Node.js: https://nodejs.org/ (versao 20+)
2. Reinicie o terminal
3. Verifique: `node --version`

---

### Scripts nao funcionam

**Windows (.bat):**
- Execute NO CMD DO WINDOWS, NAO no Git Bash
- Clique duas vezes no arquivo ou execute via CMD
- Se necessario, execute como Administrador (botao direito > Executar como Administrador)

**Linux/Mac (.sh):**
```bash
# Dar permissao de execucao
chmod +x start.sh stop.sh

# Executar
bash start.sh
```

---

## Configuracao Manual (Alternativa)

Se preferir iniciar manualmente em terminais separados:

### Terminal 1 - API (Backend)
```bash
cd apps/api
npm run dev
```

### Terminal 2 - Frontend
```bash
cd apps/web
npm run dev
```

### Abrir Navegador
- Acesse: http://localhost:3000

---

## Notas Importantes

### Windows

- Scripts `.bat` DEVEM ser executados no CMD ou PowerShell do Windows
- NAO execute arquivos .bat pelo Git Bash (causa erros de codificacao)
- Duas janelas separadas serao abertas: uma para API e outra para Frontend
- Para parar, execute PARAR-SIMPLES.bat ou feche as janelas

### Linux/Mac/Git Bash

- Scripts `.sh` funcionam no terminal nativo e Git Bash
- Processos rodam em background (daemon)
- PIDs salvos em `logs/*.pid`
- Use `bash stop.sh` para parar tudo

---

## Proximos Passos

Apos iniciar com sucesso:

1. Acesse http://localhost:3000 (abre automaticamente)
2. Teste a API em http://localhost:3001/api/health
3. Para parar tudo: `PARAR-SIMPLES.bat` (Windows) ou `bash stop.sh` (Linux/Mac)

---

## Arquivos Disponiveis

### Windows (CMD/PowerShell):
- `INICIAR-SIMPLES.bat` - Inicia aplicacao (RECOMENDADO)
- `PARAR-SIMPLES.bat` - Para aplicacao
- `INICIAR.bat` - Versao antiga (pode ter problemas)
- `PARAR.bat` - Versao antiga (pode ter problemas)

### Linux/Mac/Git Bash:
- `start.sh` - Inicia aplicacao
- `stop.sh` - Para aplicacao

---

## Suporte

**Problemas?**

1. Certifique-se de executar .bat no CMD do Windows (NAO Git Bash)
2. Execute `PARAR-SIMPLES.bat` e tente novamente
3. Verifique se Node.js esta instalado: `node --version`
4. Consulte `DOCUMENTACAO_TESTES_COMPLETA.md`
5. Verifique `CHECKPOINT.md` para status do projeto

---

**Desenvolvido pela Equipe MktPlace P2P**
**Versao:** v0.2.2
**Data:** 05 de Outubro de 2025
