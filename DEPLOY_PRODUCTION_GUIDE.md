# 🚀 ServiMap - Guía de Despliegue a Producción

## 📋 Sistema Completo Implementado

### ✅ Funcionalidades Completadas

1. **Sistema de Moderación con IA**
   - Moderación automática de mensajes de chat
   - Validación de imágenes y documentos
   - Verificación de identidad con IA (OpenAI GPT-4 Vision)
   - Panel de administración completo

2. **Verificación de Identidad**
   - Upload seguro de documentos oficiales
   - Validación automática con IA
   - Almacenamiento seguro en carpeta privada
   - Estados: verificado/pendiente_revision/rechazado

3. **Sistema de Videollamadas**
   - Integración completa con Stream Video
   - Moderación de chat en tiempo real
   - Soporte para cotizaciones y servicios online

4. **Registro de Prestadores**
   - Formulario guiado de 9 pasos
   - Clasificación automática de categorías
   - Upload de portafolio y documentos
   - Validación de disponibilidad

## 🔧 Configuración de Producción

### 1. Variables de Entorno

Configurar en Firebase Functions:

```bash
# OpenAI para moderación con IA
firebase functions:config:set openai.api_key="tu_openai_api_key"

# Stream Video
firebase functions:config:set stream.api_key="t9bm8kwcqcw6"
firebase functions:config:set stream.secret="fzwr9zkd788qmk9n6vutemtn4eyar8a7vv8vk2kf3d75akrbudg69zzyfjeaawf3"
firebase functions:config:set stream.app_id="1409820"
```

### 2. Dependencias

Instalar dependencias del proyecto:

```bash
cd functions
npm install
```

El `package.json` incluye:
- `@stream-io/node-sdk`: Para videollamadas
- `firebase-admin` y `firebase-functions`: Core de Firebase
- `axios`: Para llamadas HTTP a OpenAI

### 3. Reglas de Seguridad

Las reglas de Firestore y Storage ya están configuradas para:
- Proteger documentos de identidad (carpeta `/secure/`)
- Controlar acceso a moderación (solo administradores)
- Validar permisos de usuarios y prestadores

### 4. Estructura de Firestore

```
├── prestadores/
│   ├── {uid}/
│   │   ├── verificacionIdentidad: { estado, tipoDocumento, pais, fechaVerificacion }
│   │   ├── moderacion: { estado, resultados, fechaModeracion }
│   │   └── ... (otros campos del prestador)
├── cola_moderacion/
│   ├── {docId}/
│   │   ├── tipo: "verificacion_identidad" | "contenido_prestador" | "imagen" | "mensaje_chat"
│   │   ├── estado: "pendiente" | "aprobado" | "rechazado"
│   │   ├── prioridad: "alta" | "media" | "baja"
│   │   └── datos: { ... información específica }
├── verificaciones_identidad/
│   └── {docId}/ (solo admin puede leer)
├── moderacion_mensajes/
├── moderacion_imagenes/
├── notificaciones/
└── admins/ (para verificar permisos)
```

### 5. Storage Structure

```
├── {userId}/
│   ├── portafolio/ (público para usuarios autenticados)
│   ├── videos/ (público para usuarios autenticados)
│   └── documentos/ (público para usuarios autenticados)
├── secure/
│   └── {userId}/
│       └── documentos_identidad/ (solo admin puede leer)
├── servicios/{serviceId}/ (participantes del servicio)
├── moderacion/ (solo admin)
└── temp/{userId}/ (archivos temporales)
```

## 🔐 Configuración de Administradores

Para crear un administrador:

```javascript
// En la consola de Firebase Firestore, crear documento:
// Colección: admins
// Documento ID: {uid_del_admin}
// Datos: { role: "admin", createdAt: timestamp }
```

## 📱 URLs de la Aplicación

- **Registro de prestador**: `/registro-prestador.html`
- **Panel de moderación**: `/admin-moderacion.html` (solo admins)
- **Videollamada**: `/videollamada.html?serviceId=XXX&type=cotizacion|servicio`

## 🤖 Funciones Cloud Desplegadas

### Moderación con IA
- `moderarMensajeChat(mensaje, serviceId)`
- `moderarImagen(imageUrl, contexto, prestadorId)`
- `verificarDocumentoIdentidad(imageUrl, tipoDocumento, pais)`
- `moderarContenidoPrestador` (trigger automático)

### Gestión de Prestadores
- `registrarPrestador(datosCompletos)`
- `clasificarCategoriaPorDescripcion(descripcion)`
- `actualizarPerfilPrestador(actualizaciones)`

### Disponibilidad
- `toggleDisponibilidad(disponible, motivoPausa)`
- `obtenerEstadoDisponibilidad(prestadorId)`
- `verificarHorariosDisponibilidad` (scheduled - cada 15 min)

### Videollamadas
- `crearVideollamadaCotizacion(serviceId, prestadorId, clienteId)`
- `crearVideollamadaOnline(serviceId)`
- `terminarVideollamada(serviceId)`
- `streamVideoWebhook` (webhook de Stream)

### Notificaciones
- `notificarModeradoresNuevoElemento` (trigger automático)
- `notificarCambioEstadoModeracion` (trigger automático)
- `notificarElementoAltaPrioridad(elementoId, mensaje)`
- `enviarResumenDiarioModeracion` (scheduled - diario 8 AM)

## 🚀 Comandos de Despliegue

```bash
# Desplegar todo
firebase deploy

# Solo funciones
firebase deploy --only functions

# Solo reglas de seguridad
firebase deploy --only firestore:rules,storage

# Solo hosting
firebase deploy --only hosting
```

## 📊 Monitoreo y Logs

### Logs importantes a monitorear:
- Errores de moderación con IA
- Fallos en verificación de identidad
- Tokens FCM inválidos
- Errores en videollamadas de Stream

### Métricas clave:
- Tiempo de respuesta de moderación IA
- Precisión de verificación de documentos
- Tasa de éxito de videollamadas
- Elementos en cola de moderación

## 🔒 Consideraciones de Seguridad

### 1. Documentos de Identidad
- Se almacenan en carpeta `/secure/` con acceso restringido
- Solo administradores pueden leer documentos de identidad
- IA procesa pero no almacena datos sensibles
- Compliance con GDPR y protección de datos

### 2. Moderación
- Logs de moderación solo accesibles por admin
- Contenido inapropiado se elimina automáticamente
- Historial de acciones de moderación

### 3. API Keys
- OpenAI API key en variables de entorno
- Stream Video credentials seguros
- Rotación periódica recomendada

## 🧪 Testing en Producción

### 1. Test de Moderación
```javascript
// Probar moderación de mensajes
const moderarFn = firebase.functions().httpsCallable('moderarMensajeChat');
const result = await moderarFn({
    mensaje: "Mensaje de prueba",
    serviceId: "test_service_id"
});
```

### 2. Test de Verificación de Identidad
- Subir documento de prueba
- Verificar que IA procesa correctamente
- Confirmar que estado se actualiza

### 3. Test de Videollamadas
- Crear videollamada de prueba
- Verificar tokens de Stream
- Probar moderación de chat

## 📈 Escalabilidad

### Límites actuales:
- OpenAI: 3,500 requests/min (Tier 1)
- Stream Video: Según plan contratado
- Firebase Functions: 1,000 ejecuciones concurrentes

### Optimizaciones implementadas:
- Batch processing para moderación
- Caché de resultados de clasificación
- Cleanup automático de tokens inválidos
- Índices geográficos para búsquedas

## 🆘 Troubleshooting

### Problema: Moderación IA no funciona
- Verificar OpenAI API key
- Revisar logs de Cloud Functions
- Confirmar formato de requests

### Problema: Videollamadas fallan
- Verificar Stream Video credentials
- Revisar tokens de sesión
- Confirmar permisos de usuarios

### Problema: Upload de documentos falla
- Verificar reglas de Storage
- Confirmar tamaños de archivo
- Revisar permisos de carpeta secure/

---

## ✅ Checklist Final de Despliegue

- [ ] Variables de entorno configuradas
- [ ] Reglas de seguridad desplegadas
- [ ] Cloud Functions desplegadas
- [ ] Administradores creados en Firestore
- [ ] OpenAI API key válida y con créditos
- [ ] Stream Video credentials verificadas
- [ ] Tests de funcionalidades críticas ejecutados
- [ ] Monitoreo configurado
- [ ] Documentación de APIs actualizada

¡Tu aplicación ServiMap está lista para producción! 🎉