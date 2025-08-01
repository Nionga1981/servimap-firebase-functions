// createAdminDoc.ts - HTTP function to create admin document
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * HTTP function to create admin document in Firestore
 * Public access for initial setup only
 */
export const createAdminDoc = onRequest({ cors: true }, async (req, res) => {
  try {
    const adminUID = "LuHDo2YcuJaIPj31fofswLeuvs43";
    const adminEmail = "admin@servimap.com";
    
    console.log('🔧 Creating admin document...');
    
    // Create admin document in Firestore
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
    
    console.log('✅ Admin document created');
    
    // Also try to set custom claims
    try {
      await admin.auth().setCustomUserClaims(adminUID, {
        admin: true,
        role: 'super_admin',
        permissions: ['all'],
        isAdmin: true
      });
      console.log('✅ Custom claims set');
    } catch (claimsError) {
      console.log('⚠️ Custom claims error:', claimsError.message);
    }
    
    const response = {
      success: true,
      message: '🎉 Admin document created successfully!',
      data: {
        uid: adminUID,
        email: adminEmail,
        document: 'Created in Firestore',
        customClaims: 'Attempted to set'
      },
      credentials: {
        email: adminEmail,
        password: 'AdminServi2024!'
      },
      accessInstructions: [
        '1. Go to https://servi-map.com',
        '2. Click the dot (•) in footer or press Ctrl+Alt+A',
        '3. Login with: admin@servimap.com / AdminServi2024!',
        '4. You are now admin!'
      ]
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error creating admin document'
    });
  }
});