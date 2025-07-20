# Test de la función getWalletBalance

## Ejemplo de uso

```javascript
// Llamada a la función desde el cliente
const getWalletBalance = firebase.functions().httpsCallable('getWalletBalance');

// Usuario consulta su propio balance (más común)
const result = await getWalletBalance({});

// O especificar userId (debe ser el mismo que el autenticado)
const result2 = await getWalletBalance({
  userId: "user_123"
});

console.log(result.data);
```

## Casos de prueba esperados

### Caso 1: Usuario con wallet activo
**Datos de ejemplo:**
- Saldo actual: $125.50
- Total ganado: $345.00 (comisiones + bonos + reembolsos)
- Total gastado: $2350.00
- Total retirado: $200.00
- Bonos de lealtad ganados: 1 ($20)

**Resultado esperado:**
```json
{
  "success": true,
  "currentBalance": 125.50,
  "totalEarned": 345.00,
  "totalSpent": 2350.00,
  "totalWithdrawn": 200.00,
  "nextBonusAt": 4000,
  "progressToNextBonus": 17.5,
  "amountNeededForNextBonus": 1650.00,
  "recentTransactions": [
    {
      "id": "trans_123",
      "tipo": "credito",
      "monto": 20.00,
      "concepto": "Bonus de Lealtad", 
      "descripcion": "¡Felicidades! $20.00 agregados por ser cliente frecuente",
      "fecha": "2025-01-19T...",
      "referenciaType": "bonus",
      "saldoNuevo": 125.50
    },
    {
      "id": "trans_122",
      "tipo": "debito",
      "monto": 150.00,
      "concepto": "Pago de Servicio",
      "descripcion": "Pago por servicio de limpieza",
      "fecha": "2025-01-18T...",
      "referenciaType": "wallet_payment",
      "saldoNuevo": 105.50
    }
    // ... hasta 10 transacciones
  ],
  "walletExists": true,
  
  "breakdown": {
    "totalEarnedFromBonuses": 25.00,
    "totalEarnedFromCommissions": 270.00,
    "totalEarnedFromRefunds": 50.00,
    "loyaltyBonusesEarned": 1,
    "loyaltyBonusesGranted": 1,
    "totalLoyaltyBonusAmount": 20.00
  },
  
  "limits": {
    "dailySpendingLimit": 10000,
    "withdrawalLimit": 5000,
    "dailySpentToday": 0,
    "blockedBalance": 0
  },
  
  "pendingWithdrawals": [],
  
  "loyalty": {
    "currentThreshold": 2000,
    "nextThreshold": 4000,
    "bonusAmount": 20,
    "progressToNextBonus": 17.5,
    "amountNeededForNextBonus": 1650.00,
    "totalBonusesEarned": 1,
    "totalBonusAmount": 20.00
  }
}
```

### Caso 2: Usuario sin wallet (nuevo)
**Datos iniciales:**
- Usuario nuevo sin transacciones

**Resultado esperado:**
```json
{
  "success": true,
  "currentBalance": 0,
  "totalEarned": 0,
  "totalSpent": 0,
  "totalWithdrawn": 0,
  "nextBonusAt": 2000,
  "progressToNextBonus": 0,
  "recentTransactions": [],
  "walletExists": false,
  "message": "Wallet no inicializado"
}
```

### Caso 3: Usuario con retiros pendientes
**Datos de ejemplo:**
- Saldo: $500.00
- Retiros pendientes: 1 por $100.00

**Resultado esperado:**
```json
{
  "success": true,
  "currentBalance": 500.00,
  // ... otros campos
  "pendingWithdrawals": [
    {
      "id": "withdrawal_456",
      "amount": 100.00,
      "status": "processing",
      "fecha": "2025-01-19T...",
      "bankName": "Banco de México"
    }
  ]
  // ... resto de campos
}
```

### Caso 4: Usuario cerca del próximo bonus
**Datos de ejemplo:**
- Total gastado: $3850.00
- Bonos ganados: 1 (ya recibió por $2000)
- Próximo bonus en: $4000

**Resultado esperado:**
```json
{
  "success": true,
  // ... otros campos
  "nextBonusAt": 4000,
  "progressToNextBonus": 92.5, // (1850/2000) * 100
  "amountNeededForNextBonus": 150.00,
  
  "loyalty": {
    "currentThreshold": 2000,
    "nextThreshold": 4000,
    "bonusAmount": 20,
    "progressToNextBonus": 92.5,
    "amountNeededForNextBonus": 150.00,
    "totalBonusesEarned": 1,
    "totalBonusAmount": 20.00
  }
}
```

### Caso 5: Error de permisos
**Parámetros:**
```json
{
  "userId": "other_user_123" // Diferente al autenticado
}
```

**Resultado esperado:**
- ❌ Error: "Solo puedes acceder a tu propio wallet"

## Información retornada detallada

### **Campos principales (como solicitado):**
```typescript
{
  currentBalance: number,      // $125.50
  totalEarned: number,         // $345.00
  totalSpent: number,          // $2350.00  
  totalWithdrawn: number,      // $200.00
  nextBonusAt: number,         // $4000
  progressToNextBonus: number, // 17.5%
  recentTransactions: array    // últimas 10 transacciones
}
```

### **Campos adicionales de valor:**

#### `breakdown` - Desglose detallado de ganancias:
```typescript
{
  totalEarnedFromBonuses: number,    // $25 (bonificaciones)
  totalEarnedFromCommissions: number, // $270 (comisiones)
  totalEarnedFromRefunds: number,    // $50 (reembolsos)
  loyaltyBonusesEarned: number,      // 1 (contador)
  loyaltyBonusesGranted: number,     // 1 (verificación)
  totalLoyaltyBonusAmount: number    // $20 (total bonos)
}
```

#### `limits` - Límites y configuración:
```typescript
{
  dailySpendingLimit: number,  // $10,000 (límite diario)
  withdrawalLimit: number,     // $5,000 (límite retiro)
  dailySpentToday: number,     // $0 (gastado hoy)
  blockedBalance: number       // $0 (saldo bloqueado)
}
```

#### `loyalty` - Información completa de lealtad:
```typescript
{
  currentThreshold: number,        // $2,000 (umbral actual)
  nextThreshold: number,           // $4,000 (próximo umbral)
  bonusAmount: number,             // $20 (bonus por umbral)
  progressToNextBonus: number,     // 17.5% (progreso)
  amountNeededForNextBonus: number, // $1,650 (faltante)
  totalBonusesEarned: number,      // 1 (total ganados)
  totalBonusAmount: number         // $20 (total en dinero)
}
```

#### `pendingWithdrawals` - Retiros en proceso:
```typescript
[
  {
    id: string,           // "withdrawal_456"
    amount: number,       // 100.00
    status: string,       // "processing"
    fecha: timestamp,     // fecha de solicitud
    bankName: string      // "Banco de México"
  }
]
```

#### `recentTransactions` - Últimas 10 transacciones:
```typescript
[
  {
    id: string,              // "trans_123"
    tipo: "credito"|"debito", // tipo de transacción
    monto: number,           // 20.00
    concepto: string,        // "Bonus de Lealtad"
    descripcion: string,     // descripción detallada
    fecha: timestamp,        // fecha de transacción
    referenciaType: string,  // "bonus", "wallet_payment", etc.
    saldoNuevo: number      // saldo después de transacción
  }
]
```

## Validaciones implementadas

### 1. **Autenticación**
- Usuario autenticado requerido
- Solo puede consultar su propio wallet

### 2. **Permisos**
- Verificación userId === auth.uid
- Preparado para lógica de admin

### 3. **Usuario existente**
- Verificación en usuarios o prestadores
- Error si no existe

### 4. **Wallet inexistente**
- Retorna valores por defecto si no hay wallet
- Indica `walletExists: false`

## Cálculos implementados

### **Progreso hacia próximo bonus:**
```javascript
const nextBonusThreshold = (loyaltyBonusesEarned + 1) * 2000;
const progressAmount = totalSpent - (loyaltyBonusesEarned * 2000);  
const progressToNextBonus = (progressAmount / 2000) * 100;
```

**Ejemplo:**
- Total gastado: $3850
- Bonos ganados: 1 (por $2000)
- Progreso = ($3850 - $2000) / $2000 = 92.5%

### **Total earned (ganancias):**
```javascript
const totalEarned = totalBonuses + totalCommissions + totalRefunds;
```

### **Total withdrawn (retirado):**
```javascript
// Suma todas las transacciones tipo "withdrawal"
const totalWithdrawn = sum(transactions.where(type === "withdrawal"));
```

## Casos de uso en el frontend

### **Dashboard principal:**
```javascript
const wallet = await getWalletBalance({});

// Mostrar balance principal
displayBalance(wallet.currentBalance);

// Progreso de lealtad
displayLoyaltyProgress(
  wallet.progressToNextBonus,
  wallet.amountNeededForNextBonus
);

// Estadísticas 
displayStats({
  earned: wallet.totalEarned,
  spent: wallet.totalSpent,
  withdrawn: wallet.totalWithdrawn
});
```

### **Página de wallet:**
```javascript
const wallet = await getWalletBalance({});

// Transacciones recientes
displayTransactions(wallet.recentTransactions);

// Límites y configuración
displayLimits(wallet.limits);

// Retiros pendientes
if (wallet.pendingWithdrawals.length > 0) {
  displayPendingWithdrawals(wallet.pendingWithdrawals);
}
```

### **Sección de lealtad:**
```javascript
const wallet = await getWalletBalance({});

// Información completa de lealtad
displayLoyaltyInfo(wallet.loyalty);

// Desglose de ganancias
displayEarningsBreakdown(wallet.breakdown);
```

## Ventajas de esta implementación

### 1. **Información completa en una sola llamada** 📊
- Todo lo necesario para el dashboard
- Reduce múltiples queries del frontend

### 2. **Cálculos automáticos** 🧮
- Progreso de lealtad calculado
- Estadísticas agregadas
- Verificaciones de consistencia

### 3. **Seguridad y permisos** 🔒
- Solo acceso al propio wallet
- Validación de usuario existente
- Logs de consultas para analytics

### 4. **Información rica para UX** ✨
- Desglose detallado de ganancias
- Estado de retiros pendientes
- Límites y configuración visible

### 5. **Preparado para admin** 👥
- Base para panel administrativo
- Logs de consultas para analytics
- Estructura escalable

## Analytics y logs

La función registra cada consulta para analytics:
```json
{
  "accion": "WALLET_BALANCE_CONSULTED",
  "descripcion": "Usuario consultó balance de wallet: $125.50",
  "metadata": {
    "currentBalance": 125.50,
    "totalEarned": 345.00,
    "totalSpent": 2350.00,
    "totalWithdrawn": 200.00,
    "loyaltyBonusesEarned": 1
  }
}
```

Esto permite:
- Tracking de engagement con wallet
- Patrones de consulta de usuarios
- Analytics de comportamiento
- Detección de problemas de rendimiento