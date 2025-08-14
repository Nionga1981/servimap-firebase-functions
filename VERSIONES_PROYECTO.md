# 🔧 VERSIONES Y COMPATIBILIDAD - ServiMapp

## ⚠️ IMPORTANTE PARA EL DESARROLLADOR
Este documento especifica las versiones exactas utilizadas en el desarrollo de ServiMapp para evitar problemas de compatibilidad.

## 📋 REQUISITOS DEL SISTEMA

### Node.js y NPM
- **Node.js:** v18.0.0 o superior (mínimo requerido)
- **Node.js (Functions):** v22 (especificado en functions/package.json)
- **NPM:** v8.0.0 o superior

> ⚠️ **NOTA IMPORTANTE:** Las Cloud Functions usan Node 22, pero el frontend funciona con Node 18+

### Recomendación para desarrollo:
```bash
# Usar NVM para manejar múltiples versiones de Node
nvm install 18
nvm use 18
# Para las functions, cambiar a Node 22 cuando sea necesario
```

## 🎯 VERSIONES PRINCIPALES DEL PROYECTO

### Frontend (React/Next.js)
| Dependencia | Versión | Notas |
|------------|---------|-------|
| React | 18.2.0 | |
| React DOM | 18.2.0 | |
| Next.js | 14.0.4 | Framework principal |
| TypeScript | 5.2.2 | Para el frontend |
| Tailwind CSS | 3.3.5 | |

### Firebase
| Servicio | Versión | Notas |
|----------|---------|-------|
| Firebase (SDK) | 10.14.1 | Cliente/Frontend |
| Firebase Admin | 12.6.0 | Backend/Functions |
| Firebase Functions | 6.4.0 | Cloud Functions |
| Firebase Tools | 14.11.1 | CLI (dev dependency) |

### Capacitor (Apps Móviles)
| Paquete | Versión | Notas |
|---------|---------|-------|
| @capacitor/core | 7.4.2 | |
| @capacitor/android | 7.4.2 | |
| @capacitor/ios | 7.4.2 | |
| @capacitor/cli | 7.4.2 | |

### Integraciones Externas
| Servicio | Versión | Notas |
|----------|---------|-------|
| Stripe JS | 7.5.0 | Frontend |
| Stripe React | 3.7.0 | Frontend |
| Stripe SDK | 18.3.0 | Backend y Frontend |
| Google Maps API | 2.19.3 | React wrapper |
| Socket.io Client | 4.7.4 | Chat real-time |

### UI Components (Radix UI)
Todas las dependencias de Radix UI están en versión ^1.x o ^2.x (ver package.json para detalles específicos)

## 🚀 INSTALACIÓN PASO A PASO

### 1. Clonar el repositorio
```bash
git clone https://github.com/Nionga1981/servimap-firebase-functions.git
cd servimap-firebase-functions
```

### 2. Verificar versión de Node
```bash
node --version  # Debe ser >= 18.0.0
npm --version   # Debe ser >= 8.0.0
```

### 3. Instalar dependencias del Frontend
```bash
# En la raíz del proyecto
npm install
```

### 4. Instalar dependencias de Cloud Functions
```bash
cd functions
npm install
cd ..
```

### 5. Configuración de Firebase
```bash
# Instalar Firebase CLI globalmente si no lo tienes
npm install -g firebase-tools@14.11.1

# Login en Firebase
firebase login

# Seleccionar el proyecto
firebase use servimap-nyniz
```

## 🔴 SOLUCIÓN DE PROBLEMAS COMUNES

### Error: Conflicto de versiones de Node
**Problema:** Las functions requieren Node 22 pero el frontend usa Node 18

**Solución:**
```bash
# Opción 1: Usar NVM para cambiar entre versiones
nvm use 18  # Para trabajar en el frontend
nvm use 22  # Para trabajar en las functions

# Opción 2: Modificar temporalmente functions/package.json
# Cambiar "node": "22" a "node": "18" para desarrollo local
```

### Error: peer dependencies
**Problema:** Warnings sobre peer dependencies al instalar

**Solución:**
```bash
# Instalar con legacy peer deps si es necesario
npm install --legacy-peer-deps
```

### Error: TypeScript version mismatch
**Problema:** Diferentes versiones de TypeScript entre frontend y functions

**Solución:**
- Frontend usa TypeScript 5.2.2
- Functions usa TypeScript 4.9.5
- Esto es intencional y no debe causar problemas

### Error: Firebase Admin initialization
**Problema:** Error de inicialización de Firebase Admin en functions

**Solución:**
- Ya está corregido en el código con inicialización condicional
- Verificar que tengas las credenciales correctas de Firebase

## 📦 SCRIPTS IMPORTANTES

### Frontend
```bash
npm run dev          # Desarrollo local
npm run build        # Build producción
npm run lint         # Linting
npm run type-check   # Verificar tipos TypeScript
```

### Functions
```bash
cd functions
npm run build        # Compilar TypeScript
npm run serve        # Emulador local
npm run deploy       # Deploy a producción
```

### Mobile
```bash
npm run android:build  # Build Android
npm run ios:build      # Build iOS
```

## 🔍 VERIFICACIÓN DE INSTALACIÓN

Para verificar que todo está instalado correctamente:

```bash
# 1. Verificar compilación del frontend
npm run build

# 2. Verificar compilación de functions
cd functions && npm run build && cd ..

# 3. Verificar linting
npm run lint

# 4. Verificar tipos
npm run type-check
```

## 📌 NOTAS ADICIONALES

1. **Firebase Project ID:** servimap-nyniz
2. **URL Producción:** https://servimap-nyniz.web.app
3. **Región Functions:** us-central1
4. **TypeScript Config:** Configuración permisiva (strict: false) para compatibilidad con código legacy

## 🆘 CONTACTO PARA SOPORTE

Si encuentras problemas de compatibilidad no documentados aquí:
1. Revisar el archivo CLAUDE.md para contexto adicional
2. Verificar los logs de Firebase: `firebase functions:log`
3. Revisar el historial de commits para cambios recientes

---
Documento creado: Agosto 2025
Última actualización: Después del deployment final con 85+ Cloud Functions