// src/services/bannerService.ts
"use client";

import type { BannerPublicitario } from '@/types';
import { getBanners as getMockBanners } from '@/lib/mockData';

// In a real app, this would call a Cloud Function
// import { getFunctions, httpsCallable } from 'firebase/functions';
// import { app } from '@/lib/firebase';

interface BannerTargetingParams {
  region?: string;
  idioma?: string;
  categoria?: string;
}

export const fetchBanners = async (params: BannerTargetingParams): Promise<BannerPublicitario[]> => {
  console.log('[BannerService] Fetching banners with params (simulated):', params);
  
  // Simulate Cloud Function call and filtering logic
  const allBanners = getMockBanners();
  const now = Date.now();

  const filteredBanners = allBanners.filter(banner => {
    if (!banner.activo) return false;
    if (banner.fechaInicio && banner.fechaInicio > now) return false;
    if (banner.fechaFin && banner.fechaFin < now) return false;
    if (params.region && banner.regiones && !banner.regiones.includes(params.region)) return false;
    if (params.idioma && banner.idiomas && !banner.idiomas.includes(params.idioma)) return false;
    if (params.categoria && banner.categorias && !banner.categorias.includes(params.categoria)) return false;

    return true;
  });

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 250));
  
  console.log(`[BannerService] Found ${filteredBanners.length} active banners.`);
  return filteredBanners.sort((a, b) => (a.orden || 0) - (b.orden || 0));
};
