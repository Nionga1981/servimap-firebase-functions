# deploy-windows.ps1 - Script de deployment PowerShell para Windows
# Ejecutar: PowerShell -ExecutionPolicy Bypass -File deploy-windows.ps1

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   SERVIMAP - DEPLOYMENT POWERSHELL" -ForegroundColor Cyan  
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Función para mostrar errores
function Show-Error {
    param($Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
    Read-Host "Presiona Enter para continuar"
    exit 1
}

# Función para mostrar éxito
function Show-Success {
    param($Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

# Verificar estructura del proyecto
Write-Host "[1/6] Verificando estructura del proyecto..." -ForegroundColor Yellow

if (-not (Test-Path "functions\src\adminDashboard.ts")) {
    Show-Error "No se encuentra functions\src\adminDashboard.ts. Ejecuta desde la raíz del proyecto."
}

if (Test-Path "functions\src\adminDashboard.ts") { Show-Success "adminDashboard.ts encontrado" }
if (Test-Path "functions\src\index.ts") { Show-Success "index.ts encontrado" }
if (Test-Path "firebase.json") { Show-Success "firebase.json encontrado" }

# Instalar dependencias
Write-Host ""
Write-Host "[2/6] Instalando dependencias..." -ForegroundColor Yellow

Set-Location functions
try {
    & npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install falló" }
    Show-Success "Dependencias instaladas"
} catch {
    Show-Error "Falló la instalación de dependencias: $_"
}

# Compilar TypeScript
Write-Host ""
Write-Host "[3/6] Compilando TypeScript..." -ForegroundColor Yellow

try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build falló" }
    Show-Success "TypeScript compilado exitosamente"
} catch {
    Show-Error "Falló la compilación de TypeScript: $_"
}

Set-Location ..

# Verificar autenticación Firebase
Write-Host ""
Write-Host "[4/6] Verificando autenticación Firebase..." -ForegroundColor Yellow

try {
    & firebase projects:list *>$null
    if ($LASTEXITCODE -ne 0) { throw "No autenticado" }
    Show-Success "Firebase autenticado"
} catch {
    Show-Error "No estás autenticado en Firebase. Ejecuta: firebase login"
}

# Seleccionar proyecto
Write-Host ""
Write-Host "[5/6] Seleccionando proyecto..." -ForegroundColor Yellow

try {
    & firebase use servimap-nyniz
    if ($LASTEXITCODE -ne 0) { throw "No se pudo seleccionar proyecto" }
    Show-Success "Proyecto servimap-nyniz seleccionado"
} catch {
    Show-Error "No se pudo seleccionar el proyecto servimap-nyniz"
}

# Deploy funciones
Write-Host ""
Write-Host "[6/6] Deployando Cloud Functions..." -ForegroundColor Yellow

try {
    & firebase deploy --only functions
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Deployment completo falló, intentando funciones individuales..." -ForegroundColor Yellow
        
        & firebase deploy --only functions:getAdminStats
        & firebase deploy --only functions:getUsers  
        & firebase deploy --only functions:getAnalyticsReport
        & firebase deploy --only functions:exportSystemData
    }
    Show-Success "Funciones deployadas"
} catch {
    Show-Error "Falló el deployment de funciones: $_"
}

# Resultado final
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "        DEPLOYMENT COMPLETADO" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Funciones deployadas:" -ForegroundColor White
Write-Host "  - getAdminStats" -ForegroundColor Gray
Write-Host "  - getUsers" -ForegroundColor Gray
Write-Host "  - getAnalyticsReport" -ForegroundColor Gray
Write-Host "  - exportSystemData" -ForegroundColor Gray
Write-Host ""
Write-Host "Para probar:" -ForegroundColor White
Write-Host "  1. Ve a: https://servi-map.com" -ForegroundColor Gray
Write-Host "  2. Presiona Ctrl+Alt+A" -ForegroundColor Gray
Write-Host "  3. Login: admin@servimap.com / AdminServi2024!" -ForegroundColor Gray
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green

Read-Host "Presiona Enter para continuar"