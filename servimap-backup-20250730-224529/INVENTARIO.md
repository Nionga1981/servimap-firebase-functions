# 📋 ServiMap - Inventario de Backup

**Fecha de backup:** Wed Jul 30 22:45:29 UTC 2025
**Versión:** Sistema completo con moderación IA y verificación de identidad

## 🗂️ Estructura del Proyecto

### 📁 Configuración Principal
- `firebase.json` - Configuración de Firebase
- `firestore.rules` - Reglas de seguridad de Firestore
- `firestore.indexes.json` - Índices optimizados
- `storage.rules` - Reglas de Firebase Storage
- `DEPLOY_PRODUCTION_GUIDE.md` - Guía completa de despliegue

### ☁️ Cloud Functions (`/functions/`)
- `index.js` - Exportador principal de funciones
- `package.json` - Dependencias (incluye @stream-io/node-sdk)

#### 🤖 Sistema de Moderación (`/functions/src/moderacion/`)
- `ia-moderador.js` - Moderación con OpenAI GPT-4 Vision
  - Moderación de chat en tiempo real
  - Validación de imágenes y documentos
  - Verificación automática de identidad
  - Sistema de cola de moderación

#### 👥 Gestión de Prestadores (`/functions/src/prestadores/`)
- `clasificacion.js` - Clasificación automática de categorías (14 categorías)
- `disponibilidad.js` - Control de disponibilidad y horarios

#### 📹 Videollamadas (`/functions/src/videollamadas/`)
- `stream-video.js` - Integración completa con Stream Video
  - Cotizaciones con videollamada
  - Servicios online
  - Tokens seguros con expiración

#### 🔔 Notificaciones (`/functions/src/notificaciones/`)
- `push-notifications.js` - Sistema completo de notificaciones push
  - Notificaciones a moderadores
  - Notificaciones de cambio de estado
  - Resumen diario automatizado

### 🎨 Frontend (`/public/`)

#### 📄 HTML
- `registro-prestador.html` - Registro guiado de 9 pasos con verificación de identidad
- `videollamada.html` - Interfaz completa de videollamada con chat moderado
- `admin-moderacion.html` - Panel de administración para moderación

#### 📜 JavaScript (`/public/js/`)
- `registro-prestador.js` - Lógica del registro con validaciones y IA
- `videollamada.js` - Cliente de Stream Video con moderación
- `admin-moderacion.js` - Panel de administración en tiempo real

## 🔑 Funcionalidades Implementadas

### ✅ Moderación con IA
- Chat en videollamadas moderado automáticamente
- Validación de imágenes con GPT-4 Vision
- Verificación de documentos de identidad
- Panel de administración completo

### ✅ Verificación de Identidad
- Paso obligatorio en registro
- Documentos oficiales validados por IA
- Almacenamiento seguro privado
- Estados: verificado/pendiente/rechazado

### ✅ Sistema de Videollamadas
- Stream Video con credenciales reales configuradas
- Chat moderado en tiempo real
- Cotizaciones y servicios online
- Controles completos de media

### ✅ Registro de Prestadores
- 9 pasos guiados con validaciones
- Clasificación automática con IA
- Upload seguro de archivos
- Vista previa antes de publicar

## 🚀 Para Restaurar el Proyecto

1. Copiar todos los archivos a tu directorio de proyecto
2. Instalar dependencias: `cd functions && npm install`
3. Verificar variables de entorno (ya configuradas ✅):
   ```bash
   firebase functions:config:get
   # OpenAI API key y Stream Video ya están configuradas
   ```
4. Crear administradores en Firestore colección `admins`
5. Desplegar: `firebase deploy`

## 📊 URLs de la Aplicación
- Registro: `/registro-prestador.html`
- Moderación: `/admin-moderacion.html`
- Videollamada: `/videollamada.html?serviceId=XXX`

**¡Proyecto 100% completo y listo para producción! 🎉**
