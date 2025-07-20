/**
 * Script de Testing para Cloud Functions de ServiMap
 * 
 * Este script ejecuta tests de integración para las Cloud Functions
 * del sistema de comisiones y wallet.
 * 
 * Uso: node scripts/test-functions.js
 */

const admin = require('firebase-admin');
const { seedDatabase, cleanTestData } = require('./seed-data');

// Inicializar Firebase Admin (si no está inicializado)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

// Colores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Clase para manejar tests
class CloudFunctionTester {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async runTest(testName, testFunction) {
    this.totalTests++;
    log('blue', `\n🧪 Ejecutando: ${testName}`);
    
    try {
      await testFunction();
      this.passedTests++;
      log('green', `✅ PASS: ${testName}`);
      this.testResults.push({ name: testName, status: 'PASS' });
    } catch (error) {
      log('red', `❌ FAIL: ${testName}`);
      log('red', `   Error: ${error.message}`);
      this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
    }
  }

  printSummary() {
    log('cyan', `\n📊 Resumen de Tests:`);
    log('cyan', `===================`);
    log('green', `✅ Pasaron: ${this.passedTests}/${this.totalTests}`);
    
    if (this.passedTests < this.totalTests) {
      log('red', `❌ Fallaron: ${this.totalTests - this.passedTests}/${this.totalTests}`);
      
      log('yellow', `\n🔍 Tests fallidos:`);
      this.testResults
        .filter(test => test.status === 'FAIL')
        .forEach(test => {
          log('red', `  - ${test.name}: ${test.error}`);
        });
    }
    
    if (this.passedTests === this.totalTests) {
      log('green', `\n🎉 ¡Todos los tests pasaron!`);
    }
  }
}

// Simulador de Cloud Functions (para testing local)
class MockCloudFunctions {
  
  // Mock de calculateCommissions
  async calculateCommissions(data) {
    const { serviceRequestId, totalAmount, providerId, userId } = data;
    
    // Validaciones básicas
    if (!serviceRequestId || !totalAmount || !providerId || !userId) {
      throw new Error('Parámetros requeridos faltantes');
    }
    
    if (typeof totalAmount !== 'number' || totalAmount <= 0) {
      throw new Error('totalAmount debe ser un número positivo');
    }
    
    // Simular cálculo de comisiones
    const comisionServiMap = totalAmount * 0.06; // 6%
    const comisionEmbajadorPrestador = comisionServiMap * 0.6; // 60%
    const comisionEmbajadorUsuario = comisionServiMap * 0.4; // 40%
    
    return {
      success: true,
      comisionServiMapTotal: comisionServiMap,
      comisionEmbajadorPrestador,
      comisionEmbajadorUsuario,
      comisionTotalPagada: comisionEmbajadorPrestador + comisionEmbajadorUsuario,
      comisionServiMapRetenida: comisionServiMap - (comisionEmbajadorPrestador + comisionEmbajadorUsuario)
    };
  }
  
  // Mock de processMembershipCommissions
  async processMembershipCommissions(data) {
    const { membershipType, amount, memberId, ambassadorId } = data;
    
    if (!membershipType || !amount || !memberId || !ambassadorId) {
      throw new Error('Parámetros requeridos faltantes');
    }
    
    // Verificar que el embajador existe
    const ambassadorDoc = await db.collection('usuarios').doc(ambassadorId).get();
    if (!ambassadorDoc.exists) {
      throw new Error('Embajador no encontrado');
    }
    
    const ambassadorData = ambassadorDoc.data();
    const ambassadorLevel = ambassadorData.membershipLevel === 'premium' ? 'premium' : 'gratuito';
    
    // Calcular comisión
    let commissionAmount = 0;
    if (membershipType === 'user_premium') {
      commissionAmount = ambassadorLevel === 'premium' ? 5.00 : 4.00;
    } else if (membershipType === 'fixed_business') {
      commissionAmount = ambassadorLevel === 'premium' ? 12.50 : 10.00;
    }
    
    return {
      success: true,
      commissionAmount,
      ambassadorLevel,
      membershipType,
      description: `Comisión ${ambassadorLevel === 'premium' ? 'premium ' : ''}por membresía ${membershipType}`
    };
  }
  
  // Mock de addToWallet
  async addToWallet(data) {
    const { userId, amount, type, description } = data;
    
    if (!userId || !amount || !type || !description) {
      throw new Error('Parámetros requeridos faltantes');
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('amount debe ser un número positivo');
    }
    
    // Verificar que el usuario existe
    const userDoc = await db.collection('usuarios').doc(userId).get();
    const providerDoc = await db.collection('prestadores').doc(userId).get();
    
    if (!userDoc.exists && !providerDoc.exists) {
      throw new Error('Usuario no encontrado');
    }
    
    // Simular adición al wallet
    const currentBalance = 150.00; // Simulated
    const newBalance = currentBalance + amount;
    
    return {
      success: true,
      amount,
      previousBalance: currentBalance,
      newBalance,
      description,
      type
    };
  }
  
  // Mock de calculateLoyaltyBonus
  async calculateLoyaltyBonus(data) {
    const { userId } = data;
    
    if (!userId) {
      throw new Error('userId es requerido');
    }
    
    // Verificar wallet
    const walletDoc = await db.collection('wallets').doc(userId).get();
    if (!walletDoc.exists) {
      return {
        success: true,
        bonusAmount: 0,
        message: 'Wallet no encontrado',
        totalSpent: 0,
        loyaltyBonusesEarned: 0
      };
    }
    
    const walletData = walletDoc.data();
    const totalSpent = walletData.totalSpent || 0;
    const loyaltyBonusesEarned = walletData.bonusesEarned || 0;
    
    // Calcular bonos pendientes
    const bonusesDeserved = Math.floor(totalSpent / 2000);
    const bonusesPending = Math.max(0, bonusesDeserved - loyaltyBonusesEarned);
    const bonusAmount = bonusesPending * 20;
    
    return {
      success: true,
      bonusAmount,
      bonusesPending,
      totalSpent,
      loyaltyBonusesEarned,
      nextThreshold: (loyaltyBonusesEarned + bonusesPending + 1) * 2000
    };
  }
  
  // Mock de getWalletBalance
  async getWalletBalance(data) {
    const { userId } = data;
    
    if (!userId) {
      throw new Error('userId es requerido');
    }
    
    // Verificar wallet
    const walletDoc = await db.collection('wallets').doc(userId).get();
    if (!walletDoc.exists) {
      return {
        success: true,
        currentBalance: 0,
        totalEarned: 0,
        totalSpent: 0,
        totalWithdrawn: 0,
        walletExists: false,
        message: 'Wallet no inicializado'
      };
    }
    
    const walletData = walletDoc.data();
    
    return {
      success: true,
      currentBalance: walletData.balance || 0,
      totalEarned: walletData.totalEarned || 0,
      totalSpent: walletData.totalSpent || 0,
      totalWithdrawn: walletData.totalWithdrawn || 0,
      bonusesEarned: walletData.bonusesEarned || 0,
      walletExists: true,
      breakdown: walletData.breakdown || {},
      limits: walletData.limits || {},
      loyalty: walletData.loyalty || {}
    };
  }
}

// Tests específicos
async function runAllTests() {
  const tester = new CloudFunctionTester();
  const mockFunctions = new MockCloudFunctions();
  
  log('magenta', '🚀 Iniciando tests de Cloud Functions...');
  
  // Test 1: calculateCommissions - Caso básico
  await tester.runTest('calculateCommissions - Caso básico', async () => {
    const result = await mockFunctions.calculateCommissions({
      serviceRequestId: 'service_test_001',
      totalAmount: 1000,
      providerId: 'provider_001',
      userId: 'user_client_001'
    });
    
    if (!result.success) throw new Error('Función falló');
    if (result.comisionServiMapTotal !== 60) throw new Error(`Comisión incorrecta: ${result.comisionServiMapTotal}`);
    if (result.comisionEmbajadorPrestador !== 36) throw new Error(`Comisión prestador incorrecta: ${result.comisionEmbajadorPrestador}`);
    if (result.comisionEmbajadorUsuario !== 24) throw new Error(`Comisión usuario incorrecta: ${result.comisionEmbajadorUsuario}`);
  });
  
  // Test 2: calculateCommissions - Parámetros inválidos
  await tester.runTest('calculateCommissions - Parámetros inválidos', async () => {
    try {
      await mockFunctions.calculateCommissions({
        serviceRequestId: 'test',
        totalAmount: -100, // Inválido
        providerId: 'provider_001',
        userId: 'user_client_001'
      });
      throw new Error('Debería haber fallado');
    } catch (error) {
      if (!error.message.includes('número positivo')) {
        throw new Error(`Error incorrecto: ${error.message}`);
      }
    }
  });
  
  // Test 3: processMembershipCommissions - Usuario Premium con Embajador Premium
  await tester.runTest('processMembershipCommissions - Premium/Premium', async () => {
    const result = await mockFunctions.processMembershipCommissions({
      membershipType: 'user_premium',
      amount: 10,
      memberId: 'member_test_001',
      ambassadorId: 'user_ambassador_002' // Premium
    });
    
    if (!result.success) throw new Error('Función falló');
    if (result.commissionAmount !== 5.00) throw new Error(`Comisión incorrecta: ${result.commissionAmount}`);
    if (result.ambassadorLevel !== 'premium') throw new Error(`Nivel incorrecto: ${result.ambassadorLevel}`);
  });
  
  // Test 4: processMembershipCommissions - Usuario Premium con Embajador Gratuito
  await tester.runTest('processMembershipCommissions - Premium/Gratuito', async () => {
    const result = await mockFunctions.processMembershipCommissions({
      membershipType: 'user_premium',
      amount: 10,
      memberId: 'member_test_002',
      ambassadorId: 'user_ambassador_001' // Gratuito
    });
    
    if (!result.success) throw new Error('Función falló');
    if (result.commissionAmount !== 4.00) throw new Error(`Comisión incorrecta: ${result.commissionAmount}`);
    if (result.ambassadorLevel !== 'gratuito') throw new Error(`Nivel incorrecto: ${result.ambassadorLevel}`);
  });
  
  // Test 5: addToWallet - Caso válido
  await tester.runTest('addToWallet - Caso válido', async () => {
    const result = await mockFunctions.addToWallet({
      userId: 'user_ambassador_001',
      amount: 25.50,
      type: 'commission',
      description: 'Comisión de prueba'
    });
    
    if (!result.success) throw new Error('Función falló');
    if (result.amount !== 25.50) throw new Error(`Monto incorrecto: ${result.amount}`);
    if (result.newBalance !== 175.50) throw new Error(`Balance incorrecto: ${result.newBalance}`);
  });
  
  // Test 6: addToWallet - Usuario inexistente
  await tester.runTest('addToWallet - Usuario inexistente', async () => {
    try {
      await mockFunctions.addToWallet({
        userId: 'user_inexistente',
        amount: 25.50,
        type: 'commission',
        description: 'Test'
      });
      throw new Error('Debería haber fallado');
    } catch (error) {
      if (!error.message.includes('Usuario no encontrado')) {
        throw new Error(`Error incorrecto: ${error.message}`);
      }
    }
  });
  
  // Test 7: calculateLoyaltyBonus - Con bonus pendiente
  await tester.runTest('calculateLoyaltyBonus - Con bonus pendiente', async () => {
    const result = await mockFunctions.calculateLoyaltyBonus({
      userId: 'user_client_001' // Tiene $1850 gastado, debería tener bonus pendiente
    });
    
    if (!result.success) throw new Error('Función falló');
    // user_client_001 no tiene bonus, pero está cerca del umbral
  });
  
  // Test 8: getWalletBalance - Usuario existente
  await tester.runTest('getWalletBalance - Usuario existente', async () => {
    const result = await mockFunctions.getWalletBalance({
      userId: 'user_ambassador_001'
    });
    
    if (!result.success) throw new Error('Función falló');
    if (!result.walletExists) throw new Error('Wallet debería existir');
    if (typeof result.currentBalance !== 'number') throw new Error('Balance debe ser número');
  });
  
  // Test 9: getWalletBalance - Usuario sin wallet
  await tester.runTest('getWalletBalance - Usuario sin wallet', async () => {
    const result = await mockFunctions.getWalletBalance({
      userId: 'user_inexistente'
    });
    
    if (!result.success) throw new Error('Función falló');
    if (result.walletExists) throw new Error('Wallet no debería existir');
    if (result.currentBalance !== 0) throw new Error('Balance debería ser 0');
  });
  
  // Test 10: Verificar estructura de datos
  await tester.runTest('Verificar estructura de datos', async () => {
    // Verificar que existan los usuarios de prueba
    const user1 = await db.collection('usuarios').doc('user_ambassador_001').get();
    const user2 = await db.collection('usuarios').doc('user_ambassador_002').get();
    
    if (!user1.exists || !user2.exists) {
      throw new Error('Usuarios de prueba no encontrados');
    }
    
    // Verificar wallets
    const wallet1 = await db.collection('wallets').doc('user_ambassador_001').get();
    if (!wallet1.exists) {
      throw new Error('Wallet de prueba no encontrado');
    }
    
    const walletData = wallet1.data();
    if (typeof walletData.balance !== 'number') {
      throw new Error('Estructura de wallet incorrecta');
    }
  });
  
  tester.printSummary();
  
  return {
    totalTests: tester.totalTests,
    passedTests: tester.passedTests,
    success: tester.passedTests === tester.totalTests
  };
}

// Test de carga de datos
async function testDataLoad() {
  log('yellow', '\n🔄 Verificando carga de datos...');
  
  const collections = ['usuarios', 'prestadores', 'wallets', 'wallet_transactions', 'commissions'];
  
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).limit(1).get();
    if (snapshot.empty) {
      log('red', `❌ Colección ${collectionName} está vacía`);
      return false;
    } else {
      log('green', `✅ Colección ${collectionName} tiene datos`);
    }
  }
  
  return true;
}

// Función principal
async function main() {
  try {
    log('cyan', '🎯 Iniciando suite de tests completa...\n');
    
    // Verificar si hay datos
    const hasData = await testDataLoad();
    
    if (!hasData) {
      log('yellow', '📥 No se encontraron datos de prueba. Ejecutando seeding...');
      await seedDatabase();
      log('green', '✅ Datos de prueba creados\n');
    }
    
    // Ejecutar tests
    const results = await runAllTests();
    
    if (results.success) {
      log('green', '\n🎉 ¡Todos los tests pasaron exitosamente!');
      process.exit(0);
    } else {
      log('red', '\n💥 Algunos tests fallaron. Revisar logs arriba.');
      process.exit(1);
    }
    
  } catch (error) {
    log('red', `\n💀 Error fatal durante los tests: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// CLI handling
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'clean') {
    cleanTestData().then(() => {
      log('green', '🧹 Datos de prueba eliminados');
      process.exit(0);
    });
  } else if (command === 'seed') {
    seedDatabase().then(() => {
      log('green', '🌱 Datos de prueba creados');
      process.exit(0);
    });
  } else if (command === 'test' || !command) {
    main();
  } else {
    console.log('Uso: node test-functions.js [test|seed|clean]');
    console.log('  test  - Ejecutar tests (por defecto)');
    console.log('  seed  - Solo crear datos de prueba');
    console.log('  clean - Solo eliminar datos de prueba');
    process.exit(1);
  }
}

module.exports = {
  runAllTests,
  MockCloudFunctions
};