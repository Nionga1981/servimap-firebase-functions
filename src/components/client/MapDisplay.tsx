
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MapPinned, Search, AlertTriangle, WifiOff, Loader2, LocateFixed } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import { USER_FIXED_LOCATION, mockProviders } from '@/lib/mockData';
import { useSearchParams } from 'next/navigation';

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
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
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
        return provider.location && (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={`${provider.name} (Calificación: ${provider.rating.toFixed(1)})`}
          />
        )
      })}
    </GoogleMap>
  );
});
MapContentComponent.displayName = 'MapContentComponent';

export function MapDisplay() {
  const userLocation = USER_FIXED_LOCATION;
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [mapCenter, setMapCenter] = useState(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(16);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const searchParams = useSearchParams();
  const categoryParam = useMemo(() => searchParams.get('category'), [searchParams]);

  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; // TEMPORARY HARDCODED
  
  const libraries = useMemo(() => ['places'] as const, []);
  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries,
    id: 'google-map-script-servimap'
  });

  useEffect(() => {
    console.log('[MapDisplay useEffect] Triggered. Deps: userLocation, categoryParam, isMapApiLoaded, mapApiLoadError');
    if (!isMapApiLoaded || mapApiLoadError || !googleMapsApiKey) {
      console.log('[MapDisplay useEffect] Map API not ready or error, skipping provider processing. isLoaded:', isMapApiLoaded, 'loadError:', mapApiLoadError);
      setDisplayedProviders([]);
      setProvidersVisibleInPanel(false);
      return;
    }
    
    console.log('[MapDisplay useEffect] Processing providers. UserLocation:', userLocation, 'CategoryParam:', categoryParam);
    let providersSource = [...mockProviders];
    console.log('[MapDisplay useEffect] Initial mockProviders count:', providersSource.length);

    // 1. Filter by distance (20km radius)
    if (userLocation) {
      providersSource = providersSource.filter(provider => {
        if (provider.location && provider.isAvailable) {
          const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
          return distance <= 20; 
        }
        return false;
      });
      console.log('[MapDisplay useEffect] Providers after distance filter (and isAvailable):', providersSource.length, providersSource.map(p => p.name));
    }

    // 2. Filter by category from URL (if categoryParam is a specific category ID)
    const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
    if (isActiveCategoryFilter) {
      console.log(`[MapDisplay useEffect] Applying specific category filter: ${categoryParam}`);
      providersSource = providersSource.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
      console.log('[MapDisplay useEffect] Providers after specific category filter:', providersSource.length, providersSource.map(p => p.name));
    }
    // If categoryParam is 'all', no further category filtering is done here; all nearby providers are kept.
    // If categoryParam is null/undefined, no category filtering from URL.

    providersSource.sort((a, b) => b.rating - a.rating);
    setDisplayedProviders(providersSource);
    
    // Panel Visibility Logic based on categoryParam
    if (categoryParam) { // User has interacted with category filter (selected a category or "all")
      console.log(`[MapDisplay useEffect] Category param is '${categoryParam}'. Setting panel visibility based on results.`);
      setProvidersVisibleInPanel(providersSource.length > 0);
    } else { // No category param from URL (e.g., initial load, or URL cleared of category)
      console.log('[MapDisplay useEffect] No category param from URL. Panel visibility not changed by useEffect, relies on handleSearch or remains hidden.');
      // To ensure panel hides if filter is cleared and no search was made:
      // setProvidersVisibleInPanel(false); // This line would hide it if categoryParam is removed.
      // For now, let's keep it this way: useEffect only shows panel if categoryParam is active.
      // It doesn't hide it if categoryParam is removed. handleSearch can still show it.
      // A better approach: if categoryParam is null, hide panel.
      setProvidersVisibleInPanel(false); // Explicitly hide if no category param from URL
    }
    
    setMapCenter(userLocation);
    
  }, [userLocation, categoryParam, isMapApiLoaded, mapApiLoadError, googleMapsApiKey]);

  const onMapLoadCallback = useCallback((map: google.maps.Map) => {
    console.log("Google Map component successfully loaded. Instancia del mapa:", map);
    setMapInstance(map);
  }, []);

  const onMapUnmountCallback = useCallback(() => {
    console.log("Google Map component unmounted.");
    setMapInstance(null);
  }, []);

  const handleSearch = () => {
    console.log('[MapDisplay handleSearch] Search button clicked.');
    let providersToDisplay = [...mockProviders]; 

    if (userLocation) {
      providersToDisplay = providersToDisplay.filter(provider => {
        if (provider.location && provider.isAvailable) {
          const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
          return distance <= 20;
        }
        return false;
      });
    }
    console.log('[MapDisplay handleSearch] Providers after distance filter (and isAvailable):', providersToDisplay.length);

    const currentCategoryParam = searchParams.get('category'); // Use searchParams directly here
    console.log(`[MapDisplay handleSearch] categoryParam from URL: ${currentCategoryParam}`);
    if (currentCategoryParam && currentCategoryParam !== 'all' && currentCategoryParam !== '') {
      console.log(`[MapDisplay handleSearch] Applying category filter: ${currentCategoryParam}`);
      providersToDisplay = providersToDisplay.filter(provider =>
        provider.services.some(service => service.category === currentCategoryParam)
      );
    }
    console.log('[MapDisplay handleSearch] Providers after category filter:', providersToDisplay.length);
    
    // Placeholder for future text search based on `searchTerm`
    // if (searchTerm.trim() !== '') { ... }

    providersToDisplay.sort((a, b) => b.rating - a.rating);
    setDisplayedProviders(providersToDisplay);
    setProvidersVisibleInPanel(providersToDisplay.length > 0);
    console.log(`[MapDisplay handleSearch] Setting providersVisibleInPanel to ${providersToDisplay.length > 0}. Final displayed providers:`, providersToDisplay.map(p=>p.name));

    if (providersToDisplay.length === 0) {
      console.log("[MapDisplay handleSearch] No providers found for current filters.");
    }
  };

  const renderMapArea = () => {
    if (!googleMapsApiKey) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Configuración Requerida</p>
          <p className="text-sm text-center">La API Key de Google Maps no está configurada.</p>
        </div>
      );
    }

    if (mapApiLoadError) {
       return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <WifiOff className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Error Cargando Google Maps</p>
          <p className="text-sm text-center">Error al cargar la API: {mapApiLoadError.message}.</p>
        </div>
      );
    }

    if (!isMapApiLoaded) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-primary p-4 bg-primary/5">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-semibold">Cargando Mapa...</p>
        </div>
      );
    }
    
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
              {categoryParam && categoryParam !== 'all' 
                ? `Proveedores de "${searchParams.get('category')}" cercanos:` // Use searchParams here for display
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

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

    