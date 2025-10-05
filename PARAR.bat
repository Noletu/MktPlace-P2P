@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ========================================
echo   MktPlace P2P - Parar Servicos
echo ========================================
echo.

echo [1/3] Procurando processos nas portas 3001 e 3000...
echo.

:: Variavel para rastrear se encontramos processos
set FOUND_PROCESSES=0

:: Encontrar PID usando porta 3001 (API)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    set PID_API=%%a
    set FOUND_PROCESSES=1
    echo Encontrado: API na porta 3001 (PID: !PID_API!)
)

:: Encontrar PID usando porta 3000 (Frontend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    set PID_WEB=%%a
    set FOUND_PROCESSES=1
    echo Encontrado: Frontend na porta 3000 (PID: !PID_WEB!)
)

if %FOUND_PROCESSES%==0 (
    echo Nenhum processo encontrado nas portas 3000 e 3001
    echo.
    echo As aplicacoes ja estao paradas!
    echo.
    pause
    exit /b 0
)

echo.
echo [2/3] Finalizando processos...
echo.

:: Matar processo da API
if defined PID_API (
    echo Parando API (PID: %PID_API%)...
    taskkill /F /PID %PID_API% >nul 2>&1
    if errorlevel 1 (
        echo AVISO: Nao foi possivel parar o processo %PID_API%
    ) else (
        echo OK - API parada
    )
)

:: Matar processo do Frontend
if defined PID_WEB (
    echo Parando Frontend (PID: %PID_WEB%)...
    taskkill /F /PID %PID_WEB% >nul 2>&1
    if errorlevel 1 (
        echo AVISO: Nao foi possivel parar o processo %PID_WEB%
    ) else (
        echo OK - Frontend parado
    )
)

:: Aguardar processos terminarem
timeout /t 2 /nobreak >nul

:: Limpar processos órfãos (tsx, next-server)
echo.
echo Limpando processos orfaos...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *tsx*" >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *next*" >nul 2>&1

echo.
echo [3/3] Verificando portas...
echo.

:: Verificar se porta 3001 foi liberada
netstat -ano | findstr :3001 | findstr LISTENING >nul 2>&1
if errorlevel 1 (
    echo OK - Porta 3001 liberada
) else (
    echo AVISO: Porta 3001 ainda esta em uso
)

:: Verificar se porta 3000 foi liberada
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if errorlevel 1 (
    echo OK - Porta 3000 liberada
) else (
    echo AVISO: Porta 3000 ainda esta em uso
)

echo.
echo ========================================
echo   Servicos Parados!
echo ========================================
echo.
echo Para reiniciar: INICIAR.bat
echo.
pause
