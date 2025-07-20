# Test de la función processWalletPayment

## Ejemplo de uso

```javascript
// Llamada a la función desde el cliente para pagar con wallet
const processWalletPayment = firebase.functions().httpsCallable('processWalletPayment');

const result = await processWalletPayment({
  userId: "user_123",
  amount: 150.00,
  serviceRequestId: "service_456",
  description: "Pago por servicio de limpieza doméstica"
});

console.log(result.data);
```

## Casos de prueba esperados

### Caso 1: Pago exitoso con saldo suficiente
**Datos iniciales:**
- Saldo wallet: $200.00
- Monto a pagar: $150.00
- Gastos diarios: $50.00
- Límite diario: $500.00

**Resultado esperado:**
- ✅ Pago procesado
- Nuevo saldo: $50.00
- Total gastado: anterior + $150.00
- Gastos diarios: $200.00

### Caso 2: Saldo insuficiente
**Datos iniciales:**
- Saldo wallet: $100.00
- Monto a pagar: $150.00

**Resultado esperado:**
- ❌ Error: "Saldo insuficiente. Disponible: $100.00, Requerido: $150.00"

### Caso 3: Límite diario excedido
**Datos iniciales:**
- Saldo wallet: $1000.00
- Monto a pagar: $200.00
- Gastos diarios: $400.00  
- Límite diario: $500.00

**Resultado esperado:**
- ❌ Error: "Límite diario excedido. Límite: $500.00, Gastado hoy: $400.00"

### Caso 4: Saldo bloqueado
**Datos iniciales:**
- Saldo total: $200.00
- Saldo bloqueado: $100.00
- Saldo disponible: $100.00
- Monto a pagar: $150.00

**Resultado esperado:**
- ❌ Error: "Saldo insuficiente. Disponible: $100.00, Requerido: $150.00"

### Caso 5: Nuevo día (reset gastos diarios)
**Datos iniciales:**
- Gastos diarios: $400.00
- Último día gasto: "2025-01-18"  
- Día actual: "2025-01-19"
- Monto a pagar: $100.00

**Resultado esperado:**
- ✅ Gastos diarios se resetean a $0.00
- Nuevos gastos diarios: $100.00

## Estructura de datos actualizada

### Colección "wallets" (después del pago)
```firestore
{
  userId: "user_123",
  saldoActual: 50.00, // descontado el pago
  ultimaActualizacion: timestamp,
  saldoBloqueado: 0,
  limiteDiario: 500.00,
  limiteRetiro: 5000,
  totalAcumuladoBonificaciones: 25.00,
  totalAcumuladoComisiones: 50.00,
  totalAcumuladoReembolsos: 100.00,
  totalGastado: 350.00, // incrementado con el pago
  gastosDiarios: 200.00, // gastos del día actual
  ultimoDiaGasto: "2025-01-19"
}
```

### Colección "wallet_transactions" (transacción débito)
```firestore
{
  userId: "user_123",
  tipo: "debito",
  monto: 150.00,
  concepto: "Pago de Servicio",
  descripcion: "Pago por servicio de limpieza doméstica",
  fecha: timestamp,
  referenciaId: "service_456",
  referenciaType: "wallet_payment",
  saldoAnterior: 200.00,
  saldoNuevo: 50.00,
  metadata: {
    serviceRequestId: "service_456",
    paymentMethod: "wallet",
    noStripeFees: true,
    dailySpent: 200.00,
    totalSpent: 350.00
  }
}
```

### Colección "solicitudes_servicio" (actualizada)
```firestore
{
  // ... otros campos ...
  paymentStatus: "pagado",
  metodoPago: "wallet",
  montoCobrado: 150.00,
  walletTransactionId: "transaction_789",
  paidWithWallet: true,
  noStripeFees: true, // 🔥 VENTAJA CLAVE: Sin comisiones Stripe
  updatedAt: timestamp,
  actorDelCambioId: "user_123",
  actorDelCambioRol: "usuario"
}
```

## Ventajas clave del pago con wallet

### 1. **Sin comisiones Stripe** 🔥
- Stripe cobra ~4% por transacción
- Wallet = 0% comisiones
- Ahorro directo para ServiMap

### 2. **Experiencia de usuario mejorada**
- Pago instantáneo sin formularios
- Sin necesidad de ingresar tarjeta
- Historial centralizado en la app

### 3. **Control de gastos**
- Límites diarios configurables
- Tracking de gastos por día
- Prevención de fraude

### 4. **Analytics detallados**
- Total gastado histórico
- Gastos por tipo (servicios)
- Patrones de uso del wallet

### 5. **Transacciones atómicas**
- Garantía de consistencia
- Si falla el pago, no se descuenta
- Rollback automático en errores

## Validaciones implementadas

1. **Usuario existe** (usuarios o prestadores)
2. **Servicio existe** 
3. **Wallet existe** (debe tener saldo previo)
4. **Saldo suficiente** (considerando saldo bloqueado)
5. **Límites diarios** no excedidos
6. **Monto positivo** y válido

## Flujo completo de pago

1. Usuario selecciona "Pagar con Wallet"
2. Frontend llama `processWalletPayment`
3. Función valida saldo y límites
4. Descuenta monto del wallet atómicamente  
5. Actualiza servicio como "pagado"
6. Registra transacción débito
7. Envía notificación al usuario
8. Retorna confirmación de pago