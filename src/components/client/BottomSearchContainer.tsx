
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { mockBanners } from '@/lib/mockData'; // Import mock banner data
import type { BannerAd } from '@/types'; // Import BannerAd type

interface BottomSearchContainerProps {
  onSearch: (searchTerm: string) => void;
}

export function BottomSearchContainer({ onSearch }: BottomSearchContainerProps) {
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [displayBanners, setDisplayBanners] = useState<BannerAd[]>([]);

  useEffect(() => {
    // Filter active banners, sort by priority, and take top 3
    const activeBanners = mockBanners
      .filter(banner => banner.activo)
      .sort((a, b) => b.prioridad - a.prioridad) // Higher priority first
      .slice(0, 3);
    setDisplayBanners(activeBanners);
  }, []);

  const handleSearchClick = () => {
    onSearch(internalSearchTerm);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearch(internalSearchTerm);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background via-background/95 to-transparent space-y-3 z-10">
      {/* Search Bar Area */}
      <Card className="shadow-xl rounded-lg">
        <CardContent className="p-2 flex items-center space-x-2">
          <Input
            type="text"
            placeholder="¿Qué servicio buscas?"
            value={internalSearchTerm}
            onChange={(e) => setInternalSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-grow text-base border border-input bg-background px-3 py-2 h-11 rounded-md ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
            aria-label="Buscar servicio"
          />
          <Button onClick={handleSearchClick} size="icon" variant="ghost" className="text-primary hover:bg-primary/10 h-10 w-10 rounded-md">
            <Search className="h-5 w-5" />
            <span className="sr-only">Buscar</span>
          </Button>
        </CardContent>
      </Card>

      {/* Promotional Banners Area */}
      {displayBanners.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {displayBanners.map((banner) => (
            <Link key={banner.id} href={banner.enlaceUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Card className="bg-card hover:shadow-lg transition-shadow duration-200 ease-in-out overflow-hidden rounded-lg shadow-sm border-border/50 h-full">
                <CardContent className="p-0 aspect-[16/7] relative"> {/* Adjust aspect ratio as needed */}
                  <Image
                    src={banner.imageUrl}
                    alt={banner.nombre}
                    fill
                    style={{ objectFit: 'cover' }}
                    className="rounded-t-lg" // Only round top if you want footer space
                    data-ai-hint={banner.dataAiHint || "advertisement banner"}
                  />
                </CardContent>
                {/* Optional: Add a small title or text overlay if needed, 
                    but the prompt focuses on image and clickability
                <div className="p-2 text-center">
                    <p className="text-xs font-medium text-foreground truncate">{banner.nombre}</p>
                </div> 
                */}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
