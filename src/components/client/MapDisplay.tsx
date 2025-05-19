
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPinned, Search, LocateFixed, AlertTriangle, WifiOff, Loader2 } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { cn } from "@/lib/utils";
// import { SERVICE_CATEGORIES } from '@/lib/constants'; // Necesario si fuéramos a usar iconos de categoría

// Log environment variable at module level - for debugging .env issues
const apiKeyFromEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
console.log('[MapDisplay Module] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:', apiKeyFromEnv);


// Mock providers for demoing
const mockProviders: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100.png?text=MF',
    dataAiHint: 'plumber portrait',
    rating: 4.9,
    isAvailable: true,
    services: [{
      id: 's_p1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos.', price: 90, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water pipes'
    }],
    location: { lat: 34.0540, lng: -118.2450 }
  },
  {
    id: 'plumber2',
    name: 'Luigi Soluciones Hidráulicas',
    avatarUrl: 'https://placehold.co/100x100.png?text=LS',
    dataAiHint: 'worker profile',
    rating: 4.7,
    isAvailable: true,
    services: [{
      id: 's_p2', title: 'Instalación Grifería', description: 'Moderniza tu cocina y baño.', price: 70, category: 'plumbing', providerId: 'plumber2', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'shiny faucet'
    }],
    location: { lat: 34.0500, lng: -118.2420 }
  },
  {
    id: 'plumber3',
    name: 'Fontanería Princesa Peach',
    avatarUrl: 'https://placehold.co/100x100.png?text=PP',
    dataAiHint: 'friendly professional',
    rating: 4.8,
    isAvailable: false,
    services: [{
      id: 's_p3', title: 'Desatascos Profesionales', description: 'Tuberías como nuevas.', price: 120, category: 'plumbing', providerId: 'plumber3', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'clear drains'
    }],
    location: { lat: 34.0560, lng: -118.2480 }
  },
  {
    id: 'electrician1',
    name: 'ElectroSoluciones Rápidas',
    avatarUrl: 'https://placehold.co/100x100.png?text=ES',
    dataAiHint: 'electrician smile',
    rating: 4.8,
    isAvailable: true,
    services: [{
      id: 's_e1', title: 'Instalaciones y Reparaciones Eléctricas', description: 'Expertos en todo tipo de trabajos eléctricos para tu hogar o negocio.', price: 80, category: 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'electrical panel'
    }],
    location: { lat: 34.0580, lng: -118.2500 }
  },
  {
    id: 'cleaner1',
    name: 'Limpieza Impecable Hogar',
    avatarUrl: 'https://placehold.co/100x100.png?text=LI',
    dataAiHint: 'cleaning professional',
    rating: 4.9,
    isAvailable: true,
    services: [{
      id: 's_c1', title: 'Limpieza Profunda Residencial', description: 'Dejamos tu casa reluciente, servicio detallado y confiable.', price: 100, category: 'cleaning', providerId: 'cleaner1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'sparkling clean'
    }],
    location: { lat: 34.0480, lng: -118.2380 }
  },
  {
    id: 'gardener1',
    name: 'Jardines Verdes y Sanos',
    avatarUrl: 'https://placehold.co/100x100.png?text=JV',
    dataAiHint: 'gardener nature',
    rating: 4.7,
    isAvailable: false, // Not available
    services: [{
      id: 's_g1', title: 'Mantenimiento de Jardines', description: 'Cuidado experto para tus plantas, césped y diseño de paisajes.', price: 65, category: 'gardening', providerId: 'gardener1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'lush garden'
    }],
    location: { lat: 34.0600, lng: -118.2400 }
  },
];


const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 34.0522,
  lng: -118.2437
};

// Define MapContentComponent outside MapDisplay
const MapContentComponent = React.memo(({
  center,
  zoom,
  onLoad,
  onUnmount,
  userLocation,
  providersToDisplay
}: {
  center: { lat: number; lng: number };
  zoom: number;
  onLoad: (map: google.maps.Map) => void;
  onUnmount: () => void;
  userLocation: { lat: number; lng: number } | null;
  providersToDisplay: Provider[];
}) => {
  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={zoom}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {userLocation && (
        <MarkerF
          position={userLocation}
          title="Tu ubicación"
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "hsl(var(--primary))", // Blue color from theme
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
          }}
        />
      )}
      {providersToDisplay.map(provider => {
        // TODO: Implement custom icons per category if desired
        // const category = SERVICE_CATEGORIES.find(c => c.id === provider.services[0]?.category);
        // const iconUrl = category?.iconUrl; // Assuming iconUrl is a property in ServiceCategory
        return provider.location && provider.isAvailable && (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={`${provider.name} (Calificación: ${provider.rating})`}
            // icon={iconUrl ? { url: iconUrl, scaledSize: new google.maps.Size(30, 30) } : undefined}
          />
        )
      })}
    </GoogleMap>
  );
});
MapContentComponent.displayName = 'MapContentComponent';


export function MapDisplay() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(10);
  const [, setIsMapComponentLoaded] = useState(false); // For onLoad/onUnmount, not critical for display
  const [providersVisible, setProvidersVisible] = useState(false);


  const libraries = useMemo(() => ['places'] as const, []);
  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; // TEMPORARY HARDCODED - REMOVE FOR PRODUCTION

  console.log('[MapDisplay Component] Using hardcoded googleMapsApiKey value:', googleMapsApiKey);
  console.log('[MapDisplay Component] Value from process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (for comparison):', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);


  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader(
    googleMapsApiKey
      ? {
          googleMapsApiKey: googleMapsApiKey,
          libraries: libraries,
          id: 'google-map-script-servimap' // Unique ID for the script
        }
      : { skip: true } // Skip loading if API key is not provided
  );

  console.log('[MapDisplay Render] isMapApiLoaded:', isMapApiLoaded, 'mapApiLoadError:', mapApiLoadError);


  const handleRequestUserLocation = useCallback((isUserInitiated: boolean = false) => {
    console.log(`[handleRequestUserLocation] Called. isUserInitiated: ${isUserInitiated}`);
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
          console.log("Ubicación del usuario obtenida:", coords);
          
          // Simulate finding providers - sort mock providers by rating
          const sortedProviders = [...mockProviders]
            // .filter(p => p.isAvailable) // Optionally filter only available ones
            .sort((a, b) => b.rating - a.rating); // Higher rating first
          setDisplayedProviders(sortedProviders);

          if (isUserInitiated) {
            setProvidersVisible(true);
            console.log("[handleRequestUserLocation] Providers list will be VISIBLE.");
          } else {
             setProvidersVisible(false); // Do not show providers list on initial automatic load
             console.log("[handleRequestUserLocation] Providers list will be HIDDEN on initial load.");
          }
        },
        (error) => {
          console.error("Error de geolocalización:", error);
          setLocationError(`Error obteniendo ubicación: ${error.message}. Por favor, habilita los permisos de ubicación.`);
          setIsLoadingLocation(false);
          setDisplayedProviders([]); // Clear providers if location fails
          setProvidersVisible(false); // Hide list on error
        }
      );
    } else {
      setLocationError("La geolocalización no es compatible con este navegador.");
      setIsLoadingLocation(false);
      setDisplayedProviders([]); // Clear providers
      setProvidersVisible(false); // Hide list
    }
  }, []);

  useEffect(() => {
    // Request location on initial load, but don't show provider list automatically
    handleRequestUserLocation(false); 
  }, [handleRequestUserLocation]);

  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(14);
    } else {
      setMapCenter(defaultCenter);
      setMapZoom(10);
    }
  }, [userLocation]);

  const onMapLoadCallback = useCallback((mapInstance: google.maps.Map) => {
    console.log("Google Map component successfully loaded. Instancia del mapa:", mapInstance);
    setIsMapComponentLoaded(true);
  }, []);

  const onMapUnmountCallback = useCallback(() => {
    console.log("Google Map component unmounted.");
    setIsMapComponentLoaded(false);
  }, []);


  const renderMapArea = () => {
    if (!googleMapsApiKey) {
      console.log('[renderMapArea] No API Key');
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Configuración Requerida</p>
          <p className="text-sm text-center">La API Key de Google Maps no está configurada.</p>
        </div>
      );
    }

    if (mapApiLoadError) {
       console.log('[renderMapArea] mapApiLoadError:', mapApiLoadError);
       return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <WifiOff className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Error Cargando Google Maps</p>
          <p className="text-sm text-center">Error al cargar la API de Google Maps: {mapApiLoadError.message}.</p>
        </div>
      );
    }

    if (!isMapApiLoaded) {
      console.log('[renderMapArea] !isMapApiLoaded (Loading Map...)');
      return (
        <div className="flex flex-col items-center justify-center h-full text-primary p-4">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-semibold">Cargando Mapa...</p>
        </div>
      );
    }
    
    console.log('[renderMapArea] Rendering MapContentComponent');
    return (
      <>
        {isLoadingLocation && !userLocation && !locationError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-background/50 z-10">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
            <p className="text-lg font-semibold text-foreground">Obteniendo tu ubicación...</p>
          </div>
        )}
        {locationError && !userLocation && (
           <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-destructive/20 z-10 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-lg font-semibold text-destructive-foreground">Error de Ubicación</p>
              <p className="text-sm text-destructive-foreground px-4">{locationError}</p>
              <Button onClick={() => handleRequestUserLocation(true)} variant="secondary" size="sm" className="mt-3">Reintentar Obtener Ubicación</Button>
           </div>
        )}
         <MapContentComponent
           center={mapCenter}
           zoom={mapZoom}
           onLoad={onMapLoadCallback}
           onUnmount={onMapUnmountCallback}
           userLocation={userLocation}
           providersToDisplay={displayedProviders} 
         />
      </>
    );
  };

  // Determine if the right panel (provider list) should be shown at all
  const showProviderListPanel = isMapApiLoaded && !mapApiLoadError && googleMapsApiKey;
  // Determine if providers should be listed in the panel
  const showProvidersInPanel = showProviderListPanel && providersVisible && displayedProviders.length > 0 && !isLoadingLocation;
  // Determine if "no providers found" message should be shown in panel
  const showNoProvidersFoundInPanel = showProviderListPanel && providersVisible && displayedProviders.length === 0 && !isLoadingLocation;
  
  // The right panel should be displayed if providers are meant to be shown, or if no providers were found (to show the message),
  // or if there's a critical API/config error to display there.
  const shouldDisplayRightPanel = showProvidersInPanel || showNoProvidersFoundInPanel || !googleMapsApiKey || mapApiLoadError;


  return (
    <Card className="shadow-xl overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b p-4">
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="relative flex-grow w-full sm:w-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar servicio, nombre, categoría..." className="pl-8 w-full" />
          </div>
          <Button variant="outline" onClick={() => handleRequestUserLocation(true)} disabled={isLoadingLocation && !userLocation} className="w-full sm:w-auto flex-shrink-0">
            <LocateFixed className={`mr-2 h-4 w-4 ${isLoadingLocation && !userLocation ? 'animate-spin' : ''}`} />
            {isLoadingLocation && !userLocation ? "Localizando..." : "Actualizar Ubicación"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:flex flex-grow overflow-hidden">
         {/* Mapa Area */}
         <div className={cn(
             "h-[calc(100vh-var(--header-height,150px)-var(--map-header-height,80px))] md:h-auto relative bg-muted flex items-center justify-center text-foreground flex-grow",
             shouldDisplayRightPanel ? "md:w-2/3" : "md:w-full" // Map takes full width if right panel is hidden
           )}>
          {renderMapArea()}
        </div>

        {/* Panel Derecho Condicional */}
        {shouldDisplayRightPanel && (
          <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-full md:overflow-y-auto space-y-4 flex-shrink-0">
            {/* Errores Críticos de API/Configuración (solo se muestran si el panel es visible por error) */}
            {!googleMapsApiKey && ( // Este caso es manejado principalmente por renderMapArea, pero como fallback.
                <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-full">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="font-semibold text-destructive">Mapa no disponible.</p>
                  <p className="text-sm text-destructive-foreground">API Key no configurada.</p>
                </div>
            )}
            {mapApiLoadError && googleMapsApiKey && ( // Similar, como fallback.
                <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-full">
                  <WifiOff className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="font-semibold text-destructive">Error al cargar el mapa.</p>
                  <p className="text-sm text-destructive-foreground">{mapApiLoadError.message.split('.')[0]}.</p>
                </div>
            )}

            {/* Lista de Proveedores */}
            {isMapApiLoaded && !mapApiLoadError && googleMapsApiKey && providersVisible && displayedProviders.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-primary mb-2">Proveedores Cercanos:</h3>
                {displayedProviders.map(provider => ( 
                    <ProviderPreviewCard
                      key={provider.id}
                      provider={provider}
                      onSelectProvider={(providerId) => alert(`Ver perfil de ${provider.name} (ID: ${providerId}) (funcionalidad pendiente)`)}
                    />
                  ))}
              </>
            )}
            {/* No se encontraron proveedores */}
            {isMapApiLoaded && !mapApiLoadError && googleMapsApiKey && providersVisible && displayedProviders.length === 0 && !isLoadingLocation && (
               <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-full">
                <Search className="h-10 w-10 mb-3 text-primary" />
                <p className="font-semibold">No se encontraron proveedores.</p>
                <p className="text-sm">Intenta ajustar tu búsqueda o reintentar la ubicación.</p>
              </div>
            )}
             {/* Mensaje inicial si el panel es visible pero no hay búsqueda activa y providersVisible es false (debería ser raro este estado aquí) */}
            {isMapApiLoaded && !mapApiLoadError && googleMapsApiKey && !providersVisible && !isLoadingLocation && (
                 <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-full">
                    <MapPinned className="h-10 w-10 mb-3 text-primary" />
                    <p className="font-semibold">Lista de proveedores aparecerá aquí.</p>
                    <p className="text-sm">Usa "Actualizar Ubicación" o la búsqueda para encontrar servicios.</p>
                </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
    

    