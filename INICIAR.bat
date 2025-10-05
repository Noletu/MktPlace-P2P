@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ========================================
echo   MktPlace P2P - Inicializacao
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

echo [1/5] Verificando portas...
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

echo [2/5] Iniciando API (Backend)...
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

echo [3/5] Iniciando Frontend (Next.js)...
echo.

:: Iniciar Frontend em background
start /B cmd /c "cd apps\web && npm run dev > ..\..\logs\web.log 2>&1"

:: Aguardar Frontend inicializar
echo Aguardando Frontend inicializar (5 segundos)...
timeout /t 5 /nobreak >nul

echo OK - Frontend iniciado em http://localhost:3000
echo.

echo [4/5] Abrindo navegador...
echo.

:: Aguardar mais 2 segundos para garantir que tudo inicializou
timeout /t 2 /nobreak >nul

:: Abrir navegador
start http://localhost:3000

echo OK - Navegador aberto
echo.

echo [5/5] Status dos Servicos
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
echo   Logs da Aplicacao
echo ========================================
echo.
echo --- API LOG (logs\api.log) ---
type logs\api.log 2>nul
echo.
echo --- FRONTEND LOG (logs\web.log) ---
type logs\web.log 2>nul
echo.
echo ========================================
timeout /t 5 >nul
goto SHOW_LOGS
