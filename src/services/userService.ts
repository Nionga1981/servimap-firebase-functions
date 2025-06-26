// src/services/userService.ts
"use client";

import type { AmbassadorData, DemoUser, Provider } from '@/types';
import { mockDemoUsers, mockProviders } from '@/lib/mockData';

// This would typically be a set of Firestore queries
export const getAmbassadorData = async (userId: string): Promise<AmbassadorData | null> => {
  console.log(`[UserService] Fetching ambassador data for user: ${userId}`);
  
  const user = mockDemoUsers.find(u => u.id === userId);

  if (!user || !user.codigoPropio) {
    console.log(`[UserService] User ${userId} not found or is not an ambassador.`);
    // Return a default structure or null if the user is not an ambassador
    return {
      referidos: [],
      comisionesAcumuladas: 0,
      historialComisiones: [],
      codigoPropio: user?.codigoPropio || "No asignado",
    };
  }

  // Populate provider names for referrals
  const referidosConNombre = (user.referidos || []).map(providerId => {
    const provider = mockProviders.find(p => p.id === providerId);
    return {
      id: providerId,
      name: provider?.name || 'Proveedor Desconocido',
      avatarUrl: provider?.avatarUrl
    };
  });

  // Populate provider names for commission history
  const historialConNombre = (user.historialComisiones || []).map(comision => {
      const provider = mockProviders.find(p => p.id === comision.prestadorId);
      return {
          ...comision,
          providerName: provider?.name || 'Proveedor Desconocido'
      }
  });


  const data: AmbassadorData = {
    referidos: referidosConNombre,
    comisionesAcumuladas: user.comisionesAcumuladas || 0,
    historialComisiones: historialConNombre.sort((a, b) => b.fecha - a.fecha), // Sort by most recent
    codigoPropio: user.codigoPropio,
  };

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log(`[UserService] Data fetched successfully for ${userId}:`, data);
  return data;
};
