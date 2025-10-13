@echo off
echo.
echo ========================================
echo   MktPlace P2P - Instalacao de Dependencias
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

:: Verificar npm
where npm >nul 2>&1
if errorlevel 1 (
    echo ERRO: npm nao encontrado!
    pause
    exit /b 1
)

echo Node.js:
node --version
echo npm:
npm --version
echo.
echo ========================================
echo.

echo [1/3] Instalando dependencias da API...
echo.
cd apps\api
call npm install
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias da API!
    cd ..\..
    pause
    exit /b 1
)
cd ..\..
echo OK - Dependencias da API instaladas
echo.

echo [2/3] Instalando dependencias do Frontend...
echo.
cd apps\web
call npm install
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias do Frontend!
    cd ..\..
    pause
    exit /b 1
)
cd ..\..
echo OK - Dependencias do Frontend instaladas
echo.

echo [3/3] Gerando Prisma Client...
echo.
cd apps\api
call npx prisma generate
if errorlevel 1 (
    echo ERRO: Falha ao gerar Prisma Client!
    cd ..\..
    pause
    exit /b 1
)
cd ..\..
echo OK - Prisma Client gerado
echo.

echo ========================================
echo   Instalacao Concluida com Sucesso!
echo ========================================
echo.
echo Proximos passos:
echo   1. Execute INICIAR-SIMPLES.bat para iniciar a aplicacao
echo   2. Ou execute INICIAR.bat para inicializacao completa com logs
echo.
pause
