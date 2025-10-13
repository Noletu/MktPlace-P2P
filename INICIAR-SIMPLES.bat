@echo off
echo.
echo ========================================
echo   MktPlace P2P - Inicializacao Simples
echo ========================================
echo.

:: Verificar Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao instalado!
    echo Por favor, instale o Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Verificando dependencias...
echo.

:: Verificar se node_modules existe na API
if not exist "apps\api\node_modules" (
    echo Dependencias da API nao encontradas!
    echo Instalando dependencias... (isso pode demorar alguns minutos)
    echo.
    cd apps\api
    call npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias da API!
        pause
        exit /b 1
    )
    cd ..\..
    echo OK - Dependencias da API instaladas
)

:: Verificar se node_modules existe no Frontend
if not exist "apps\web\node_modules" (
    echo Dependencias do Frontend nao encontradas!
    echo Instalando dependencias... (isso pode demorar alguns minutos)
    echo.
    cd apps\web
    call npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias do Frontend!
        pause
        exit /b 1
    )
    cd ..\..
    echo OK - Dependencias do Frontend instaladas
)

echo OK - Todas as dependencias instaladas
echo.

:: Verificar se Prisma Client foi gerado
echo [2/4] Verificando Prisma Client...
echo.
cd apps\api
call npx prisma generate >nul 2>&1
cd ..\..
echo OK - Prisma Client gerado
echo.

:: Criar diretorio de logs
if not exist logs mkdir logs

:: Iniciar API
echo [3/4] Iniciando API na porta 3001...
start "MktPlace-API" cmd /c "cd apps\api && npm run dev"

:: Aguardar 5 segundos
ping 127.0.0.1 -n 6 > nul

:: Iniciar Frontend
echo Iniciando Frontend na porta 3000...
start "MktPlace-Frontend" cmd /c "cd apps\web && npm run dev"

:: Aguardar 8 segundos
ping 127.0.0.1 -n 9 > nul

:: Abrir navegador
echo [4/4] Abrindo navegador...
start http://localhost:3000

echo.
echo ========================================
echo   Aplicacao iniciada com sucesso!
echo ========================================
echo.
echo   API:      http://localhost:3001
echo   Frontend: http://localhost:3000
echo.
echo Duas janelas foram abertas:
echo   - MktPlace-API (Backend)
echo   - MktPlace-Frontend (Frontend)
echo.
echo Para parar: Execute PARAR-SIMPLES.bat
echo             ou feche as janelas da API e Frontend
echo.
pause
