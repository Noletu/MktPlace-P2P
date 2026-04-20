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

:: Este projeto usa npm workspaces. Instalar da raiz instala tudo de uma vez.
echo [1/2] Instalando todas as dependencias (workspace)...
echo.
call npm install
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo OK - Todas as dependencias instaladas
echo.

echo [2/2] Gerando Prisma Client...
echo.
cd apps\api
call npx prisma generate
if errorlevel 1 (
    echo AVISO: Falha ao gerar Prisma Client (tente executar manualmente: cd apps\api && npx prisma generate)
    cd ..\..
) else (
    cd ..\..
    echo OK - Prisma Client gerado
)
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
