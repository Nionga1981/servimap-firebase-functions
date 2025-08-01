// autoAdmin.ts - Auto-configuración del administrador
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Función HTTP que configura automáticamente el admin
 * Solo debe ejecutarse una vez
 */
export const setupAdmin = onRequest(async (req, res) => {
  try {
    const adminUID = "LuHDo2YcuJaIPj31fofswLeuvs43";
    const adminEmail = "admin@servimap.com";
    
    console.log('🔧 Auto-configurando administrador...');
    
    // 1. Verificar que el usuario existe
    const userRecord = await admin.auth().getUser(adminUID);
    console.log('✅ Usuario encontrado:', userRecord.email);
    
    // 2. Asignar custom claims de admin
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
      createdAt: Timestamp.now(),
      lastLogin: null,
      uid: adminUID,
      setupComplete: true
    }, { merge: true });
    console.log('✅ Documento creado en Firestore');
    
    // 4. Verificar configuración
    const updatedUser = await admin.auth().getUser(adminUID);
    const userDoc = await db.collection('users').doc(adminUID).get();
    
    const response = {
      success: true,
      message: '🎉 ¡Administrador configurado completamente!',
      credentials: {
        email: adminEmail,
        password: 'AdminServi2024!',
        uid: adminUID
      },
      verification: {
        customClaims: updatedUser.customClaims,
        firestoreDoc: userDoc.exists ? userDoc.data() : null
      },
      instructions: [
        '1. Ve a https://servi-map.com',
        '2. Haz clic en el punto (•) en el footer o presiona Ctrl+Alt+A',
        '3. Ingresa: admin@servimap.com / AdminServi2024!',
        '4. ¡Listo! Ya eres administrador'
      ]
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error configurando administrador'
    });
  }
});