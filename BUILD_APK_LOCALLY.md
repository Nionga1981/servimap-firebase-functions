# 🚀 Guía: Generar APK de ServiMap Localmente

## ⚠️ Nota Importante
Los entornos de Codespaces no incluyen el Android SDK completo necesario para compilar APKs. Esta guía te permite generar el APK en tu computadora local.

## 📋 Requisitos Previos

### 1. Android Studio
- Descarga e instala [Android Studio](https://developer.android.com/studio)
- Ejecuta Android Studio y completa la configuración inicial
- Acepta todas las licencias del SDK

### 2. Node.js y npm
- Node.js 18+ instalado
- npm o yarn

## 🔽 Descargar el Proyecto

### Opción 1: Clonar desde GitHub
```bash
git clone https://github.com/TU_USUARIO/servimap-firebase-functions.git
cd servimap-firebase-functions
```

### Opción 2: Descargar ZIP desde Codespaces
1. En Codespaces, ve a la terminal
2. Ejecuta: `tar -czf servimap-project.tar.gz .`
3. Descarga el archivo y extráelo localmente

## 🛠️ Configuración Local

### 1. Instalar Dependencias
```bash
# Instalar dependencias del proyecto
npm install

# Instalar Capacitor CLI globalmente
npm install -g @capacitor/cli
```

### 2. Configurar Variables de Entorno
Crea un archivo `.env.local` con:
```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BGLOkCdZ4-_QC3sF9iplTU6RAb6bLCSnXVu0IVDeh-cT7dTX1eF2UPRd5vVK2OM7iLMgyuyG4sV1evdlYEnVgu4
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=servimap-nyniz.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=servimap-nyniz
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=servimap-nyniz.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 3. Generar Build de Producción
```bash
# Generar el build estático
npm run build

# Verificar que se creó la carpeta 'out'
ls -la out/
```

### 4. Sincronizar con Capacitor
```bash
# Copiar archivos web al proyecto nativo
npx cap sync android
```

## 📱 Generar APK

### Método 1: Android Studio (Recomendado)
```bash
# Abrir proyecto en Android Studio
npx cap open android
```

En Android Studio:
1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Espera a que compile (3-5 minutos)
3. APK generado en: `android/app/build/outputs/apk/debug/app-debug.apk`

### Método 2: Línea de Comandos
```bash
# Ir al directorio Android
cd android

# Generar APK debug
./gradlew assembleDebug

# APK estará en: app/build/outputs/apk/debug/app-debug.apk
```

### Método 3: Script Automatizado
```bash
# Usar el script incluido
chmod +x build-android.sh
./build-android.sh

# Seleccionar opción 1 (Debug APK)
```

## 📦 Ubicación del APK

Una vez compilado, encontrarás el APK en:
- **Ruta completa**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Copia automática**: `ServiMap-debug.apk` (en el directorio raíz)

## 📲 Instalar APK

### En tu teléfono Android:
1. **Transferir APK**: Copia `ServiMap-debug.apk` a tu teléfono
2. **Habilitar fuentes desconocidas**: Configuración → Seguridad → Fuentes desconocidas
3. **Instalar**: Abre el archivo APK y sigue las instrucciones

### Con ADB (si tienes el teléfono conectado):
```bash
# Verificar dispositivo conectado
adb devices

# Instalar APK
adb install ServiMap-debug.apk
```

## 🔧 Solución de Problemas

### Error: SDK location not found
```bash
# En Windows
echo sdk.dir=C:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk > android/local.properties

# En Mac/Linux
echo sdk.dir=/Users/TU_USUARIO/Library/Android/sdk > android/local.properties
```

### Error: Gradle sync failed
```bash
cd android
./gradlew clean
./gradlew build
```

### Error: Build tools version
Abre Android Studio y ve a:
- **Tools → SDK Manager → SDK Tools**
- Instala **Android SDK Build-Tools 34.0.0**

## 📊 Información del APK

**APK Debug Generado:**
- Nombre: `ServiMap-debug.apk`
- Tamaño aproximado: ~25-30 MB
- ID de aplicación: `com.servimap.app`
- Versión: 1.0.0

## ✅ Verificación Final

Después de instalar, verifica que la app:
- [x] Se abre correctamente
- [x] Muestra la landing page
- [x] Funciona sin conexión (PWA)
- [x] Permite acceder a las funciones principales

## 🚀 APK de Producción (Opcional)

Para generar un APK firmado para distribución:

1. **Crear keystore**:
```bash
keytool -genkey -v -keystore servimap-release.keystore -alias servimap -keyalg RSA -keysize 2048 -validity 10000
```

2. **Build release**:
```bash
./gradlew assembleRelease
```

3. **Firmar APK** (en Android Studio):
   - Build → Generate Signed Bundle / APK
   - Selecciona el keystore creado
   - Build type: release

---

## 📞 Ayuda

Si encuentras problemas:
1. Asegúrate de tener Android Studio actualizado
2. Verifica que Java 8+ esté instalado
3. Limpia el proyecto: `./gradlew clean`
4. Revisa los logs en Android Studio

¡Tu APK de ServiMap estará listo en pocos minutos! 🎉