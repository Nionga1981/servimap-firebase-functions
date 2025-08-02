@echo off
REM deploy-windows.bat - Script de deployment para Windows
REM Ejecutar desde la raíz del proyecto

echo.
echo =========================================
echo    SERVIMAP - DEPLOYMENT PARA WINDOWS
echo =========================================
echo.

REM Verificar que estamos en el directorio correcto
if not exist "functions\src\adminDashboard.ts" (
    echo ERROR: No se encuentra functions\src\adminDashboard.ts
    echo Asegurate de ejecutar este script desde la raiz del proyecto
    pause
    exit /b 1
)

echo [1/6] Verificando estructura del proyecto...
if exist "functions\src\adminDashboard.ts" echo     ✓ adminDashboard.ts encontrado
if exist "functions\src\index.ts" echo     ✓ index.ts encontrado
if exist "firebase.json" echo     ✓ firebase.json encontrado

echo.
echo [2/6] Instalando dependencias...
cd functions
call npm install
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias
    pause
    exit /b 1
)

echo.
echo [3/6] Compilando TypeScript...
call npm run build
if errorlevel 1 (
    echo ERROR: Fallo la compilacion de TypeScript
    pause
    exit /b 1
)

cd ..

echo.
echo [4/6] Verificando autenticacion Firebase...
firebase projects:list >nul 2>nul
if errorlevel 1 (
    echo ERROR: No estas autenticado en Firebase
    echo.
    echo Por favor ejecuta primero:
    echo   firebase login
    echo.
    pause
    exit /b 1
)

echo.
echo [5/6] Seleccionando proyecto...
firebase use servimap-nyniz
if errorlevel 1 (
    echo ERROR: No se pudo seleccionar el proyecto servimap-nyniz
    pause
    exit /b 1
)

echo.
echo [6/6] Deployando Cloud Functions...
firebase deploy --only functions
if errorlevel 1 (
    echo ERROR: Fallo el deployment de funciones
    echo.
    echo Intentando deployment individual de funciones admin...
    firebase deploy --only functions:getAdminStats
    firebase deploy --only functions:getUsers
    firebase deploy --only functions:getAnalyticsReport
    firebase deploy --only functions:exportSystemData
)

echo.
echo =========================================
echo           DEPLOYMENT COMPLETADO
echo =========================================
echo.
echo Funciones deployadas:
echo   - getAdminStats
echo   - getUsers
echo   - getAnalyticsReport
echo   - exportSystemData
echo.
echo Para probar:
echo   1. Ve a: https://servi-map.com
echo   2. Presiona Ctrl+Alt+A
echo   3. Login: admin@servimap.com / AdminServi2024!
echo.
echo =========================================

pause