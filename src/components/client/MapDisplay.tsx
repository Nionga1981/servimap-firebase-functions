
"use client";

import { GoogleMap, LoadScript, MarkerF } from '@react-google-maps/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPinned, Search, LocateFixed, AlertTriangle, WifiOff } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { useState, useEffect, useMemo } from 'react';

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

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 34.0522, // Los Angeles
  lng: -118.2437
};

const libraries: ("places" | "drawing" | "geometry" | "localContext" | "visualization")[] = ['places'];

export function MapDisplay() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [providersToDisplay, setProvidersToDisplay] = useState<Provider[]>([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(10);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    handleRequestUserLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(14); // Zoom in when user location is available
      // Simulate finding plumbers when location is available
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
          setIsLoadingLocation(false);
        },
        (error) => {
          setLocationError(`Error obteniendo ubicación: ${error.message}`);
          setIsLoadingLocation(false);
        }
      );
    } else {
      setLocationError("La geolocalización no es compatible con este navegador.");
      setIsLoadingLocation(false);
    }
  };

  const handleSearchAtMyLocation = () => {
    if (userLocation) {
      alert(`Buscando servicios cerca de tu ubicación: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}. (Simulación: mostrando plomeros de ejemplo)`);
      setProvidersToDisplay(mockPlumbers); // For demo, re-set mockPlumbers
      setMapCenter(userLocation);
      setMapZoom(14);
    }
  };

  const MapContent = () => (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={mapCenter}
      zoom={mapZoom}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {userLocation && (
        <MarkerF
          position={userLocation}
          title="Tu ubicación"
          // icon={{ url: '/user-marker.png', scaledSize: new window.google.maps.Size(30,30) }} // Example custom icon
        />
      )}
      {providersToDisplay.map(provider => 
        provider.location && (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={provider.name}
            // icon={{ url: provider.isAvailable ? '/available-marker.png' : '/unavailable-marker.png' }} // Example conditional icon
            onClick={() => alert(`Abrir perfil de ${provider.name}`)}
          />
        )
      )}
    </GoogleMap>
  );

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
        <div className="md:w-2/3 h-[400px] md:h-[500px] relative bg-muted flex items-center justify-center text-foreground">
          {!googleMapsApiKey ? (
            <div className="text-center p-4 bg-destructive/20 text-destructive-foreground rounded-md shadow-lg max-w-md">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-lg font-semibold">Configuración Requerida</p>
              <p className="text-sm">Por favor, configura la variable de entorno `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` para mostrar el mapa.</p>
            </div>
          ) : (
            <LoadScript
              googleMapsApiKey={googleMapsApiKey}
              libraries={libraries}
              loadingElement={
                <div className="text-center p-4">
                  <LocateFixed className="h-8 w-8 text-primary animate-ping mx-auto mb-2" />
                  <p className="text-lg font-semibold">Cargando Mapa...</p>
                </div>
              }
            >
              {isLoadingLocation && !userLocation && (
                <div className="absolute inset-0 flex items-center justify-center p-4 bg-background/80 z-10">
                  <div className="text-center p-4 rounded-md shadow-lg">
                    <LocateFixed className="h-8 w-8 text-primary animate-ping mx-auto mb-2" />
                    <p className="text-lg font-semibold text-foreground">Obteniendo tu ubicación...</p>
                  </div>
                </div>
              )}
              {locationError && !isLoadingLocation && (
                 <div className="absolute inset-0 flex items-center justify-center p-4 bg-destructive/20 z-10">
                    <div className="text-center p-4 text-destructive-foreground rounded-md shadow-lg max-w-md">
                    <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <p className="text-lg font-semibold">Error de Ubicación</p>
                    <p className="text-sm">{locationError}</p>
                    <Button onClick={handleRequestUserLocation} variant="secondary" size="sm" className="mt-2">Reintentar</Button>
                    </div>
                 </div>
              )}
              <MapContent />
            </LoadScript>
          )}
        </div>
        <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-[500px] md:overflow-y-auto space-y-4">
          <Button 
            className="w-full" 
            onClick={handleSearchAtMyLocation} 
            disabled={!userLocation || isLoadingLocation || !googleMapsApiKey}
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
                onSelectProvider={(providerId) => alert(`Ver perfil de ${provider.name} (ID: ${providerId})`)}
              />
            ))
          ) : (
            !isLoadingLocation && !locationError && userLocation && googleMapsApiKey && (
              <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
                <p>No se encontraron plomeros para esta simulación. En una app real, aquí verías resultados o un mensaje de "no encontrado".</p>
              </div>
            )
          )}
           {!isLoadingLocation && !locationError && !userLocation && googleMapsApiKey && (
              <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
                <p>Obtén tu ubicación para ver proveedores cercanos.</p>
              </div>
            )
          }
           {!googleMapsApiKey && (
              <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
                <WifiOff className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="font-semibold">Mapa no disponible.</p>
                <p className="text-sm">Por favor, configura la API key de Google Maps.</p>
              </div>
           )}
        </div>
      </CardContent>
    </Card>
  );
}
