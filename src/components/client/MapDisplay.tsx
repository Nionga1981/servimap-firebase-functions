
"use client";

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPinned, Search, LocateFixed, AlertTriangle } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { useState, useEffect } from 'react';

// Mock providers for demo - kept for ProviderPreviewCard, but not shown on map for this iteration
const mockProviders: Provider[] = [
  { 
    id: '1', name: 'Alice Smith', avatarUrl: 'https://placehold.co/100x100.png?text=AS', rating: 4.8, isAvailable: true,
    services: [{ id: 's1', title: 'Expert Plumbing', description: 'Fixing leaks and pipes', price: 60, category: 'plumbing', providerId: '1' }],
    location: { lat: 34.0522, lng: -118.2437 } 
  },
  { 
    id: '2', name: 'Bob Johnson', avatarUrl: 'https://placehold.co/100x100.png?text=BJ', rating: 4.5, isAvailable: true,
    services: [{ id: 's2', title: 'Electrical Wiring', description: 'Safe and certified', price: 80, category: 'electrical', providerId: '2' }],
    location: { lat: 34.0550, lng: -118.2450 }
  },
  { 
    id: '3', name: 'Carol White', avatarUrl: 'https://placehold.co/100x100.png?text=CW', rating: 4.9, isAvailable: false,
    services: [{ id: 's3', title: 'Deep Cleaning Services', description: 'Home and office', price: 120, category: 'cleaning', providerId: '3' }],
    location: { lat: 34.0500, lng: -118.2400 }
  },
];

export function MapDisplay() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(mockProviders[0]); // Keep for preview card
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 34.0522, lng: -118.2437 }); // Default center

  useEffect(() => {
    handleRequestUserLocation();
  }, []);

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
          setMapCenter(coords);
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
      alert(`Searching for services near your location: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`);
      // Here you would typically trigger an API call or filter providers
    }
  };

  let mapPlaceholderText = "Map Area. Interactive map coming soon!";
  let mapDataAiHint = "map city providers";

  if (isLoadingLocation) {
    mapPlaceholderText = "Getting your location...";
    mapDataAiHint = "loading map";
  } else if (locationError) {
    mapPlaceholderText = `Location Error: ${locationError.substring(0,50)}`; // Keep it short
    mapDataAiHint = "map error";
  } else if (userLocation) {
    mapPlaceholderText = `Your Location: ${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)}`;
    mapDataAiHint = "map user location";
  }
  
  const mapImageUrl = `https://placehold.co/800x500.png?text=${encodeURIComponent(mapPlaceholderText)}`;

  return (
    <Card className="shadow-xl overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <MapPinned className="text-primary" /> Find Providers Near You
        </CardTitle>
        <CardDescription>
          Use your current location or search manually to find services.
        </CardDescription>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search by service, name, or category..." className="pl-8 w-full" />
          </div>
          <Button variant="outline" onClick={handleRequestUserLocation} disabled={isLoadingLocation}>
            <LocateFixed className={`h-4 w-4 ${isLoadingLocation ? 'animate-spin' : ''}`} />
            {isLoadingLocation ? "Locating..." : userLocation ? "My Location" : "Get My Location"}
          </Button>
          <Button variant="outline">Filters</Button>
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

          {selectedProvider ? (
            <ProviderPreviewCard provider={selectedProvider} onSelectProvider={() => alert(`View full profile of ${selectedProvider.name}`)} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Select a provider to see details.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

    