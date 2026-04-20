@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   MktPlace P2P - Inicializacao Simples
echo ========================================
echo.

:: Verificar Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao instalado!
    echo Por favor, instale o Node.js 20+: https://nodejs.org/
    pause
    exit /b 1
)

:: Verificar versao Node.js (precisa ser 18+)
for /f "tokens=1 delims=v" %%a in ('node --version') do set NODE_VER=%%a
for /f "tokens=1 delims=." %%a in ('node --version') do set NODE_MAJOR=%%a
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% LSS 18 (
    echo AVISO: Node.js %NODE_MAJOR% detectado. Recomendado Node.js 20+.
    echo Atualize em: https://nodejs.org/
    echo.
)

echo [1/5] Configurando variaveis de ambiente...
echo.

:: Criar apps/api/.env se nao existir
if not exist "apps\api\.env" (
    echo Criando apps/api/.env a partir do .env.example...

    :: Gerar JWT_SECRET automaticamente com Node.js
    for /f %%i in ('node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"') do set JWT_SECRET_GENERATED=%%i

    :: Gerar WALLET_ENCRYPTION_KEY automaticamente
    for /f %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set WALLET_KEY_GENERATED=%%i

    :: Copiar .env.example e substituir placeholders
    powershell -Command "(Get-Content 'apps\api\.env.example') -replace 'GERAR_SEU_JWT_SECRET_AQUI', '%JWT_SECRET_GENERATED%' -replace 'GERAR_SUA_WALLET_KEY_AQUI', '%WALLET_KEY_GENERATED%' | Set-Content 'apps\api\.env'"

    echo OK - apps/api/.env criado com segredos gerados automaticamente
) else (
    echo OK - apps/api/.env ja existe
)

:: Criar apps/web/.env.local se nao existir
if not exist "apps\web\.env.local" (
    echo Criando apps/web/.env.local...
    (
        echo # API Configuration
        echo NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
    ) > "apps\web\.env.local"
    echo OK - apps/web/.env.local criado
) else (
    echo OK - apps/web/.env.local ja existe
)

echo.

echo [2/5] Instalando dependencias...
echo.

if not exist "node_modules" (
    echo Instalando dependencias (pode demorar alguns minutos na primeira vez)...
    call npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias!
        pause
        exit /b 1
    )
    echo OK - Dependencias instaladas
) else (
    echo OK - Dependencias ja instaladas
)
echo.

echo [3/5] Configurando banco de dados...
echo.
cd apps\api
call npx prisma generate >nul 2>&1
if errorlevel 1 (
    echo AVISO: Falha ao gerar Prisma Client
) else (
    echo OK - Prisma Client gerado
)

:: Aplicar schema ao banco (cria tabelas que faltam, seguro para re-executar)
call npx prisma db push --accept-data-loss >nul 2>&1
if errorlevel 1 (
    echo AVISO: Falha ao sincronizar schema do banco
) else (
    echo OK - Schema do banco sincronizado
)
cd ..\..
echo.

echo [4/5] Iniciando servicos...
echo.

:: Iniciar API
echo Iniciando API na porta 3001...
start "MktPlace-API" cmd /k "title MktPlace-API && cd apps\api && npm run dev"

:: Aguardar API inicializar
ping 127.0.0.1 -n 7 > nul

:: Iniciar Frontend
echo Iniciando Frontend na porta 3000...
start "MktPlace-Frontend" cmd /k "title MktPlace-Frontend && cd apps\web && npm run dev"

:: Aguardar Frontend inicializar
ping 127.0.0.1 -n 10 > nul

echo.
echo [5/5] Abrindo navegador...
start http://localhost:3000

echo.
echo ========================================
echo   Aplicacao iniciada com sucesso!
echo ========================================
echo.
echo   Frontend: http://localhost:3000
echo   API:      http://localhost:3001
echo.
echo Duas janelas abertas:
echo   - MktPlace-API     (fechar = para o backend)
echo   - MktPlace-Frontend (fechar = para o frontend)
echo.
echo Credenciais de teste: CREDENCIAIS_ADMIN.md
echo.
pause
