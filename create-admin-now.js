// create-admin-now.js - Crear documento de admin con reglas temporales
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

// Configuración de Firebase
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
    console.log('🆔 UID:', adminUID);
    
    // Crear documento en Firestore
    const adminDocRef = doc(db, 'users', adminUID);
    
    const adminData = {
      email: "admin@servimap.com",
      displayName: "Administrador ServiMap",
      role: "admin",
      isAdmin: true,
      permissions: ["all"],
      uid: adminUID,
      createdAt: serverTimestamp(),
      lastLogin: null,
      setupComplete: true
    };
    
    console.log('📄 Datos a escribir:', adminData);
    
    await setDoc(adminDocRef, adminData, { merge: true });
    
    console.log('✅ ¡Documento creado exitosamente!');
    console.log('');
    console.log('🎉 ¡CONFIGURACIÓN COMPLETA!');
    console.log('═══════════════════════════════');
    console.log('📧 Email: admin@servimap.com');
    console.log('🔑 Contraseña: AdminServi2024!');
    console.log('🆔 UID:', adminUID);
    console.log('');
    console.log('📝 INSTRUCCIONES PARA ACCEDER:');
    console.log('1. Ve a https://servi-map.com');
    console.log('2. Haz clic en el punto (•) en el footer o presiona Ctrl+Alt+A');
    console.log('3. Ingresa: admin@servimap.com / AdminServi2024!');
    console.log('4. ¡Listo! Ya eres administrador');
    console.log('');
    console.log('⚠️ IMPORTANTE: Restaurar reglas de Firestore después de probar');
    
  } catch (error) {
    console.error('❌ Error creando documento:', error);
    console.log('Código de error:', error.code);
    console.log('Mensaje:', error.message);
  }
  
  process.exit(0);
}

createAdminDocument();