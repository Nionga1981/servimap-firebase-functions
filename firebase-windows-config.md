# 🔧 CONFIGURACIÓN FIREBASE CLI PARA WINDOWS

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### 1. **Problema de Shell/Bash en Windows**
Firebase CLI puede tener problemas con Git Bash o shells no nativos de Windows.

**SOLUCIONES:**

#### Opción A: Usar Command Prompt nativo
```cmd
# Abrir Command Prompt (cmd) como administrador
# NO usar Git Bash, PowerShell ISE, o terminales de VSCode
```

#### Opción B: Configurar PowerShell
```powershell
# Abrir PowerShell como administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Opción C: Usar scripts proporcionados
```cmd
# Usar deploy-windows.bat (más compatible)
deploy-windows.bat

# O usar PowerShell script
PowerShell -ExecutionPolicy Bypass -File deploy-windows.ps1
```

### 2. **Variables de Entorno**
Verificar que Firebase CLI está en el PATH:

```cmd
# Verificar instalación
firebase --version

# Si no funciona, reinstalar
npm uninstall -g firebase-tools
npm install -g firebase-tools

# O usar npx
npx firebase-tools --version
```

### 3. **Permisos de Node.js**
Ejecutar como administrador si hay problemas de permisos:

```cmd
# Ejecutar Command Prompt como administrador
# Luego ejecutar los comandos de Firebase
```

### 4. **Proxy/Firewall Corporativo**
Si estás en una red corporativa:

```cmd
# Configurar proxy para npm
npm config set proxy http://proxy-server:port
npm config set https-proxy http://proxy-server:port

# Configurar proxy para Firebase
firebase use --add --project servimap-nyniz
```

## ⚡ DEPLOYMENT RÁPIDO - PASO A PASO

### Método 1: Script Automático (.bat)
```cmd
# 1. Abrir Command Prompt como administrador
# 2. Navegar al proyecto
cd C:\ruta\a\servimap-firebase-functions

# 3. Ejecutar script
deploy-windows.bat
```

### Método 2: PowerShell
```powershell
# 1. Abrir PowerShell como administrador
# 2. Navegar al proyecto
cd C:\ruta\a\servimap-firebase-functions

# 3. Ejecutar script
PowerShell -ExecutionPolicy Bypass -File deploy-windows.ps1
```

### Método 3: Manual (Command Prompt)
```cmd
# 1. Ir al directorio functions
cd functions

# 2. Instalar dependencias
npm install

# 3. Compilar
npm run build

# 4. Volver a raíz
cd ..

# 5. Autenticar (si no está hecho)
firebase login

# 6. Seleccionar proyecto
firebase use servimap-nyniz

# 7. Deploy
firebase deploy --only functions
```

### Método 4: Deploy Individual (si falla el completo)
```cmd
firebase deploy --only functions:getAdminStats
firebase deploy --only functions:getUsers
firebase deploy --only functions:getAnalyticsReport
firebase deploy --only functions:exportSystemData
```

## 🔍 DIAGNÓSTICO DE PROBLEMAS

### Verificar estado actual:
```cmd
# Verificar proyecto actual
firebase projects:list
firebase use

# Verificar funciones
firebase functions:list

# Ver logs de funciones
firebase functions:log

# Verificar compilación
cd functions
npm run build
```

### Si hay errores de autenticación:
```cmd
# Logout y login nuevamente
firebase logout
firebase login

# Verificar tokens
firebase login:list
```

### Si hay errores de Node.js:
```cmd
# Verificar versión Node.js (debe ser >=18)
node --version

# Verificar npm
npm --version

# Limpiar cache npm
npm cache clean --force
```

## 🎯 VERIFICAR DEPLOYMENT EXITOSO

Después del deployment, verificar:

1. **Funciones listadas:**
   ```cmd
   firebase functions:list
   ```

2. **URLs activas:**
   - https://us-central1-servimap-nyniz.cloudfunctions.net/getAdminStats
   - https://us-central1-servimap-nyniz.cloudfunctions.net/getUsers
   - https://us-central1-servimap-nyniz.cloudfunctions.net/getAnalyticsReport
   - https://us-central1-servimap-nyniz.cloudfunctions.net/exportSystemData

3. **Probar admin dashboard:**
   - Ir a: https://servi-map.com
   - Presionar Ctrl+Alt+A
   - Login: admin@servimap.com / AdminServi2024!

## 🆘 SI NADA FUNCIONA

Como último recurso, usar Firebase Console:

1. Ir a: https://console.firebase.google.com/project/servimap-nyniz/functions
2. Ver si las funciones están listadas
3. Usar Firebase Console para deployment manual si es necesario

## 📞 PROMPT PARA CLAUDE CODER

Si sigues teniendo problemas, usa este prompt:

```
Tengo problemas con Firebase CLI en Windows. Los errores específicos son:
[PEGAR ERRORES AQUÍ]

He intentado:
- deploy-windows.bat 
- deploy-windows.ps1
- Comandos manuales

Proyecto: servimap-nyniz
Funciones a deployar: getAdminStats, getUsers, getAnalyticsReport, exportSystemData

¿Puedes ayudarme a resolverlo paso a paso?
```