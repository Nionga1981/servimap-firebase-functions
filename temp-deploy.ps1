# Script temporal de deployment sin dependencias de bash
$env:SHELL = ""
$env:BASH = ""

Write-Host "Deployando funciones admin..." -ForegroundColor Green

# Deployar cada funcion individualmente
$functions = @("getAdminStats", "getUsers", "getAnalyticsReport", "exportSystemData")

foreach ($func in $functions) {
    Write-Host "Deployando $func..." -ForegroundColor Yellow
    $result = & firebase deploy --only "functions:$func" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Funcion $func deployada exitosamente" -ForegroundColor Green
    } else {
        Write-Host "Error deployando $func" -ForegroundColor Red
        Write-Host $result
    }
}

Write-Host "Verificando funciones..." -ForegroundColor Blue
firebase functions:list