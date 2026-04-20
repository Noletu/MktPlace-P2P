@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ========================================
echo   MktPlace P2P - Inicializacao Completa
echo ========================================
echo.

:: Verificar se Node.js esta instalado
where node >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado!
    echo.
    echo Por favor, instale o Node.js: https://nodejs.org/
    pause
    exit /b 1
)

:: Verificar se npm esta instalado
where npm >nul 2>&1
if errorlevel 1 (
    echo ERRO: npm nao encontrado!
    pause
    exit /b 1
)

echo [1/7] Verificando dependencias...
echo.

:: Este projeto usa npm workspaces — node_modules fica na RAIZ, nao em apps/api ou apps/web.
if not exist "node_modules" (
    echo Dependencias nao encontradas!
    echo Instalando todas as dependencias... (isso pode demorar alguns minutos)
    echo.
    call npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias!
        pause
        exit /b 1
    )
    echo OK - Dependencias instaladas
    echo.
) else (
    echo OK - Dependencias ja instaladas
    echo.
)

echo OK - Todas as dependencias instaladas
echo.

echo [2/7] Gerando Prisma Client...
echo.
cd apps\api
call npx prisma generate >nul 2>&1
if errorlevel 1 (
    echo AVISO: Falha ao gerar Prisma Client (tentando continuar...)
) else (
    echo OK - Prisma Client gerado
)
cd ..\..
echo.

echo [3/7] Verificando portas...
echo.

:: Verificar porta 3001 (API)
netstat -ano | findstr :3001 | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
    echo AVISO: Porta 3001 ja esta em uso!
    echo.
    echo Para liberar a porta, execute: PARAR.bat
    echo Ou feche manualmente o processo que esta usando a porta 3001
    pause
    exit /b 1
)

:: Verificar porta 3000 (Frontend)
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
    echo AVISO: Porta 3000 ja esta em uso!
    echo.
    echo Para liberar a porta, execute: PARAR.bat
    pause
    exit /b 1
)

echo OK - Portas 3000 e 3001 disponiveis
echo.

echo [4/7] Iniciando API (Backend)...
echo.

:: Criar diretorio de logs se nao existir
if not exist logs mkdir logs

:: Iniciar API em background
start /B cmd /c "cd apps\api && npm run dev > ..\..\logs\api.log 2>&1"

:: Aguardar API inicializar
echo Aguardando API inicializar (5 segundos)...
timeout /t 5 /nobreak >nul

echo OK - API iniciada em http://localhost:3001
echo.

echo [5/7] Iniciando Frontend (Next.js)...
echo.

:: Iniciar Frontend em background
start /B cmd /c "cd apps\web && npm run dev > ..\..\logs\web.log 2>&1"

:: Aguardar Frontend inicializar
echo Aguardando Frontend inicializar (5 segundos)...
timeout /t 5 /nobreak >nul

echo OK - Frontend iniciado em http://localhost:3000
echo.

echo [6/7] Abrindo navegador...
echo.

:: Aguardar mais 2 segundos para garantir que tudo inicializou
timeout /t 2 /nobreak >nul

:: Abrir navegador
start http://localhost:3000

echo OK - Navegador aberto
echo.

echo [7/7] Status dos Servicos
echo.
echo +------------------------------------------+
echo ^|  OK - API:       http://localhost:3001  ^|
echo ^|  OK - Frontend:  http://localhost:3000  ^|
echo ^|  OK - Navegador: Aberto                 ^|
echo +------------------------------------------+
echo.
echo ========================================
echo   Tudo Pronto!
echo ========================================
echo.
echo Logs disponiveis em:
echo    - API:      logs\api.log
echo    - Frontend: logs\web.log
echo.
echo Dicas:
echo    - Para ver logs da API:      type logs\api.log
echo    - Para ver logs do Frontend: type logs\web.log
echo    - Para parar tudo:           PARAR.bat
echo.
echo AVISO: NAO FECHE ESTA JANELA!
echo        (Pressione Ctrl+C para parar tudo)
echo.
echo.
echo Pressione qualquer tecla para ver os logs...
pause >nul

:SHOW_LOGS
cls
echo ========================================
echo   Logs da Aplicacao (Atualizacao a cada 5s)
echo ========================================
echo.
echo --- API LOG (ultimas 30 linhas) ---
type logs\api.log 2>nul | more +0 | findstr /V "^$" | tail -n 30 2>nul || type logs\api.log 2>nul
echo.
echo --- FRONTEND LOG (ultimas 30 linhas) ---
type logs\web.log 2>nul | more +0 | findstr /V "^$" | tail -n 30 2>nul || type logs\web.log 2>nul
echo.
echo ========================================
echo Pressione Ctrl+C para sair
timeout /t 5 >nul
goto SHOW_LOGS
