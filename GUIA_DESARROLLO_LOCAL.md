# 📚 Guía Completa de Configuración Local - ServiMapp
## Para Desarrolladores - Configuración desde Cero

---

## 📋 Tabla de Contenidos
1. [Requisitos Previos](#requisitos-previos)
2. [Clonación del Repositorio](#clonación-del-repositorio)
3. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
4. [Instalación de Dependencias](#instalación-de-dependencias)
5. [Compilación del Proyecto](#compilación-del-proyecto)
6. [Desarrollo Local](#desarrollo-local)
7. [Estructura del Proyecto](#estructura-del-proyecto)
8. [Comandos Útiles](#comandos-útiles)
9. [Solución de Problemas Comunes](#solución-de-problemas-comunes)
10. [Contacto y Soporte](#contacto-y-soporte)

---

## 1. 🔧 Requisitos Previos

### Software Necesario
Asegúrate de tener instalado lo siguiente en tu máquina local:

| Herramienta | Versión Requerida | Verificar Instalación | Enlace de Descarga |
|------------|-------------------|----------------------|-------------------|
| **Node.js** | v18.x o superior | `node --version` | [nodejs.org](https://nodejs.org/) |
| **npm** | v9.x o superior | `npm --version` | Incluido con Node.js |
| **Git** | Última versión | `git --version` | [git-scm.com](https://git-scm.com/) |
| **Firebase CLI** | Última versión | `firebase --version` | Ver instrucciones abajo |
| **Java** (para Android) | JDK 11+ | `java --version` | [Oracle JDK](https://www.oracle.com/java/technologies/downloads/) |
| **Android Studio** (opcional) | Última versión | - | [developer.android.com](https://developer.android.com/studio) |

### Instalación de Firebase CLI
```bash
# Instalar Firebase CLI globalmente
npm install -g firebase-tools

# Verificar instalación
firebase --version

# Iniciar sesión en Firebase (se abrirá el navegador)
firebase login
```

---

## 2. 📦 Clonación del Repositorio

### Paso 1: Clonar el proyecto
```bash
# Clonar el repositorio
git clone https://github.com/Nionga1981/servimap-firebase-functions.git

# Entrar al directorio del proyecto
cd servimap-firebase-functions

# Verificar que estés en la rama correcta
git branch
# Deberías estar en 'master' o 'main'
```

### Paso 2: Verificar la estructura
```bash
# Listar archivos principales
ls -la

# Deberías ver estos directorios y archivos:
# - src/           (código fuente del frontend)
# - functions/     (Cloud Functions)
# - public/        (archivos estáticos)
# - package.json   (dependencias del frontend)
# - next.config.js (configuración de Next.js)
# - .env.local.example (ejemplo de variables de entorno)
```

---

## 3. 🔐 Configuración de Variables de Entorno

### Paso 1: Crear archivo de variables de entorno para el Frontend

Crea un archivo llamado `.env.local` en la raíz del proyecto con el siguiente contenido:

```bash
# Crear el archivo .env.local
touch .env.local
```

### Paso 2: Agregar las variables de entorno

Copia y pega exactamente este contenido en `.env.local`:

```env
# ============================================
# CONFIGURACIÓN DE FIREBASE - SERVIMAP
# ============================================
# Estas son las variables PÚBLICAS del proyecto
# Son seguras de usar ya que Firebase las protege con reglas de seguridad

# Firebase Core Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBgD4rXJZ7nJGI9yZGN7JGQc6X1OGlq_sg
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=servimap-nyniz.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=servimap-nyniz
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=servimap-nyniz.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=566736348254
NEXT_PUBLIC_FIREBASE_APP_ID=1:566736348254:web:9a8b7c6d5e4f3g2h1i8j9k
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-ABC123XYZ789

# Firebase Cloud Messaging (para notificaciones push)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BGLOkCdZ4-_QC3sF9iplTU6RAb6bLCSnXVu0IVDeh-cT7dTX1eF2UPRd5vVK2OM7iLMgyuyG4sV1evdlYEnVgu4

# Entorno de desarrollo
NODE_ENV=development
```

### Paso 3: Configurar variables para Cloud Functions (Opcional)

Si necesitas trabajar con las Cloud Functions localmente:

```bash
# Entrar al directorio de functions
cd functions

# Crear archivo .env para desarrollo local
touch .env

# Agregar las siguientes variables (SOLICITAR VALORES REALES AL ADMINISTRADOR):
```

```env
# NOTA: Estas son variables SENSIBLES - Solicitar valores reales al administrador
STRIPE_SECRET_KEY=sk_test_xxxxx  # Clave de prueba de Stripe
OPENAI_API_KEY=sk-xxxxx          # Tu API key de OpenAI
STREAM_API_KEY=t9bm8kwcqcw6      # API key de Stream (ejemplo)
STREAM_SECRET=xxxxx               # Secret de Stream
STREAM_APP_ID=1409820             # App ID de Stream
```

⚠️ **IMPORTANTE**: Las variables de las Cloud Functions contienen claves secretas. 
- Para desarrollo, puedes usar claves de prueba
- Para producción, solicita las claves reales al administrador del proyecto

---

## 4. 📦 Instalación de Dependencias

### Paso 1: Instalar dependencias del Frontend

Desde la raíz del proyecto:

```bash
# Asegúrate de estar en la raíz del proyecto
pwd
# Debería mostrar: .../servimap-firebase-functions

# Limpiar caché de npm (opcional pero recomendado)
npm cache clean --force

# Instalar dependencias con flag legacy para evitar conflictos
npm install --legacy-peer-deps

# Si hay errores, intentar con:
npm install --force --legacy-peer-deps
```

### Paso 2: Instalar dependencias de Cloud Functions

```bash
# Entrar al directorio de functions
cd functions

# Instalar dependencias
npm install --legacy-peer-deps

# Volver a la raíz del proyecto
cd ..
```

### Paso 3: Verificar instalación

```bash
# Verificar que node_modules existe en ambos directorios
ls -la node_modules | head -5
ls -la functions/node_modules | head -5

# Verificar versiones de paquetes principales
npm list next firebase react
```

---

## 5. 🔨 Compilación del Proyecto

### Compilación del Frontend

```bash
# Desde la raíz del proyecto
npm run build

# Proceso esperado:
# 1. Next.js compilará el proyecto
# 2. Se generará la carpeta .next/
# 3. Se optimizarán los assets
# 4. Se generará el Service Worker para PWA
```

Si la compilación es exitosa, verás:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Collecting build traces
✓ Finalizing page optimization
```

### Compilación de Cloud Functions

```bash
# Entrar al directorio de functions
cd functions

# Compilar TypeScript a JavaScript
npm run build

# Verificar que se generó la carpeta lib/
ls -la lib/

# Volver a la raíz
cd ..
```

---

## 6. 💻 Desarrollo Local

### Iniciar el servidor de desarrollo del Frontend

```bash
# Desde la raíz del proyecto
npm run dev

# El servidor se iniciará en:
# → Local:    http://localhost:3000
# → Network:  http://192.168.x.x:3000
```

### Iniciar emulador de Firebase Functions (Opcional)

En una nueva terminal:

```bash
# Iniciar emuladores de Firebase
firebase emulators:start --only functions

# O si quieres emular todo (Firestore, Auth, Functions, etc):
firebase emulators:start

# Los emuladores estarán disponibles en:
# → Functions: http://localhost:5001
# → Firestore: http://localhost:8080
# → Auth:      http://localhost:9099
```

### Verificar que todo funciona

1. Abre http://localhost:3000 en tu navegador
2. Deberías ver la página de inicio de ServiMapp
3. Intenta registrarte o iniciar sesión
4. Verifica la consola del navegador (F12) para errores

---

## 7. 📂 Estructura del Proyecto

```
servimap-firebase-functions/
├── 📁 src/                    # Código fuente del Frontend
│   ├── 📁 app/               # Páginas de Next.js (App Router)
│   │   ├── page.tsx          # Página principal
│   │   ├── layout.tsx        # Layout principal
│   │   └── ...              # Otras páginas
│   ├── 📁 components/        # Componentes React reutilizables
│   │   ├── ui/              # Componentes de UI base
│   │   ├── auth/            # Componentes de autenticación
│   │   ├── chat/            # Sistema de chat
│   │   └── ...              # 80+ componentes
│   ├── 📁 lib/              # Utilidades y configuraciones
│   │   ├── firebase.ts      # Configuración de Firebase
│   │   └── utils.ts         # Funciones utilitarias
│   └── 📁 styles/           # Estilos CSS/SCSS
│
├── 📁 functions/             # Cloud Functions de Firebase
│   ├── 📁 src/              # Código fuente de las functions
│   │   ├── index.ts         # Punto de entrada principal
│   │   ├── 📁 pagos/        # Funciones de pagos con Stripe
│   │   ├── 📁 moderacion/   # Sistema de moderación con IA
│   │   └── ...              # 85+ funciones
│   ├── package.json         # Dependencias de functions
│   └── tsconfig.json        # Configuración TypeScript
│
├── 📁 public/               # Archivos estáticos
│   ├── manifest.json        # Configuración PWA
│   ├── sw.js               # Service Worker
│   └── icons/              # Iconos de la app
│
├── 📁 android/              # Proyecto Android (Capacitor)
├── 📁 ios/                  # Proyecto iOS (Capacitor)
│
├── 📄 package.json          # Dependencias del frontend
├── 📄 next.config.js        # Configuración de Next.js
├── 📄 firebase.json         # Configuración de Firebase
├── 📄 .env.local           # Variables de entorno (crear)
└── 📄 README.md            # Documentación principal
```

---

## 8. 🎯 Comandos Útiles

### Comandos de Desarrollo

```bash
# Frontend
npm run dev                 # Iniciar servidor de desarrollo
npm run build              # Compilar para producción
npm run start              # Iniciar servidor de producción
npm run lint               # Verificar código con ESLint
npm run type-check         # Verificar tipos TypeScript

# Cloud Functions
cd functions
npm run serve              # Iniciar functions localmente
npm run shell              # Shell interactivo de functions
npm run build              # Compilar TypeScript
npm run deploy             # Desplegar functions (requiere permisos)

# Firebase
firebase emulators:start   # Iniciar todos los emuladores
firebase deploy --only hosting      # Desplegar solo frontend
firebase deploy --only functions    # Desplegar solo functions
firebase functions:list             # Listar functions desplegadas

# Mobile (Capacitor)
npm run android:build      # Compilar app Android
npm run ios:build         # Compilar app iOS
npx cap sync              # Sincronizar cambios con apps móviles
npx cap open android      # Abrir en Android Studio
npx cap open ios          # Abrir en Xcode
```

### Scripts del package.json

```bash
# Ver todos los scripts disponibles
npm run

# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Actualizar dependencias (con precaución)
npm update --legacy-peer-deps
```

---

## 9. 🔧 Solución de Problemas Comunes

### Error: "Cannot find module 'firebase-admin'"
```bash
# Solución:
cd functions
npm install firebase-admin --save
cd ..
```

### Error: "EACCES: permission denied"
```bash
# En Linux/Mac, usar sudo o cambiar permisos npm
sudo npm install -g firebase-tools
# O configurar npm para no requerir sudo:
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Error: "Module not found: Can't resolve '@/components/...'"
```bash
# El alias @ apunta a src/, verificar tsconfig.json
# Solución: Reiniciar el servidor de desarrollo
npm run dev
```

### Error: "Firebase: No Firebase App '[DEFAULT]' has been created"
```bash
# Verificar que .env.local existe y tiene las variables correctas
cat .env.local
# Reiniciar el servidor de desarrollo
npm run dev
```

### Error de versiones de Node
```bash
# Usar nvm para cambiar versión de Node
nvm install 18
nvm use 18
node --version  # Debería mostrar v18.x.x
```

### Error: "peer dependency conflict"
```bash
# Siempre usar el flag --legacy-peer-deps
npm install --legacy-peer-deps

# O configurarlo globalmente
npm config set legacy-peer-deps true
```

### Build falla con errores de TypeScript
```bash
# El proyecto usa TypeScript en modo no estricto
# Verificar tsconfig.json tiene:
# "strict": false
# "skipLibCheck": true

# Si persisten errores, compilar ignorándolos:
npm run build -- --no-lint
```

---

## 10. 📞 Contacto y Soporte

### Información del Proyecto
- **Nombre**: ServiMapp
- **URL Producción**: https://servimap-nyniz.web.app
- **Repositorio**: https://github.com/Nionga1981/servimap-firebase-functions
- **Admin Firebase**: admin@servimap.com

### Recursos Adicionales
- **Documentación Completa**: Ver `CLAUDE_DETALLE.md` en el repositorio
- **Sistema de Diseño**: Ver `SERVIMAP_DESIGN_SYSTEM.md`
- **Versiones y Compatibilidad**: Ver `VERSIONES_PROYECTO.md`

### Checklist de Verificación Final

Antes de empezar a desarrollar, verifica que:

- [ ] Node.js v18+ está instalado
- [ ] Firebase CLI está instalado y autenticado
- [ ] El repositorio está clonado correctamente
- [ ] El archivo `.env.local` está creado con las variables correctas
- [ ] Las dependencias del frontend están instaladas (`npm install --legacy-peer-deps`)
- [ ] Las dependencias de functions están instaladas (`cd functions && npm install`)
- [ ] El proyecto compila sin errores (`npm run build`)
- [ ] El servidor de desarrollo inicia correctamente (`npm run dev`)
- [ ] Puedes acceder a http://localhost:3000 y ver la aplicación

### Notas Importantes

1. **Variables de Entorno**: Las variables con prefijo `NEXT_PUBLIC_` son públicas y seguras. Las variables de backend (Stripe, OpenAI) son sensibles y deben manejarse con cuidado.

2. **Versiones de Node**: El frontend usa Node 18+, las Cloud Functions usan Node 22. Usa nvm para cambiar entre versiones si es necesario.

3. **Deploy**: NO hagas deploy a producción sin autorización. Usa los emuladores locales para desarrollo.

4. **Git**: Nunca hagas commit de archivos `.env.local` o `.env`. Ya están en `.gitignore`.

5. **Dependencias**: Siempre usa `--legacy-peer-deps` al instalar paquetes para evitar conflictos de versiones.

---

## 🚀 ¡Listo para Desarrollar!

Si seguiste todos los pasos correctamente, deberías tener:
- ✅ El proyecto corriendo en http://localhost:3000
- ✅ Capacidad de hacer cambios y ver actualizaciones en tiempo real
- ✅ Acceso a todas las funcionalidades de ServiMapp en desarrollo local

**¡Bienvenido al equipo de desarrollo de ServiMapp!** 🎉

---

*Documento creado: Agosto 2025*
*Última actualización: Post-deployment con 85+ Cloud Functions*