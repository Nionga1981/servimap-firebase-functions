# 🗺️ ServiMapp - Guía Rápida para Claude Code

## 📋 Contexto del Proyecto
**ServiMapp** es una plataforma de servicios profesionales geolocalizados con 200+ funcionalidades.
- **Stack:** React + Firebase + Stream Video + OpenAI + Stripe
- **Estado:** 100% funcional en producción
- **URL Producción:** https://servimap-nyniz.web.app
- **Repo Principal:** https://github.com/Nionga1981/servimap-firebase-functions
- **Rama Desarrollo:** master (branch principal para desarrollo activo)

## 🎯 Arquitectura Resumida

### Backend: 85+ Cloud Functions
- **Búsqueda con IA** - Interpretación en lenguaje natural
- **Pagos y Wallet** - Stripe + comisiones multinivel
- **Comunidades** - Sistema social geolocalizado  
- **Videollamadas** - Stream Video integrado
- **Moderación IA** - OpenAI para contenido y verificación
- **Premium** - Analytics y funciones avanzadas
- **Embajadores** - Sistema de referidos con comisiones

### Frontend: 80+ Componentes React
- **PWA completa** con capacidades nativas
- **Material Design 3** con tema personalizado (#209ded)
- **Apps móviles** Android/iOS con Capacitor
- **Shadcn/ui** para componentes base
- **Next.js 14** como framework principal

## 🚀 Comandos Esenciales

```bash
# Desarrollo
npm run dev                    # Frontend desarrollo
cd functions && npm run serve  # Functions local

# Build
npm run build                  # Frontend producción
cd functions && npm run build  # Compilar functions

# Deploy
firebase deploy --only hosting    # Solo frontend
firebase deploy --only functions  # Solo backend
bash DEPLOY_FINAL.sh             # Deploy completo

# Mobile
npm run android:build          # Build Android
npm run ios:build             # Build iOS
```

## 📁 Estructura Clave

```
/
├── src/                # Frontend React
│   ├── components/     # 80+ componentes
│   ├── app/           # Páginas Next.js
│   └── lib/           # Firebase y servicios
├── functions/         # Cloud Functions
│   └── src/          # 85+ funciones TypeScript
├── public/           # Assets y HTML estáticos
├── android/          # App Android
└── ios/             # App iOS
```

## ⚠️ Configuraciones Importantes

### Versiones
- **Node Frontend:** 18+
- **Node Functions:** 22
- **TypeScript:** Modo permisivo (strict: false)

### Firebase
- **Project ID:** servimap-nyniz
- **Región:** us-central1
- **Admin:** admin@servimap.com / AdminServi2024!

### Desarrollo Local
- **Variables de Entorno:** Configuradas en `.env.local` (ver `GUIA_DESARROLLO_LOCAL.md`)
- **Instalación:** Siempre usar `npm install --legacy-peer-deps`

## 🔧 Problemas Comunes y Soluciones

1. **Error de versiones Node:**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Firebase Admin no inicializado:**
   - Ya corregido con inicialización condicional en todos los módulos

3. **Deploy desde Codespaces:**
   - Usar GitHub Actions o scripts locales

## 📚 Documentación Adicional

Para información detallada consultar:
- `GUIA_DESARROLLO_LOCAL.md` - **Guía paso a paso para nuevos desarrolladores** (configuración desde cero)
- `CLAUDE_DETALLE.md` - Documentación completa del proyecto (1000+ líneas)
- `VERSIONES_PROYECTO.md` - Versiones y compatibilidad detallada
- `SERVIMAP_DESIGN_SYSTEM.md` - Sistema de diseño UI/UX completo

## 🎯 Estado Actual (Agosto 2025)

✅ **Completado:**
- 85+ Cloud Functions desplegadas
- 200+ funcionalidades activas
- Sistema de diseño Material Design 3
- PWA y apps móviles configuradas
- Panel admin funcional
- Moderación con IA operativa
- Guía completa de desarrollo local para nuevos colaboradores

🚧 **Pendiente:**
- Publicación en App Store/Play Store
- Documentación para usuarios finales
- Tests automatizados
- CI/CD pipeline completo

## 💡 Tips para Claude Code

1. **Siempre verificar** el estado actual con `git status`
2. **No crear archivos** innecesarios, preferir editar existentes
3. **Usar TodoWrite** para tareas complejas
4. **Compilar antes de deploy:** `cd functions && npm run build`
5. **Para configuración inicial** seguir `GUIA_DESARROLLO_LOCAL.md`
6. **Para más contexto** revisar CLAUDE_DETALLE.md si es necesario

## 👥 Para Nuevos Desarrolladores

**IMPORTANTE:** Si eres un nuevo desarrollador, comienza por:
1. Leer `GUIA_DESARROLLO_LOCAL.md` - Contiene TODO lo necesario para empezar
2. Incluye las variables de entorno reales necesarias para compilar
3. Soluciones a problemas comunes de instalación
4. Proceso paso a paso desde cero hasta tener el proyecto funcionando

---
*Última actualización: Agosto 2025 - Agregada guía completa para desarrolladores*