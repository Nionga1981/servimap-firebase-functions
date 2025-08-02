# 📋 DEPLOYMENT PASO A PASO - RESOLUCIÓN DE PROBLEMAS WINDOWS

## 🎯 MÉTODO RECOMENDADO: Command Prompt Nativo

### PASO 1: Preparar el entorno
```cmd
# 1.1 Abrir Command Prompt como ADMINISTRADOR
# Click derecho en "Command Prompt" → "Run as administrator"

# 1.2 Navegar al proyecto
cd C:\tu\ruta\a\servimap-firebase-functions

# 1.3 Verificar que estás en el lugar correcto
dir
# Debes ver: functions/, firebase.json, package.json
```

### PASO 2: Actualizar código
```cmd
# 2.1 Actualizar desde GitHub
git pull origin master

# 2.2 Verificar que tienes los archivos nuevos
dir deploy-windows.bat
dir firebase-windows-config.md
```

### PASO 3: Usar script automático
```cmd
# 3.1 Ejecutar el script de Windows
deploy-windows.bat

# Si funciona, ¡listo! Si no, continúa con PASO 4
```

### PASO 4: Deployment manual (si el script falla)
```cmd
# 4.1 Ir al directorio functions
cd functions

# 4.2 Verificar/instalar dependencias
npm install

# 4.3 Compilar TypeScript
npm run build

# 4.4 Volver al directorio raíz
cd ..

# 4.5 Verificar autenticación Firebase
firebase projects:list

# Si falla autenticación:
firebase logout
firebase login
```

### PASO 5: Configurar proyecto
```cmd
# 5.1 Seleccionar proyecto
firebase use servimap-nyniz

# 5.2 Verificar que está seleccionado
firebase use
```

### PASO 6: Deploy funciones
```cmd
# 6.1 Intentar deploy completo
firebase deploy --only functions

# 6.2 Si falla, deploy individual:
firebase deploy --only functions:getAdminStats
firebase deploy --only functions:getUsers
firebase deploy --only functions:getAnalyticsReport
firebase deploy --only functions:exportSystemData
```

### PASO 7: Verificar deployment
```cmd
# 7.1 Listar funciones deployadas
firebase functions:list

# 7.2 Ver logs
firebase functions:log --limit 10
```

## 🚨 RESOLUCIÓN DE ERRORES ESPECÍFICOS

### Error: "Command not found" o "firebase is not recognized"
```cmd
# Reinstalar Firebase CLI
npm uninstall -g firebase-tools
npm install -g firebase-tools

# O usar npx
npx firebase-tools login
npx firebase-tools use servimap-nyniz
npx firebase-tools deploy --only functions
```

### Error: "Permission denied" o "EACCES"
```cmd
# 1. Cerrar todas las ventanas de terminal
# 2. Abrir Command Prompt como ADMINISTRADOR
# 3. Ejecutar comandos desde ahí
```

### Error: "spawn bash ENOENT" o problemas de shell
```cmd
# NO usar Git Bash, usar Command Prompt nativo
# Si estás en VSCode, usar terminal externo:
# Terminal → "Select Default Shell" → "Command Prompt"
```

### Error: "Functions source not found"
```cmd
# Verificar estructura:
dir functions\src\adminDashboard.ts
dir functions\src\index.ts
dir firebase.json

# Si no existen, hacer pull:
git pull origin master
```

### Error: "Authentication failed"
```cmd
# Logout completo y login nuevamente
firebase logout
firebase login

# Verificar proyectos disponibles
firebase projects:list

# Seleccionar proyecto nuevamente
firebase use servimap-nyniz
```

### Error: "Build failed" o "TypeScript compilation error"
```cmd
# Ir a functions y verificar
cd functions
npm install
npm run build

# Ver errores específicos y resolverlos
# Luego volver y deployar
cd ..
firebase deploy --only functions
```

## ⚡ MÉTODO ALTERNATIVO: PowerShell

Si Command Prompt no funciona:

### PowerShell PASO A PASO:
```powershell
# 1. Abrir PowerShell como administrador
Start-Process PowerShell -Verb RunAs

# 2. Permitir ejecución de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 3. Navegar al proyecto
cd C:\tu\ruta\a\servimap-firebase-functions

# 4. Ejecutar script PowerShell
.\deploy-windows.ps1
```

## 🎯 VERIFICACIÓN FINAL

Después del deployment exitoso:

### 1. Verificar en Firebase Console:
- Ir a: https://console.firebase.google.com/project/servimap-nyniz/functions
- Verificar que aparecen 4 funciones admin

### 2. Probar el admin dashboard:
- Ir a: https://servi-map.com
- Presionar Ctrl+Alt+A (o click en el punto • del footer)
- Login: admin@servimap.com / AdminServi2024!
- Verificar que cargan las estadísticas

### 3. URLs de funciones activas:
- https://us-central1-servimap-nyniz.cloudfunctions.net/getAdminStats
- https://us-central1-servimap-nyniz.cloudfunctions.net/getUsers
- https://us-central1-servimap-nyniz.cloudfunctions.net/getAnalyticsReport
- https://us-central1-servimap-nyniz.cloudfunctions.net/exportSystemData

## 🆘 ÚLTIMO RECURSO

Si NADA funciona, copia este prompt para Claude Coder:

```
Los scripts de Windows no funcionan. Errores específicos:
[PEGAR ERRORES AQUÍ]

He intentado:
- deploy-windows.bat
- deploy-windows.ps1 
- Comandos manuales en cmd
- PowerShell como administrador

Sistema: Windows [VERSION]
Node.js: [VERSIÓN]
Firebase CLI: [VERSIÓN]

Proyecto: servimap-nyniz
Directorio: [TU RUTA]

Necesito deployment de funciones admin sin usar scripts bash. 
¿Puedes guiarme comando por comando específico para Windows?
```