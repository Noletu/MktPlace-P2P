@echo off
echo.
echo Parando MktPlace P2P...
echo.

:: Fechar janela da API
taskkill /FI "WINDOWTITLE eq MktPlace-API*" /F >nul 2>&1
if errorlevel 1 (
    echo API nao estava rodando
) else (
    echo API parada
)

:: Fechar janela do Frontend
taskkill /FI "WINDOWTITLE eq MktPlace-Frontend*" /F >nul 2>&1
if errorlevel 1 (
    echo Frontend nao estava rodando
) else (
    echo Frontend parada
)

:: Matar processos nas portas especificas
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Liberando porta 3001...
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Liberando porta 3000...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ========================================
echo   Aplicacao parada com sucesso!
echo ========================================
echo.
pause
