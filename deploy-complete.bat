@echo off
setlocal EnableDelayedExpansion

echo ==============================================
echo  DEPLOYMENT COMPLETO DE FIREBASE FUNCTIONS
echo  Solucionando conflicto Git Bash Windows
echo ==============================================

REM Guardar PATH original
set ORIGINAL_PATH=%PATH%

REM Configurar entorno limpio sin Git Bash
set PATH=C:\WINDOWS\system32;C:\WINDOWS;C:\Program Files\nodejs;%APPDATA%\npm

echo Cambiando al directorio functions...
cd functions

echo Compilando TypeScript...
call npm run build
if errorlevel 1 (
    echo ERROR: Falló la compilación TypeScript
    goto :error
)

echo Iniciando deployment de Firebase...
call firebase deploy --only functions --project servimap-nyniz
if errorlevel 1 (
    echo ERROR: Falló el deployment
    goto :error
)

echo.
echo ======================================
echo  DEPLOYMENT COMPLETADO EXITOSAMENTE!
echo ======================================

cd ..
echo Verificando funciones desplegadas...
firebase functions:list --project servimap-nyniz

goto :end

:error
echo.
echo =====================================
echo  ERROR EN EL DEPLOYMENT
echo =====================================
cd ..
set PATH=%ORIGINAL_PATH%
exit /b 1

:end
set PATH=%ORIGINAL_PATH%
echo.
echo =====================================
echo  PROCESO COMPLETADO
echo =====================================