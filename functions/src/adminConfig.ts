// adminConfig.ts - Configuración final del administrador
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Función para configurar completamente el usuario administrador
 * UID: LuHDo2YcuJaIPj31fofswLeuvs43
 */
export const configureAdmin = onCall(async (request) => {
  try {
    const adminUID = "LuHDo2YcuJaIPj31fofswLeuvs43";
    const adminEmail = "admin@servimap.com";
    
    console.log('🔧 Configurando administrador con UID:', adminUID);
    
    // 1. Asignar custom claims de admin
    await admin.auth().setCustomUserClaims(adminUID, {
      admin: true,
      role: 'super_admin',
      permissions: ['all'],
      isAdmin: true
    });
    console.log('✅ Custom claims asignados');
    
    // 2. Crear documento en Firestore
    await db.collection('users').doc(adminUID).set({
      email: adminEmail,
      displayName: 'Administrador ServiMap',
      role: 'admin',
      isAdmin: true,
      permissions: ['all'],
      createdAt: Timestamp.now(),
      lastLogin: null,
      uid: adminUID
    }, { merge: true });
    console.log('✅ Documento creado en Firestore');
    
    // 3. Verificar que todo esté correcto
    const userRecord = await admin.auth().getUser(adminUID);
    const userDoc = await db.collection('users').doc(adminUID).get();
    
    console.log('✅ Verificación completa');
    
    return {
      success: true,
      message: 'Administrador configurado completamente',
      data: {
        uid: adminUID,
        email: adminEmail,
        customClaims: userRecord.customClaims,
        firestoreDoc: userDoc.exists ? userDoc.data() : null
      }
    };
    
  } catch (error) {
    console.error('❌ Error configurando admin:', error);
    throw new HttpsError('internal', `Error: ${error.message}`);
  }
});