# 🚀 INICIO RÁPIDO: Prueba ServiMap en tu Móvil AHORA

## Opción 1: Prueba Local (5 minutos)

### 1. Ejecuta este comando:
```bash
./scripts/mobile-test.sh
```

### 2. En tu móvil:
- Conecta a la misma WiFi que tu computadora
- Abre el navegador
- Ve a: `http://[TU-IP-LOCAL]:3000`
- ¡Listo! Ya puedes probar ServiMap

## Opción 2: Deploy Rápido con Vercel (10 minutos)

### 1. Instala Vercel CLI:
```bash
npm install -g vercel
```

### 2. Deploy:
```bash
vercel
```

### 3. Sigue los pasos:
- Login con GitHub/Email
- Selecciona el proyecto
- Acepta configuración por defecto
- Obtendrás una URL pública

### 4. Comparte la URL:
- Envíatela por WhatsApp
- Ábrela en cualquier móvil
- Prueba la instalación PWA

## 🧪 Qué Probar Primero

### En Android:
1. **Instalación PWA**
   - Abre en Chrome
   - Menú → "Instalar aplicación"
   - Verifica que se instale

2. **Funciones Básicas**
   - [ ] Búsqueda de servicios
   - [ ] Ver mapa
   - [ ] Cambiar a modo prestador
   - [ ] Probar el chat

3. **Permisos**
   - [ ] Ubicación GPS
   - [ ] Cámara (para fotos)
   - [ ] Notificaciones

### En iOS:
1. **Instalación PWA**
   - SOLO funciona en Safari
   - Compartir → "Añadir a inicio"

2. **Limitaciones iOS**
   - Sin notificaciones push
   - Sin instalación automática
   - Algunas APIs limitadas

## 🔍 Debug Remoto (Opcional)

### Android:
1. Activa modo desarrollador en tu móvil
2. Conecta por USB
3. En Chrome PC: `chrome://inspect`
4. Verás tu dispositivo listado

### iOS:
1. Conecta iPhone a Mac
2. Safari → Desarrollador → [Tu iPhone]
3. Inspecciona la página

## 📝 Checklist Rápido

- [ ] La app carga correctamente
- [ ] El mapa funciona
- [ ] Los botones responden al toque
- [ ] Se puede instalar como app
- [ ] El diseño se ve bien en móvil
- [ ] La navegación inferior funciona
- [ ] El modo prestador se activa

## 🚨 Problemas Comunes

### "No puedo acceder desde mi móvil"
- Verifica que estés en la misma red WiFi
- Desactiva firewall temporalmente
- Usa la IP correcta (no localhost)

### "No aparece opción de instalar"
- En Android: Usa Chrome (no otro navegador)
- En iOS: Usa Safari (no Chrome)
- Espera que cargue completamente

### "La app se ve mal"
- Actualiza a Chrome/Safari más reciente
- Limpia caché del navegador
- Revisa la consola de errores

## 💡 Siguiente Paso

Una vez probado localmente, considera:
1. Deploy en Vercel para URL permanente
2. Compartir con 5-10 beta testers
3. Recopilar feedback
4. Preparar para Google Play (TWA)