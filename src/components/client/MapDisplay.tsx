
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader, PolylineF, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MapPinned, Search, AlertTriangle, WifiOff, Loader2, LocateFixed, Car, Clock } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import * as mockData from '@/lib/mockData'; // Import all exports as mockData
import { SERVICE_CATEGORIES, DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useSearchParams } from 'next/navigation';

// console.log('[MapDisplay Module] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const mapStylesArray: google.maps.MapTypeStyle[] = [
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


// Define MapContentComponent outside MapDisplay
const MapContentComponent = React.memo(({
  center,
  zoom,
  onLoad,
  onUnmount,
  userLocationToDisplay,
  providersToDisplayOnMap,
  children,
}: {
  center: google.maps.LatLngLiteral;
  zoom: number;
  onLoad: (map: google.maps.Map) => void;
  onUnmount: () => void;
  userLocationToDisplay: google.maps.LatLngLiteral | null;
  providersToDisplayOnMap: Provider[];
  children?: React.ReactNode;
}) => {
  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={zoom}
      options={{
        styles: mapStylesArray,
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
          title="Tu ubicación"
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
            // Icono personalizado por categoría (requiere más trabajo)
            // icon={getCategoryMarkerIcon(provider.services[0]?.category)}
          />
        )
      })}
      {children}
    </GoogleMap>
  );
});
MapContentComponent.displayName = 'MapContentComponent';

interface EnRouteProviderInfo {
  provider: Provider;
  currentLocation: google.maps.LatLngLiteral;
  status: "En camino" | "Ha llegado";
  eta: string;
  route: google.maps.DirectionsRoute | null;
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
  return R * c; // Distancia en km
};

export function MapDisplay() {
  const libraries = useMemo(() => ['places'] as const, []);
  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; // Mantener hardcodeado para la prueba

  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries,
    id: 'google-map-script-servimap'
  });

  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(mockData.USER_FIXED_LOCATION);
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(mockData.USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(16);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const searchParams = useSearchParams();
  const categoryParam = useMemo(() => searchParams.get('category'), [searchParams]);
  const currentHiredProviderId = useMemo(() => searchParams.get('hiredProviderId'), [searchParams]);

  const [enRouteProviderInfo, setEnRouteProviderInfo] = useState<EnRouteProviderInfo | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const simulationTimeoutIds = useRef<NodeJS.Timeout[]>([]);


  // Efecto para manejar proveedor contratado y simulación de ruta
 useEffect(() => {
    console.log('[MapDisplay] useEffect for hiredProviderId. Current ID from URL:', currentHiredProviderId);
    console.log('[MapDisplay] Conditions: isMapApiLoaded:', isMapApiLoaded, 'mapInstance:', !!mapInstance, 'userLocation:', !!userLocation);

    // Limpiar estado anterior si cambia hiredProviderId o se elimina
    if (!currentHiredProviderId && enRouteProviderInfo) {
      console.log('[MapDisplay] No hiredProviderId, clearing enRouteProviderInfo and directions.');
      setEnRouteProviderInfo(null);
      setDirectionsResponse(null);
      simulationTimeoutIds.current.forEach(clearTimeout);
      simulationTimeoutIds.current = [];
      if (userLocation) setMapCenter(userLocation); // Reset map center
      setMapZoom(16); // Reset zoom
      return;
    }

    if (currentHiredProviderId && isMapApiLoaded && mapInstance && userLocation) {
      const providerInRoute = mockData.mockProviders.find(p => p.id === currentHiredProviderId);
      console.log('[MapDisplay] Found providerInRoute:', providerInRoute);

      if (providerInRoute && providerInRoute.location) {
        setProvidersVisibleInPanel(false); // Hide regular provider list
        setEnRouteProviderInfo({
          provider: providerInRoute,
          currentLocation: providerInRoute.location,
          status: "En camino",
          eta: "Calculando...",
          route: null,
        });
        // Center between provider and user or fit bounds later
        
        console.log('[MapDisplay] Requesting directions from:', providerInRoute.location, 'to:', userLocation);
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: providerInRoute.location,
            destination: userLocation,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            console.log('[MapDisplay] DirectionsService callback. Status:', status); //, 'Result:', result
            if (status === google.maps.DirectionsStatus.OK && result) {
              setDirectionsResponse(result);
              const route = result.routes[0];
              if (route && route.legs[0] && route.legs[0].duration) {
                const etaText = route.legs[0].duration.text;
                console.log('[MapDisplay] Route found. ETA:', etaText);
                setEnRouteProviderInfo(prev => prev ? {...prev, eta: etaText, route } : null);
                if (mapInstance && route.bounds) {
                  mapInstance.fitBounds(route.bounds);
                }
                simulateProviderMovement(route, providerInRoute);
              } else {
                console.error('[MapDisplay] Route or leg duration not found in directions result.');
                setEnRouteProviderInfo(prev => prev ? {...prev, eta: "ETA no disp." } : null);
              }
            } else {
              console.error(`[MapDisplay] Error fetching directions ${status}`);
              setEnRouteProviderInfo(prev => prev ? {...prev, eta: "Error ruta" } : null);
            }
          }
        );
      } else {
         console.log('[MapDisplay] Hired provider or its location not found for ID:', currentHiredProviderId);
      }
    }
    // Cleanup function
    return () => {
      simulationTimeoutIds.current.forEach(clearTimeout);
      simulationTimeoutIds.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHiredProviderId, isMapApiLoaded, mapInstance, userLocation]);


  const simulateProviderMovement = useCallback((route: google.maps.DirectionsRoute, provider: Provider) => {
    console.log('[MapDisplay] simulateProviderMovement started for route with provider:', provider.name);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];

    if (!route.legs || !route.legs[0] || !route.legs[0].steps || !userLocation) {
      console.error('[MapDisplay] No steps found in route or userLocation missing for simulation.');
      // Fallback if no steps, provider "arrives" after a delay
      if (userLocation) {
          const arrivalTimeout = setTimeout(() => {
              setEnRouteProviderInfo(prev => prev ? {
                  ...prev,
                  currentLocation: userLocation,
                  status: "Ha llegado",
                  eta: "0 min",
              } : null);
              console.log('[MapDisplay] Fallback: Provider arrived at user location.');
              if (mapInstance) {
                  mapInstance.panTo(userLocation);
                  mapInstance.setZoom(17);
              }
          }, 5000); // 5 second delay
          simulationTimeoutIds.current.push(arrivalTimeout);
      }
      return;
    }

    const steps = route.legs[0].steps;
    let cumulativeDelay = 0;
    const stepDuration = 2000; // Simulate 2 seconds per step

    steps.forEach((step, index) => {
      const timeoutId = setTimeout(() => {
        const newLocation = { lat: step.end_location.lat(), lng: step.end_location.lng() };
        // console.log(`[MapDisplay] Simulating step ${index + 1}/${steps.length}: Moving to`, newLocation);

        let remainingSeconds = 0;
        for (let i = index + 1; i < steps.length; i++) {
          remainingSeconds += steps[i].duration?.value || 0;
        }
        const remainingMinutes = Math.ceil(remainingSeconds / 60);
        const newEta = remainingMinutes > 0 ? `${remainingMinutes} min` : "Casi llega";

        setEnRouteProviderInfo(prev => {
          if (!prev) return null;
          // console.log(`[MapDisplay] Updating enRouteProviderInfo: newLocation, newEta: ${newEta}`);
          return { ...prev, currentLocation: newLocation, eta: newEta };
        });

        if (mapInstance) {
          mapInstance.panTo(newLocation);
        }

        if (index === steps.length - 1) {
          console.log('[MapDisplay] Simulation: Provider arrived at destination.');
          setEnRouteProviderInfo(prev => {
            if (!prev) return null;
            return { ...prev, currentLocation: userLocation, status: "Ha llegado", eta: "0 min" };
          });
          if (mapInstance) {
            mapInstance.panTo(userLocation);
            mapInstance.setZoom(17);
          }
        }
      }, cumulativeDelay);
      simulationTimeoutIds.current.push(timeoutId);
      cumulativeDelay += stepDuration;
    });
    // console.log(`[MapDisplay] Total ${steps.length} steps scheduled for simulation.`);
  }, [mapInstance, userLocation]); // Added userLocation here


  // Efecto para actualizar proveedores basados en categoría y ubicación (si no hay proveedor en ruta)
  useEffect(() => {
    console.log('[MapDisplay] useEffect for category/search. CategoryParam:', categoryParam, 'UserLocation:', !!userLocation);
    if (currentHiredProviderId) {
        setDisplayedProviders([]);
        // setProvidersVisibleInPanel(false); // Visibility handled by enRouteProviderInfo
        console.log('[MapDisplay category-useEffect] Hired provider detected, clearing displayedProviders.');
        return;
    }

    let filteredProviders = [...mockData.mockProviders];

    if (userLocation) {
      filteredProviders = filteredProviders.filter(provider => {
        if (provider.location) {
          const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
          return distance <= 20;
        }
        return false;
      });
      console.log('[MapDisplay category-useEffect] Providers after distance filter:', filteredProviders.length);
    }

    const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
    if (isActiveCategoryFilter) {
      console.log(`[MapDisplay category-useEffect] Applying specific category filter: ${categoryParam}`);
      filteredProviders = filteredProviders.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
      console.log('[MapDisplay category-useEffect] Providers after specific category filter:', filteredProviders.length);
    }
    
    filteredProviders.sort((a, b) => b.rating - a.rating);
    setDisplayedProviders(filteredProviders);
    
    // Manage panel visibility only if a category filter is active from URL
    if (categoryParam) {
      console.log(`[MapDisplay category-useEffect] Category param is '${categoryParam}'. Setting panel visibility based on results: ${filteredProviders.length > 0}`);
      setProvidersVisibleInPanel(filteredProviders.length > 0);
    }
    // If categoryParam is null, this useEffect does NOT change providersVisibleInPanel.
    // It allows handleSearch to control visibility for text searches.

    if (userLocation && !currentHiredProviderId) {
        setMapCenter(userLocation);
    }
    
  }, [userLocation, categoryParam, currentHiredProviderId]);


  const onMapLoadCallback = useCallback((map: google.maps.Map) => {
    console.log("[MapDisplay] Google Map component successfully loaded.");
    setMapInstance(map);
  }, []);

  const onMapUnmountCallback = useCallback(() => {
    console.log("[MapDisplay] Google Map component unmounted.");
    setMapInstance(null);
    setDirectionsResponse(null);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];
  }, []);

  const handleSearch = () => {
    console.log('[MapDisplay] Search button clicked. HiredProviderId:', currentHiredProviderId);
    if (currentHiredProviderId) return; 

    let providersToDisplay = [...mockData.mockProviders];
    console.log('[MapDisplay handleSearch] Initial mockProviders count:', providersToDisplay.length);

    if (userLocation) {
      providersToDisplay = providersToDisplay.filter(provider => {
        if (provider.location) {
          const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
          return distance <= 20; 
        }
        return false;
      });
    }
    console.log('[MapDisplay handleSearch] Providers after distance filter:', providersToDisplay.length);
    
    // Apply category filter from URL if present
    if (categoryParam && categoryParam !== 'all' && categoryParam !== '') {
      console.log(`[MapDisplay handleSearch] Applying category filter from URL: ${categoryParam}`);
      providersToDisplay = providersToDisplay.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
    }
    console.log('[MapDisplay handleSearch] Providers after category filter (from URL):', providersToDisplay.length);
    
    // Apply text search based on `searchTerm`
    if (searchTerm.trim() !== '') {
        console.log(`[MapDisplay handleSearch] Applying text search for: "${searchTerm}"`);
        providersToDisplay = providersToDisplay.filter(provider =>
            provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            provider.services.some(service => service.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
            provider.specialties?.some(specialty => specialty.toLowerCase().includes(searchTerm.toLowerCase()))
        );
         console.log('[MapDisplay handleSearch] Providers after text search:', providersToDisplay.length);
    }

    providersToDisplay.sort((a, b) => b.rating - a.rating);
    setDisplayedProviders(providersToDisplay);
    setProvidersVisibleInPanel(providersToDisplay.length > 0); 
    console.log(`[MapDisplay handleSearch] Setting providersVisibleInPanel to ${providersToDisplay.length > 0}. Displayed providers count: ${providersToDisplay.length}`);

    if (providersToDisplay.length === 0) {
      console.log("[MapDisplay handleSearch] No providers found for current filters.");
    }
  };


  const renderMapArea = () => {
    // console.log('[MapDisplay] renderMapArea called. isMapApiLoaded:', isMapApiLoaded, 'mapApiLoadError:', !!mapApiLoadError);
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
        <div className="flex flex-col items-center justify-center h-full text-primary p-4 bg-background/80">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-semibold">Cargando Mapa...</p>
        </div>
      );
    }
    
    const providersOnMap = enRouteProviderInfo?.provider ? [] : displayedProviders;
    
    return (
      <MapContentComponent
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onMapLoadCallback}
        onUnmount={onMapUnmountCallback}
        userLocationToDisplay={userLocation} 
        providersToDisplayOnMap={providersOnMap}
      >
        {directionsResponse && (
            <DirectionsRenderer directions={directionsResponse} options={{ suppressMarkers: true, preserveViewport: true }} />
        )}
        {enRouteProviderInfo?.provider.location && enRouteProviderInfo.currentLocation && (
           <MarkerF
             key={enRouteProviderInfo.provider.id + "-route"}
             position={enRouteProviderInfo.currentLocation}
             title={enRouteProviderInfo.provider.name + (enRouteProviderInfo.status === "En camino" ? " (En camino)" : " (Ha llegado)")}
             icon={{
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 5,
                strokeColor: "hsl(var(--accent))", // Use accent color for en-route provider
                fillColor: "hsl(var(--accent))",
                fillOpacity: 1,
             }}
             zIndex={1000} 
           />
        )}
      </MapContentComponent>
    );
  };
  
  const shouldDisplayRightPanel = providersVisibleInPanel && displayedProviders.length > 0 && !currentHiredProviderId;


  const EnRouteProviderPanel = () => {
    if (!enRouteProviderInfo || !enRouteProviderInfo.provider) return null;
    const { provider, status, eta } = enRouteProviderInfo;
    const providerCategory = SERVICE_CATEGORIES.find(c => c.id === provider.services[0]?.category);
    const IconComponent = providerCategory?.icon || Car;

    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-11/12 max-w-md z-10">
        <Card className="shadow-xl bg-background/90 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-4 p-4">
            <img 
                src={provider.avatarUrl || DEFAULT_USER_AVATAR} 
                alt={provider.name} 
                className="w-16 h-16 rounded-full border-2 border-primary object-cover"
                data-ai-hint={provider.dataAiHint || "provider avatar"}
            />
            <div>
              <h3 className="text-lg font-semibold text-primary">{provider.name}</h3>
              <p className="text-sm text-muted-foreground">{providerCategory?.name || "Servicio Contratado"}</p>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-center">
            {status === "En camino" ? (
              <>
                <div className="flex items-center justify-center gap-2 text-xl font-medium text-foreground mb-2">
                  <IconComponent className="w-6 h-6 text-primary" />
                  <span>{status}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-accent">
                  <Clock className="w-7 h-7" />
                  <span>Llega en {eta}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xl font-bold text-green-600">
                <IconComponent className="w-6 h-6" />
                <span>¡{provider.name} ha llegado!</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };


  return (
    <Card className="shadow-xl overflow-hidden h-full flex flex-col">
      {!enRouteProviderInfo && ( // Solo mostrar barra de búsqueda si no hay proveedor en ruta
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
      )}
      <CardContent className="p-0 md:flex flex-grow overflow-hidden relative"> 
         <div className={cn(
             "h-[calc(100vh-var(--header-height,150px)-var(--map-header-height,80px)-var(--ad-banner-height,70px))] md:h-auto relative bg-muted flex items-center justify-center text-foreground flex-grow",
             shouldDisplayRightPanel ? "md:w-2/3" : "md:w-full" 
           )}>
          {renderMapArea()}
        </div>

        {shouldDisplayRightPanel && (
          <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-full md:overflow-y-auto space-y-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-primary mb-2">
              {categoryParam && categoryParam !== 'all' && SERVICE_CATEGORIES.find(c=>c.id === categoryParam)
                ? `Proveedores de "${SERVICE_CATEGORIES.find(c=>c.id === categoryParam)?.name}" cercanos:`
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
         {isMapApiLoaded && !mapApiLoadError && googleMapsApiKey && !shouldDisplayRightPanel && !enRouteProviderInfo && (
             <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-full md:overflow-y-auto space-y-4 flex-shrink-0 flex flex-col items-center justify-center text-muted-foreground text-center">
                <MapPinned className="h-10 w-10 mb-3 text-primary" />
                <p className="font-semibold">Realiza una búsqueda o selecciona una categoría.</p>
                <p className="text-sm">Usa el botón "Buscar" o elige una categoría del menú superior para ver proveedores.</p>
            </div>
        )}
        <EnRouteProviderPanel />
      </CardContent>
    </Card>
  );
}

    