@echo off
echo.
echo ========================================
echo   Limpando cache e reconstruindo Frontend
echo ========================================
echo.

echo [1/3] Limpando cache do Next.js...
cd apps\web
if exist .next (
    rmdir /s /q .next
    echo OK - Cache limpo
) else (
    echo OK - Sem cache para limpar
)

echo.
echo [2/3] Limpando cache do navegador...
echo.
echo IMPORTANTE: Apos iniciar o frontend:
echo   1. Pressione Ctrl+Shift+Delete no navegador
echo   2. Marque "Cache" e limpe
echo   3. OU pressione Ctrl+Shift+R para force reload
echo.

echo [3/3] Iniciando frontend...
start "MktPlace-Frontend" cmd /c "npm run dev"

echo.
echo ========================================
echo   Frontend reiniciado!
echo ========================================
echo.
echo Acesse: http://localhost:3000
echo.
echo Lembre-se de:
echo   1. Fazer LOGOUT
echo   2. Limpar cache do navegador (Ctrl+Shift+Delete)
echo   3. Fazer LOGIN novamente
echo   4. Testar /admin
echo.
pause
