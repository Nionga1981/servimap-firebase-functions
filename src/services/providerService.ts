
// src/services/providerService.ts
"use client"; // Necesario si usamos hooks o interactuamos con APIs de navegador

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

// En una aplicación real, importarías tu instancia de Firestore y funciones de Firebase:
// import { db } from '@/lib/firebase'; // Asumiendo que tienes firebase.ts configurado
// import { doc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';

interface ProviderUpdatePayload {
  isAvailable: boolean;
  lastConnection: number;
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: number;
  } | null;
}

interface ProviderRegistrationData {
    name: string;
    specialties: string[];
    selectedCategoryIds: string[];
    newCategoryName?: string;
    codigoEmbajador?: string;
}


/**
 * Actualiza la disponibilidad y la ubicación en tiempo real de un proveedor.
 * En una app real, esto interactuaría con Firestore.
 */
export const updateProviderRealtimeStatus = async (
  providerId: string,
  isAvailable: boolean,
  location?: { lat: number; lng: number }
): Promise<void> => {
  console.log(`[ProviderService] Actualizando estado para ${providerId}:`);
  console.log(`  Disponible: ${isAvailable}`);

  const updates: ProviderUpdatePayload = {
    isAvailable: isAvailable,
    lastConnection: Date.now(), // Usar serverTimestamp() de Firestore en una app real
  };

  if (isAvailable && location) {
    updates.currentLocation = {
      lat: location.lat,
      lng: location.lng,
      timestamp: Date.now(),
    };
    console.log(`  Ubicación Actual: Lat ${location.lat}, Lng ${location.lng}`);
  } else if (!isAvailable) {
    updates.currentLocation = null; // En Firestore real, usarías deleteField() o null
    console.log(`  Ubicación Actual: Borrada/Nula`);
  }

  // Simulación de la llamada a Firestore:
  // const providerRef = doc(db, "prestadores", providerId);
  // await updateDoc(providerRef, updates);

  console.log(`[ProviderService] Estado de ${providerId} actualizado (simulado).`);
};

/**
 * Detiene el seguimiento y actualiza el estado a no disponible.
 */
export const disconnectProvider = async (providerId: string): Promise<void> => {
  console.log(`[ProviderService] Desconectando a ${providerId}...`);

  const updates: ProviderUpdatePayload = {
    isAvailable: false,
    currentLocation: null,
    lastConnection: Date.now(),
  };

  // Simulación de la llamada a Firestore:
  // const providerRef = doc(db, "prestadores", providerId);
  // await updateDoc(providerRef, updates);

  console.log(`[ProviderService] ${providerId} desconectado (simulado).`);
};

/**
 * Llama a la Cloud Function para registrar un nuevo perfil de proveedor.
 */
export const registerProvider = async (data: ProviderRegistrationData): Promise<any> => {
  console.log('[ProviderService] Llamando a la función registerProviderProfile...', data);
  const functions = getFunctions(app);
  const registerProviderProfile = httpsCallable(functions, 'registerProviderProfile');
  
  try {
    const result = await registerProviderProfile(data);
    console.log('[ProviderService] Respuesta de la función:', result.data);
    return result.data;
  } catch (error) {
    console.error("[ProviderService] Error al llamar a la función 'registerProviderProfile':", error);
    // Para que el componente que llama pueda manejar el error, lo relanzamos.
    throw error;
  }
};
