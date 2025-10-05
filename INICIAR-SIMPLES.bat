@echo off
echo.
echo Iniciando MktPlace P2P...
echo.

:: Verificar Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao instalado!
    pause
    exit /b 1
)

:: Criar diretorio de logs
if not exist logs mkdir logs

:: Iniciar API
echo Iniciando API na porta 3001...
start "MktPlace-API" cmd /c "cd apps\api && npm run dev"

:: Aguardar 5 segundos
ping 127.0.0.1 -n 6 > nul

:: Iniciar Frontend
echo Iniciando Frontend na porta 3000...
start "MktPlace-Frontend" cmd /c "cd apps\web && npm run dev"

:: Aguardar 8 segundos
ping 127.0.0.1 -n 9 > nul

:: Abrir navegador
echo Abrindo navegador...
start http://localhost:3000

echo.
echo ========================================
echo   Aplicacao iniciada com sucesso!
echo ========================================
echo.
echo   API:      http://localhost:3001
echo   Frontend: http://localhost:3000
echo.
echo Para parar: Execute PARAR-SIMPLES.bat
echo.
pause
