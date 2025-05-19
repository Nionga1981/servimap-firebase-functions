
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MapPinned, Search, AlertTriangle, WifiOff, Loader2, Filter } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import { USER_FIXED_LOCATION, mockProviders } from '@/lib/mockData'; // Importar desde mockData

const apiKeyFromEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
console.log('[MapDisplay Module] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:', apiKeyFromEnv);


const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const mapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", stylers: [{ visibility: "off" }] }, // Oculta calles locales para más limpieza
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];

// Define MapContentComponent outside MapDisplay
const MapContentComponent = React.memo(({
  center,
  zoom,
  onLoad,
  onUnmount,
  userLocationToDisplay,
  providersToDisplayOnMap
}: {
  center: { lat: number; lng: number };
  zoom: number;
  onLoad: (map: google.maps.Map) => void;
  onUnmount: () => void;
  userLocationToDisplay: { lat: number; lng: number } | null;
  providersToDisplayOnMap: Provider[];
}) => {
  console.log('[MapContentComponent] Rendering. Center:', center, 'Providers on map:', providersToDisplayOnMap.length);
  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={zoom}
      options={{
        styles: mapStyles,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: false,
        rotateControl: false,
        scaleControl: false,
        clickableIcons: false,
      }}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {userLocationToDisplay && (
        <MarkerF
          position={userLocationToDisplay}
          title="Tu ubicación (simulada)"
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "hsl(var(--primary))", // Usa el color primario del tema
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
          }}
        />
      )}
      {providersToDisplayOnMap.map(provider => {
        return provider.location && provider.isAvailable && (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={`${provider.name} (Calificación: ${provider.rating.toFixed(1)})`}
            // Iconos personalizados por categoría se implementarían aquí en el futuro
            // Ejemplo: icon={getCategoryIconUrl(provider.category)}
          />
        )
      })}
    </GoogleMap>
  );
});
MapContentComponent.displayName = 'MapContentComponent';


export function MapDisplay() {
  const userLocation = USER_FIXED_LOCATION; // Ubicación fija para la demo
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [mapCenter, setMapCenter] = useState(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(16);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Estado para el término de búsqueda

  // TEMPORARY HARDCODED - RECUERDA QUITAR ESTO Y USAR .ENV EN UN ENTORNO REAL
  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; 

  console.log('[MapDisplay Component] Using hardcoded googleMapsApiKey value for Culiacan demo:', googleMapsApiKey);
  console.log('[MapDisplay Component] User fixed location (Culiacan):', userLocation);
  
  const libraries = useMemo(() => ['places'] as const, []);
  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader(
    googleMapsApiKey
      ? { googleMapsApiKey, libraries, id: 'google-map-script-servimap' }
      : { skip: true }
  );
  console.log('[MapDisplay Render] isMapApiLoaded:', isMapApiLoaded, 'mapApiLoadError:', mapApiLoadError);

  // Cargar y filtrar proveedores basados en la ubicación fija del usuario
  useEffect(() => {
    console.log("[MapDisplay useEffect] Procesando proveedores con ubicación fija (Culiacán):", userLocation);
    
    const providersInRange = mockProviders.filter(provider => {
      if (provider.location && provider.isAvailable) { // Asegurarse que solo disponibles se consideren
        const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
        console.log(`[MapDisplay useEffect] Distancia a ${provider.name}: ${distance.toFixed(2)} km`);
        return distance <= 20; // Radio de 20 km
      }
      return false;
    });

    // Ordenar por calificación descendente
    const sortedProviders = providersInRange.sort((a, b) => b.rating - a.rating);
    setDisplayedProviders(sortedProviders);
    
    if (sortedProviders.length > 0) {
      // La visibilidad del panel se controla por la búsqueda explícita ahora
      // setProvidersVisibleInPanel(true); 
      console.log(`[MapDisplay useEffect] ${sortedProviders.length} proveedores encontrados cerca de Culiacán.`);
    } else {
      setProvidersVisibleInPanel(false);
      console.log("[MapDisplay useEffect] No se encontraron proveedores cerca de Culiacán.");
    }
    setMapCenter(userLocation);
    
  }, [userLocation]); // Dependencia en userLocation (que es constante aquí)

  const onMapLoadCallback = useCallback((map: google.maps.Map) => {
    console.log("Google Map component successfully loaded. Instancia del mapa:", map);
    setMapInstance(map);
  }, []);

  const onMapUnmountCallback = useCallback(() => {
    console.log("Google Map component unmounted.");
    setMapInstance(null);
  }, []);

  // Función para simular la búsqueda
  const handleSearch = () => {
    // Por ahora, simplemente mostramos los proveedores que ya están filtrados por distancia.
    // En una implementación real, aquí se filtraría 'displayedProviders' por 'searchTerm'.
    if (displayedProviders.length > 0) {
        setProvidersVisibleInPanel(true);
        console.log(`Búsqueda simulada. Mostrando ${displayedProviders.length} proveedores cercanos.`);
    } else {
        setProvidersVisibleInPanel(false);
        console.log("Búsqueda simulada. No hay proveedores cercanos para mostrar.");
    }
    // Si se quiere implementar filtrado por texto (ejemplo básico):
    // const filteredBySearchTerm = displayedProviders.filter(provider => 
    //   provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    //   provider.services.some(service => service.title.toLowerCase().includes(searchTerm.toLowerCase()))
    // );
    // setFilteredProvidersForPanel(filteredBySearchTerm); // Necesitarías un nuevo estado para esto
    // setProvidersVisibleInPanel(true);
  };


  const renderMapArea = () => {
    console.log('[renderMapArea] Current state: isMapApiLoaded:', isMapApiLoaded, 'mapApiLoadError:', mapApiLoadError, 'googleMapsApiKey set:', !!googleMapsApiKey);
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
      console.log('[renderMapArea] !isMapApiLoaded (Loading Map API...)');
      return (
        <div className="flex flex-col items-center justify-center h-full text-primary p-4 bg-primary/5">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-semibold">Cargando Mapa...</p>
        </div>
      );
    }
    
    console.log('[renderMapArea] Rendering MapContentComponent with mapCenter:', mapCenter, 'and userLocation:', userLocation);
    return (
      <MapContentComponent
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onMapLoadCallback}
        onUnmount={onMapUnmountCallback}
        userLocationToDisplay={userLocation} 
        providersToDisplayOnMap={displayedProviders} 
      />
    );
  };
  
  // El panel derecho solo se muestra si providersVisibleInPanel es true Y hay proveedores
  const shouldDisplayRightPanel = providersVisibleInPanel && displayedProviders.length > 0;

  return (
    <Card className="shadow-xl overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b p-4 space-y-3">
         <h2 className="text-xl font-semibold text-primary text-center">
          Servicios Disponibles en Culiacán (Simulado)
        </h2>
        <div className="flex items-center space-x-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Buscar servicio, nombre, categoría..." 
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} aria-label="Buscar">
            <Search className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Buscar</span>
          </Button>
          {/* Botón de filtro (funcionalidad futura) */}
          {/* 
          <Button variant="outline" size="icon" aria-label="Filtrar servicios">
            <Filter className="h-4 w-4" />
          </Button> 
          */}
        </div>
      </CardHeader>
      <CardContent className="p-0 md:flex flex-grow overflow-hidden">
         <div className={cn(
             "h-[calc(100vh-var(--header-height,150px)-var(--map-header-height,120px)-var(--ad-banner-height,70px))] md:h-auto relative bg-muted flex items-center justify-center text-foreground flex-grow",
             shouldDisplayRightPanel ? "md:w-2/3" : "md:w-full" 
           )}>
          {renderMapArea()}
        </div>

        {shouldDisplayRightPanel && (
          <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-full md:overflow-y-auto space-y-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-primary mb-2">Proveedores Cercanos (menos de 20km):</h3>
            {displayedProviders.map(provider => ( 
                <ProviderPreviewCard
                  key={provider.id}
                  provider={provider}
                />
              ))}
          </div>
        )}
         {isMapApiLoaded && !mapApiLoadError && googleMapsApiKey && !shouldDisplayRightPanel && (
             <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-full md:overflow-y-auto space-y-4 flex-shrink-0 flex flex-col items-center justify-center text-muted-foreground text-center">
                <MapPinned className="h-10 w-10 mb-3 text-primary" />
                <p className="font-semibold">Realiza una búsqueda para ver proveedores.</p>
                <p className="text-sm">Ingresa un término en la barra de arriba y presiona "Buscar".</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

// Función para calcular la distancia (Haversine)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en km
};
