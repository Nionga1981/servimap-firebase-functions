
"use client";

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPinned, Search, LocateFixed, AlertTriangle } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { useState, useEffect } from 'react';

// Mock plumbers for demoing the "3 plumbers nearby" scenario
const mockPlumbers: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100.png?text=MF',
    rating: 4.9,
    isAvailable: true,
    services: [{
      id: 's_p1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos.', price: 90, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png?text=Fugas+24/7'
    }],
    location: { lat: 34.0540, lng: -118.2450 } // Example location
  },
  {
    id: 'plumber2',
    name: 'Luigi Soluciones Hidráulicas',
    avatarUrl: 'https://placehold.co/100x100.png?text=LS',
    rating: 4.7,
    isAvailable: true,
    services: [{
      id: 's_p2', title: 'Instalación Grifería', description: 'Moderniza tu cocina y baño.', price: 70, category: 'plumbing', providerId: 'plumber2', imageUrl: 'https://placehold.co/300x200.png?text=Grifos'
    }],
    location: { lat: 34.0500, lng: -118.2420 } // Example location
  },
  {
    id: 'plumber3',
    name: 'Fontanería Princesa Peach',
    avatarUrl: 'https://placehold.co/100x100.png?text=PP',
    rating: 4.8,
    isAvailable: false, // Example of one unavailable
    services: [{
      id: 's_p3', title: 'Desatascos Profesionales', description: 'Tuberías como nuevas.', price: 120, category: 'plumbing', providerId: 'plumber3', imageUrl: 'https://placehold.co/300x200.png?text=Desatascos'
    }],
    location: { lat: 34.0560, lng: -118.2480 } // Example location
  },
];

export function MapDisplay() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [providersToDisplay, setProvidersToDisplay] = useState<Provider[]>([]);
  // const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 34.0522, lng: -118.2437 }); // Default center

  useEffect(() => {
    handleRequestUserLocation();
  }, []);

  useEffect(() => {
    // Simulate finding plumbers when location is available FOR THIS PREVIEW
    if (userLocation) {
      // In a real app, this would be the result of an API call filtering by "plumbing" and location.
      // For this demo, we directly use the mockPlumbers.
      setProvidersToDisplay(mockPlumbers);
    } else {
      setProvidersToDisplay([]);
    }
  }, [userLocation]);

  const handleRequestUserLocation = () => {
    setIsLoadingLocation(true);
    setLocationError(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          // setMapCenter(coords); // Not strictly needed for placeholder updates
          setIsLoadingLocation(false);
        },
        (error) => {
          setLocationError(`Error getting location: ${error.message}`);
          setIsLoadingLocation(false);
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
      setIsLoadingLocation(false);
    }
  };

  const handleSearchAtMyLocation = () => {
    if (userLocation) {
      alert(`Buscando servicios cerca de tu ubicación: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}. (Simulación: mostrando plomeros de ejemplo)`);
      // For demo, we've already set mockPlumbers if userLocation is available.
      // In a real app, this would trigger a new search or filter.
      setProvidersToDisplay(mockPlumbers);
    }
  };

  let mapPlaceholderText = "Map Area. Interactive map coming soon!";
  let mapDataAiHint = "map city providers";

  if (isLoadingLocation) {
    mapPlaceholderText = "Getting your location...";
    mapDataAiHint = "loading map";
  } else if (locationError) {
    mapPlaceholderText = `Error de Ubicación: ${locationError.substring(0,50)}`;
    mapDataAiHint = "map error";
  } else if (userLocation) {
    // Check if the providersToDisplay are plumbers (for this specific simulation)
    const activePlumbers = providersToDisplay.filter(p => p.services.some(s => s.category === 'plumbing'));
    if (activePlumbers.length > 0) {
      mapPlaceholderText = `Tu Ubicación (${activePlumbers.length} Plomero${activePlumbers.length === 1 ? '' : 's'} Cerca)`;
      mapDataAiHint = "map user location plumbers";
    } else if (providersToDisplay.length > 0) { // Some other providers might be shown if search changes
        mapPlaceholderText = `Tu Ubicación (${providersToDisplay.length} Proveedores Cerca)`;
        mapDataAiHint = "map user location providers";
    }
    else {
      mapPlaceholderText = `Tu Ubicación: ${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)} (No se encontraron plomeros en esta demo)`;
      mapDataAiHint = "map user location";
    }
  } else {
    mapPlaceholderText = "Área del Mapa. Permite tu ubicación o busca.";
    mapDataAiHint = "map city default";
  }
  
  const mapImageUrl = `https://placehold.co/800x500.png?text=${encodeURIComponent(mapPlaceholderText)}`;

  return (
    <Card className="shadow-xl overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <MapPinned className="text-primary" /> Encuentra Proveedores Cerca de Ti
        </CardTitle>
        <CardDescription>
          Usa tu ubicación actual o busca manualmente para encontrar servicios.
        </CardDescription>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar por servicio, nombre, o categoría..." className="pl-8 w-full" />
          </div>
          <Button variant="outline" onClick={handleRequestUserLocation} disabled={isLoadingLocation}>
            <LocateFixed className={`h-4 w-4 ${isLoadingLocation ? 'animate-spin' : ''}`} />
            {isLoadingLocation ? "Localizando..." : userLocation ? "Mi Ubicación" : "Obtener Mi Ubicación"}
          </Button>
          <Button variant="outline">Filtros</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:flex">
        <div className="md:w-2/3 h-[400px] md:h-[500px] relative bg-muted flex items-center justify-center">
          <Image
            src={mapImageUrl}
            alt={mapPlaceholderText}
            layout="fill"
            objectFit="cover"
            data-ai-hint={mapDataAiHint}
            className={isLoadingLocation || locationError ? "opacity-70" : "opacity-50"}
          />
           <div className="absolute inset-0 flex items-center justify-center p-4">
             {isLoadingLocation && (
                <div className="text-center p-4 bg-background/80 rounded-md shadow-lg">
                  <LocateFixed className="h-8 w-8 text-primary animate-ping mx-auto mb-2" />
                  <p className="text-lg font-semibold text-foreground">Obteniendo tu ubicación...</p>
                </div>
             )}
             {locationError && !isLoadingLocation && (
                <div className="text-center p-4 bg-destructive/20 text-destructive-foreground rounded-md shadow-lg max-w-md">
                  <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-lg font-semibold">Error de Ubicación</p>
                  <p className="text-sm">{locationError}</p>
                  <Button onClick={handleRequestUserLocation} variant="secondary" size="sm" className="mt-2">Reintentar</Button>
                </div>
             )}
             {!isLoadingLocation && !locationError && !userLocation && (
                <div className="text-center p-4 bg-background/80 rounded-md shadow-lg">
                    <p className="text-xl font-semibold text-foreground/70">Permite el acceso a tu ubicación o usa el botón "Obtener mi ubicación".</p>
                </div>
             )}
           </div>
        </div>
        <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-[500px] md:overflow-y-auto space-y-4">
          <Button 
            className="w-full" 
            onClick={handleSearchAtMyLocation} 
            disabled={!userLocation || isLoadingLocation}
          >
            <Search className="mr-2 h-4 w-4" />
            Buscar servicios en mi ubicación
          </Button>
          
          {locationError && (
            <p className="text-sm text-destructive text-center">{locationError}</p>
          )}

          {providersToDisplay.length > 0 ? (
            providersToDisplay.map(provider => (
              <ProviderPreviewCard 
                key={provider.id} 
                provider={provider} 
                onSelectProvider={() => alert(`Ver perfil de ${provider.name} (simulación)`)}
              />
            ))
          ) : (
            !isLoadingLocation && !locationError && userLocation && ( // Only show if location is available but no providers
              <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
                <p>No se encontraron plomeros para esta simulación. En una app real, aquí verías resultados o un mensaje de "no encontrado".</p>
              </div>
            )
          )}
           {!isLoadingLocation && !locationError && !userLocation && ( // Message when location is not yet available
              <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
                <p>Obtén tu ubicación para ver proveedores cercanos.</p>
              </div>
            )
          }
        </div>
      </CardContent>
    </Card>
  );
}
