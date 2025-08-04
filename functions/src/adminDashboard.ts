// adminDashboard.ts - Cloud Functions para el panel de administración
import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Obtiene estadísticas completas para el dashboard de admin
 */
export const getAdminStats = onCall(async (request) => {
  try {
    // Verificar que el usuario es admin
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const uid = request.auth.uid;
    
    // Verificar permisos de admin
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      throw new HttpsError('permission-denied', 'No tienes permisos de administrador');
    }

    console.log('📊 Obteniendo estadísticas de admin para:', uid);

    // Obtener estadísticas en paralelo
    const [
      usuariosCount,
      prestadoresCount,
      serviceRequestsCount,
      completedServicesCount,
      walletTransactionsSnapshot,
      ratingsSnapshot,
      activeChatsCount,
      emergencyServicesCount
    ] = await Promise.all([
      // Contar usuarios
      db.collection('usuarios').count().get(),
      
      // Contar prestadores
      db.collection('prestadores').count().get(),
      
      // Contar solicitudes de servicio totales
      db.collection('service_requests').count().get(),
      
      // Contar servicios completados
      db.collection('service_requests')
        .where('estado', '==', 'completado')
        .count().get(),
      
      // Obtener transacciones de wallet para calcular ingresos
      db.collection('wallet_transactions')
        .where('type', '==', 'service_payment')
        .limit(1000).get(),
      
      // Obtener ratings para promedio
      db.collection('service_requests')
        .where('rating', '>=', 1)
        .limit(1000).get(),
      
      // Contar chats activos
      db.collection('chats')
        .where('status', '==', 'active')
        .count().get(),
      
      // Contar servicios de emergencia
      db.collection('service_requests')
        .where('tipo', '==', 'emergencia')
        .count().get()
    ]);

    // Calcular ingresos totales
    let totalRevenue = 0;
    let systemCommissions = 0;
    walletTransactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.amount && typeof data.amount === 'number') {
        totalRevenue += data.amount;
        // Calcular comisiones del sistema (10%)
        systemCommissions += data.amount * 0.1;
      }
    });

    // Calcular rating promedio
    let totalRating = 0;
    let ratingCount = 0;
    ratingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.rating && typeof data.rating === 'number') {
        totalRating += data.rating;
        ratingCount++;
      }
    });
    const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : '0.0';

    // Obtener estadísticas adicionales
    const totalUsers = usuariosCount.data().count + prestadoresCount.data().count;
    const totalServices = serviceRequestsCount.data().count;
    const completedServices = completedServicesCount.data().count;
    const activeChats = activeChatsCount.data().count;
    const emergencyServices = emergencyServicesCount.data().count;

    // Calcular tasas
    const completionRate = totalServices > 0 ? ((completedServices / totalServices) * 100).toFixed(1) : '0.0';
    
    const stats = {
      // Métricas principales
      totalUsers,
      totalServices,
      completedServices,
      avgRating: parseFloat(avgRating),
      totalRevenue: Math.round(totalRevenue),
      systemCommissions: Math.round(systemCommissions),
      
      // Métricas adicionales
      activeUsers: usuariosCount.data().count,
      activeProviders: prestadoresCount.data().count,
      activeChats,
      emergencyServices,
      completionRate: parseFloat(completionRate),
      
      // Metadata
      lastUpdated: Timestamp.now(),
      generatedBy: uid
    };

    console.log('✅ Estadísticas generadas:', stats);
    return { success: true, stats };

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    throw new HttpsError('internal', `Error: ${error.message}`);
  }
});

/**
 * Obtiene lista de usuarios para gestión
 */
export const getUsers = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const uid = request.auth.uid;
    const { limit = 50, offset = 0, type = 'all' } = request.data || {};
    
    // Verificar permisos de admin
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      throw new HttpsError('permission-denied', 'No tienes permisos de administrador');
    }

    const users = [];
    
    if (type === 'all' || type === 'usuarios') {
      const usuariosSnapshot = await db.collection('usuarios')
        .limit(limit)
        .offset(offset)
        .get();
      
      users.push(...usuariosSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        type: 'usuario'
      })));
    }
    
    if (type === 'all' || type === 'prestadores') {
      const prestadoresSnapshot = await db.collection('prestadores')
        .limit(limit)
        .offset(offset)
        .get();
      
      users.push(...prestadoresSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        type: 'prestador'
      })));
    }

    return { success: true, users, total: users.length };

  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    throw new HttpsError('internal', `Error: ${error.message}`);
  }
});

/**
 * Obtiene reportes de analytics avanzados
 */
export const getAnalyticsReport = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const uid = request.auth.uid;
    const { dateRange = 30 } = request.data || {};
    
    // Verificar permisos de admin
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      throw new HttpsError('permission-denied', 'No tienes permisos de administrador');
    }

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - dateRange);
    const fromTimestamp = Timestamp.fromDate(dateFrom);

    // Obtener datos de analytics
    const [
      recentServices,
      recentTransactions,
      activeUsers,
      topProviders
    ] = await Promise.all([
      // Servicios recientes
      db.collection('service_requests')
        .where('timestampCreacion', '>=', fromTimestamp)
        .orderBy('timestampCreacion', 'desc')
        .limit(100)
        .get(),
      
      // Transacciones recientes
      db.collection('wallet_transactions')
        .where('timestamp', '>=', fromTimestamp)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get(),
      
      // Usuarios activos (que han hecho solicitudes)
      db.collection('service_requests')
        .where('timestampCreacion', '>=', fromTimestamp)
        .limit(500)
        .get(),
      
      // Top prestadores por servicios completados
      db.collection('service_requests')
        .where('estado', '==', 'completado')
        .where('timestampCreacion', '>=', fromTimestamp)
        .limit(200)
        .get()
    ]);

    // Procesar datos
    const servicesByDay = {};
    const revenueByDay = {};
    const userActivity = new Set();
    const providerStats = {};

    // Analizar servicios por día
    recentServices.docs.forEach(doc => {
      const data = doc.data();
      const date = data.timestampCreacion.toDate().toISOString().split('T')[0];
      servicesByDay[date] = (servicesByDay[date] || 0) + 1;
      
      if (data.usuarioId) {
        userActivity.add(data.usuarioId);
      }
    });

    // Analizar ingresos por día
    recentTransactions.docs.forEach(doc => {
      const data = doc.data();
      const date = data.timestamp.toDate().toISOString().split('T')[0];
      revenueByDay[date] = (revenueByDay[date] || 0) + (data.amount || 0);
    });

    // Analizar top prestadores
    topProviders.docs.forEach(doc => {
      const data = doc.data();
      if (data.prestadorId) {
        providerStats[data.prestadorId] = (providerStats[data.prestadorId] || 0) + 1;
      }
    });

    const topProvidersList = Object.entries(providerStats)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([providerId, count]) => ({ providerId, completedServices: count as number }));

    const analytics = {
      dateRange,
      totalServices: recentServices.size,
      totalRevenue: Object.values(revenueByDay).reduce((sum: number, val: any) => sum + (val as number), 0),
      activeUsers: userActivity.size,
      servicesByDay,
      revenueByDay,
      topProviders: topProvidersList,
      lastUpdated: Timestamp.now()
    };

    return { success: true, analytics };

  } catch (error) {
    console.error('❌ Error obteniendo analytics:', error);
    throw new HttpsError('internal', `Error: ${error.message}`);
  }
});

/**
 * Exporta datos del sistema
 */
export const exportSystemData = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const uid = request.auth.uid;
    const { format = 'json', collections = ['usuarios', 'prestadores', 'service_requests'] } = request.data || {};
    
    // Verificar permisos de admin
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      throw new HttpsError('permission-denied', 'No tienes permisos de administrador');
    }

    const exportData = {};
    
    // Exportar colecciones solicitadas
    for (const collection of collections) {
      try {
        const snapshot = await db.collection(collection).limit(1000).get();
        exportData[collection] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.log(`⚠️ Error exportando ${collection}:`, error.message);
        exportData[collection] = [];
      }
    }

    // Log de actividad
    await db.collection('activity_logs').add({
      userId: uid,
      userType: 'admin',
      action: 'EXPORT_DATA',
      description: `Admin exportó datos: ${collections.join(', ')}`,
      timestamp: Timestamp.now(),
      metadata: { format, collections }
    });

    return { 
      success: true, 
      data: exportData,
      exportedAt: Timestamp.now(),
      exportedBy: uid,
      format
    };

  } catch (error) {
    console.error('❌ Error exportando datos:', error);
    throw new HttpsError('internal', `Error: ${error.message}`);
  }
});