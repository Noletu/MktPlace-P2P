@echo off
echo.
echo ========================================
echo   MktPlace P2P - Limpeza do Banco
echo ========================================
echo.
echo ATENCAO: Esta operacao deletara TODOS os dados!
echo.
echo O que sera DELETADO:
echo   - Todos os usuarios comuns
echo   - Todas as carteiras
echo   - Todos os pedidos e transacoes
echo   - Todos os chats e mensagens
echo   - Todas as notificacoes
echo   - Todas as disputas e avaliacoes
echo   - Todo o historico de auditoria
echo   - Todos os saldos e colaterais
echo.
echo O que sera PRESERVADO:
echo   - Usuario MASTER (master@mktplace.com)
echo   - Usuario ADMIN (admin@mktplace.com)
echo   - Estrutura do banco (schema, migrations)
echo.
echo Um BACKUP AUTOMATICO sera criado antes da limpeza!
echo.
echo ========================================
echo.

:: Solicitar confirmação
set /p resposta="Tem certeza que deseja continuar? (s/N): "

if /i "%resposta%"=="s" goto verificar_node
if /i "%resposta%"=="sim" goto verificar_node
echo.
echo Operacao cancelada pelo usuario.
echo.
pause
exit /b 0

:verificar_node
echo.
echo [1/4] Verificando Node.js...

:: Verificar Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: Node.js nao instalado!
    echo Por favor, instale o Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo OK - Node.js instalado
echo.

:: Verificar se servidor está rodando
echo [2/4] Verificando se servidor esta rodando...
echo.

netstat -ano | findstr :3001 >nul 2>&1
if not errorlevel 1 (
    echo AVISO: Servidor API detectado rodando na porta 3001!
    echo.
    set /p parar="Deseja parar o servidor antes de limpar? (S/n): "

    if /i "!parar!"=="s" goto parar_servidor
    if /i "!parar!"=="sim" goto parar_servidor
    if /i "!parar!"=="" goto parar_servidor

    echo.
    echo Continuando com servidor rodando...
    goto limpar_banco

    :parar_servidor
    echo.
    echo Parando servidor...
    call PARAR-SIMPLES.bat
    echo.
    echo Aguardando 3 segundos...
    ping 127.0.0.1 -n 4 > nul
) else (
    echo OK - Servidor nao esta rodando
)

:limpar_banco
echo.
echo [3/4] Executando limpeza do banco...
echo.
echo IMPORTANTE: Um backup sera criado automaticamente!
echo.

:: Executar limpeza
cd apps\api
call npm run db:clean

if errorlevel 1 (
    echo.
    echo ========================================
    echo   ERRO: Falha na limpeza do banco!
    echo ========================================
    echo.
    echo Verifique os logs acima para detalhes.
    echo O backup NAO foi afetado se foi criado.
    echo.
    cd ..\..
    pause
    exit /b 1
)

cd ..\..

echo.
echo [4/4] Limpeza concluida!
echo.
echo ========================================
echo   Banco Limpo com Sucesso!
echo ========================================
echo.
echo Backup salvo em:
echo   apps\api\prisma\dev.db.backup-YYYYMMDD-HHMMSS
echo.
echo Credenciais Disponiveis:
echo   +-------------------------------------+
echo   ! Master:                             !
echo   !   Email: master@mktplace.com        !
echo   !   Senha: Master@2025!               !
echo   !                                     !
echo   ! Admin:                              !
echo   !   Email: admin@mktplace.com         !
echo   !   Senha: Admin@123                  !
echo   +-------------------------------------+
echo.
echo Proximos Passos:
echo   1. Reiniciar servidor: INICIAR-SIMPLES.bat
echo   2. Fazer login com credenciais acima
echo   3. Cadastrar carteiras da plataforma (ou executar seed)
echo.
echo Para restaurar backup (se necessario):
echo   cd apps\api\prisma
echo   copy dev.db.backup-YYYYMMDD-HHMMSS dev.db
echo.
echo ========================================
echo.
pause
