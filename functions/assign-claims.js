// assign-claims.js - Asignar custom claims usando Firebase Admin
const admin = require('firebase-admin');

// Usar el proyecto actual autenticado
admin.initializeApp({
  projectId: 'servimap-nyniz'
});

async function assignCustomClaims() {
  const adminUID = "LuHDo2YcuJaIPj31fofswLeuvs43";
  
  try {
    console.log('🔧 Asignando custom claims al administrador...');
    console.log('🆔 UID:', adminUID);
    
    // Verificar que el usuario existe
    try {
      const userRecord = await admin.auth().getUser(adminUID);
      console.log('✅ Usuario encontrado:', userRecord.email);
    } catch (error) {
      console.error('❌ Usuario no encontrado:', error.message);
      return;
    }
    
    // Asignar custom claims
    await admin.auth().setCustomUserClaims(adminUID, {
      admin: true,
      role: 'super_admin',
      permissions: ['all'],
      isAdmin: true
    });
    
    console.log('✅ Custom claims asignados exitosamente!');
    
    // Verificar
    const updatedUser = await admin.auth().getUser(adminUID);
    console.log('🔐 Custom claims verificados:', JSON.stringify(updatedUser.customClaims, null, 2));
    
    console.log('\n🎉 ¡TODO LISTO!');
    console.log('═══════════════════════════════');
    console.log('📧 Email: admin@servimap.com');
    console.log('🔑 Contraseña: AdminServi2024!');
    console.log('');
    console.log('📝 INSTRUCCIONES IMPORTANTES:');
    console.log('1. Si ya estás logueado en ServiMap, CIERRA SESIÓN primero');
    console.log('2. Ve a https://servi-map.com');
    console.log('3. Haz clic en el punto (•) en el footer o presiona Ctrl+Alt+A');
    console.log('4. Ingresa: admin@servimap.com / AdminServi2024!');
    console.log('5. ¡Ahora deberías tener acceso completo al panel!');
    console.log('');
    console.log('⚠️ NOTA: Los custom claims se actualizan cuando el usuario inicia sesión nuevamente.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

assignCustomClaims();