# ServiMap Admin Functions Deployment Script - PowerShell
# Solución para problemas de shell en Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SERVIMAP ADMIN FUNCTIONS DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

Write-Host "[1/7] Verificando directorio del proyecto..." -ForegroundColor Yellow
if (-not (Test-Path "firebase.json")) {
    Write-Host "ERROR: No se encontró firebase.json. Verifica que estás en el directorio correcto." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host "✓ Directorio correcto encontrado" -ForegroundColor Green

Write-Host ""
Write-Host "[2/7] Verificando autenticación Firebase..." -ForegroundColor Yellow
try {
    $loginResult = firebase login:list
    Write-Host "✓ Autenticación verificada" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No estás autenticado en Firebase" -ForegroundColor Red
    Write-Host "Ejecuta: firebase login" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "[3/7] Seleccionando proyecto..." -ForegroundColor Yellow
try {
    firebase use servimap-nyniz
    Write-Host "✓ Proyecto seleccionado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo seleccionar el proyecto" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "[4/7] Navegando a functions..." -ForegroundColor Yellow
Set-Location "functions"
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: No se encontró el directorio functions válido" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "[5/7] Instalando dependencias..." -ForegroundColor Yellow
try {
    npm install
    Write-Host "✓ Dependencias instaladas" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Falló la instalación de dependencias" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "[6/7] Compilando TypeScript..." -ForegroundColor Yellow
try {
    npm run build
    Write-Host "✓ Compilación exitosa" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Falló la compilación" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "[7/7] Volviendo al directorio raíz..." -ForegroundColor Yellow
Set-Location ".."

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "        INICIANDO DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Intentar deployment completo
Write-Host "Intentando deployment completo..." -ForegroundColor Yellow
try {
    firebase deploy --only functions
    Write-Host ""
    Write-Host "✓✓✓ DEPLOYMENT EXITOSO ✓✓✓" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verificando funciones desplegadas..." -ForegroundColor Yellow
    firebase functions:list
    Write-Host ""
    Write-Host "PRUEBA EL ADMIN DASHBOARD:" -ForegroundColor Cyan
    Write-Host "URL: https://servi-map.com" -ForegroundColor White
    Write-Host "Acceso: Ctrl+Alt+A o click en • del footer" -ForegroundColor White
    Write-Host "Login: admin@servimap.com / AdminServi2024!" -ForegroundColor White
    Write-Host ""
    Read-Host "Presiona Enter para continuar"
    exit 0
} catch {
    Write-Host ""
    Write-Host "⚠️  Deployment completo falló, intentando funciones individuales..." -ForegroundColor Yellow
    Write-Host ""
}

# Intentar deployment individual
$functions = @("getAdminStats", "getUsers", "getAnalyticsReport", "exportSystemData")

foreach ($func in $functions) {
    Write-Host "Desplegando $func..." -ForegroundColor Yellow
    try {
        firebase deploy --only "functions:$func"
        Write-Host "✓ $func desplegado exitosamente" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Falló $func" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         DEPLOYMENT COMPLETADO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verificando funciones desplegadas..." -ForegroundColor Yellow
firebase functions:list
Write-Host ""
Write-Host "PRUEBA EL ADMIN DASHBOARD:" -ForegroundColor Cyan
Write-Host "URL: https://servi-map.com" -ForegroundColor White
Write-Host "Acceso: Ctrl+Alt+A o click en • del footer" -ForegroundColor White
Write-Host "Login: admin@servimap.com / AdminServi2024!" -ForegroundColor White
Write-Host ""

Read-Host "Presiona Enter para salir"