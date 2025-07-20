# ServiMap - Firestore Database Schema

## Introducción

Este documento describe la estructura completa de la base de datos Firestore para ServiMap, incluyendo todas las colecciones, campos, tipos de datos, relaciones, índices y reglas de seguridad.

## Tabla de Contenidos

- [Colecciones Principales](#colecciones-principales)
- [Sistema de Wallet](#sistema-de-wallet)
- [Sistema de Comisiones](#sistema-de-comisiones)
- [Servicios y Cotizaciones](#servicios-y-cotizaciones)
- [Logs y Auditoría](#logs-y-auditoría)
- [Configuración](#configuración)
- [Índices Compuestos](#índices-compuestos)
- [Reglas de Seguridad](#reglas-de-seguridad)

---

## Colecciones Principales

### `usuarios` Collection

Almacena la información de los usuarios cliente de la plataforma.

```typescript
interface Usuario {
  id?: string;                    // Auto-generado por Firestore
  nombre?: string;                // Nombre completo del usuario
  email?: string;                 // Email de autenticación
  fcmTokens?: string[];          // Tokens para push notifications
  isBlocked?: boolean;           // Si el usuario está bloqueado
  referidoPor?: string;          // UID del embajador que lo refirió
  membershipLevel?: "gratuito" | "premium"; // Nivel de membresía
  createdAt?: Timestamp;         // Fecha de registro
  updatedAt?: Timestamp;         // Última actualización
  
  // Campos adicionales opcionales
  telefono?: string;
  avatar?: string;
  ubicacion?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Propio usuario o admin
- ✅ Escritura: Propio usuario (campos limitados)
- ❌ No pueden modificar: `referidoPor`, `membershipLevel`

---

### `prestadores` Collection

Almacena la información de los proveedores de servicios.

```typescript
interface Prestador {
  id?: string;                    // Auto-generado por Firestore
  nombre?: string;                // Nombre completo del prestador
  email?: string;                 // Email de autenticación
  fcmTokens?: string[];          // Tokens para push notifications
  isBlocked?: boolean;           // Si el prestador está bloqueado
  isAvailable?: boolean;         // Si está disponible para servicios
  currentLocation?: {            // Ubicación actual
    lat: number;
    lng: number;
    pais?: string;
  } | null;
  rating?: number;               // Calificación promedio (0-5)
  avatarUrl?: string;            // URL de la foto de perfil
  categoryIds?: string[];        // IDs de categorías de servicios
  referidoPor?: string;          // UID del embajador que lo refirió
  createdAt?: Timestamp;         // Fecha de registro
  updatedAt?: Timestamp;         // Última actualización
  
  // Campos adicionales opcionales
  telefono?: string;
  descripcion?: string;
  serviciosOfrecidos?: string[];
  horariosTrabajo?: {
    [dia: string]: {
      inicio: string;
      fin: string;
      activo: boolean;
    };
  };
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Propio prestador o admin
- ✅ Escritura: Propio prestador (campos limitados)
- ❌ No pueden modificar: `referidoPor`, `rating`

---

## Sistema de Wallet

### `wallets` Collection

Almacena el estado del wallet de cada usuario/prestador.

```typescript
interface WalletData {
  // Campos principales (estructura base)
  userId: string;                    // UID del usuario/prestador
  balance: number;                   // Saldo actual en USD
  totalEarned: number;               // Total ganado (todos los tipos)
  totalSpent: number;                // Total gastado
  totalWithdrawn: number;            // Total retirado
  bonusesEarned: number;             // Bonos de lealtad ganados
  lastBonusAt?: Timestamp;           // Último bonus otorgado
  createdAt: Timestamp;              // Fecha de creación
  updatedAt: Timestamp;              // Última actualización
  
  // Campos avanzados (breakdown detallado)
  breakdown: {
    totalEarnedFromBonuses: number;     // Parte de totalEarned
    totalEarnedFromCommissions: number; // Parte de totalEarned
    totalEarnedFromRefunds: number;     // Parte de totalEarned
  };
  
  // Límites y configuración
  limits: {
    dailySpendingLimit: number;    // Default: 10000
    withdrawalLimit: number;       // Default: 5000
    dailySpentToday: number;       // Gastado hoy
    lastSpendingDate: string;      // YYYY-MM-DD
    blockedBalance: number;        // Saldo bloqueado
  };
  
  // Información de lealtad
  loyalty: {
    nextThreshold: number;         // 2000, 4000, 6000...
    progressToNext: number;        // Porcentaje 0-100
  };
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Propio wallet o admin
- ❌ Escritura: Solo Cloud Functions

---

### `wallet_transactions` Collection

Registro de todas las transacciones del wallet.

```typescript
interface WalletTransaction {
  id?: string;                      // Auto-generado por Firestore
  userId: string;                   // UID del usuario/prestador
  type: "commission" | "bonus" | "payment" | "withdrawal" | "refund" | "withdrawal_fee";
  amount: number;                   // Monto de la transacción
  description: string;              // Descripción legible
  sourceId?: string;                // Service ID, Membership ID, etc.
  balanceAfter: number;             // Saldo después de la transacción
  createdAt: Timestamp;             // Fecha de la transacción
  
  // Campos adicionales para compatibilidad y debugging
  balanceBefore?: number;           // Saldo antes de la transacción
  metadata?: Record<string, unknown>; // Metadata adicional
}
```

**Ejemplo de Metadata por Tipo:**

```typescript
// type: "commission"
metadata: {
  commissionType: "service" | "membership";
  sourceRequestId: string;
  ambassadorLevel: "gratuito" | "premium";
}

// type: "bonus" 
metadata: {
  bonusType: "loyalty";
  thresholdReached: number;
  bonusNumber: number;
}

// type: "withdrawal"
metadata: {
  bankDetails: {
    bankName: string;
    accountNumber: string; // Enmascarado
    country: string;
  };
  stripeFee: number;
  withdrawalId: string;
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Propio userId o admin
- ❌ Escritura: Solo Cloud Functions

---

### `loyalty_bonuses` Collection

Tracking de bonos de lealtad calculados y otorgados.

```typescript
interface LoyaltyBonusData {
  id?: string;                      // Auto-generado por Firestore
  userId: string;                   // UID del usuario
  bonusAmount: number;              // Monto del bonus ($20)
  thresholdReached: number;         // Umbral que activó el bonus ($2000)
  totalSpentAtTime: number;         // Total gastado al momento del bonus
  fecha: Timestamp;                 // Fecha de cálculo
  otorgado: boolean;                // Si ya fue otorgado al wallet
  walletTransactionId?: string;     // ID de la transacción de wallet
  fechaOtorgado?: Timestamp;        // Fecha de otorgamiento
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Propio userId o admin
- ❌ Escritura: Solo Cloud Functions

---

### `withdrawals` Collection

Registro de retiros bancarios solicitados.

```typescript
interface WithdrawalData {
  id?: string;                      // Auto-generado por Firestore
  userId: string;                   // UID del usuario
  amount: number;                   // Monto a retirar
  stripeFee: number;                // Fee cobrado por Stripe
  totalDeducted: number;            // amount + stripeFee
  bankDetails: {                    // Detalles bancarios
    bankName: string;
    accountNumber: string;
    routingNumber?: string;
    accountHolderName: string;
    accountType: "checking" | "savings";
    country: string;
    currency: string;
  };
  stripeTransferId?: string;        // ID de la transferencia de Stripe
  status: "pending" | "processing" | "completed" | "failed";
  fecha: Timestamp;                 // Fecha de solicitud
  completedAt?: Timestamp;          // Fecha de completado
  walletTransactionId?: string;     // ID de la transacción de wallet
  errorMessage?: string;            // Mensaje de error si falla
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Propio userId o admin
- ❌ Escritura: Solo Cloud Functions

---

## Sistema de Comisiones

### `commissions` Collection (NUEVA - Unificada)

Registro unificado de todas las comisiones (servicios y membresías).

```typescript
interface Commission {
  id?: string;                      // Auto-generado por Firestore
  ambassadorId: string;             // UID del embajador que recibe la comisión
  type: "service" | "membership";   // Tipo de comisión
  sourceId: string;                 // Service ID o Membership ID
  amount: number;                   // Monto de la comisión
  percentage: number;               // Porcentaje de comisión (40%, 50%, 60%, etc.)
  status: "pending" | "paid";       // Estado de la comisión
  paidAt?: Timestamp;               // Fecha de pago (si está pagada)
  createdAt: Timestamp;             // Fecha de creación
  
  // Metadata flexible para diferentes tipos
  metadata?: {
    serviceRequestId?: string;          // Para comisiones de servicio
    membershipType?: "user_premium" | "fixed_business"; // Para membresías
    ambassadorLevel?: "gratuito" | "premium";
    totalAmount?: number;               // Monto total del servicio/membresía
    originalType?: string;              // Tipo legacy para migración
    providerName?: string;              // Nombre del prestador
    [key: string]: any;                 // Permite campos adicionales
  };
}
```

**Ejemplos por Tipo:**

```typescript
// Comisión de Servicio
{
  ambassadorId: "user_123",
  type: "service",
  sourceId: "service_456", 
  amount: 36.00,
  percentage: 60,
  status: "pending",
  createdAt: Timestamp.now(),
  metadata: {
    serviceRequestId: "service_456",
    totalAmount: 1000.00,
    originalType: "servicio_completado_prestador"
  }
}

// Comisión de Membresía
{
  ambassadorId: "user_789",
  type: "membership",
  sourceId: "membership_101",
  amount: 5.00,
  percentage: 50,
  status: "paid",
  paidAt: Timestamp.now(),
  createdAt: Timestamp.now(),
  metadata: {
    membershipType: "user_premium",
    ambassadorLevel: "premium",
    totalAmount: 10.00
  }
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Propio ambassadorId o admin
- ❌ Escritura: Solo Cloud Functions

---

## Servicios y Cotizaciones

### `service_requests` Collection

Solicitudes de servicios entre usuarios y prestadores.

```typescript
interface ServiceRequest {
  id: string;                       // Auto-generado por Firestore
  usuarioId: string;                // UID del usuario cliente
  prestadorId: string;              // UID del prestador
  status: ServiceRequestStatus;     // Estado actual del servicio
  createdAt: Timestamp;             // Fecha de creación
  updatedAt?: Timestamp;            // Última actualización
  fechaFinalizacionEfectiva?: Timestamp; // Fecha real de finalización
  titulo?: string;                  // Título del servicio
  
  // Campos de auditoría
  actorDelCambioId?: string;        // Quién hizo el último cambio
  actorDelCambioRol?: "usuario" | "prestador" | "sistema" | "admin";
  
  // Calificaciones
  calificacionUsuario?: {           // Calificación del usuario al prestador
    estrellas: number;
    comentario?: string;
    fecha: Timestamp;
  };
  calificacionPrestador?: {         // Calificación del prestador al usuario
    estrellas: number;
    comentario?: string;
    fecha: Timestamp;
  };
  
  // Información de pago
  paymentStatus?: PaymentStatus;
  metodoPago?: "tarjeta" | "efectivo" | "transferencia" | "wallet";
  precio?: number;                  // Precio acordado
  montoCobrado?: number;            // Monto realmente cobrado
  paymentReleasedToProviderAt?: Timestamp;
  paidWithWallet?: boolean;         // Si se pagó con wallet
  noStripeFees?: boolean;           // Si no hay fees de Stripe
  
  // Detalles financieros (calculados por Cloud Functions)
  detallesFinancieros?: {
    montoTotalPagadoPorUsuario?: number;
    comisionSistemaPagoPct?: number;
    comisionSistemaPagoMonto?: number;
    montoNetoProcesador?: number;
    comisionAppPct?: number;
    comisionAppMonto?: number;
    aporteFondoFidelidadMonto?: number;
    montoBrutoParaPrestador?: number;
    montoFinalLiberadoAlPrestador?: number;
    fechaLiberacion?: Timestamp;
  };
  
  // Comisiones calculadas (calculadas por Cloud Functions)
  comisionesCalculadas?: {
    comisionServiMapTotal: number;
    comisionEmbajadorPrestador: number;
    comisionEmbajadorUsuario: number;
    comisionTotalPagada: number;
    comisionServiMapRetenida: number;
    embajadorPrestador?: string;
    embajadorUsuario?: string;
    fechaCalculo: Timestamp;
  };
  
  // Información del servicio
  serviceDate?: string;             // Fecha del servicio (YYYY-MM-DD)
  serviceTime?: string;             // Hora del servicio (HH:MM)
  serviceType?: "fixed" | "hourly"; // Tipo de servicio
  selectedFixedServices?: {         // Servicios fijos seleccionados
    serviceId: string;
    title: string;
    price: number;
  }[];
  totalAmount?: number;             // Monto total
  
  // Ubicación
  location?: {
    lat: number;
    lng: number;
    pais?: string;
  } | {
    customAddress: string;
  };
  
  // Otros campos
  category?: string;                // Categoría del servicio
  originatingQuotationId?: string;  // ID de cotización origen
  originatingServiceId?: string;    // ID de servicio origen
  isRecurringAttempt?: boolean;     // Si es un intento recurrente
  reactivationOfferedBy?: "usuario" | "prestador";
  userConfirmedCompletionAt?: number; // Timestamp de confirmación usuario
}

type ServiceRequestStatus =
  | "agendado"
  | "pendiente_confirmacion_usuario"
  | "confirmada_prestador"
  | "pagada"
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador"
  | "completado_por_usuario"
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "cancelada_admin"
  | "rechazada_prestador"
  | "en_disputa"
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta"
  | "cerrado_forzado_admin";

type PaymentStatus =
  | "pendiente_confirmacion_usuario"
  | "retenido_para_liberacion"
  | "liberado_al_proveedor"
  | "congelado_por_disputa"
  | "reembolsado_parcial"
  | "reembolsado_total"
  | "pendiente_cobro"
  | "procesado_exitosamente"
  | "fallido"
  | "no_aplica";
```

**Reglas de Seguridad:**
- ✅ Lectura: Usuario o prestador involucrado, admin
- ✅ Escritura: Usuario o prestador involucrado (campos limitados)
- ❌ No pueden modificar: `comisionesCalculadas`, `detallesFinancieros`, `paymentStatus`

---

### `solicitudes_cotizacion` Collection

Cotizaciones de servicios personalizados.

```typescript
interface SolicitudCotizacionData {
  id?: string;                      // Auto-generado por Firestore
  usuarioId: string;                // UID del usuario
  prestadorId: string;              // UID del prestador
  descripcionProblema: string;      // Descripción del problema/servicio
  videoUrl?: string;                // URL del video explicativo
  estado: SolicitudCotizacionEstado; // Estado de la cotización
  precioSugerido?: number;          // Precio sugerido por el prestador
  notasPrestador?: string;          // Notas del prestador
  fechaCreacion: Timestamp;         // Fecha de creación
  fechaRespuestaPrestador?: Timestamp; // Fecha de respuesta del prestador
  fechaRespuestaUsuario?: Timestamp;   // Fecha de respuesta del usuario
  tituloServicio?: string;          // Título del servicio
}

type SolicitudCotizacionEstado =
  | "pendiente_revision_prestador"
  | "precio_propuesto_al_usuario"
  | "rechazada_prestador"
  | "aceptada_por_usuario"
  | "rechazada_usuario"
  | "convertida_a_servicio"
  | "expirada";
```

**Reglas de Seguridad:**
- ✅ Lectura: Usuario o prestador involucrado, admin
- ✅ Escritura: Usuario o prestador involucrado

---

### `citas` Collection (Legacy)

Sistema legacy de citas. Se mantiene para compatibilidad.

```typescript
interface Cita {
  id?: string;                      // Auto-generado por Firestore
  clienteUid: string;               // UID del cliente
  prestadorUid: string;             // UID del prestador
  servicioId: string;               // ID del servicio
  fechaHoraCita: Timestamp;         // Fecha y hora de la cita
  ubicacion: string;                // Ubicación de la cita
  mensaje?: string;                 // Mensaje opcional del cliente
  estado: "pendiente" | "confirmada" | "rechazada" | "cancelada_usuario";
  timestampCreacion: Timestamp;     // Fecha de creación
  timestampConfirmacion?: Timestamp; // Fecha de confirmación
  fechaRechazo?: Timestamp;         // Fecha de rechazo
  paymentStatus?: string;           // Estado del pago
  ordenCobroId?: string;            // ID de la orden de cobro
  updatedAt?: Timestamp;            // Última actualización
}
```

---

## Logs y Auditoría

### `activity_logs` Collection

Registro de todas las actividades importantes del sistema.

```typescript
interface ActivityLog {
  id?: string;                      // Auto-generado por Firestore
  usuarioId: string;                // UID del usuario que realizó la acción
  prestadorId?: string;             // UID del prestador (si aplica)
  accion: ActivityLogAction;        // Tipo de acción realizada
  descripcion: string;              // Descripción legible de la acción
  fecha: Timestamp;                 // Fecha de la actividad
  referenciaId?: string;            // ID del documento relacionado
  referenciaType?: string;          // Tipo de documento relacionado
  actorRol: "usuario" | "prestador" | "sistema" | "admin"; // Rol del actor
  
  // Metadata adicional
  metadata?: Record<string, unknown>;
}

type ActivityLogAction =
  | "CAMBIO_ESTADO_SOLICITUD"
  | "SERVICIO_FINALIZADO"
  | "SERVICIO_CANCELADO"
  | "SERVICIO_EN_DISPUTA"
  | "CALIFICACION_USUARIO"
  | "CALIFICACION_PRESTADOR"
  | "SOLICITUD_CREADA"
  | "PAGO_LIBERADO"
  | "PAGO_INICIADO"
  | "PAGO_COMPLETADO"
  | "REEMBOLSO_PROCESADO"
  | "COTIZACION_PRECIO_PROPUESTO"
  | "COTIZACION_ACEPTADA_USUARIO"
  | "COTIZACION_RECHAZADA"
  | "PUNTOS_FIDELIDAD_GANADOS"
  | "FONDO_FIDELIDAD_APORTE"
  | "PROMO_APLICADA"
  | "NOTIFICACION_RECORDATORIO_PROGRAMADA"
  | "RELACION_USUARIO_PRESTADOR_ACTUALIZADA"
  | "COMISIONES_CALCULADAS"
  | "COMISION_MEMBRESIA_PROCESADA"
  | "WALLET_CREDITO_AGREGADO"
  | "WALLET_DEBITO_REALIZADO"
  | "LOYALTY_BONUS_CALCULATED"
  | "LOYALTY_BONUS_OTORGADO"
  | "WALLET_WITHDRAWAL_INITIATED"
  | "WALLET_WITHDRAWAL_COMPLETED"
  | "WALLET_WITHDRAWAL_FAILED"
  | "WALLET_BALANCE_CONSULTED";
```

**Reglas de Seguridad:**
- ✅ Lectura: Solo admin
- ❌ Escritura: Solo Cloud Functions

---

## Configuración

### `admins` Collection

Lista de administradores del sistema.

```typescript
interface Admin {
  id: string;                       // UID del usuario admin
  email: string;                    // Email del admin
  role: "super_admin" | "admin" | "moderator";
  permissions: string[];            // Lista de permisos específicos
  createdAt: Timestamp;             // Fecha de creación
  createdBy: string;                // UID de quien lo creó
  isActive: boolean;                // Si está activo
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Usuarios autenticados (para verificación)
- ❌ Escritura: Solo configuración manual

---

### `categorias` Collection

Categorías de servicios disponibles.

```typescript
interface Categoria {
  id?: string;                      // Auto-generado por Firestore
  nombre: string;                   // Nombre de la categoría
  descripcion?: string;             // Descripción de la categoría
  icono?: string;                   // URL del icono
  activa: boolean;                  // Si está activa
  orden?: number;                   // Orden de visualización
  createdAt: Timestamp;             // Fecha de creación
  updatedAt: Timestamp;             // Última actualización
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Público
- ✅ Escritura: Solo admin

---

### `promociones_fidelidad` Collection

Promociones y descuentos del sistema de fidelidad.

```typescript
interface PromocionFidelidad {
  id?: string;                      // Auto-generado por Firestore
  descripcion: string;              // Descripción de la promoción
  puntosRequeridos?: number;        // Puntos requeridos para canjear
  tipoDescuento: "porcentaje" | "monto_fijo";
  valorDescuento: number;           // Valor del descuento
  activo: boolean;                  // Si está activa
  codigoPromocional: string;        // Código para aplicar
  usosDisponibles?: number;         // Usos disponibles (null = ilimitado)
  fechaExpiracion?: Timestamp;      // Fecha de expiración
  serviciosAplicables?: string[];   // IDs de servicios aplicables
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Público
- ✅ Escritura: Solo admin

---

### `fondoFidelidad` Collection

Estado global del fondo de fidelidad.

```typescript
interface FondoFidelidad {
  id: "global";                     // Documento único
  totalAcumulado: number;           // Total acumulado en el fondo
  totalDistribuido: number;         // Total ya distribuido
  saldoDisponible: number;          // Saldo disponible para bonos
  ultimaActualizacion: Timestamp;   // Última actualización
  
  // Estadísticas
  stats: {
    totalServicios: number;         // Total de servicios que aportaron
    promedioAportePorServicio: number;
    ultimoAporte: {
      monto: number;
      servicioId: string;
      fecha: Timestamp;
    };
  };
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Solo admin
- ❌ Escritura: Solo Cloud Functions

---

### `recordatorios` Collection

Recordatorios programados del sistema.

```typescript
interface Recordatorio {
  id?: string;                      // Auto-generado por Firestore
  usuarioId: string;                // UID del usuario
  servicioId: string;               // ID del servicio relacionado
  tipo: "recordatorio_servicio";    // Tipo de recordatorio
  mensaje: string;                  // Mensaje del recordatorio
  fechaProgramada: Timestamp;       // Fecha programada para envío
  enviado: boolean;                 // Si ya fue enviado
  datosAdicionales?: {              // Datos adicionales
    tituloServicio?: string;
    nombrePrestador?: string;
    fechaHoraServicioIso?: string;
  };
}
```

**Reglas de Seguridad:**
- ✅ Lectura: Propio usuarioId o admin
- ❌ Escritura: Solo Cloud Functions

---

## Subcolecciones

### `usuarios/{userId}/historial_puntos` Subcollection

Historial de puntos de fidelidad del usuario.

```typescript
interface HistorialPuntoUsuario {
  id?: string;                      // Auto-generado por Firestore
  servicioId?: string;              // ID del servicio relacionado
  promocionId?: string;             // ID de la promoción relacionada
  tipo: "ganados" | "canjeados";    // Tipo de movimiento
  puntos: number;                   // Cantidad de puntos
  fecha: Timestamp;                 // Fecha del movimiento
  descripcion?: string;             // Descripción del movimiento
}
```

### `usuarios/{userId}/fcm_tokens` y `prestadores/{providerId}/fcm_tokens` Subcollections

Tokens FCM para push notifications.

```typescript
interface FCMToken {
  id?: string;                      // Auto-generado por Firestore
  token: string;                    // Token FCM
  deviceId?: string;                // ID del dispositivo
  platform?: "ios" | "android" | "web";
  createdAt: Timestamp;             // Fecha de creación
  lastUsed: Timestamp;              // Última vez usado
  isActive: boolean;                // Si está activo
}
```

---

## Índices Compuestos

Los siguientes índices compuestos están configurados para optimizar las consultas más comunes:

### Wallet Transactions
- `userId` (ASC) + `createdAt` (DESC) - Para historial de transacciones
- `userId` (ASC) + `type` (ASC) + `createdAt` (DESC) - Para filtrar por tipo

### Commissions
- `ambassadorId` (ASC) + `status` (ASC) + `createdAt` (DESC) - Para dashboard de embajador
- `ambassadorId` (ASC) + `type` (ASC) + `createdAt` (DESC) - Para filtrar por tipo

### Loyalty Bonuses
- `userId` (ASC) + `otorgado` (ASC) + `fecha` (DESC) - Para bonos pendientes

### Withdrawals
- `userId` (ASC) + `status` (ASC) + `fecha` (DESC) - Para estado de retiros

### Service Requests
- `usuarioId` (ASC) + `status` (ASC) + `createdAt` (DESC) - Para servicios de usuario
- `prestadorId` (ASC) + `status` (ASC) + `createdAt` (DESC) - Para servicios de prestador

### Activity Logs
- `accion` (ASC) + `fecha` (DESC) - Para filtrar por tipo de acción
- `usuarioId` (ASC) + `fecha` (DESC) - Para actividad de usuario

### Citas (Legacy)
- `clienteUid` (ASC) + `estado` (ASC) + `fechaHoraCita` (ASC) - Para citas de cliente
- `prestadorUid` (ASC) + `estado` (ASC) + `fechaHoraCita` (ASC) - Para citas de prestador

---

## Reglas de Seguridad

### Principios de Seguridad

1. **Autenticación Requerida**: Todas las operaciones requieren usuario autenticado
2. **Principio de Menor Privilegio**: Los usuarios solo pueden acceder a sus propios datos
3. **Cloud Functions Only**: Datos críticos solo pueden ser modificados por Cloud Functions
4. **Admin Override**: Los administradores tienen acceso completo de lectura

### Reglas por Colección

#### Usuarios y Prestadores
- ✅ **Lectura**: Propio documento o admin
- ✅ **Escritura**: Propio documento (campos limitados)
- ❌ **Campos Protegidos**: `referidoPor`, `membershipLevel`, `rating`

#### Sistema de Wallet (wallets, wallet_transactions, loyalty_bonuses, withdrawals)
- ✅ **Lectura**: Propio userId o admin
- ❌ **Escritura**: Solo Cloud Functions

#### Sistema de Comisiones (commissions)
- ✅ **Lectura**: Propio ambassadorId o admin
- ❌ **Escritura**: Solo Cloud Functions

#### Servicios (service_requests, solicitudes_cotizacion)
- ✅ **Lectura**: Usuario o prestador involucrado, admin
- ✅ **Escritura**: Usuario o prestador involucrado (campos limitados)
- ❌ **Campos Protegidos**: `comisionesCalculadas`, `detallesFinancieros`, `paymentStatus`

#### Logs y Auditoría (activity_logs)
- ✅ **Lectura**: Solo admin
- ❌ **Escritura**: Solo Cloud Functions

#### Configuración (categorias, promociones_fidelidad)
- ✅ **Lectura**: Público
- ✅ **Escritura**: Solo admin

#### Datos Críticos (fondoFidelidad, recordatorios)
- ✅ **Lectura**: Admin (fondoFidelidad) / Propio usuario (recordatorios)
- ❌ **Escritura**: Solo Cloud Functions

---

## Constantes del Sistema

```typescript
// Porcentajes de comisión
export const COMISION_SISTEMA_PAGO_PORCENTAJE = 0.04;        // 4% fee procesador
export const COMISION_APP_SERVICIOMAP_PORCENTAJE = 0.06;     // 6% comisión app
export const PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD = 0.1; // 10% al fondo
export const PORCENTAJE_COMISION_EMBAJADOR = 0.05;           // 5% de la app fee

// Sistema de lealtad
export const LOYALTY_BONUS_THRESHOLD = 2000;                 // $2000 USD per bonus
export const LOYALTY_BONUS_AMOUNT = 20;                      // $20 USD bonus

// Otros
export const FACTOR_CONVERSION_PUNTOS = 10;                  // Factor de conversión puntos
export const HORAS_ANTES_RECORDATORIO_SERVICIO = 24;         // Horas antes del recordatorio
```

---

## Migraciones y Compatibilidad

### Colecciones Legacy (En Proceso de Migración)

1. **`comisiones`** → **`commissions`**
   - Status: ✅ Migrado
   - Todas las comisiones de servicios ahora usan la colección unificada

2. **`membership_commissions`** → **`commissions`**
   - Status: ✅ Migrado
   - Comisiones de membresía integradas en colección unificada

3. **Campos de Wallet Legacy**
   - Status: ✅ Migrado
   - `saldoActual` → `balance`
   - `ultimaActualizacion` → `updatedAt`
   - `totalAcumuladoBonificaciones` → `breakdown.totalEarnedFromBonuses`

### Estrategia de Migración

1. **Fase 1**: Crear nuevas estructuras (✅ Completado)
2. **Fase 2**: Actualizar Cloud Functions (✅ Completado)
3. **Fase 3**: Migrar datos existentes (Pendiente)
4. **Fase 4**: Remover estructuras legacy (Futuro)

---

## Notas de Implementación

### Performance
- Usar índices compuestos para consultas complejas
- Limitar consultas a máximo 50 documentos por defecto
- Implementar paginación para listas largas

### Seguridad
- Validar todos los inputs en Cloud Functions
- No exponer datos sensibles en reglas de Firestore
- Logs completos para auditoría

### Escalabilidad
- Estructura de documentos optimizada para lectura
- Metadata flexible en JSON para extensibilidad
- Separación clara entre datos transaccionales y de configuración

---

Este documento debe mantenerse actualizado con cualquier cambio en la estructura de la base de datos.

**Última actualización**: Enero 2025
**Versión del Schema**: 2.0