@echo off
echo ==========================================
echo    INICIANDO PREDICTION BATTLE LOCAL
echo ==========================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo Node modules nao encontrados. Instalando dependencias...
    call npm install
)

echo.
echo Abrindo navegador em 5 segundos...
timeout /t 5 >nul
start "" "http://localhost:3000"

echo.
echo Iniciando servidor...
call npm run dev

pause
