# PowerShell Script para deployment completo de Firebase Functions
# Evita conflictos de Git Bash en Windows

Write-Host "🔧 SOLUCIONANDO CONFLICTO GIT BASH Y DEPLOYANDO FUNCTIONS..." -ForegroundColor Cyan

# Configurar entorno
$env:SHELL = "cmd"
$env:ComSpec = "C:\Windows\System32\cmd.exe"
$OriginalPath = $env:PATH

try {
    # Remover paths problemáticos de Git
    $env:PATH = $env:PATH -replace "[^;]*Git[^;]*;?", ""
    
    Write-Host "📁 Cambiando al directorio de functions..." -ForegroundColor Yellow
    Set-Location "functions"
    
    Write-Host "🔨 Compilando TypeScript..." -ForegroundColor Yellow
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Error en compilación TypeScript"
    }
    
    Write-Host "🚀 Iniciando deployment de Firebase Functions..." -ForegroundColor Green
    
    # Usar cmd.exe para ejecutar firebase
    & cmd.exe /c "firebase deploy --only functions --project servimap-nyniz"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ DEPLOYMENT COMPLETADO EXITOSAMENTE!" -ForegroundColor Green
    } else {
        Write-Host "❌ Error en deployment" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
} finally {
    # Restaurar PATH original
    $env:PATH = $OriginalPath
    Set-Location ".."
}

Write-Host "🔍 Verificando funciones desplegadas..." -ForegroundColor Cyan
firebase functions:list --project servimap-nyniz