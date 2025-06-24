// src/services/providerService.ts
"use client";

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type { PastClientInfo } from '@/types';

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

export const updateProviderRealtimeStatus = async (
  providerId: string,
  isAvailable: boolean,
  location?: { lat: number; lng: number }
): Promise<void> => {
  console.log(`[ProviderService] Actualizando estado para ${providerId}:`);
  console.log(`  Disponible: ${isAvailable}`);

  const updates: ProviderUpdatePayload = {
    isAvailable: isAvailable,
    lastConnection: Date.now(),
  };

  if (isAvailable && location) {
    updates.currentLocation = {
      lat: location.lat,
      lng: location.lng,
      timestamp: Date.now(),
    };
    console.log(`  Ubicación Actual: Lat ${location.lat}, Lng ${location.lng}`);
  } else if (!isAvailable) {
    updates.currentLocation = null;
  }

  console.log(`[ProviderService] Estado de ${providerId} actualizado (simulado).`);
};

export const disconnectProvider = async (providerId: string): Promise<void> => {
  console.log(`[ProviderService] Desconectando a ${providerId}...`);
  const updates: ProviderUpdatePayload = {
    isAvailable: false,
    currentLocation: null,
    lastConnection: Date.now(),
  };
  console.log(`[ProviderService] ${providerId} desconectado (simulado).`);
};

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
    throw error;
  }
};

export const getPastClients = async (providerId: string): Promise<PastClientInfo[]> => {
  console.log(`[ProviderService] Obteniendo clientes pasados para el proveedor: ${providerId}`);
  
  // La función callable usa el UID del usuario autenticado, por lo que no es necesario pasar el providerId.
  const functions = getFunctions(app);
  const getPastClientsFunction = httpsCallable(functions, 'getPastClientsForProvider');

  try {
      const result = await getPastClientsFunction();
      // El resultado de la función ya es el array de clientes que necesitamos.
      return result.data as PastClientInfo[];
  } catch (error) {
      console.error("[ProviderService] Error al llamar a 'getPastClientsForProvider':", error);
      // El componente que llama a este servicio deberá manejar el error (ej. mostrar un toast).
      throw error;
  }
};

export const sendRehireReminder = async (usuarioId: string, categoriaId: string): Promise<any> => {
    console.log(`[ProviderService] Solicitando enviar recordatorio de recontratación a ${usuarioId} para categoría ${categoriaId}`);
    const functions = getFunctions(app);
    const callFunction = httpsCallable(functions, 'enviarRecordatorioRecontratacion');

    try {
        const result = await callFunction({ usuarioId, categoriaId });
        console.log('[ProviderService] Respuesta de la función de recordatorio:', result.data);
        return result.data;
    } catch (error) {
        console.error("[ProviderService] Error al llamar a la función 'enviarRecordatorioRecontratacion':", error);
        throw error;
    }
};
