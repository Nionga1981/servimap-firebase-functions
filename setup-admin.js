// setup-admin.js - Script para crear el primer usuario administrador
const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function createFirstAdmin() {
  try {
    console.log('🔧 Creando usuario administrador...');
    
    // Datos del admin
    const adminEmail = 'admin@servimap.com';
    const adminPassword = 'AdminServi2024!';
    
    // Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: adminEmail,
      password: adminPassword,
      emailVerified: true,
      displayName: 'Administrador ServiMap'
    });
    
    console.log('✅ Usuario creado:', userRecord.uid);
    
    // Asignar custom claims de admin
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: true,
      role: 'super_admin',
      permissions: ['all']
    });
    
    console.log('✅ Permisos de admin asignados');
    
    // Crear documento en Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email: adminEmail,
      displayName: 'Administrador ServiMap',
      role: 'admin',
      isAdmin: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null
    });
    
    console.log('✅ Documento de usuario creado en Firestore');
    
    console.log(`
🎉 ¡Administrador creado exitosamente!

📧 Email: ${adminEmail}
🔑 Contraseña: ${adminPassword}
🆔 UID: ${userRecord.uid}

Ahora puedes usar estas credenciales para acceder al panel de administración.
    `);
    
  } catch (error) {
    console.error('❌ Error creando administrador:', error);
  }
  
  process.exit(0);
}

createFirstAdmin();