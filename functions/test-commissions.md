# Test de la función calculateCommissions

## Ejemplo de uso

```javascript
// Llamada a la función desde el cliente
const calculateCommissions = firebase.functions().httpsCallable('calculateCommissions');

const result = await calculateCommissions({
  serviceRequestId: "service_123",
  totalAmount: 1000,
  providerId: "provider_456", 
  userId: "user_789"
});

console.log(result.data);
```

## Casos de prueba esperados

### Caso 1: Sin embajadores
- Servicio $1000 → ServiMap retiene $60 (6%)
- Resultado: $0 comisiones pagadas, $60 retenidos por ServiMap

### Caso 2: Solo embajador del prestador
- Servicio $1000 → ServiMap retiene $60 (6%)
- Embajador prestador recibe: $36 (60% de $60)
- ServiMap reinvierte: $24

### Caso 3: Solo embajador del usuario  
- Servicio $1000 → ServiMap retiene $60 (6%)
- Embajador usuario recibe: $24 (40% de $60)
- ServiMap reinvierte: $36

### Caso 4: Diferentes embajadores
- Servicio $1000 → ServiMap retiene $60 (6%)
- Embajador prestador: $36 (60%)
- Embajador usuario: $24 (40%)
- ServiMap reinvierte: $0

### Caso 5: Mismo embajador para ambos
- Servicio $1000 → ServiMap retiene $60 (6%) 
- Embajador único: $60 (100%)
- ServiMap reinvierte: $0

## Estructura de datos creada

### Colección "comisiones"
```firestore
{
  idUsuarioGanador: "ambassador_uid",
  tipo: "servicio_completado_prestador", 
  monto: 36.00,
  detalle: "Comisión 60% por referir prestador",
  fecha: timestamp,
  referenciaID: "service_123",
  serviceRequestId: "service_123",
  totalAmount: 1000,
  porcentajeComision: 60,
  embajadorPrestador: "ambassador_uid"
}
```

### Campo en solicitud_servicio
```firestore
{
  comisionesCalculadas: {
    comisionServiMapTotal: 60,
    comisionEmbajadorPrestador: 36,
    comisionEmbajadorUsuario: 0,
    comisionTotalPagada: 36,
    comisionServiMapRetenida: 24,
    embajadorPrestador: "ambassador_uid",
    fechaCalculo: timestamp
  }
}
```