# Test de la función processWalletWithdrawal

## Ejemplo de uso

```javascript
// Llamada a la función desde el cliente
const processWalletWithdrawal = firebase.functions().httpsCallable('processWalletWithdrawal');

// Paso 1: Mostrar fee al usuario (acceptFee = false)
const feeCheck = await processWalletWithdrawal({
  userId: "user_123",
  amount: 100,
  bankDetails: {
    bankName: "Banco de México",
    accountNumber: "1234567890",
    routingNumber: "012345678",
    accountHolderName: "Juan Pérez",
    accountType: "checking",
    country: "MX",
    currency: "MXN"
  },
  acceptFee: false
});

console.log("Fee a mostrar:", feeCheck.data);

// Paso 2: Procesar retiro si usuario acepta fee
if (userAcceptsFee) {
  const result = await processWalletWithdrawal({
    userId: "user_123",
    amount: 100,
    bankDetails: {
      bankName: "Banco de México",
      accountNumber: "1234567890",
      routingNumber: "012345678", 
      accountHolderName: "Juan Pérez",
      accountType: "checking",
      country: "MX",
      currency: "MXN"
    },
    acceptFee: true
  });
  
  console.log("Retiro procesado:", result.data);
}
```

## Casos de prueba esperados

### Caso 1: Mostrar fee al usuario (acceptFee = false)
**Datos iniciales:**
- Saldo wallet: $150.00
- Monto retiro: $100.00
- País: México (MX)

**Resultado esperado:**
```json
{
  "success": false,
  "requiresFeeAcceptance": true,
  "stripeFee": 3.50,
  "totalDeducted": 103.50,
  "feeCalculation": {
    "baseFee": 3.50,
    "percentageFee": 0.015,
    "minimumFee": 2.00,
    "maximumFee": 5.00,
    "country": "MX",
    "currency": "MXN"
  },
  "message": "Este retiro requiere un fee de $3.50. Total a descontar: $103.50"
}
```

### Caso 2: Retiro exitoso (acceptFee = true)
**Datos iniciales:**
- Saldo wallet: $150.00
- Monto retiro: $100.00
- Fee calculado: $3.50
- Usuario acepta fee

**Resultado esperado:**
```json
{
  "success": true,
  "amount": 100,
  "stripeFee": 3.50,
  "totalDeducted": 103.50,
  "newBalance": 46.50,
  "stripeTransferId": "tr_simulated_1737320000000",
  "transactionId": "transaction_789",
  "withdrawalId": "withdrawal_456",
  "message": "Retiro de $100.00 procesado exitosamente. Fee: $3.50"
}
```

### Caso 3: Saldo insuficiente incluyendo fee
**Datos iniciales:**
- Saldo wallet: $100.00
- Monto retiro: $100.00
- Fee calculado: $3.50
- Total requerido: $103.50

**Resultado esperado:**
- ❌ Error: "Saldo insuficiente. Disponible: $100.00, Requerido: $103.50 (incluyendo fee de $3.50)"

### Caso 4: Límite de retiro excedido
**Datos iniciales:**
- Saldo wallet: $6000.00
- Monto retiro: $5500.00
- Límite retiro: $5000.00

**Resultado esperado:**
- ❌ Error: "Monto excede límite de retiro. Límite: $5000.00"

### Caso 5: Datos bancarios incompletos
**Parámetros:**
```json
{
  "userId": "user_123",
  "amount": 100,
  "bankDetails": {
    "bankName": "Banco Test",
    // accountNumber faltante
    "accountHolderName": "Juan Pérez"
  },
  "acceptFee": true
}
```

**Resultado esperado:**
- ❌ Error: "Datos bancarios incompletos"

## Fees de Stripe por país

### Estados Unidos (US)
- Base: $0.25 + 0.75%
- Mínimo: $0.25
- Máximo: $5.00

### México (MX)
- Base: $2.00 + 1.5%
- Mínimo: $2.00
- Máximo: $5.00

### Canadá (CA)
- Base: $0.50 + 1%
- Mínimo: $0.50
- Máximo: $4.00

### Reino Unido (GB)
- Base: $0.25 + 0.75%
- Mínimo: $0.25
- Máximo: $4.00

## Estructura de datos creada

### Colección "withdrawals" (registro de retiro)
```firestore
{
  userId: "user_123",
  amount: 100,
  stripeFee: 3.50,
  totalDeducted: 103.50,
  bankDetails: {
    bankName: "Banco de México",
    accountNumber: "1234567890",
    routingNumber: "012345678",
    accountHolderName: "Juan Pérez",
    accountType: "checking",
    country: "MX", 
    currency: "MXN"
  },
  stripeTransferId: "tr_simulated_1737320000000",
  status: "completed",
  fecha: timestamp_iniciado,
  completedAt: timestamp_completado,
  walletTransactionId: "transaction_789"
}
```

### Colección "wallet_transactions" (2 transacciones)

**Transacción principal (retiro):**
```firestore
{
  userId: "user_123",
  tipo: "debito",
  monto: 100,
  concepto: "Retiro Bancario",
  descripcion: "Retiro a Banco de México cuenta ***7890",
  fecha: timestamp,
  referenciaId: "withdrawal_456",
  referenciaType: "withdrawal",
  saldoAnterior: 150.00,
  saldoNuevo: 50.00, // después del retiro, antes del fee
  metadata: {
    bankDetails: {
      bankName: "Banco de México",
      accountNumber: "***7890",
      country: "MX"
    },
    stripeFee: 3.50,
    totalDeducted: 103.50,
    withdrawalId: "withdrawal_456"
  }
}
```

**Transacción del fee:**
```firestore
{
  userId: "user_123",
  tipo: "debito",
  monto: 3.50,
  concepto: "Fee de Retiro",
  descripcion: "Fee de Stripe por transferencia bancaria",
  fecha: timestamp,
  referenciaId: "withdrawal_456",
  referenciaType: "withdrawal_fee",
  saldoAnterior: 50.00,
  saldoNuevo: 46.50, // saldo final
  metadata: {
    feeCalculation: {
      baseFee: 3.50,
      percentageFee: 0.015,
      minimumFee: 2.00,
      maximumFee: 5.00,
      country: "MX",
      currency: "MXN"
    },
    withdrawalId: "withdrawal_456",
    parentTransactionId: "transaction_789"
  }
}
```

### Colección "wallets" (saldo actualizado)
```firestore
{
  userId: "user_123",
  saldoActual: 46.50, // descontado monto + fee
  ultimaActualizacion: timestamp,
  // ... otros campos sin cambios
}
```

## Flujo de UI recomendado

### 1. **Solicitar datos del retiro**
```javascript
// Usuario ingresa:
// - Monto a retirar
// - Datos bancarios
```

### 2. **Mostrar fee calculado**
```javascript
const feePreview = await processWalletWithdrawal({
  userId,
  amount,
  bankDetails,
  acceptFee: false // ← Mostrar fee sin procesar
});

// UI muestra:
// "Retiro: $100.00"
// "Fee: $3.50"
// "Total a descontar: $103.50"
// "¿Deseas continuar?"
```

### 3. **Procesar si acepta**
```javascript
if (userAccepts) {
  const result = await processWalletWithdrawal({
    userId,
    amount,
    bankDetails,
    acceptFee: true // ← Procesar retiro
  });
  
  // Mostrar confirmación
}
```

## Validaciones implementadas

### 1. **Autenticación y usuario**
- Usuario autenticado requerido
- Usuario existe en usuarios o prestadores

### 2. **Datos bancarios**
- bankName requerido
- accountNumber requerido
- accountHolderName requerido
- country y currency para calcular fees

### 3. **Saldo y límites**
- Wallet existe
- Saldo suficiente (incluyendo fee)
- Respeta límite de retiro ($5000 por defecto)
- Considera saldo bloqueado

### 4. **Parámetros**
- amount positivo y numérico
- acceptFee booleano requerido
- bankDetails objeto válido

## Ventajas del sistema

### 1. **Transparencia total** 💰
- Usuario ve fee exacto antes de confirmar
- Dos pasos: preview → confirmación
- Cálculo automático por país

### 2. **Transacciones atómicas**
- Descuento del wallet + registro de retiro
- Rollback automático si falla Stripe
- Consistencia garantizada

### 3. **Tracking detallado**
- Estado del retiro (pending → processing → completed)
- Historial separado para retiro y fee
- Vinculación con Stripe transfer ID

### 4. **Validaciones robustas**
- Verificación de saldo en tiempo real
- Límites configurables por usuario
- Datos bancarios validados

### 5. **Experiencia internacional**
- Fees por país optimizados
- Soporte para múltiples monedas
- Adaptable a regulaciones locales

## Integración con Stripe (producción)

```javascript
// En producción, reemplazar simulación con:
const stripe = new Stripe(stripeSecretKey.value());

const transfer = await stripe.transfers.create({
  amount: Math.round(amount * 100), // cents
  currency: bankDetails.currency,
  destination: bankAccount.stripeAccountId,
  metadata: {
    userId,
    withdrawalId: withdrawalRef.id
  }
});

stripeTransferId = transfer.id;
```

## Estados del retiro

1. **pending**: Iniciado, esperando procesamiento
2. **processing**: En proceso con Stripe  
3. **completed**: Completado exitosamente
4. **failed**: Error en el procesamiento

## Notificación enviada

```json
{
  "title": "💰 Retiro Procesado",
  "body": "Tu retiro de $100.00 ha sido enviado a tu cuenta bancaria. Fee: $3.50",
  "data": {
    "type": "withdrawal_completed",
    "amount": "100",
    "stripeFee": "3.50",
    "transactionId": "transaction_789",
    "withdrawalId": "withdrawal_456",
    "bankName": "Banco de México"
  }
}
```