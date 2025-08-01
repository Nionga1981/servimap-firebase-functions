// setup-admin.js - Script para crear el primer usuario administrador
const admin = require('firebase-admin');

// Inicializar Firebase Admin con el proyecto específico
admin.initializeApp({
  projectId: 'servimap-nyniz'
});

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

Ahora puedes usar estas credenciales para acceder al panel de administración:
1. Ve a https://servi-map.com
2. Haz clic en el punto (•) en el footer O presiona Ctrl+Alt+A
3. Ingresa las credenciales de arriba
4. ¡Listo! Ya eres administrador
    `);
    
  } catch (error) {
    console.error('❌ Error creando administrador:', error);
    if (error.code === 'auth/email-already-exists') {
      console.log('ℹ️  El usuario ya existe. Solo asignando permisos...');
      
      // Obtener usuario existente
      const existingUser = await admin.auth().getUserByEmail(adminEmail);
      
      // Asignar custom claims
      await admin.auth().setCustomUserClaims(existingUser.uid, {
        admin: true,
        role: 'super_admin',
        permissions: ['all']
      });
      
      console.log('✅ Permisos de admin asignados al usuario existente');
    }
  }
  
  process.exit(0);
}

createFirstAdmin();