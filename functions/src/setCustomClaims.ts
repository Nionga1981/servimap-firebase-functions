// setCustomClaims.ts - Función para asignar custom claims
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

/**
 * Función HTTP pública para asignar custom claims al admin
 * Solo debe ejecutarse una vez para setup inicial
 */
export const setCustomClaims = onRequest({ cors: true }, async (req, res) => {
  try {
    const adminUID = "LuHDo2YcuJaIPj31fofswLeuvs43";
    
    console.log('🔧 Asignando custom claims al admin...');
    console.log('🆔 UID:', adminUID);
    
    // Verificar que el usuario existe
    const userRecord = await admin.auth().getUser(adminUID);
    console.log('✅ Usuario encontrado:', userRecord.email);
    
    // Asignar custom claims de administrador
    await admin.auth().setCustomUserClaims(adminUID, {
      admin: true,
      role: 'super_admin',
      permissions: ['all'],
      isAdmin: true
    });
    
    console.log('✅ Custom claims asignados exitosamente');
    
    // Verificar que se asignaron correctamente
    const updatedUser = await admin.auth().getUser(adminUID);
    
    const response = {
      success: true,
      message: '🎉 Custom claims asignados correctamente!',
      uid: adminUID,
      email: userRecord.email,
      customClaims: updatedUser.customClaims,
      instructions: [
        '1. Cierra sesión si estás logueado en ServiMap',
        '2. Ve a https://servi-map.com',
        '3. Haz clic en el punto (•) en el footer o presiona Ctrl+Alt+A',
        '4. Ingresa: admin@servimap.com / AdminServi2024!',
        '5. ¡Ahora deberías tener acceso completo!'
      ],
      note: 'Los custom claims se actualizan cuando el usuario inicia sesión nuevamente'
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Error asignando custom claims:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error asignando custom claims'
    });
  }
});