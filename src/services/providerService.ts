// src/services/providerService.ts
"use client";

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type { PastClientInfo, RelacionUsuarioPrestador, DemoUser } from '@/types';
import { mockRelaciones, mockDemoUsers } from '@/lib/mockData';
import { SERVICE_CATEGORIES } from '@/lib/constants';

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
  await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay

  const relaciones = mockRelaciones.filter(rel => rel.prestadorId === providerId);

  const clientsInfo = relaciones.map(rel => {
    const user = mockDemoUsers.find(u => u.id === rel.usuarioId);
    const lastCategory = SERVICE_CATEGORIES.find(c => c.id === rel.categoriasServicios[rel.categoriasServicios.length - 1]);

    return {
      usuarioId: rel.usuarioId,
      nombreUsuario: user?.name || 'Usuario Desconocido',
      avatarUrl: user?.avatarUrl,
      ultimoServicioFecha: rel.ultimoServicioFecha,
      ultimaCategoriaId: lastCategory?.id || 'general',
      ultimaCategoriaNombre: lastCategory?.name || 'Servicio General',
      serviciosContratados: rel.serviciosContratados,
    };
  });

  return clientsInfo.sort((a, b) => b.ultimoServicioFecha - a.ultimoServicioFecha);
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
