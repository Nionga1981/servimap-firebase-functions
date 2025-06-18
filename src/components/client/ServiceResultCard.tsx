// src/components/client/ServiceResultCard.tsx
"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, DollarSign, MapPin, Route, Clock } from 'lucide-react';
import type { Service, Provider } from '@/types';
import { DEFAULT_SERVICE_IMAGE, SERVICE_CATEGORIES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

interface ServiceResultCardProps {
  service: Service;
  provider: Provider;
  isCommunityResult: boolean;
  userLocation?: { lat: number; lng: number } | null; // For distance calculation
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export function ServiceResultCard({ service, provider, isCommunityResult, userLocation }: ServiceResultCardProps) {
  const category = SERVICE_CATEGORIES.find(cat => cat.id === service.category);
  const CategoryIcon = category?.icon;

  const distanceKm = userLocation && provider.ubicacionAproximada
    ? calculateDistance(userLocation.lat, userLocation.lng, provider.ubicacionAproximada.lat, provider.ubicacionAproximada.lng)
    : null;

  return (
    <Card className="w-full overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
      <CardHeader className="p-0">
        <div className="relative h-40 w-full">
          <Image
            src={service.imageUrl || provider.avatarUrl || DEFAULT_SERVICE_IMAGE}
            alt={service.title}
            layout="fill"
            objectFit="cover"
            data-ai-hint={service.dataAiHint || provider.dataAiHint || "service provider"}
          />
          {provider.isAvailable && provider.estadoOnline && (
            <Badge variant="default" className="absolute top-2 right-2 bg-green-500 text-white">
              Disponible Ahora
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg mb-1 truncate" title={service.title}>{service.title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground mb-2">
          Ofrecido por: <Link href={`/provider-profile/${provider.id}`} className="text-primary hover:underline">{provider.name}</Link>
        </CardDescription>

        {category && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            {CategoryIcon && <CategoryIcon className="h-3.5 w-3.5 text-accent" />}
            <span>{category.name}</span>
          </div>
        )}

        <p className="text-sm text-muted-foreground line-clamp-2 mb-2" title={service.description}>
          {service.description}
        </p>

        <div className="flex items-center gap-2 text-sm mb-1">
          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          <span>{provider.rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">({provider.ratingCount} reseñas)</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-primary font-semibold mb-1">
          <DollarSign className="h-4 w-4" />
          <span>${service.price.toFixed(2)}</span>
          {service.hourlyRate && <span className="text-xs text-muted-foreground ml-1">/hr (si aplica)</span>}
        </div>

        {distanceKm !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>Aprox. {distanceKm.toFixed(1)} km de ti</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 border-t">
        {isCommunityResult ? (
          <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href={`/provider-profile/${provider.id}?serviceId=${service.id}`}>
              Ver Detalles y Solicitar
            </Link>
          </Button>
        ) : (
          <div className="w-full space-y-2">
            <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href={`/?viewProviderRoute=${provider.id}&serviceId=${service.id}`}>
                <Route className="mr-2 h-4 w-4" /> Ver en Mapa y Ruta
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/provider-profile/${provider.id}?serviceId=${service.id}`}>
                Ver Perfil del Proveedor
              </Link>
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
