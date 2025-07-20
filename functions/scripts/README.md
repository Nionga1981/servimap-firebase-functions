# ServiMap - Scripts de Testing y Seeding

Este directorio contiene scripts para testing y seeding del sistema de comisiones y wallet de ServiMap.

## Archivos

- `seed-data.js` - Script para crear/eliminar datos de prueba
- `test-functions.js` - Suite de tests para Cloud Functions  
- `package.json` - Configuración de NPM y scripts
- `README.md` - Este archivo

## Instalación

```bash
cd functions/scripts
npm install
```

## Scripts Disponibles

### Seeding de Datos

```bash
# Crear datos de prueba
npm run seed
# o
node seed-data.js seed

# Eliminar datos de prueba  
npm run clean
# o
node seed-data.js clean

# Resetear (limpiar + crear)
npm run reset
```

### Testing

```bash
# Ejecutar tests
npm run test
# o
node test-functions.js test

# Ejecutar seeding + tests
npm run test-all

# Solo seeding desde test script
node test-functions.js seed

# Solo limpieza desde test script  
node test-functions.js clean
```

## Datos de Prueba Creados

### 👥 Usuarios
- **maria@example.com** - Cliente con embajador gratuito
- **carlos@example.com** - Cliente premium con embajador premium  
- **ana.embajadora@example.com** - Embajadora gratuita
- **roberto.embajador@example.com** - Embajador premium

### 🔧 Prestadores
- **juan.plomero@example.com** - Referido por Ana (embajadora gratuita)
- **elena.limpieza@example.com** - Referido por Roberto (embajador premium)

### 💰 Wallets
- **Ana**: $125.50 (con bonus de lealtad otorgado)
- **Roberto**: $500.00 (sin bonos aún)
- **María**: $0 (cerca del próximo bonus - 92.5% progreso)

### 📊 Datos Adicionales
- Categorías de servicios (plomería, limpieza, electricidad)
- Transacciones de wallet de ejemplo
- Comisiones de servicios y membresías
- Bonos de lealtad (otorgados y pendientes)
- Promociones activas
- Administrador de prueba
- Fondo de fidelidad global

## Tests Incluidos

### 🧪 Tests de Cloud Functions

1. **calculateCommissions**
   - ✅ Caso básico con cálculos correctos
   - ✅ Validación de parámetros inválidos

2. **processMembershipCommissions** 
   - ✅ Usuario Premium + Embajador Premium ($5)
   - ✅ Usuario Premium + Embajador Gratuito ($4)

3. **addToWallet**
   - ✅ Caso válido con actualización de balance
   - ✅ Usuario inexistente (debería fallar)

4. **calculateLoyaltyBonus**
   - ✅ Usuario con bonus pendiente
   - ✅ Usuario sin wallet

5. **getWalletBalance**
   - ✅ Usuario existente con wallet
   - ✅ Usuario sin wallet (valores por defecto)

6. **Verificación de Estructura**
   - ✅ Usuarios de prueba existen
   - ✅ Wallets tienen estructura correcta
   - ✅ Datos son consistentes

## Estructura de Datos de Prueba

### Escenarios de Testing

#### Scenario 1: Embajadora Gratuita con Bonus
- **Usuario**: Ana López (user_ambassador_001)
- **Estado**: Ya recibió 1 bonus de lealtad ($20)
- **Wallet**: $125.50 balance, $345 total ganado
- **Próximo bonus**: En $4000 gastados (17.5% progreso)

#### Scenario 2: Embajador Premium Activo  
- **Usuario**: Roberto Silva (user_ambassador_002)
- **Estado**: Sin bonos aún, múltiples comisiones
- **Wallet**: $500 balance, $750 total ganado
- **Próximo bonus**: En $2000 gastados (12.5% progreso)

#### Scenario 3: Cliente Cerca de Bonus
- **Usuario**: María González (user_client_001)  
- **Estado**: $1850 gastado, muy cerca del primer bonus
- **Wallet**: $0 balance (gastó todo)
- **Próximo bonus**: En $150 más (92.5% progreso)

#### Scenario 4: Cliente Premium
- **Usuario**: Carlos Rodríguez (user_client_002)
- **Estado**: Membresía premium, referido por embajador premium
- **Beneficios**: Embajador recibe $5 por su membresía

## Ejemplos de Uso

### Testing Manual de Funciones

```javascript
// Después del seeding, puedes probar:

// 1. Calcular comisiones para un nuevo servicio
const result = await calculateCommissions({
  serviceRequestId: 'new_service_001',
  totalAmount: 500,
  providerId: 'provider_001',  
  userId: 'user_client_001'
});

// 2. Procesar comisión de membresía
const membershipResult = await processMembershipCommissions({
  membershipType: 'user_premium',
  amount: 10,
  memberId: 'user_client_001',
  ambassadorId: 'user_ambassador_001' 
});

// 3. Verificar balance de wallet
const balance = await getWalletBalance({
  userId: 'user_ambassador_001'
});
```

### Verificación de Datos

```javascript
// Verificar que los datos se crearon correctamente
const wallet = await db.collection('wallets').doc('user_ambassador_001').get();
console.log('Wallet de Ana:', wallet.data());

const transactions = await db.collection('wallet_transactions')
  .where('userId', '==', 'user_ambassador_001')
  .orderBy('createdAt', 'desc')
  .limit(5)
  .get();

console.log('Últimas transacciones:', transactions.docs.map(doc => doc.data()));
```

## Troubleshooting

### Error: "Usuario no encontrado"
Ejecutar seeding de datos:
```bash
npm run seed
```

### Error: "Collection is empty"  
Verificar que Firebase esté configurado correctamente y ejecutar:
```bash
npm run reset
```

### Tests fallan
1. Verificar conexión a Firebase
2. Verificar que los datos de prueba existen
3. Revisar logs detallados en consola

### Permisos de Firestore
Asegurarse de que las reglas de Firestore permiten las operaciones de testing, o usar Firebase Admin SDK con permisos elevados.

## Desarrollo

Para agregar nuevos tests:

1. Añadir el test en `test-functions.js` usando `tester.runTest()`
2. Crear datos de prueba relacionados en `seed-data.js` 
3. Documentar el nuevo test en este README

Para agregar nuevos datos de prueba:

1. Añadir datos a `SEED_DATA` en `seed-data.js`
2. Actualizar la documentación de datos creados
3. Crear tests que verifiquen los nuevos datos

## Notas Importantes

- ⚠️ **Solo usar en desarrollo/testing** - Nunca ejecutar en producción
- 🔒 Los scripts requieren permisos de Firebase Admin  
- 🧹 Siempre limpiar datos de prueba después de testing
- 📝 Los IDs de documentos son predecibles para facilitar testing
- 🔄 Los scripts son idempotentes (se pueden ejecutar múltiples veces)

## Próximos Pasos

- [ ] Tests de integración end-to-end
- [ ] Performance testing con datos grandes
- [ ] Tests de concurrencia
- [ ] Mocking de Stripe APIs
- [ ] Tests de notificaciones push
- [ ] Validación de reglas de Firestore