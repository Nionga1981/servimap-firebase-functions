
"use client";

import { GoogleMap, LoadScript, MarkerF } from '@react-google-maps/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPinned, Search, LocateFixed, AlertTriangle, WifiOff, Loader2 } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { useState, useEffect, useMemo } from 'react';

// Log environment variable at module level
const apiKeyFromEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
console.log('[MapDisplay Module] process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:', apiKeyFromEnv);


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
  const [isMapComponentLoaded, setIsMapComponentLoaded] = useState(false);
  const [isMapApiLoadingError, setIsMapApiLoadingError] = useState<string | null>(null);

  // ========================================================================
  // TEMPORARY DEBUGGING: Hardcoding API Key
  // This is ONLY for testing if the environment variable loading is the issue.
  // REMOVE THIS AND USE process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for actual use.
  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU";
  // const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  console.log('[MapDisplay Component] Using hardcoded googleMapsApiKey value:', googleMapsApiKey);
  console.log('[MapDisplay Component] Value from process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (for comparison):', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  // ========================================================================


  useEffect(() => {
    handleRequestUserLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(14); 
      setProvidersToDisplay(mockPlumbers);
    } else {
      setMapCenter(defaultCenter);
      setMapZoom(10);
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
          console.log("User location obtained:", coords);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationError(`Error obteniendo ubicación: ${error.message}. Por favor, habilita los permisos de ubicación.`);
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
      setProvidersToDisplay(mockPlumbers);
      setMapCenter(userLocation);
      setMapZoom(14);
    } else {
        alert("No podemos buscar en tu ubicación porque no se ha podido obtener. Intenta permitir el acceso a tu ubicación.");
        handleRequestUserLocation();
    }
  };

  const onMapLoad = (mapInstance: google.maps.Map) => {
    console.log("Google Map component successfully loaded. Map Instance:", mapInstance);
    setIsMapComponentLoaded(true);
  }

  const onMapUnmount = () => {
    setIsMapComponentLoaded(false); 
  }

  const onLoadScriptError = (error: Error) => {
    console.error("LoadScript error:", error);
    setIsMapApiLoadingError(`Error al cargar la API de Google Maps: ${error.message}. Revisa la consola y la configuración de tu API Key.`);
  }


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
      onLoad={onMapLoad}
      onUnmount={onMapUnmount}
    >
      {userLocation && (
        <MarkerF
          position={userLocation}
          title="Tu ubicación"
        />
      )}
      {providersToDisplay.map(provider =>
        provider.location && provider.isAvailable && (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={provider.name}
            onClick={() => alert(`Abrir perfil de ${provider.name}`)}
          />
        )
      )}
    </GoogleMap>
  );

  const renderMapArea = () => {
    if (!googleMapsApiKey) {
      // This message should NOT appear if the key is hardcoded above.
      // If it does, there's a very fundamental issue.
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Configuración Requerida (Hardcoded Check)</p>
          <p className="text-sm text-center">La API Key de Google Maps NO está llegando al componente, incluso hardcodeada. Verifica el código.</p>
        </div>
      );
    }
    
    if (isMapApiLoadingError) {
       return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <WifiOff className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Error Cargando Google Maps</p>
          <p className="text-sm text-center">{isMapApiLoadingError}</p>
        </div>
      );
    }

    return (
      <LoadScript
        googleMapsApiKey={googleMapsApiKey}
        libraries={libraries}
        loadingElement={
          <div className="flex flex-col items-center justify-center h-full text-primary p-4">
            <Loader2 className="h-12 w-12 animate-spin mb-4" />
            <p className="text-lg font-semibold">Cargando Mapa...</p>
            <p className="text-sm text-muted-foreground">Esto puede tardar unos segundos.</p>
          </div>
        }
        onError={onLoadScriptError}
      >
        <>
          {isLoadingLocation && !userLocation && !locationError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-background/80 z-10">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
              <p className="text-lg font-semibold text-foreground">Obteniendo tu ubicación...</p>
            </div>
          )}
          {locationError && !userLocation && (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-destructive/20 z-10 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-lg font-semibold text-destructive-foreground">Error de Ubicación</p>
                <p className="text-sm text-destructive-foreground px-4">{locationError}</p>
                <Button onClick={handleRequestUserLocation} variant="secondary" size="sm" className="mt-3">Reintentar Obtener Ubicación</Button>
             </div>
          )}
           <MapContent />
        </>
      </LoadScript>
    );
  };


  return (
    <Card className="shadow-xl overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <MapPinned className="text-primary" /> Encuentra Proveedores Cerca de Ti
        </CardTitle>
        <CardDescription>
          Usa tu ubicación actual o busca manualmente para encontrar servicios. El mapa es interactivo.
        </CardDescription>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar servicio, nombre, categoría..." className="pl-8 w-full" />
          </div>
          <Button variant="outline" onClick={handleRequestUserLocation} disabled={isLoadingLocation || !googleMapsApiKey}>
            <LocateFixed className={`h-4 w-4 ${isLoadingLocation ? 'animate-spin' : ''}`} />
            {isLoadingLocation ? "Localizando..." : userLocation ? "Actualizar Ubicación" : "Obtener Mi Ubicación"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:flex">
        <div className="md:w-2/3 h-[400px] md:h-[500px] relative bg-muted flex items-center justify-center text-foreground">
          {renderMapArea()}
        </div>
        <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-[500px] md:overflow-y-auto space-y-4">
          <Button
            className="w-full"
            onClick={handleSearchAtMyLocation}
            disabled={!userLocation || isLoadingLocation || !googleMapsApiKey || isMapApiLoadingError}
          >
            <Search className="mr-2 h-4 w-4" />
            Buscar servicios en mi ubicación
          </Button>

          {(!googleMapsApiKey || isMapApiLoadingError || (locationError && !userLocation)) && (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
              {!googleMapsApiKey && ( // This should not be hit if hardcoded correctly
                <>
                  <WifiOff className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="font-semibold">Mapa no disponible (hardcoded fail).</p>
                  <p className="text-sm">Verifica el código fuente, la key debería estar hardcodeada.</p>
                </>
              )}
              {isMapApiLoadingError && googleMapsApiKey && (
                 <>
                  <WifiOff className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="font-semibold">Error al cargar el mapa.</p>
                  <p className="text-sm">{isMapApiLoadingError.split('.')[0]}.</p>
                </>
              )}
              {(locationError && !userLocation && googleMapsApiKey && !isMapApiLoadingError) && (
                <>
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="font-semibold">Problema con la ubicación</p>
                  <p className="text-sm">{locationError.split('.')[0]}.</p>
                  <Button onClick={handleRequestUserLocation} variant="link" size="sm">Reintentar</Button>
                </>
              )}
            </div>
          )}

          {providersToDisplay.length > 0 && googleMapsApiKey && !isMapApiLoadingError ? (
            providersToDisplay.map(provider => (
              <ProviderPreviewCard
                key={provider.id}
                provider={provider}
                onSelectProvider={(providerId) => alert(`Ver perfil de ${provider.name} (ID: ${providerId})`)}
              />
            ))
          ) : (
            !isLoadingLocation && userLocation && googleMapsApiKey && !isMapApiLoadingError && providersToDisplay.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
                <p>No se encontraron proveedores para esta simulación en tu ubicación actual.</p>
              </div>
            )
          )}
           {!isLoadingLocation && !userLocation && !locationError && googleMapsApiKey && !isMapApiLoadingError && providersToDisplay.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
                <p>Obtén tu ubicación para ver proveedores cercanos o intenta una búsqueda manual.</p>
              </div>
            )
          }
        </div>
      </CardContent>
    </Card>
  );
}
    
    
