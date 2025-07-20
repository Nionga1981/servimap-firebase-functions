# Test de la función calculateLoyaltyBonus

## Ejemplo de uso

```javascript
// Llamada a la función desde el cliente
const calculateLoyaltyBonus = firebase.functions().httpsCallable('calculateLoyaltyBonus');

const result = await calculateLoyaltyBonus({
  userId: "user_123"
});

console.log(result.data);
```

## Casos de prueba esperados

### Caso 1: Usuario sin wallet
**Datos iniciales:**
- Usuario no tiene wallet

**Resultado esperado:**
```json
{
  "success": true,
  "bonusAmount": 0,
  "reason": "Usuario no tiene wallet",
  "totalSpent": 0,
  "nextThreshold": 2000
}
```

### Caso 2: Usuario con gasto menor al umbral
**Datos iniciales:**
- totalGastado: $1500
- loyaltyBonusesEarned: 0

**Resultado esperado:**
```json
{
  "success": true,
  "bonusAmount": 0,
  "reason": "No hay bonos pendientes",
  "totalSpent": 1500,
  "bonusesEarned": 0,
  "nextThreshold": 2000,
  "amountNeededForNextBonus": 500
}
```

### Caso 3: Usuario merece su primer bonus
**Datos iniciales:**
- totalGastado: $2500
- loyaltyBonusesEarned: 0

**Resultado esperado:**
```json
{
  "success": true,
  "bonusAmount": 20,
  "pendingBonuses": 1,
  "bonusPerThreshold": 20,
  "totalSpent": 2500,
  "bonusesEarned": 0,
  "bonusesDeserved": 1,
  "nextThreshold": 4000,
  "amountNeededForNextBonus": 1500,
  "thresholdAmount": 2000
}
```

### Caso 4: Usuario merece múltiples bonus
**Datos iniciales:**
- totalGastado: $6800
- loyaltyBonusesEarned: 1 (ya recibió 1 bonus)

**Resultado esperado:**
```json
{
  "success": true,
  "bonusAmount": 40,
  "pendingBonuses": 2,
  "bonusPerThreshold": 20,
  "totalSpent": 6800,
  "bonusesEarned": 1,
  "bonusesDeserved": 3,
  "nextThreshold": 8000,
  "amountNeededForNextBonus": 1200,
  "thresholdAmount": 2000
}
```

### Caso 5: Usuario al día con sus bonos
**Datos iniciales:**
- totalGastado: $4000
- loyaltyBonusesEarned: 2 (ya recibió todos sus bonos)

**Resultado esperado:**
```json
{
  "success": true,
  "bonusAmount": 0,
  "reason": "No hay bonos pendientes",
  "totalSpent": 4000,
  "bonusesEarned": 2,
  "nextThreshold": 6000,
  "amountNeededForNextBonus": 2000
}
```

## Estructura de datos creada

### Colección "loyalty_bonuses" (registros de tracking)
```firestore
{
  userId: "user_123",
  bonusAmount: 20,
  thresholdReached: 2000, // Umbral que activó este bonus
  totalSpentAtTime: 2500, // Gasto total cuando se calculó
  fecha: timestamp,
  otorgado: false, // Se marca true cuando se otorga
  walletTransactionId: null // Se llena cuando se otorga
}
```

### Colección "wallets" (campos de tracking)
```firestore
{
  userId: "user_123",
  saldoActual: 150.00,
  totalGastado: 6800, // ← Se usa para calcular bonos
  loyaltyBonusesEarned: 1, // ← Bonos ya otorgados
  loyaltyBonusThreshold: 4000, // ← Próximo umbral
  // ... otros campos
}
```

## Lógica de cálculo detallada

### Fórmula principal:
```javascript
const bonusesDeserved = Math.floor(totalGastado / 2000);
const pendingBonuses = bonusesDeserved - loyaltyBonusesEarned;
const totalBonusAmount = pendingBonuses * 20;
```

### Ejemplos de cálculo:

**Usuario gasta $6800:**
- bonusesDeserved = Math.floor(6800 / 2000) = 3
- Si loyaltyBonusesEarned = 1
- pendingBonuses = 3 - 1 = 2
- totalBonusAmount = 2 × $20 = $40

**Umbrales de bonus:**
- $2000 → $20 (1er bonus)
- $4000 → $20 (2do bonus)  
- $6000 → $20 (3er bonus)
- $8000 → $20 (4to bonus)

## Integración con otras funciones

### 1. Esta función SOLO calcula, NO otorga
- Retorna `bonusAmount` a otorgar
- Frontend debe llamar `addToWallet` para otorgar

### 2. Flujo completo de otorgamiento:
```javascript
// 1. Calcular bonus pendientes
const calculation = await calculateLoyaltyBonus({ userId });

if (calculation.data.bonusAmount > 0) {
  // 2. Otorgar bonus al wallet
  await addToWallet({
    userId,
    amount: calculation.data.bonusAmount,
    type: "bonus",
    description: `Bonus de lealtad por gastar $${calculation.data.totalSpent}`
  });
  
  // 3. Actualizar contador de bonos otorgados
  // (Se puede hacer en addToWallet o en función separada)
}
```

### 3. Cuándo llamar esta función:
- Después de cada pago con wallet exitoso
- Periódicamente (cron job)
- Cuando usuario consulta su progreso de lealtad

## Ventajas del sistema

### 1. **Tracking preciso**
- Registro detallado de cada bonus calculado
- Evita duplicados y pérdidas

### 2. **Escalable**
- Fácil cambiar umbrales ($2000) y montos ($20)
- Constantes configurables

### 3. **Transparente**
- Usuario puede ver su progreso exacto
- Próximo umbral y monto faltante

### 4. **Flexible**
- Función separada permite diferentes triggers
- Frontend controla cuándo otorgar

### 5. **Auditable**
- Logs completos de cada cálculo
- Historial en `loyalty_bonuses`