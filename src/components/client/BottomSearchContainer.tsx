
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { mockBannersPublicitarios } from '@/lib/mockData'; // Corrected import name
import type { BannerAd } from '@/types'; 

interface BottomSearchContainerProps {
  // Removed onSearch as it's handled in MapDisplay now
}

export function BottomSearchContainer({}: BottomSearchContainerProps) {
  const [displayBanners, setDisplayBanners] = useState<BannerAd[]>([]);

  useEffect(() => {
    const activeBanners = mockBannersPublicitarios
      .filter(banner => banner.activo) // Ensure 'activo' field exists and is used
      .sort((a, b) => (a.orden || 0) - (b.orden || 0)) // Sort by 'orden', ascending
      .slice(0, 3);
    setDisplayBanners(activeBanners);
  }, []);


  return (
    <div className="w-full p-2 sm:p-3 space-y-3 z-10">
      {displayBanners.length > 0 && (
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
      )}
    </div>
  );
}

