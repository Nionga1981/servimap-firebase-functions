
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, LoadScript, MarkerF } from '@react-google-maps/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPinned, Search, LocateFixed, AlertTriangle, WifiOff, Loader2 } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';

// Log environment variable at module level - for debugging .env issues
const apiKeyFromEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
console.log('[MapDisplay Module] process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:', apiKeyFromEnv);

// Mock plumbers for demoing the "3 plumbers nearby" scenario
const mockPlumbers: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100.png?text=MF',
    dataAiHint: 'plumber portrait',
    rating: 4.9,
    isAvailable: true,
    services: [{
      id: 's_p1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos.', price: 90, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png?text=Fugas+24/7', dataAiHint: 'water pipes'
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
      id: 's_p2', title: 'Instalación Grifería', description: 'Moderniza tu cocina y baño.', price: 70, category: 'plumbing', providerId: 'plumber2', imageUrl: 'https://placehold.co/300x200.png?text=Grifos', dataAiHint: 'shiny faucet'
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
      id: 's_p3', title: 'Desatascos Profesionales', description: 'Tuberías como nuevas.', price: 120, category: 'plumbing', providerId: 'plumber3', imageUrl: 'https://placehold.co/300x200.png?text=Desatascos', dataAiHint: 'clear drains'
    }],
    location: { lat: 34.0560, lng: -118.2480 }
  },
];

const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 34.0522, // Los Angeles (Ejemplo, idealmente centrado en la región del usuario)
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
        // Considerar deshabilitar zoom y scroll si es solo visualización
        // gestureHandling: 'none', 
        // zoomControl: false,
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
            fillColor: "#4285F4", // Google Blue
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
          }}
        />
      )}
      {providersToDisplay.map(provider =>
        provider.location && provider.isAvailable && ( // Solo mostrar proveedores disponibles con ubicación
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={provider.name}
            // onClick={() => setSelectedProvider(provider)} // Implementar lógica para seleccionar proveedor
          />
        )
      )}
    </GoogleMap>
  );
});
MapContentComponent.displayName = 'MapContentComponent';


export function MapDisplay() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [providersToDisplay, setProvidersToDisplay] = useState<Provider[]>([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(10); // Zoom inicial más alejado
  const [, setIsMapComponentLoaded] = useState(false); // Para seguir si el componente mapa se cargó
  const [isMapApiLoadingError, setIsMapApiLoadingError] = useState<string | null>(null);

  // Moved libraries declaration inside the component
  const libraries: ("places" | "drawing" | "geometry" | "localContext" | "visualization")[] = useMemo(() => ['places'], []);

  // TEMPORARY HARDCODED API KEY - REMOVE FOR PRODUCTION AND USE .env
  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; 
  // const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  console.log('[MapDisplay Component] Using hardcoded googleMapsApiKey value:', googleMapsApiKey);
  console.log('[MapDisplay Component] Value from process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (for comparison):', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);


  const handleRequestUserLocation = useCallback(() => {
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
        },
        (error) => {
          console.error("Error de geolocalización:", error);
          setLocationError(`Error obteniendo ubicación: ${error.message}. Por favor, habilita los permisos de ubicación.`);
          setIsLoadingLocation(false);
        }
      );
    } else {
      setLocationError("La geolocalización no es compatible con este navegador.");
      setIsLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    handleRequestUserLocation();
  }, [handleRequestUserLocation]);

  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(14); // Zoom más cercano cuando se tiene la ubicación del usuario
      // Simular búsqueda de plomeros si la ubicación del usuario está disponible
      setProvidersToDisplay(mockPlumbers.filter(p => p.location)); // Asegurarse que los proveedores tengan ubicación
    } else {
      // Si no hay ubicación del usuario, resetear mapa y proveedores (o mantener proveedores por defecto si se desea)
      setMapCenter(defaultCenter);
      setMapZoom(10);
      setProvidersToDisplay([]); // O `mockPlumbers` si quieres mostrar algo por defecto
    }
  }, [userLocation]);

  const handleSearchAtMyLocation = () => {
    if (userLocation) {
      // Aquí iría la lógica real para buscar proveedores basada en userLocation
      // Por ahora, solo mostramos los mocks y centramos el mapa.
      setProvidersToDisplay(mockPlumbers.filter(p => p.location));
      setMapCenter(userLocation);
      setMapZoom(14);
    } else {
        alert("No podemos buscar en tu ubicación porque no se ha podido obtener. Intenta permitir el acceso a tu ubicación.");
        handleRequestUserLocation(); // Intentar obtener ubicación de nuevo
    }
  };

  const onMapLoadCallback = useCallback((mapInstance: google.maps.Map) => {
    console.log("Componente Google Map cargado exitosamente. Instancia del mapa:", mapInstance);
    setIsMapComponentLoaded(true);
  }, []); // Eliminado setIsMapComponentLoaded de dependencias ya que es un setter

  const onMapUnmountCallback = useCallback(() => {
    console.log("Componente Google Map desmontado.");
    setIsMapComponentLoaded(false);
  }, []); // Eliminado setIsMapComponentLoaded de dependencias ya que es un setter

  const onLoadScriptError = useCallback((error: Error) => {
    console.error("Error al cargar LoadScript:", error);
    setIsMapApiLoadingError(`Error al cargar la API de Google Maps: ${error.message}. Revisa la consola y la configuración de tu API Key.`);
  }, []);


  const renderMapArea = () => {
    if (!googleMapsApiKey) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Configuración Requerida</p>
          <p className="text-sm text-center">La API Key de Google Maps no está configurada. Por favor, añádela a tu archivo .env como NEXT_PUBLIC_GOOGLE_MAPS_API_KEY o verifica el código temporal.</p>
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
          {/* Indicador de carga de ubicación */}
          {isLoadingLocation && !userLocation && !locationError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-background/80 z-10">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
              <p className="text-lg font-semibold text-foreground">Obteniendo tu ubicación...</p>
            </div>
          )}
          {/* Mensaje de error de ubicación */}
          {locationError && !userLocation && (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-destructive/20 z-10 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-lg font-semibold text-destructive-foreground">Error de Ubicación</p>
                <p className="text-sm text-destructive-foreground px-4">{locationError}</p>
                <Button onClick={handleRequestUserLocation} variant="secondary" size="sm" className="mt-3">Reintentar Obtener Ubicación</Button>
             </div>
          )}
           <MapContentComponent
             center={mapCenter}
             zoom={mapZoom}
             onLoad={onMapLoadCallback}
             onUnmount={onMapUnmountCallback}
             userLocation={userLocation}
             providersToDisplay={providersToDisplay}
           />
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
          <Button variant="outline" onClick={handleRequestUserLocation} disabled={isLoadingLocation}>
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
            disabled={!userLocation || isLoadingLocation || !googleMapsApiKey || !!isMapApiLoadingError}
          >
            <Search className="mr-2 h-4 w-4" />
            Buscar servicios en mi ubicación
          </Button>

          {/* Mensajes informativos en el panel derecho */}
          {(!googleMapsApiKey || isMapApiLoadingError || (locationError && !userLocation)) && (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
              {!googleMapsApiKey && (
                <>
                  <WifiOff className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="font-semibold">Mapa no disponible.</p>
                  <p className="text-sm">API Key no configurada.</p>
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
                onSelectProvider={(providerId) => alert(`Ver perfil de ${provider.name} (ID: ${providerId}) (funcionalidad pendiente)`)}
              />
            ))
          ) : (
            // Mensaje si no hay proveedores Y NO hay errores Y se tiene ubicación
            !isLoadingLocation && userLocation && googleMapsApiKey && !isMapApiLoadingError && providersToDisplay.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
                <p>No se encontraron proveedores para esta simulación en tu ubicación actual.</p>
              </div>
            )
          )}
           {/* Mensaje si no hay ubicación (y no hay errores de carga de mapa o API key) */}
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
    
    
