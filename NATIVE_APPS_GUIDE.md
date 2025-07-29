# 📱 Guía Completa: Apps Nativas de ServiMap

## 🚀 Estado Actual

✅ **Capacitor configurado y listo**
✅ **Proyectos Android e iOS generados**
✅ **PWA sincronizada con las apps nativas**

---

## 🤖 Android - Generar APK

### Requisitos Previos
- Android Studio instalado
- JDK 11 o superior
- Android SDK configurado

### Pasos para Generar el APK:

#### 1. Abrir el proyecto en Android Studio
```bash
# En tu terminal local (no en Codespaces)
cd servimap-firebase-functions
npx cap open android
```

#### 2. Configurar el Gradle (si es necesario)
El proyecto ya está configurado, pero verifica:
- `android/app/build.gradle` tiene el applicationId correcto: `com.servimap.app`
- minSdkVersion: 22
- targetSdkVersion: 34

#### 3. Generar APK Debug
En Android Studio:
1. Build → Build Bundle(s) / APK(s) → Build APK(s)
2. El APK se generará en: `android/app/build/outputs/apk/debug/app-debug.apk`

#### 4. Generar APK Release (Firmado)
1. Build → Generate Signed Bundle / APK
2. Selecciona APK
3. Crea un nuevo Key Store (primera vez):
   - Key store path: Guárdalo en lugar seguro
   - Password: Usa una contraseña fuerte
   - Alias: servimap-release
   - Validity: 25 años
4. Completa la información del certificado
5. Build Type: release
6. Click "Finish"

#### 5. Instalar en Dispositivo
```bash
# Conecta tu dispositivo Android con USB debugging activado
adb install android/app/build/outputs/apk/release/app-release.apk
```

### 📦 Archivos Generados:
- **Debug APK**: `app-debug.apk` (~30MB)
- **Release APK**: `app-release.apk` (~20MB)
- **AAB para Play Store**: Usa Build → Generate Signed Bundle

---

## 🍎 iOS - Generar IPA

### Requisitos Previos
- Mac con macOS
- Xcode 15+ instalado
- Apple Developer Account (para testing en dispositivo real)
- CocoaPods instalado

### Pasos para Configurar iOS:

#### 1. Instalar Dependencias
```bash
# En tu Mac
cd ios/App
pod install
```

#### 2. Abrir en Xcode
```bash
npx cap open ios
# O manualmente: open ios/App/App.xcworkspace
```

#### 3. Configurar el Proyecto
En Xcode:
1. Selecciona el proyecto "App" en el navegador
2. En "Signing & Capabilities":
   - Team: Selecciona tu Apple Developer Team
   - Bundle Identifier: com.servimap.app
   - Activa "Automatically manage signing"

#### 4. Configurar Capacidades
Agrega las siguientes capacidades:
- Push Notifications
- Background Modes → Remote notifications
- Associated Domains (para deep links)

#### 5. Compilar para Dispositivo
1. Conecta tu iPhone
2. Selecciona tu dispositivo en el selector
3. Product → Run (⌘R)

#### 6. Generar IPA para TestFlight
1. Product → Archive
2. Window → Organizer
3. Selecciona el archive → Distribute App
4. App Store Connect → Upload
5. Sigue el asistente

### 📲 Testing sin Apple Developer Account
Para probar en tu iPhone sin cuenta de desarrollador:
1. Xcode → Preferences → Accounts
2. Agrega tu Apple ID personal
3. En Signing, selecciona "Personal Team"
4. La app funcionará por 7 días en tu dispositivo

---

## 🧪 Testing y Distribución

### Android - Distribución Beta
1. **Google Play Console** (recomendado):
   - Sube el AAB a Internal Testing
   - Invita testers por email
   
2. **Firebase App Distribution**:
   ```bash
   npm install -g firebase-tools
   firebase appdistribution:distribute app-release.apk \
     --app YOUR_FIREBASE_APP_ID \
     --groups "beta-testers"
   ```

3. **APK Directo**:
   - Sube el APK a Google Drive
   - Comparte el link con testers

### iOS - Distribución Beta
1. **TestFlight** (recomendado):
   - Sube a App Store Connect
   - Invita hasta 10,000 testers
   - No requiere revisión para beta

2. **Ad Hoc Distribution**:
   - Requiere UDIDs de dispositivos
   - Máximo 100 dispositivos

---

## 📝 Checklist Pre-Lanzamiento

### Ambas Plataformas
- [ ] Logo y splash screen actualizados
- [ ] Nombre de app correcto
- [ ] Versión actualizada (1.0.0)
- [ ] Permisos necesarios configurados
- [ ] Deep links configurados
- [ ] Push notifications configuradas

### Android Específico
- [ ] Keystore seguro y respaldado
- [ ] ProGuard/R8 configurado
- [ ] minSdkVersion apropiado
- [ ] Iconos adaptivos
- [ ] Play Store listing preparado

### iOS Específico
- [ ] Provisioning profiles correctos
- [ ] Capacidades habilitadas
- [ ] Info.plist completo
- [ ] App Store listing preparado
- [ ] Screenshots para todos los tamaños

---

## 🆘 Troubleshooting

### Android
**Error: SDK location not found**
```bash
echo "sdk.dir=/Users/TU_USUARIO/Library/Android/sdk" > android/local.properties
```

**Error: Gradle sync failed**
```bash
cd android
./gradlew clean
./gradlew build
```

### iOS
**Error: No such module 'Capacitor'**
```bash
cd ios/App
pod deintegrate
pod install
```

**Error: Signing requires a development team**
- Agrega tu Apple ID en Xcode
- Selecciona un team en Signing & Capabilities

---

## 🚀 Comandos Útiles

```bash
# Actualizar cambios en las apps
npx cap sync

# Solo copiar archivos web
npx cap copy

# Abrir en IDE
npx cap open android
npx cap open ios

# Ver logs en desarrollo
npx cap run android -l --external
npx cap run ios -l --external

# Limpiar y reconstruir
npx cap sync --inline
```

---

## 📱 Capturas de Pantalla

Las apps nativas incluyen:
- ✅ Splash screen nativo
- ✅ Ícono de app
- ✅ Soporte para notificaciones push
- ✅ Acceso a cámara y ubicación
- ✅ Funciona offline
- ✅ Performance nativa

---

## 🎯 Próximos Pasos

1. **Android**: Genera el APK siguiendo los pasos anteriores
2. **iOS**: Configura en Xcode con tu Mac
3. **Testing**: Distribuye a beta testers
4. **Feedback**: Recopila y mejora
5. **Lanzamiento**: Publica en las tiendas

¡ServiMap está listo para convertirse en apps nativas! 🎉