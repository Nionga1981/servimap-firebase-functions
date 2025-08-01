// create-admin-doc.js - Crear documento de admin en Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

// Configuración de Firebase (obtenida de Firebase CLI)
const firebaseConfig = {
  apiKey: "AIzaSyCeqjYpRb12DP3AthBG9JdFk_jpgPTVa70",
  authDomain: "servimap-nyniz.firebaseapp.com",
  projectId: "servimap-nyniz",
  databaseURL: "https://servimap-nyniz-default-rtdb.firebaseio.com",
  storageBucket: "servimap-nyniz.firebasestorage.app",
  messagingSenderId: "812822422605",
  appId: "1:812822422605:web:213465574b424deb84a804",
  measurementId: "G-7QKCKB2GVF"
};

async function createAdminDocument() {
  try {
    console.log('🔧 Inicializando Firebase...');
    
    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    const adminUID = "LuHDo2YcuJaIPj31fofswLeuvs43";
    
    console.log('📝 Creando documento de administrador...');
    
    // Crear documento en Firestore
    const adminDocRef = doc(db, 'users', adminUID);
    await setDoc(adminDocRef, {
      email: "admin@servimap.com",
      displayName: "Administrador ServiMap",
      role: "admin",
      isAdmin: true,
      permissions: ["all"],
      createdAt: serverTimestamp(),
      lastLogin: null,
      uid: adminUID,
      setupComplete: true
    }, { merge: true });
    
    console.log('✅ Documento creado exitosamente en Firestore');
    console.log('🆔 UID:', adminUID);
    console.log('📧 Email: admin@servimap.com');
    
    console.log('\n🎉 ¡Listo! Documento de admin creado.');
    console.log('Ahora solo faltan los custom claims para completar la configuración.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

createAdminDocument();