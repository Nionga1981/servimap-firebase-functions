// create-admin-rest.js - Crear documento de admin usando REST API
const https = require('https');

async function createAdminDocumentViaREST() {
  const adminUID = "LuHDo2YcuJaIPj31fofswLeuvs43";
  const projectId = "servimap-nyniz";
  
  // Documento a crear
  const adminDoc = {
    fields: {
      email: { "stringValue": "admin@servimap.com" },
      displayName: { "stringValue": "Administrador ServiMap" },
      role: { "stringValue": "admin" },
      isAdmin: { "booleanValue": true },
      permissions: {
        "arrayValue": {
          "values": [{ "stringValue": "all" }]
        }
      },
      uid: { "stringValue": adminUID },
      createdAt: { "timestampValue": new Date().toISOString() },
      lastLogin: { "nullValue": null },
      setupComplete: { "booleanValue": true }
    }
  };

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${adminUID}`;
  
  console.log('🔧 Creando documento via REST API...');
  console.log('📍 URL:', url);
  console.log('📄 Documento:', JSON.stringify(adminDoc, null, 2));
  
  // Nota: Esta petición fallaría sin token de autenticación OAuth2
  console.log('❌ ERROR: Se requiere token OAuth2 válido');
  console.log('🔑 Solución: Usar Firebase Console manualmente');
  
  return false;
}

createAdminDocumentViaREST();