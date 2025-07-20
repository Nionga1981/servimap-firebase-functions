# Test de la función addLoyaltyBonus

## Ejemplo de uso

```javascript
// Llamada a la función desde el cliente o sistema automático
const addLoyaltyBonus = firebase.functions().httpsCallable('addLoyaltyBonus');

const result = await addLoyaltyBonus({
  userId: "user_123",
  bonusAmount: 20
});

console.log(result.data);
```

## Flujo automático completo

```javascript
// 1. Usuario paga con wallet
await processWalletPayment({
  userId: "user_123",
  amount: 300,
  serviceRequestId: "service_456",
  description: "Servicio de plomería"
});

// 2. Sistema verifica si merece bonus de lealtad
const loyaltyCheck = await calculateLoyaltyBonus({
  userId: "user_123"
});

// 3. Si hay bonus pendiente, otorgarlo automáticamente
if (loyaltyCheck.data.bonusAmount > 0) {
  await addLoyaltyBonus({
    userId: "user_123",
    bonusAmount: loyaltyCheck.data.bonusAmount
  });
}
```

## Casos de prueba esperados

### Caso 1: Primer bonus de lealtad
**Datos iniciales:**
- Saldo wallet: $150.00
- Total gastado: $2300 (merece 1 bonus)
- loyaltyBonusesEarned: 0

**Parámetros:**
```json
{
  "userId": "user_123",
  "bonusAmount": 20
}
```

**Resultado esperado:**
```json
{
  "success": true,
  "bonusAmount": 20,
  "newBalance": 170.00,
  "previousBalance": 150.00,
  "transactionId": "transaction_789",
  "message": "¡Felicidades! $20.00 agregados por ser cliente frecuente",
  "loyaltyBonusesEarned": 1,
  "nextThreshold": 4000,
  "bonusesMarkedAsGranted": 1
}
```

### Caso 2: Múltiples bonus acumulados
**Datos iniciales:**
- Saldo wallet: $50.00
- Total gastado: $6500 (merece 3 bonos, ya tiene 1)
- loyaltyBonusesEarned: 1

**Parámetros:**
```json
{
  "userId": "user_123",
  "bonusAmount": 40
}
```

**Resultado esperado:**
```json
{
  "success": true,
  "bonusAmount": 40,
  "newBalance": 90.00,
  "previousBalance": 50.00,
  "transactionId": "transaction_890",
  "message": "¡Felicidades! $40.00 agregados por ser cliente frecuente",
  "loyaltyBonusesEarned": 3,
  "nextThreshold": 8000,
  "bonusesMarkedAsGranted": 1
}
```

### Caso 3: Usuario sin wallet
**Parámetros:**
```json
{
  "userId": "user_new",
  "bonusAmount": 20
}
```

**Resultado esperado:**
- ❌ Error: "Wallet no encontrado"

## Estructura de datos actualizada

### Colección "wallets" (después del bonus)
```firestore
{
  userId: "user_123",
  saldoActual: 170.00, // incrementado con bonus
  ultimaActualizacion: timestamp,
  totalAcumuladoBonificaciones: 20.00, // incrementado
  loyaltyBonusesEarned: 1, // contador incrementado
  loyaltyBonusThreshold: 4000, // próximo umbral calculado
  totalGastado: 2300, // no cambia
  // ... otros campos
}
```

### Colección "wallet_transactions" (transacción de bonus)
```firestore
{
  userId: "user_123",
  tipo: "credito",
  monto: 20.00,
  concepto: "Bonus de Lealtad",
  descripcion: "¡Felicidades! $20.00 agregados por ser cliente frecuente",
  fecha: timestamp,
  referenciaId: "loyalty_bonus_1",
  referenciaType: "bonus",
  saldoAnterior: 150.00,
  saldoNuevo: 170.00,
  metadata: {
    type: "loyalty_bonus",
    bonusNumber: 1,
    thresholdReached: 2000,
    automatic: true,
    specialMessage: true
  }
}
```

### Colección "loyalty_bonuses" (marcado como otorgado)
```firestore
{
  userId: "user_123",
  bonusAmount: 20,
  thresholdReached: 2000,
  totalSpentAtTime: 2300,
  fecha: timestamp_calculado,
  otorgado: true, // ← actualizado a true
  walletTransactionId: "transaction_789", // ← vinculado
  fechaOtorgado: timestamp_otorgado // ← fecha de otorgamiento
}
```

## Notificación especial enviada

### Push Notification
```json
{
  "title": "🎉 ¡Bonus de Lealtad!",
  "body": "¡Felicidades! Has ganado $20.00 por ser un cliente frecuente. ¡Sigue usando ServiMap!",
  "data": {
    "type": "loyalty_bonus",
    "amount": "20",
    "transactionId": "transaction_789",
    "newBalance": "170.00",
    "special": "true",
    "celebration": "true"
  }
}
```

## Funcionalidades clave implementadas

### 1. **Transacción atómica completa**
- Actualiza saldo del wallet
- Incrementa contador de bonos otorgados
- Crea transacción de wallet
- Marca loyalty_bonus como otorgado
- Todo en una sola operación atómica

### 2. **Tracking preciso de bonos**
- `loyaltyBonusesEarned` cuenta bonos ya otorgados
- `loyaltyBonusThreshold` calcula próximo umbral
- Vincula transacción wallet con registro de bonus

### 3. **Notificación especial personalizada** 🎉
- Emoji y mensaje celebratorio
- Metadata especial para el frontend
- Flags de "celebration" para animaciones

### 4. **Validaciones robustas**
- Usuario existe (usuarios o prestadores)
- Wallet existe y tiene datos
- Monto positivo válido
- Autenticación requerida

### 5. **Auditoría completa**
- Log de actividad del sistema
- Tracking en `loyalty_bonuses`
- Historial en `wallet_transactions`
- Metadata detallada

## Integración con el ecosistema

### Trigger automático recomendado:
```javascript
// Después de cada pago con wallet exitoso
export const onWalletPaymentSuccess = onDocumentUpdated(
  "wallet_transactions/{transactionId}",
  async (event) => {
    const transaction = event.data?.after.data();
    
    if (transaction?.tipo === "debito" && transaction?.referenciaType === "wallet_payment") {
      // Verificar si merece bonus
      const loyaltyCheck = await calculateLoyaltyBonus({
        userId: transaction.userId
      });
      
      // Otorgar automáticamente si hay bonus pendiente
      if (loyaltyCheck.bonusAmount > 0) {
        await addLoyaltyBonus({
          userId: transaction.userId,
          bonusAmount: loyaltyCheck.bonusAmount
        });
      }
    }
  }
);
```

## Diferencias vs addToWallet

| Feature | addToWallet | addLoyaltyBonus |
|---------|-------------|-----------------|
| **Propósito** | Genérico para cualquier crédito | Específico para bonos de lealtad |
| **Contador** | No actualiza contadores especiales | Actualiza `loyaltyBonusesEarned` |
| **Notificación** | Estándar | Especial con emojis y celebración |
| **Tracking** | Solo wallet transaction | + loyalty_bonuses vinculado |
| **Metadata** | Básica | Rica con thresholds y números |
| **Uso** | Manual/múltiples propósitos | Automático/lealtad |

## Ventajas del sistema

### 1. **Automático y transparente**
- Se ejecuta automáticamente al alcanzar umbrales
- Usuario ve progreso claro hacia próximo bonus

### 2. **Experiencia celebratoria** 🎉
- Notificación especial hace sentir valorado al usuario
- Refuerza comportamiento de lealtad

### 3. **Tracking detallado**
- Auditoría completa de cada bonus otorgado
- Analytics ricos para entender patrones

### 4. **Escalable**
- Fácil ajustar umbrales y montos
- Sistema preparado para múltiples niveles de lealtad

### 5. **Consistencia garantizada**
- Transacciones atómicas previenen inconsistencias
- Imposible perder o duplicar bonos