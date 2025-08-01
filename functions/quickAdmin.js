// quickAdmin.js - Configuración rápida del administrador
const admin = require('firebase-admin');

// Configuración específica del proyecto
const serviceAccount = {
  projectId: 'servimap-nyniz'
};

// Inicializar con configuración mínima
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'servimap-nyniz'
  });
}

const db = admin.firestore();

async function configureAdminUser() {
  const adminUID = "LuHDo2YcuJaIPj31fofswLeuvs43";
  const adminEmail = "admin@servimap.com";
  
  try {
    console.log('🔧 Configurando administrador con UID:', adminUID);
    
    // 1. Verificar usuario existe
    try {
      const userRecord = await admin.auth().getUser(adminUID);
      console.log('✅ Usuario encontrado:', userRecord.email);
    } catch (error) {
      console.log('❌ Usuario no encontrado:', error.message);
      return;
    }
    
    // 2. Asignar custom claims
    await admin.auth().setCustomUserClaims(adminUID, {
      admin: true,
      role: 'super_admin',
      permissions: ['all'],
      isAdmin: true
    });
    console.log('✅ Custom claims asignados');
    
    // 3. Crear documento en Firestore
    await db.collection('users').doc(adminUID).set({
      email: adminEmail,
      displayName: 'Administrador ServiMap',
      role: 'admin',
      isAdmin: true,
      permissions: ['all'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
      uid: adminUID,
      setupComplete: true
    }, { merge: true });
    console.log('✅ Documento creado en Firestore');
    
    // 4. Verificación final
    const updatedUser = await admin.auth().getUser(adminUID);
    const userDoc = await db.collection('users').doc(adminUID).get();
    
    console.log('\n🎉 ¡CONFIGURACIÓN COMPLETA!');
    console.log('═══════════════════════════════');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Contraseña: AdminServi2024!');
    console.log('🆔 UID:', adminUID);
    console.log('🔐 Custom Claims:', JSON.stringify(updatedUser.customClaims, null, 2));
    console.log('📄 Firestore Doc:', userDoc.exists ? 'Creado' : 'Error');
    console.log('\n📝 INSTRUCCIONES:');
    console.log('1. Ve a https://servi-map.com');
    console.log('2. Haz clic en el punto (•) en el footer o presiona Ctrl+Alt+A');
    console.log('3. Ingresa: admin@servimap.com / AdminServi2024!');
    console.log('4. ¡Listo! Ya eres administrador');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

configureAdminUser();