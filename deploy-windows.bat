@echo off
echo ========================================
echo   SERVIMAP ADMIN FUNCTIONS DEPLOYMENT
echo ========================================
echo.

REM Change to project directory
cd /d "%~dp0"

echo [1/7] Verificando directorio del proyecto...
if not exist "firebase.json" (
    echo ERROR: No se encontro firebase.json. Verifica que estas en el directorio correcto.
    pause
    exit /b 1
)
echo ✓ Directorio correcto encontrado

echo.
echo [2/7] Verificando autenticacion Firebase...
firebase login:list
if %errorlevel% neq 0 (
    echo ERROR: No estas autenticado en Firebase
    echo Ejecuta: firebase login
    pause
    exit /b 1
)
echo ✓ Autenticacion verificada

echo.
echo [3/7] Seleccionando proyecto...
firebase use servimap-nyniz
if %errorlevel% neq 0 (
    echo ERROR: No se pudo seleccionar el proyecto
    pause
    exit /b 1
)
echo ✓ Proyecto seleccionado

echo.
echo [4/7] Navegando a functions...
cd functions
if %errorlevel% neq 0 (
    echo ERROR: No se encontro el directorio functions
    pause
    exit /b 1
)

echo.
echo [5/7] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Fallo la instalacion de dependencias
    pause
    exit /b 1
)
echo ✓ Dependencias instaladas

echo.
echo [6/7] Compilando TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Fallo la compilacion
    pause
    exit /b 1
)
echo ✓ Compilacion exitosa

echo.
echo [7/7] Volviendo al directorio raiz...
cd ..

echo.
echo ========================================
echo        INICIANDO DEPLOYMENT
echo ========================================

REM Intentar deployment completo
echo Intentando deployment completo...
firebase deploy --only functions
if %errorlevel% equ 0 (
    echo.
    echo ✓✓✓ DEPLOYMENT EXITOSO ✓✓✓
    echo.
    echo Verificando funciones desplegadas...
    firebase functions:list
    echo.
    echo PRUEBA EL ADMIN DASHBOARD:
    echo URL: https://servi-map.com
    echo Acceso: Ctrl+Alt+A o click en • del footer
    echo Login: admin@servimap.com / AdminServi2024!
    echo.
    pause
    exit /b 0
)

echo.
echo ⚠️  Deployment completo fallo, intentando funciones individuales...
echo.

REM Intentar deployment individual
echo Desplegando getAdminStats...
firebase deploy --only functions:getAdminStats
if %errorlevel% neq 0 (
    echo ERROR: Fallo getAdminStats
)

echo Desplegando getUsers...
firebase deploy --only functions:getUsers
if %errorlevel% neq 0 (
    echo ERROR: Fallo getUsers
)

echo Desplegando getAnalyticsReport...
firebase deploy --only functions:getAnalyticsReport
if %errorlevel% neq 0 (
    echo ERROR: Fallo getAnalyticsReport
)

echo Desplegando exportSystemData...
firebase deploy --only functions:exportSystemData
if %errorlevel% neq 0 (
    echo ERROR: Fallo exportSystemData
)

echo.
echo ========================================
echo         DEPLOYMENT COMPLETADO
echo ========================================
echo.
echo Verificando funciones desplegadas...
firebase functions:list
echo.
echo PRUEBA EL ADMIN DASHBOARD:
echo URL: https://servi-map.com
echo Acceso: Ctrl+Alt+A o click en • del footer
echo Login: admin@servimap.com / AdminServi2024!
echo.

pause