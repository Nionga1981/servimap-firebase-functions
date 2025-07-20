# Test de la función processMembershipCommissions

## Ejemplo de uso

```javascript
// Llamada a la función desde el cliente cuando alguien paga membresía
const processMembershipCommissions = firebase.functions().httpsCallable('processMembershipCommissions');

const result = await processMembershipCommissions({
  membershipType: "user_premium", // o "fixed_business"
  amount: 10, // $10 para Premium, $25 para Negocio Fijo
  memberId: "member_123",
  ambassadorId: "ambassador_456"
});

console.log(result.data);
```

## Casos de prueba esperados

### Caso 1: Usuario Premium con embajador gratuito
- Membresía: $10/mes
- Comisión embajador: $4.00
- Acreditación: INMEDIATA al wallet

### Caso 2: Usuario Premium con embajador premium
- Membresía: $10/mes  
- Comisión embajador: $5.00
- Acreditación: INMEDIATA al wallet

### Caso 3: Negocio Fijo con embajador gratuito
- Membresía: $25/mes
- Comisión embajador: $10.00
- Acreditación: INMEDIATA al wallet

### Caso 4: Negocio Fijo con embajador premium
- Membresía: $25/mes
- Comisión embajador: $12.50
- Acreditación: INMEDIATA al wallet

## Estructura de datos creada

### Colección "membership_commissions"
```firestore
{
  membershipType: "user_premium",
  amount: 10,
  memberId: "member_123",
  ambassadorId: "ambassador_456",
  commissionAmount: 5.00,
  ambassadorLevel: "premium",
  fecha: timestamp,
  referenciaID: "commission_789",
  estado: "acreditada"
}
```

### Colección "wallets" (actualizada automáticamente)
```firestore
{
  userId: "ambassador_456",
  saldoActual: 105.00, // saldo anterior + comisión
  ultimaActualizacion: timestamp,
  saldoBloqueado: 0,
  limiteDiario: 10000,
  limiteRetiro: 5000
}
```

### Colección "wallet_transactions" (historial)
```firestore
{
  userId: "ambassador_456",
  tipo: "credito",
  monto: 5.00,
  concepto: "Comisión de Membresía",
  descripcion: "Comisión premium por membresía Usuario Premium",
  fecha: timestamp,
  referenciaId: "commission_789",
  referenciaType: "comision_membresia",
  saldoAnterior: 100.00,
  saldoNuevo: 105.00,
  metadata: {
    membershipType: "user_premium",
    memberId: "member_123",
    membershipAmount: 10,
    ambassadorLevel: "premium"
  }
}
```

## Diferencias clave vs comisiones de servicios

1. **Acreditación inmediata**: Se acredita al wallet AL MOMENTO del pago
2. **No hay distribución**: 100% va al embajador (sin split 60/40)
3. **Niveles de embajador**: Premium recibe más que gratuito
4. **Tipos de membresía**: Usuario Premium vs Negocio Fijo con diferentes montos