
"use client";

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, DollarSign, MapPin } from 'lucide-react';
import type { Provider } from '@/types';
import { DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useState, useEffect } from 'react';

interface ProviderPreviewCardProps {
  provider: Provider;
  onSelectProvider: (providerId: string) => void;
}

export function ProviderPreviewCard({ provider, onSelectProvider }: ProviderPreviewCardProps) {
  const mainService = provider.services[0]; // Display first service as example
  const [distance, setDistance] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  useEffect(() => {
    // Generate random values on client-side after mount to avoid hydration mismatch
    setDistance((Math.random() * 5 + 1).toFixed(1));
    setReviewCount(Math.floor(Math.random() * 100) + 5);
  }, []);


  return (
    <Card className="w-full max-w-sm overflow-hidden shadow-lg">
      <CardHeader className="p-0">
        <div className="relative h-32 w-full">
          <Image
            src={provider.avatarUrl || DEFAULT_USER_AVATAR}
            alt={provider.name}
            layout="fill"
            objectFit="cover"
            data-ai-hint="provider avatar"
          />
           {provider.isAvailable && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
              Available
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-lg mb-1">{provider.name}</CardTitle>
        {mainService && (
          <CardDescription className="text-sm text-muted-foreground mb-2 line-clamp-1">
            Offers: {mainService.title}
          </CardDescription>
        )}
         <div className="flex items-center gap-2 text-sm mb-2">
          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          <span>{provider.rating.toFixed(1)}</span>
          {reviewCount !== null ? (
            <span className="text-muted-foreground">({reviewCount} reviews)</span>
          ) : (
            <span className="text-muted-foreground">(Loading reviews...)</span>
          )}
        </div>
        {mainService && (
          <div className="flex items-center gap-1 text-sm text-primary font-semibold mb-2">
            <DollarSign className="h-4 w-4" />
            <span>Starts from ${mainService.price.toFixed(2)}</span>
          </div>
        )}
        {provider.location && distance !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>Approx. {distance} km away</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 border-t">
        <Button className="w-full" onClick={() => onSelectProvider(provider.id)}>
          View Profile & Request
        </Button>
      </CardFooter>
    </Card>
  );
}

    