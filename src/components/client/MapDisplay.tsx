
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MapPinned, Search, AlertTriangle, WifiOff, Loader2 } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import { USER_FIXED_LOCATION, mockProviders } from '@/lib/mockData'; // Importar desde mockData
import { useSearchParams } from 'next/navigation'; // Importar useSearchParams

const apiKeyFromEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// console.log('[MapDisplay Module] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:', apiKeyFromEnv);


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
  { featureType: "poi.business", stylers: [{ visibility: "off" }] }, // Oculta negocios
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", stylers: [{ visibility: "off" }] }, 
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "transit.station.airport", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station.bus", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station.rail", stylers: [{ visibility: "off" }] },
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
  // console.log('[MapContentComponent] Rendering. Center:', center, 'Providers on map:', providersToDisplayOnMap.length);
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
            fillColor: "hsl(var(--primary))", 
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
          }}
        />
      )}
      {providersToDisplayOnMap.map(provider => {
        return provider.location && ( // No es necesario checar provider.isAvailable aquí si ya se filtró antes
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={`${provider.name} (Calificación: ${provider.rating.toFixed(1)})`}
            // Iconos personalizados por categoría se implementarían aquí en el futuro
          />
        )
      })}
    </GoogleMap>
  );
});
MapContentComponent.displayName = 'MapContentComponent';


export function MapDisplay() {
  const userLocation = USER_FIXED_LOCATION; // Ubicación fija para la demo en Culiacán
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [mapCenter, setMapCenter] = useState(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(16); // Zoom más cercano por defecto
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchParams = useSearchParams(); // Hook para leer parámetros de URL

  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; // TEMPORARY HARDCODED

  // console.log('[MapDisplay Component] Using hardcoded googleMapsApiKey for Culiacan demo.');
  // console.log('[MapDisplay Component] User fixed location (Culiacan):', userLocation);
  
  const libraries = useMemo(() => ['places'] as const, []);
  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader(
    googleMapsApiKey
      ? { googleMapsApiKey, libraries, id: 'google-map-script-servimap' }
      : { skip: true }
  );
  // console.log('[MapDisplay Render] isMapApiLoaded:', isMapApiLoaded, 'mapApiLoadError:', mapApiLoadError);

  useEffect(() => {
    if (!isMapApiLoaded || mapApiLoadError || !googleMapsApiKey) {
      console.log('[MapDisplay useEffect] Map API not ready or error, skipping provider processing.');
      setDisplayedProviders([]);
      setProvidersVisibleInPanel(false);
      return;
    }
    
    console.log('[MapDisplay useEffect] Processing providers. UserLocation:', userLocation);
    let providersSource = [...mockProviders]; // Start with a fresh copy
    console.log('[MapDisplay useEffect] Initial mockProviders count:', providersSource.length);


    // 1. Filter by distance (20km radius)
    if (userLocation) {
      providersSource = providersSource.filter(provider => {
        if (provider.location && provider.isAvailable) { // Asegurar que solo disponibles se consideren
          const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
          return distance <= 20; 
        }
        return false;
      });
      console.log('[MapDisplay useEffect] Providers after distance filter (and isAvailable):', providersSource.length, providersSource.map(p => p.name));
    } else {
      console.log('[MapDisplay useEffect] No userLocation, skipping distance filter.');
    }

    // 2. Filter by category from URL
    const categoryParam = searchParams.get('category');
    console.log('[MapDisplay useEffect] categoryParam from URL:', categoryParam);

    if (categoryParam && categoryParam !== 'all' && categoryParam !== '') {
      console.log(`[MapDisplay useEffect] Applying category filter: ${categoryParam}`);
      providersSource = providersSource.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
      console.log('[MapDisplay useEffect] Providers after category filter:', providersSource.length, providersSource.map(p => p.name));
    } else {
      console.log("[MapDisplay useEffect] Not filtering by category (all or no param).");
    }

    // 3. Sort by rating (descending)
    providersSource.sort((a, b) => b.rating - a.rating);
    // console.log('[MapDisplay useEffect] Providers after sorting:', providersSource.map(p => `${p.name} (${p.rating})`));

    setDisplayedProviders(providersSource);
    
    // Si hay un filtro de categoría activo (y no es "all"), y hay resultados, mostrar el panel.
    // Si no, la visibilidad del panel se controla por handleSearch (botón "Buscar").
    if (categoryParam && categoryParam !== 'all' && categoryParam !== '') {
      setProvidersVisibleInPanel(providersSource.length > 0);
      console.log(`[MapDisplay useEffect] Category filter '${categoryParam}' is active. Panel visible: ${providersSource.length > 0}`);
    } else {
      // Si no hay filtro de categoría activo desde la URL, el panel se oculta inicialmente o después de limpiar el filtro.
      // Se mostrará solo si el usuario presiona "Buscar".
      // Si `providersVisibleInPanel` ya era true por una búsqueda previa, y el filtro de categoría se limpia,
      // el panel debería ocultarse si la intención es volver a un estado "sin búsqueda activa".
      // Esto podría necesitar una lógica más fina si se quiere mantener el panel visible con "todos" los proveedores después de una búsqueda.
      // Por ahora, si no hay filtro de categoría, el panel se oculta a menos que se presione "Buscar".
      if (providersVisibleInPanel && (!categoryParam || categoryParam === 'all' || categoryParam === '')) {
         // Si el panel estaba visible y se limpia el filtro, lo ocultamos.
         // OJO: Esto podría ser contraintuitivo si el usuario espera ver "todos" los proveedores cercanos.
         // Por ahora, la política es: el panel se muestra explícitamente por búsqueda o filtro de categoría activo.
         // setProvidersVisibleInPanel(false); 
         // console.log('[MapDisplay useEffect] No category filter or "all". Panel visibility relies on search button click.');
      }
    }
    setMapCenter(userLocation); // Asegurarse que el mapa se centra en la ubicación del usuario
    
  }, [userLocation, searchParams, isMapApiLoaded, mapApiLoadError, googleMapsApiKey]);

  const onMapLoadCallback = useCallback((map: google.maps.Map) => {
    // console.log("Google Map component successfully loaded. Instancia del mapa:", map);
    setMapInstance(map);
  }, []);

  const onMapUnmountCallback = useCallback(() => {
    // console.log("Google Map component unmounted.");
    setMapInstance(null);
  }, []);

  const handleSearch = () => {
    console.log('[MapDisplay handleSearch] Search button clicked.');
    let providersToDisplay = [...mockProviders]; 

    // 1. Filter by distance
    if (userLocation) {
      providersToDisplay = providersToDisplay.filter(provider => {
        if (provider.location && provider.isAvailable) { // Asegurar que solo disponibles se consideren
          const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
          return distance <= 20;
        }
        return false;
      });
    }
    console.log('[MapDisplay handleSearch] Providers after distance filter (and isAvailable):', providersToDisplay.length, providersToDisplay.map(p => p.name));

    // 2. Filter by category from URL
    const categoryParam = searchParams.get('category');
    console.log(`[MapDisplay handleSearch] categoryParam from URL: ${categoryParam}`);
    if (categoryParam && categoryParam !== 'all' && categoryParam !== '') {
      console.log(`[MapDisplay handleSearch] Applying category filter: ${categoryParam}`);
      providersToDisplay = providersToDisplay.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
    }
    console.log('[MapDisplay handleSearch] Providers after category filter:', providersToDisplay.length, providersToDisplay.map(p => p.name));

    // 3. Filter by searchTerm (futura implementación)
    // if (searchTerm.trim() !== '') {
    //   console.log(`[MapDisplay handleSearch] Applying text search: ${searchTerm}`);
    //   providersToDisplay = providersToDisplay.filter(provider =>
    //     provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    //     provider.specialties?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
    //     provider.services.some(service => service.title.toLowerCase().includes(searchTerm.toLowerCase()) || service.description.toLowerCase().includes(searchTerm.toLowerCase()))
    //   );
    // }
    // console.log('[MapDisplay handleSearch] Providers after text search:', providersToDisplay.length, providersToDisplay.map(p => p.name));


    // 4. Sort by rating
    providersToDisplay.sort((a, b) => b.rating - a.rating);

    setDisplayedProviders(providersToDisplay);
    setProvidersVisibleInPanel(providersToDisplay.length > 0);
    console.log(`[MapDisplay handleSearch] Setting providersVisibleInPanel to ${providersToDisplay.length > 0}. Final displayed providers:`, providersToDisplay.map(p=>p.name));

    if (providersToDisplay.length === 0) {
      // Aquí podrías usar un toast para indicar que no se encontraron resultados.
      // toast({ title: "Sin resultados", description: "No se encontraron proveedores con los filtros actuales." });
      console.log("[MapDisplay handleSearch] No providers found for current filters.");
    }
  };


  const renderMapArea = () => {
    // console.log('[renderMapArea] Current state: isMapApiLoaded:', isMapApiLoaded, 'mapApiLoadError:', mapApiLoadError, 'googleMapsApiKey set:', !!googleMapsApiKey);
    if (!googleMapsApiKey) {
      // console.log('[renderMapArea] No API Key');
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Configuración Requerida</p>
          <p className="text-sm text-center">La API Key de Google Maps no está configurada.</p>
        </div>
      );
    }

    if (mapApiLoadError) {
       // console.log('[renderMapArea] mapApiLoadError:', mapApiLoadError);
       return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <WifiOff className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Error Cargando Google Maps</p>
          <p className="text-sm text-center">Error al cargar la API de Google Maps: {mapApiLoadError.message}. Revisa la consola para más detalles.</p>
        </div>
      );
    }

    if (!isMapApiLoaded) {
      // console.log('[renderMapArea] !isMapApiLoaded (Loading Map API...)');
      return (
        <div className="flex flex-col items-center justify-center h-full text-primary p-4 bg-primary/5">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-semibold">Cargando Mapa...</p>
        </div>
      );
    }
    
    // console.log('[renderMapArea] Rendering MapContentComponent with mapCenter:', mapCenter, 'and userLocation:', userLocation);
    return (
      <MapContentComponent
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onMapLoadCallback}
        onUnmount={onMapUnmountCallback}
        userLocationToDisplay={userLocation} 
        providersToDisplayOnMap={displayedProviders} // Pasar los proveedores filtrados y ordenados al mapa
      />
    );
  };
  
  // El panel derecho solo se muestra si providersVisibleInPanel es true Y hay proveedores
  const shouldDisplayRightPanel = providersVisibleInPanel && displayedProviders.length > 0;

  return (
    <Card className="shadow-xl overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Buscar por nombre, servicio..." 
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
        </div>
      </CardHeader>
      <CardContent className="p-0 md:flex flex-grow overflow-hidden">
         <div className={cn(
             "h-[calc(100vh-var(--header-height,150px)-var(--map-header-height,80px)-var(--ad-banner-height,70px))] md:h-auto relative bg-muted flex items-center justify-center text-foreground flex-grow",
             shouldDisplayRightPanel ? "md:w-2/3" : "md:w-full" 
           )}>
          {renderMapArea()}
        </div>

        {shouldDisplayRightPanel && (
          <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-full md:overflow-y-auto space-y-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-primary mb-2">
              {searchParams.get('category') && searchParams.get('category') !== 'all' 
                ? `Proveedores de "${searchParams.get('category')}" cercanos:`
                : "Proveedores Cercanos:"}
            </h3>
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
                <p className="text-sm">Usa el botón "Buscar" o selecciona una categoría del menú superior.</p>
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
