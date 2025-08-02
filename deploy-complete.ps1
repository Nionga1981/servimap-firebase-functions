# Deployment completo sin dependencias bash
$env:SHELL = ""
$env:BASH = ""

Write-Host "=== DEPLOYMENT COMPLETO DE FUNCTIONS ===" -ForegroundColor Cyan

Write-Host "Deployando todas las functions..." -ForegroundColor Green
$result = & firebase deploy --only functions 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Deployment exitoso" -ForegroundColor Green
} else {
    Write-Host "✗ Error en deployment:" -ForegroundColor Red
    Write-Host $result
}

Write-Host "`nListando todas las funciones:" -ForegroundColor Yellow
firebase functions:list

Write-Host "`n=== PRUEBA DEL ADMIN DASHBOARD ===" -ForegroundColor Cyan
Write-Host "URL: https://servimap-nyniz.web.app" -ForegroundColor White
Write-Host "Admin Dashboard: Ctrl+Alt+A o click en • del footer" -ForegroundColor White
Write-Host "Login: admin@servimap.com / AdminServi2024" -ForegroundColor White