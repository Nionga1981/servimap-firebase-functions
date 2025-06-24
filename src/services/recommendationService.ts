// src/services/recommendationService.ts
"use client";

import type { Recomendacion, Provider } from '@/types';
import { mockRecomendaciones, mockProviders } from '@/lib/mockData';

export interface RichRecomendacion extends Recomendacion {
  provider?: Provider;
}

export const getRehireRecommendations = async (userId: string): Promise<RichRecomendacion[]> => {
  console.log(`[RecommendationService] Fetching re-hire recommendations for user: ${userId}`);

  // Simulate fetching recommendations for the user
  const userRecommendations = mockRecomendaciones.filter(rec => rec.usuarioId === userId && rec.estado === 'pendiente');

  // Enrich recommendations with provider data
  const richRecommendations = userRecommendations.map(rec => {
    const provider = mockProviders.find(p => p.id === rec.prestadorId);
    return {
      ...rec,
      provider: provider,
    };
  }).filter(rec => !!rec.provider); // Filter out any recommendations where provider wasn't found

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log(`[RecommendationService] Found ${richRecommendations.length} recommendations.`);
  return richRecommendations.sort((a, b) => b.fechaCreacion - a.fechaCreacion); // Sort by most recent
};
