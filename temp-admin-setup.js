// Ejecutar este comando en Firebase Functions Shell:
// firebase functions:shell
// setAdminClaims({data: {uid: 'TU_UID_AQUI'}})

const admin = require('firebase-admin');

exports.setAdminClaims = async (data) => {
  const uid = data.uid || 'REEMPLAZAR_CON_UID';
  
  try {
    await admin.auth().setCustomUserClaims(uid, {
      admin: true,
      role: 'super_admin',
      permissions: ['all']
    });
    
    console.log('✅ Custom claims asignados correctamente');
    return { success: true, uid };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error: error.message };
  }
};