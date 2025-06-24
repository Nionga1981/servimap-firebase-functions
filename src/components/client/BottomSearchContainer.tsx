
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import type { BannerPublicitario } from '@/types';
import { fetchBanners } from '@/services/bannerService';
import { Skeleton } from '@/components/ui/skeleton';

export function BottomSearchContainer() {
  const [displayBanners, setDisplayBanners] = useState<BannerPublicitario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBanners = async () => {
      try {
        setIsLoading(true);
        // Targeting params could be dynamic based on user context in a real app
        const banners = await fetchBanners({ idioma: 'es' });
        setDisplayBanners(banners.slice(0, 3)); // Display up to 3 banners
      } catch (error) {
        console.error("Failed to fetch banners:", error);
        // Handle error, maybe show a fallback or nothing
        setDisplayBanners([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadBanners();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full p-2 sm:p-3 z-10">
         <div className="grid grid-cols-3 gap-2.5">
           <Skeleton className="h-20 w-full rounded-lg" />
           <Skeleton className="h-20 w-full rounded-lg" />
           <Skeleton className="h-20 w-full rounded-lg" />
         </div>
      </div>
    );
  }

  if (displayBanners.length === 0) {
    return null; // Don't render anything if no banners are available
  }

  return (
    <div className="w-full p-2 sm:p-3 space-y-3 z-10">
      <div className="grid grid-cols-3 gap-2.5">
        {displayBanners.map((banner) => (
          <Link key={banner.id} href={banner.linkDestino || '#'} target="_blank" rel="noopener noreferrer" className="block">
            <Card className="bg-card hover:shadow-lg transition-shadow duration-200 ease-in-out overflow-hidden rounded-lg shadow-md border-border/50 h-full">
              <CardContent className="p-0 aspect-[16/7] relative">
                <Image
                  src={banner.imagenUrl}
                  alt={banner.nombre}
                  fill
                  style={{ objectFit: 'cover' }}
                  className="rounded-lg"
                  data-ai-hint={banner.dataAiHint || "advertisement banner"}
                />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
