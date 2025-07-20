/**
 * Script de Seeding para ServiMap
 * 
 * Este script crea datos de prueba para desarrollar y testear
 * el sistema de comisiones y wallet.
 * 
 * Uso: node scripts/seed-data.js
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    // Configurar con las credenciales apropiadas
    credential: admin.credential.applicationDefault(),
    // databaseURL: 'https://your-project.firebaseio.com'
  });
}

const db = admin.firestore();

// Datos de prueba
const SEED_DATA = {
  // Usuarios de prueba
  usuarios: [
    {
      id: 'user_client_001',
      nombre: 'María González',
      email: 'maria@example.com',
      membershipLevel: 'gratuito',
      referidoPor: 'user_ambassador_001',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isBlocked: false,
      fcmTokens: ['token_maria_123']
    },
    {
      id: 'user_client_002', 
      nombre: 'Carlos Rodríguez',
      email: 'carlos@example.com',
      membershipLevel: 'premium',
      referidoPor: 'user_ambassador_002',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isBlocked: false,
      fcmTokens: ['token_carlos_456']
    },
    {
      id: 'user_ambassador_001',
      nombre: 'Ana López (Embajadora)',
      email: 'ana.embajadora@example.com',
      membershipLevel: 'gratuito',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isBlocked: false,
      fcmTokens: ['token_ana_789']
    },
    {
      id: 'user_ambassador_002',
      nombre: 'Roberto Silva (Embajador Premium)',
      email: 'roberto.embajador@example.com', 
      membershipLevel: 'premium',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isBlocked: false,
      fcmTokens: ['token_roberto_012']
    }
  ],

  // Prestadores de prueba
  prestadores: [
    {
      id: 'provider_001',
      nombre: 'Juan Martínez - Plomero',
      email: 'juan.plomero@example.com',
      referidoPor: 'user_ambassador_001',
      isAvailable: true,
      isBlocked: false,
      rating: 4.5,
      categoryIds: ['categoria_plomeria'],
      currentLocation: {
        lat: 19.4326,
        lng: -99.1332,
        pais: 'MX'
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      fcmTokens: ['token_juan_345']
    },
    {
      id: 'provider_002',
      nombre: 'Elena Fernández - Limpieza',
      email: 'elena.limpieza@example.com',
      referidoPor: 'user_ambassador_002',
      isAvailable: true,
      isBlocked: false,
      rating: 4.8,
      categoryIds: ['categoria_limpieza'],
      currentLocation: {
        lat: 19.4326,
        lng: -99.1332,
        pais: 'MX'
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      fcmTokens: ['token_elena_678']
    }
  ],

  // Categorías de servicios
  categorias: [
    {
      id: 'categoria_plomeria',
      nombre: 'Plomería',
      descripcion: 'Servicios de fontanería y plomería',
      activa: true,
      orden: 1,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    },
    {
      id: 'categoria_limpieza',
      nombre: 'Limpieza',
      descripcion: 'Servicios de limpieza doméstica y comercial',
      activa: true,
      orden: 2,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    },
    {
      id: 'categoria_electricidad',
      nombre: 'Electricidad',
      descripcion: 'Servicios eléctricos y instalaciones',
      activa: true,
      orden: 3,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    }
  ],

  // Administradores
  admins: [
    {
      id: 'admin_001',
      email: 'admin@servimap.com',
      role: 'super_admin',
      permissions: ['*'],
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: 'system',
      isActive: true
    }
  ],

  // Wallets de ejemplo (con diferentes estados)
  wallets: [
    {
      id: 'user_ambassador_001',
      userId: 'user_ambassador_001',
      balance: 125.50,
      totalEarned: 345.00,
      totalSpent: 150.00,
      totalWithdrawn: 200.00,
      bonusesEarned: 1,
      lastBonusAt: admin.firestore.Timestamp.fromDate(new Date('2025-01-15')),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      breakdown: {
        totalEarnedFromBonuses: 25.00,
        totalEarnedFromCommissions: 270.00,
        totalEarnedFromRefunds: 50.00
      },
      limits: {
        dailySpendingLimit: 10000,
        withdrawalLimit: 5000,
        dailySpentToday: 0,
        lastSpendingDate: '2025-01-19',
        blockedBalance: 0
      },
      loyalty: {
        nextThreshold: 4000,
        progressToNext: 17.5
      }
    },
    {
      id: 'user_ambassador_002',
      userId: 'user_ambassador_002',
      balance: 500.00,
      totalEarned: 750.00,
      totalSpent: 250.00,
      totalWithdrawn: 0,
      bonusesEarned: 0,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      breakdown: {
        totalEarnedFromBonuses: 0,
        totalEarnedFromCommissions: 750.00,
        totalEarnedFromRefunds: 0
      },
      limits: {
        dailySpendingLimit: 10000,
        withdrawalLimit: 5000,
        dailySpentToday: 0,
        lastSpendingDate: '2025-01-19',
        blockedBalance: 0
      },
      loyalty: {
        nextThreshold: 2000,
        progressToNext: 12.5
      }
    },
    {
      id: 'user_client_001',
      userId: 'user_client_001',
      balance: 0,
      totalEarned: 0,
      totalSpent: 1850.00,
      totalWithdrawn: 0,
      bonusesEarned: 0,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      breakdown: {
        totalEarnedFromBonuses: 0,
        totalEarnedFromCommissions: 0,
        totalEarnedFromRefunds: 0
      },
      limits: {
        dailySpendingLimit: 10000,
        withdrawalLimit: 5000,
        dailySpentToday: 0,
        lastSpendingDate: '2025-01-19',
        blockedBalance: 0
      },
      loyalty: {
        nextThreshold: 2000,
        progressToNext: 92.5
      }
    }
  ],

  // Transacciones de wallet de ejemplo
  wallet_transactions: [
    {
      id: 'tx_001',
      userId: 'user_ambassador_001',
      type: 'commission',
      amount: 25.00,
      description: 'Comisión por servicio de plomería',
      sourceId: 'service_001',
      balanceAfter: 125.50,
      balanceBefore: 100.50,
      createdAt: admin.firestore.Timestamp.now(),
      metadata: {
        commissionType: 'service',
        serviceRequestId: 'service_001',
        ambassadorLevel: 'gratuito'
      }
    },
    {
      id: 'tx_002',
      userId: 'user_ambassador_001',
      type: 'bonus',
      amount: 20.00,
      description: '¡Felicidades! $20.00 agregados por ser cliente frecuente',
      sourceId: 'loyalty_bonus_001',
      balanceAfter: 100.50,
      balanceBefore: 80.50,
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2025-01-15')),
      metadata: {
        bonusType: 'loyalty',
        thresholdReached: 2000,
        bonusNumber: 1
      }
    },
    {
      id: 'tx_003',
      userId: 'user_client_001',
      type: 'payment',
      amount: 150.00,
      description: 'Pago por servicio de limpieza',
      sourceId: 'service_002',
      balanceAfter: 0,
      balanceBefore: 150.00,
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2025-01-18')),
      metadata: {
        serviceRequestId: 'service_002',
        noStripeFees: true
      }
    }
  ],

  // Comisiones de ejemplo
  commissions: [
    {
      id: 'commission_001',
      ambassadorId: 'user_ambassador_001',
      type: 'service',
      sourceId: 'service_001',
      amount: 25.00,
      percentage: 60,
      status: 'paid',
      paidAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      metadata: {
        serviceRequestId: 'service_001',
        totalAmount: 500.00,
        originalType: 'servicio_completado_prestador'
      }
    },
    {
      id: 'commission_002',
      ambassadorId: 'user_ambassador_002',
      type: 'membership',
      sourceId: 'membership_001',
      amount: 5.00,
      percentage: 50,
      status: 'paid',
      paidAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      metadata: {
        membershipType: 'user_premium',
        ambassadorLevel: 'premium',
        totalAmount: 10.00
      }
    },
    {
      id: 'commission_003',
      ambassadorId: 'user_ambassador_001',
      type: 'service',
      sourceId: 'service_003',
      amount: 30.00,
      percentage: 60,
      status: 'pending',
      createdAt: admin.firestore.Timestamp.now(),
      metadata: {
        serviceRequestId: 'service_003',
        totalAmount: 750.00,
        originalType: 'servicio_completado_prestador'
      }
    }
  ],

  // Bonos de lealtad
  loyalty_bonuses: [
    {
      id: 'loyalty_bonus_001',
      userId: 'user_ambassador_001',
      bonusAmount: 20.00,
      thresholdReached: 2000,
      totalSpentAtTime: 2300,
      fecha: admin.firestore.Timestamp.fromDate(new Date('2025-01-15')),
      otorgado: true,
      walletTransactionId: 'tx_002',
      fechaOtorgado: admin.firestore.Timestamp.fromDate(new Date('2025-01-15'))
    },
    {
      id: 'loyalty_bonus_002',
      userId: 'user_client_001',
      bonusAmount: 20.00,
      thresholdReached: 2000,
      totalSpentAtTime: 1850,
      fecha: admin.firestore.Timestamp.now(),
      otorgado: false
    }
  ],

  // Promociones de fidelidad
  promociones_fidelidad: [
    {
      id: 'promo_001',
      descripcion: 'Descuento 10% en servicios de plomería',
      tipoDescuento: 'porcentaje',
      valorDescuento: 10,
      activo: true,
      codigoPromocional: 'PLOMERIA10',
      usosDisponibles: 100,
      serviciosAplicables: ['categoria_plomeria']
    },
    {
      id: 'promo_002',
      descripcion: '$50 de descuento en limpieza',
      tipoDescuento: 'monto_fijo',
      valorDescuento: 50,
      activo: true,
      codigoPromocional: 'LIMPIEZA50',
      usosDisponibles: 50,
      serviciosAplicables: ['categoria_limpieza']
    }
  ],

  // Fondo de fidelidad
  fondoFidelidad: [
    {
      id: 'global',
      totalAcumulado: 1500.00,
      totalDistribuido: 200.00,
      saldoDisponible: 1300.00,
      ultimaActualizacion: admin.firestore.Timestamp.now(),
      stats: {
        totalServicios: 25,
        promedioAportePorServicio: 60.00,
        ultimoAporte: {
          monto: 75.00,
          servicioId: 'service_001',
          fecha: admin.firestore.Timestamp.now()
        }
      }
    }
  ]
};

// Función para crear datos en batch
async function createCollection(collectionName, data) {
  console.log(`📝 Creando datos para colección: ${collectionName}`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const item of data) {
    const docRef = db.collection(collectionName).doc(item.id);
    const { id, ...docData } = item;
    batch.set(docRef, docData);
    count++;
    
    // Firestore batch tiene límite de 500 operaciones
    if (count === 500) {
      await batch.commit();
      console.log(`  ✅ Batch de ${count} documentos creado`);
      count = 0;
    }
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`  ✅ ${count} documentos creados en ${collectionName}`);
  }
}

// Función principal de seeding
async function seedDatabase() {
  console.log('🌱 Iniciando seeding de la base de datos...\n');
  
  try {
    // Crear todas las colecciones
    for (const [collectionName, data] of Object.entries(SEED_DATA)) {
      await createCollection(collectionName, data);
    }
    
    console.log('\n🎉 ¡Seeding completado exitosamente!');
    console.log('\n📊 Resumen de datos creados:');
    for (const [collectionName, data] of Object.entries(SEED_DATA)) {
      console.log(`  - ${collectionName}: ${data.length} documentos`);
    }
    
    console.log('\n🚀 Datos de prueba disponibles:');
    console.log('  👥 Usuarios:');
    console.log('    - maria@example.com (cliente con embajador gratuito)');
    console.log('    - carlos@example.com (cliente premium con embajador premium)');
    console.log('    - ana.embajadora@example.com (embajadora gratuita)');
    console.log('    - roberto.embajador@example.com (embajador premium)');
    console.log('  🔧 Prestadores:');
    console.log('    - juan.plomero@example.com (referido por Ana)');
    console.log('    - elena.limpieza@example.com (referido por Roberto)');
    console.log('  💰 Wallets:');
    console.log('    - Ana: $125.50 (con bonus de lealtad)');
    console.log('    - Roberto: $500.00 (sin bonos aún)');
    console.log('    - María: $0 (cerca del próximo bonus)');
    
  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
  }
}

// Función para limpiar datos de prueba
async function cleanTestData() {
  console.log('🧹 Limpiando datos de prueba...\n');
  
  try {
    for (const [collectionName, data] of Object.entries(SEED_DATA)) {
      console.log(`🗑️  Eliminando colección: ${collectionName}`);
      
      const batch = db.batch();
      let count = 0;
      
      for (const item of data) {
        const docRef = db.collection(collectionName).doc(item.id);
        batch.delete(docRef);
        count++;
        
        if (count === 500) {
          await batch.commit();
          console.log(`  ✅ Batch de ${count} documentos eliminado`);
          count = 0;
        }
      }
      
      if (count > 0) {
        await batch.commit();
        console.log(`  ✅ ${count} documentos eliminados de ${collectionName}`);
      }
    }
    
    console.log('\n🎉 ¡Limpieza completada!');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  }
}

// CLI handling
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'clean') {
    cleanTestData().then(() => process.exit(0));
  } else if (command === 'seed' || !command) {
    seedDatabase().then(() => process.exit(0));
  } else {
    console.log('Uso: node seed-data.js [seed|clean]');
    console.log('  seed  - Crear datos de prueba (por defecto)');
    console.log('  clean - Eliminar datos de prueba');
    process.exit(1);
  }
}

module.exports = {
  seedDatabase,
  cleanTestData,
  SEED_DATA
};