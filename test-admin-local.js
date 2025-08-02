#!/usr/bin/env node
// test-admin-local.js - Probar admin dashboard localmente

const admin = require('firebase-admin');

// Configuración para emulador
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'servimap-nyniz'
});

async function testAdminSetup() {
  try {
    console.log('🧪 Probando configuración de admin...');
    
    const db = admin.firestore();
    const auth = admin.auth();
    
    // Crear usuario de prueba
    const testEmail = 'admin@test.com';
    let userRecord;
    
    try {
      userRecord = await auth.createUser({
        email: testEmail,
        password: 'test123',
        emailVerified: true,
        displayName: 'Admin Test'
      });
      console.log('✅ Usuario test creado:', userRecord.uid);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        const users = await auth.getUserByEmail(testEmail);
        userRecord = users;
        console.log('✅ Usuario test ya existe:', userRecord.uid);
      } else {
        throw error;
      }
    }
    
    // Crear documento en Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: testEmail,
      displayName: 'Admin Test',
      role: 'admin',
      isAdmin: true,
      permissions: ['all'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
      uid: userRecord.uid,
      setupComplete: true
    });
    
    console.log('✅ Documento admin creado en Firestore');
    
    // Asignar custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      isAdmin: true,
      permissions: ['all']
    });
    
    console.log('✅ Custom claims asignados');
    
    // Probar obtener estadísticas
    console.log('📊 Probando obtención de estadísticas...');
    
    const stats = {
      totalUsers: 0,
      totalProviders: 0,
      totalServices: 0,
      completedServices: 0,
      totalRevenue: 0,
      averageRating: 0,
      activeChats: 0,
      emergencyServices: 0
    };
    
    // Contar documentos de prueba
    const usersCount = await db.collection('usuarios').count().get();
    const providersCount = await db.collection('prestadores').count().get();
    
    stats.totalUsers = usersCount.data().count;
    stats.totalProviders = providersCount.data().count;
    
    console.log('📋 Estadísticas obtenidas:', stats);
    
    console.log(`
🎉 ¡Test completado exitosamente!

📧 Email: ${testEmail}
🔑 Contraseña: test123
🆔 UID: ${userRecord.uid}

Para probar el admin dashboard:
1. Inicia los emuladores: firebase emulators:start
2. Ve a: http://localhost:5000/admin.html
3. Usa las credenciales de arriba
    `);
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
  
  process.exit(0);
}

testAdminSetup();