# Test de la función addToWallet

## Ejemplo de uso

```javascript
// Llamada a la función desde el cliente
const addToWallet = firebase.functions().httpsCallable('addToWallet');

// Agregar comisión
const result1 = await addToWallet({
  userId: "user_123",
  amount: 50.00,
  type: "commission",
  description: "Comisión por referir usuario Premium",
  sourceId: "commission_789"
});

// Agregar bonificación
const result2 = await addToWallet({
  userId: "user_123", 
  amount: 25.00,
  type: "bonus",
  description: "Bonus por lealtad - 10 servicios completados",
  sourceId: "loyalty_bonus_456"
});

// Agregar reembolso
const result3 = await addToWallet({
  userId: "user_123",
  amount: 100.00, 
  type: "refund",
  description: "Reembolso por servicio cancelado",
  sourceId: "service_request_321"
});

console.log(result1.data);
```

## Casos de prueba esperados

### Caso 1: Primera transacción (wallet nuevo)
- Usuario sin wallet previo
- Se crea wallet con saldo inicial = amount
- Se establecen límites por defecto
- Se inicializan totales acumulados

### Caso 2: Agregar comisión
- Actualiza `saldoActual` y `totalAcumuladoComisiones`
- Tipo: "commission" 
- Concepto: "Comisión"
- Notificación: "¡Comisión Recibida!"

### Caso 3: Agregar bonificación
- Actualiza `saldoActual` y `totalAcumuladoBonificaciones`
- Tipo: "bonus"
- Concepto: "Bonificación" 
- Notificación: "¡Bonificación Recibida!"

### Caso 4: Agregar reembolso
- Actualiza `saldoActual` y `totalAcumuladoReembolsos`
- Tipo: "refund"
- Concepto: "Reembolso"
- Notificación: "¡Reembolso Procesado!"

## Estructura de datos actualizada

### Colección "wallets" (actualizada)
```firestore
{
  userId: "user_123",
  saldoActual: 175.00, // saldo acumulado total
  ultimaActualizacion: timestamp,
  saldoBloqueado: 0,
  limiteDiario: 10000,
  limiteRetiro: 5000,
  totalAcumuladoBonificaciones: 25.00, // solo bonificaciones
  totalAcumuladoComisiones: 50.00,     // solo comisiones  
  totalAcumuladoReembolsos: 100.00     // solo reembolsos
}
```

### Colección "wallet_transactions" (nueva transacción)
```firestore
{
  userId: "user_123",
  tipo: "credito",
  monto: 50.00,
  concepto: "Comisión",
  descripcion: "Comisión por referir usuario Premium",
  fecha: timestamp,
  referenciaId: "commission_789",
  referenciaType: "commission",
  saldoAnterior: 125.00,
  saldoNuevo: 175.00,
  metadata: {
    type: "commission",
    sourceId: "commission_789",
    addedViaFunction: "addToWallet"
  }
}
```

## Funcionalidades clave

### 1. Transacciones atómicas
- Usa Firestore transactions para consistencia
- Actualiza wallet y crea transacción en una sola operación

### 2. Totales acumulados por tipo
- Permite analytics y reportes segmentados
- Útil para calcular bonificaciones de lealtad

### 3. Notificaciones automáticas
- Push notification inmediata al usuario
- Título personalizado según el tipo

### 4. Validaciones robustas
- Verifica existencia del usuario
- Valida tipos de transacción permitidos
- Monto debe ser positivo

### 5. Historial completo
- Cada transacción se registra con saldo anterior/nuevo
- Metadata para trazabilidad
- Logs de actividad del sistema

## Diferencias vs creditToWallet

- `addToWallet`: Función pública callable, con validaciones de auth
- `creditToWallet`: Función interna helper, sin validaciones de usuario
- `addToWallet`: Totales acumulados por tipo
- `addToWallet`: Notificaciones automáticas al usuario