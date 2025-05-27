
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import { GoogleMap, MarkerF, useJsApiLoader, InfoWindowF, PolylineF, DirectionsRenderer } from '@react-google-maps/api';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, CheckCircle, Loader2, MapPin, Search, Star, Wifi, WifiOff, X, Briefcase, Shield, Package2, Navigation, Phone, Clock, CalendarDays, ShoppingBag } from 'lucide-react';
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData';
import { SERVICE_CATEGORIES, DEFAULT_USER_AVATAR } from '@/lib/constants';
import type { Provider, Service } from '@/types';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { BottomSearchContainer } from './BottomSearchContainer';

// Define the Google Maps API key, prioritizing environment variable, then fallback
const FALLBACK_GOOGLE_MAPS_API_KEY = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; // Your hardcoded key

const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const defaultMapZoom = 13;
const enRouteZoom = 14;

// TOP-LEVEL USER_MARKER_ICON DEFINITION REMOVED - This was causing the error.
// The icon object will be created conditionally within MapContentComponent.

const lucideIconToDataUri = (IconComponent: LucideIcon, color = "#3F51B5", size = 32) => {
  if (typeof window === 'undefined' || !IconComponent) {
    console.warn("[MapDisplay] lucideIconToDataUri: Cannot render on server or IconComponent is undefined.");
    return '';
  }
  try {
    const svgString = ReactDOMServer.renderToStaticMarkup(
      <IconComponent color={color} size={size} strokeWidth={2.5} />
    );
    const SvgWithXmlns = `<?xml version="1.0" encoding="UTF-8"?>` + svgString.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    const encodedSvg = encodeURIComponent(SvgWithXmlns);
    const dataUri = `data:image/svg+xml;charset=UTF-8,${encodedSvg}`;
    // console.log(`[MapDisplay] Generated iconDataUri for ${IconComponent.displayName || IconComponent.name}: ${dataUri.substring(0,100)}...`);
    return dataUri;
  } catch (error) {
    console.error("[MapDisplay] Error generating Lucide icon Data URI for an icon:", error);
    return ''; 
  }
};

const calculateDistance = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

interface EnRouteProviderInfo {
  provider: Provider;
  status: "En camino" | "Ha llegado";
  eta: string;
  currentLocation: google.maps.LatLngLiteral;
}

const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.natural", elementType: "labels", stylers: [{ visibility: "off" }] },
];

const MapContentComponent = React.memo(({
  mapCenter,
  mapZoom,
  userLocationToDisplay,
  providersToDisplayOnMap,
  onMapLoad,
  onMapUnmount,
  onMarkerClick,
  selectedProviderForInfoWindow,
  onInfoWindowClose,
  enRouteProviderInfo,
  directionsResponse,
  categoryIconCache,
  isMapApiLoaded, 
}: {
  mapCenter: google.maps.LatLngLiteral;
  mapZoom: number;
  userLocationToDisplay: google.maps.LatLngLiteral | null;
  providersToDisplayOnMap: Provider[];
  onMapLoad: (map: google.maps.Map) => void;
  onMapUnmount: (map: google.maps.Map) => void;
  onMarkerClick: (provider: Provider) => void;
  selectedProviderForInfoWindow: Provider | null;
  onInfoWindowClose: () => void;
  enRouteProviderInfo: EnRouteProviderInfo | null;
  directionsResponse: google.maps.DirectionsResult | null;
  categoryIconCache: React.MutableRefObject<Record<string, string>>;
  isMapApiLoaded: boolean; 
}) => {
  // console.log("[MapDisplay MapContentComponent] Rendering. User location:", userLocationToDisplay);
  // console.log("[MapDisplay MapContentComponent] isMapApiLoaded:", isMapApiLoaded);

  const userMarkerIconObject = useMemo(() => {
    if (isMapApiLoaded && typeof window !== 'undefined' && window.google && window.google.maps) { // Ensure google.maps is available
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#4285F4', 
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: 'white',
      };
    }
    return undefined; 
  }, [isMapApiLoaded]);

  // console.log("[MapDisplay MapContentComponent] userMarkerIconObject:", userMarkerIconObject);


  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={mapCenter}
      zoom={mapZoom}
      onLoad={onMapLoad}
      onUnmount={onMapUnmount}
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
    >
      {userLocationToDisplay && userMarkerIconObject && !enRouteProviderInfo && (
        <MarkerF
          position={userLocationToDisplay}
          title="Tu Ubicación"
          icon={userMarkerIconObject}
        />
      )}

      {enRouteProviderInfo && enRouteProviderInfo.provider.location && userMarkerIconObject && (
        <MarkerF
          position={enRouteProviderInfo.currentLocation}
          title={`${enRouteProviderInfo.provider.name} (${enRouteProviderInfo.status})`}
          icon={userMarkerIconObject} 
          zIndex={1000}
        />
      )}

      {(!enRouteProviderInfo || (enRouteProviderInfo && providersToDisplayOnMap.length > 0)) &&
        providersToDisplayOnMap.map(provider => {
          if (!provider.location) return null;

          const mainCategory = SERVICE_CATEGORIES.find(c => c.id === (provider.services[0]?.category || 'handyman'));
          let markerIconUrl = '';
          let markerIconConfig: google.maps.Icon | undefined = undefined;

          if (mainCategory && mainCategory.icon && isMapApiLoaded) { 
            if (categoryIconCache.current[mainCategory.id]) {
              markerIconUrl = categoryIconCache.current[mainCategory.id];
            } else {
              try {
                const generatedUri = lucideIconToDataUri(mainCategory.icon, "#3F51B5", 32);
                if (generatedUri) {
                  markerIconUrl = generatedUri;
                  categoryIconCache.current[mainCategory.id] = markerIconUrl;
                } else {
                  // console.warn(`[MapDisplay] Failed to generate icon URI for category ${mainCategory.id}`);
                }
              } catch (e) {
                console.error(`[MapDisplay] Error creating icon for ${mainCategory.id}`, e);
              }
            }

            if (markerIconUrl && typeof window !== 'undefined' && window.google && window.google.maps) {
              try {
                markerIconConfig = {
                  url: markerIconUrl,
                  scaledSize: new window.google.maps.Size(32, 32),
                  anchor: new window.google.maps.Point(16, 32),
                };
              } catch (e) {
                console.error("[MapDisplay] Error creating google.maps.Size/Point for icon:", e);
                 markerIconConfig = undefined; 
              }
            }
          }

          if (enRouteProviderInfo && enRouteProviderInfo.provider.id === provider.id) {
            return null;
          }

          return (
            <MarkerF
              key={provider.id}
              position={provider.location}
              title={provider.name}
              onClick={() => onMarkerClick(provider)}
              icon={markerIconConfig || undefined} 
            />
          );
      })}

      {selectedProviderForInfoWindow && userLocationToDisplay && (
        <InfoWindowF
          position={selectedProviderForInfoWindow.location}
          onCloseClick={onInfoWindowClose}
          options={{
            pixelOffset: (typeof window !== 'undefined' && window.google && window.google.maps) ? new window.google.maps.Size(0, -35) : undefined
          }}
        >
          <div className="p-2 max-w-xs">
            <h3 className="text-md font-semibold mb-1 text-foreground">{selectedProviderForInfoWindow.name}</h3>
            <div className="text-xs text-muted-foreground mb-1 flex items-center">
              <Star className="inline-block h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />
              {selectedProviderForInfoWindow.rating.toFixed(1)}
              <span className="mx-1">·</span>
              <MapPin className="inline-block h-3 w-3 mr-1" />
              {calculateDistance(
                userLocationToDisplay.lat,
                userLocationToDisplay.lng,
                selectedProviderForInfoWindow.location!.lat,
                selectedProviderForInfoWindow.location!.lng
              ).toFixed(1)} km
            </div>
            <Button asChild size="sm" className="w-full mt-2">
              <Link href={`/provider-profile/${selectedProviderForInfoWindow.id}`}>
                Ver Perfil y Solicitar
              </Link>
            </Button>
          </div>
        </InfoWindowF>
      )}
      {directionsResponse && (
        <DirectionsRenderer
          directions={directionsResponse}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#4285F4',
              strokeOpacity: 0.8,
              strokeWeight: 6,
            },
          }}
        />
      )}
    </GoogleMap>
  );
});
MapContentComponent.displayName = 'MapContentComponent';

export function MapDisplay() {
  const apiKeyFromEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const googleMapsApiKey = apiKeyFromEnv || FALLBACK_GOOGLE_MAPS_API_KEY;
  
  // console.log('[MapDisplay Module] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:', apiKeyFromEnv);
  // console.log('[MapDisplay Component] Effective googleMapsApiKey value:', googleMapsApiKey ? '********' : 'NOT DEFINED OR EMPTY');

  const libraries = useMemo(() => ['places', 'geometry'] as ("places" | "geometry")[], []);
  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "", 
    libraries,
    id: 'google-map-script-servimap'
  });
  // console.log('[MapDisplay] hook isMapApiLoaded:', isMapApiLoaded);
  // console.log('[MapDisplay] hook mapApiLoadError:', mapApiLoadError);

  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(defaultMapZoom);
  
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [selectedProviderForInfoWindow, setSelectedProviderForInfoWindow] = useState<Provider | null>(null);
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false); // This state might be unused now
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  
  const categoryIconCache = useRef<Record<string, string>>({});

  const [enRouteProviderInfo, setEnRouteProviderInfo] = useState<EnRouteProviderInfo | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For the overall arrival simulation
  const stepTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For individual steps in path animation

  const searchParams = useSearchParams();
  const router = useRouter();
  
  const categoryParam = useMemo(() => searchParams.get('category'), [searchParams]);
  const currentHiredProviderId = useMemo(() => searchParams.get('hiredProviderId'), [searchParams]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    // console.log('[MapDisplay] Map loaded via onLoad prop:', map);
    setMapInstance(map);
  }, []);

  const onMapUnmount = useCallback((map: google.maps.Map) => {
    // console.log('[MapDisplay] Map unmounted.');
    setMapInstance(null);
    if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
    if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
  }, []);

  const updateDisplayedProviders = useCallback(() => {
    // console.log(`[MapDisplay updateDisplayedProviders] Fired. Category: ${categoryParam}, Search: '${currentSearchTerm}', Hired: ${currentHiredProviderId}`);
    
    let filtered = [...mockProviders];
    // console.log('[MapDisplay updateDisplayedProviders] Initial mockProviders count:', filtered.length);

    filtered = filtered.filter(provider => {
      if (!provider.location) return false;
      const distance = calculateDistance(
        USER_FIXED_LOCATION.lat,
        USER_FIXED_LOCATION.lng,
        provider.location.lat,
        provider.location.lng
      );
      return distance <= 20;
    });
    // console.log(`[MapDisplay updateDisplayedProviders] After distance filter (<=20km): ${filtered.length} providers`);

    if (categoryParam && categoryParam !== 'all') {
      filtered = filtered.filter(provider => 
        provider.services.some(service => service.category === categoryParam)
      );
      // console.log(`[MapDisplay updateDisplayedProviders] After category filter ('${categoryParam}'): ${filtered.length} providers`);
    }

    if (currentSearchTerm.trim() !== '') {
      const searchTermLower = currentSearchTerm.toLowerCase();
      // console.log(`[MapDisplay updateDisplayedProviders] Applying search term: '${searchTermLower}'`);
      filtered = filtered.filter(provider => {
        const nameMatch = provider.name.toLowerCase().includes(searchTermLower);
        const specialtiesMatch = provider.specialties?.some(spec => spec.toLowerCase().includes(searchTermLower));
        const serviceMatch = provider.services.some(service => {
          const titleMatch = service.title.toLowerCase().includes(searchTermLower);
          const descriptionMatch = service.description.toLowerCase().includes(searchTermLower);
          const categoryDetails = SERVICE_CATEGORIES.find(cat => cat.id === service.category);
          const categoryNameMatch = categoryDetails?.name.toLowerCase().includes(searchTermLower);
          const categoryKeywordsMatch = categoryDetails?.keywords.some(kw => kw.toLowerCase().includes(searchTermLower));
          return titleMatch || descriptionMatch || categoryNameMatch || categoryKeywordsMatch;
        });
        return nameMatch || specialtiesMatch || serviceMatch;
      });
      // console.log(`[MapDisplay updateDisplayedProviders] After text search ('${searchTermLower}'): ${filtered.length} providers`);
    }
    
    const activeProviders = filtered.filter(p => p.isAvailable);
    const inactiveProviders = filtered.filter(p => !p.isAvailable);

    let finalProviders: Provider[];
    if (activeProviders.length > 0) {
        finalProviders = activeProviders;
    } else {
        finalProviders = inactiveProviders; 
    }
    finalProviders.sort((a, b) => b.rating - a.rating);
    
    // console.log('[MapDisplay updateDisplayedProviders] Final sorted providers to display:', finalProviders.length);
    setDisplayedProviders(finalProviders);
    
    const shouldShowPanel = (currentSearchTerm.trim() !== '' || (categoryParam && categoryParam !== '')) && finalProviders.length > 0;
    // setProvidersVisibleInPanel(shouldShowPanel); // This state seems unused for panel display now
    // console.log(`[MapDisplay updateDisplayedProviders] Panel visibility (shouldShowPanel): ${shouldShowPanel}`);

  }, [categoryParam, currentSearchTerm]); // Removed currentHiredProviderId as dependency to allow searching while hired

  useEffect(() => {
    // console.log('[MapDisplay useEffect for filters] Fired. Category:', categoryParam, 'SearchTerm:', currentSearchTerm, "HiredProvider:", currentHiredProviderId);
    updateDisplayedProviders();
  }, [USER_FIXED_LOCATION, categoryParam, currentSearchTerm, updateDisplayedProviders]);


  const simulateProviderMovement = useCallback((route: google.maps.DirectionsRoute | undefined, providerToSimulate: Provider) => {
    if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);

    if (!route || !route.legs || route.legs.length === 0 || !route.legs[0].steps || route.legs[0].steps.length === 0) {
      // console.error("[MapDisplay simulateProviderMovement] Invalid route data for simulation.");
      setEnRouteProviderInfo(prev => prev ? { ...prev, status: "Ha llegado", eta: "0 min", currentLocation: USER_FIXED_LOCATION } : null);
      return;
    }
    // console.log("[MapDisplay simulateProviderMovement] Starting simulation for route:", route);

    const allPathPoints: google.maps.LatLng[] = route.legs[0].steps.flatMap(step => step.path);
    let currentPointIndex = 0;

    const moveNext = () => {
      if (currentPointIndex >= allPathPoints.length) {
        // console.log("[MapDisplay simulateProviderMovement] Simulation: Provider arrived at destination.");
        setEnRouteProviderInfo(prev => {
          if (!prev) return null;
          // const params = new URLSearchParams(window.location.search);
          // params.delete('hiredProviderId');
          // router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
          return {
            ...prev,
            status: "Ha llegado",
            eta: "0 min",
            currentLocation: USER_FIXED_LOCATION
          };
        });
        if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
        return;
      }

      const nextLatLng = allPathPoints[currentPointIndex].toJSON();
      const remainingDurationSeconds = route.legs[0].duration?.value 
        ? (route.legs[0].duration.value * (1 - (currentPointIndex / allPathPoints.length))) 
        : 0;
      const etaMinutes = Math.max(0, Math.round(remainingDurationSeconds / 60));

      // console.log(`[MapDisplay simulateProviderMovement] Simulating step ${currentPointIndex + 1}/${allPathPoints.length}: Moving to`, nextLatLng, `ETA: ${etaMinutes} min`);
      setEnRouteProviderInfo(prev => {
        if (!prev) return null; 
        return {
          ...prev,
          currentLocation: nextLatLng,
          eta: `${etaMinutes} min (sim.)`
        };
      });
      currentPointIndex++;
      
      stepTimeoutRef.current = setTimeout(moveNext, 1000); 
    };

    if (providerToSimulate?.location) {
        // console.log("[MapDisplay simulateProviderMovement] Initializing enRouteProviderInfo for:", providerToSimulate.name, "ETA:", route.legs[0].duration?.text);
        setEnRouteProviderInfo({
            provider: providerToSimulate,
            status: "En camino",
            eta: route.legs[0].duration?.text || "Calculando...",
            currentLocation: providerToSimulate.location, 
        });
        moveNext();
    }
  }, [router]); 

  useEffect(() => {
    // console.log('[MapDisplay] useEffect for hiredProviderId. Current ID from URL:', currentHiredProviderId);
    if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
    if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);


    if (currentHiredProviderId && isMapApiLoaded && mapInstance && USER_FIXED_LOCATION) {
      // console.log('[MapDisplay] Conditions met for hired provider. isMapApiLoaded:', isMapApiLoaded, 'mapInstance:', !!mapInstance, 'USER_FIXED_LOCATION:', !!USER_FIXED_LOCATION);
      const providerInRoute = mockProviders.find(p => p.id === currentHiredProviderId);

      if (providerInRoute && providerInRoute.location) {
        // console.log('[MapDisplay] Found providerInRoute:', providerInRoute.name, "Location:", providerInRoute.location);
        setSelectedProviderForInfoWindow(null);

        if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.DirectionsService) {
            const directionsService = new window.google.maps.DirectionsService();
            // console.log('[MapDisplay] Requesting directions from:', providerInRoute.location, 'to:', USER_FIXED_LOCATION);
            
            directionsService.route(
              {
                origin: providerInRoute.location,
                destination: USER_FIXED_LOCATION,
                travelMode: window.google.maps.TravelMode.DRIVING,
              },
              (result, status) => {
                // console.log('[MapDisplay] DirectionsService callback. Status:', status);
                if (status === window.google.maps.DirectionsStatus.OK && result) {
                  // console.log('[MapDisplay] Directions result:', result);
                  setDirectionsResponse(result);
                  // const etaText = result.routes[0]?.legs[0]?.duration?.text || "Calculando...";
                  // console.log('[MapDisplay] Route found. ETA:', etaText);
                  
                  if (mapInstance && providerInRoute.location && USER_FIXED_LOCATION && window.google && window.google.maps ) {
                    const bounds = new window.google.maps.LatLngBounds();
                    bounds.extend(providerInRoute.location);
                    bounds.extend(USER_FIXED_LOCATION);
                    mapInstance.fitBounds(bounds);
                    const listener = window.google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
                        if (mapInstance.getZoom()! > 16) mapInstance.setZoom(16);
                        if(window.google && window.google.maps && listener) window.google.maps.event.removeListener(listener);
                    });
                  }
                  setMapZoom(enRouteZoom); 
                  simulateProviderMovement(result.routes[0], providerInRoute);

                } else {
                  console.error(`[MapDisplay] Error fetching directions: ${status}`, result);
                  setEnRouteProviderInfo({
                    provider: providerInRoute,
                    status: "En camino",
                    eta: "Ruta no disponible",
                    currentLocation: providerInRoute.location,
                  });
                  setDirectionsResponse(null); 
                }
              }
            );
        } else {
            console.error("[MapDisplay] Google Maps DirectionsService not available when trying to fetch directions.");
        }
      } else {
        // console.warn(`[MapDisplay] Hired provider with ID ${currentHiredProviderId} not found or has no location.`);
        setEnRouteProviderInfo(null);
        setDirectionsResponse(null);
      }
    } else if (!currentHiredProviderId && enRouteProviderInfo) { 
      // console.log("[MapDisplay] Hired provider ID removed from URL or became null, clearing enRoute state.");
      setEnRouteProviderInfo(null);
      setDirectionsResponse(null);
       if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
       if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
    }
  }, [currentHiredProviderId, isMapApiLoaded, mapInstance, simulateProviderMovement, router]); 

  const handleSearchFromBottomBar = useCallback((term: string) => {
    // console.log('[MapDisplay handleSearchFromBottomBar] Search term:', term);
    setCurrentSearchTerm(term);
    // updateDisplayedProviders will be called by the useEffect reacting to currentSearchTerm
  }, []);

  const handleMarkerClick = useCallback((provider: Provider) => {
    setSelectedProviderForInfoWindow(provider);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedProviderForInfoWindow(null);
  }, []);

  const renderMapArea = () => {
    // console.log('[MapDisplay renderMapArea] apiKeyToUse present:', !!googleMapsApiKey);
    if (!googleMapsApiKey) {
         return (
            <div className="p-4 text-center text-destructive-foreground bg-destructive rounded-md h-full flex flex-col items-center justify-center">
                <AlertCircle className="h-12 w-12 mb-4" />
                <h3 className="font-semibold text-xl">Configuración Requerida</h3>
                <p className="text-md">La API Key de Google Maps no está configurada.</p>
            </div>
        );
    }
    if (mapApiLoadError) {
      // console.error("[MapDisplay renderMapArea] Google Maps API load error:", mapApiLoadError);
      return (
        <div className="flex items-center justify-center h-full text-destructive p-4 text-center">
            <AlertCircle className="h-8 w-8 mr-2"/> Error al cargar Google Maps: {mapApiLoadError.message}
        </div>
      );
    }
    if (!isMapApiLoaded) {
      // console.log("[MapDisplay renderMapArea] Google Maps API loading (isMapApiLoaded is false)...");
      return (
        <div className="flex flex-col items-center justify-center h-full bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Cargando Mapa...</p>
        </div>
      );
    }
    
    // console.log("[MapDisplay renderMapArea] Rendering MapContentComponent.");
    return (
      <MapContentComponent
        mapCenter={mapCenter}
        mapZoom={mapZoom}
        userLocationToDisplay={USER_FIXED_LOCATION}
        providersToDisplayOnMap={displayedProviders}
        onMapLoad={onMapLoad}
        onMapUnmount={onMapUnmount}
        onMarkerClick={handleMarkerClick}
        selectedProviderForInfoWindow={selectedProviderForInfoWindow}
        onInfoWindowClose={handleInfoWindowClose}
        enRouteProviderInfo={enRouteProviderInfo}
        directionsResponse={directionsResponse}
        categoryIconCache={categoryIconCache}
        isMapApiLoaded={isMapApiLoaded} 
      />
    );
  };
  
  // Panel lateral ya no se muestra como antes, así que esta variable no controla su display directo
  // const shouldDisplayRightPanel = providersVisibleInPanel && displayedProviders.length > 0 && !currentHiredProviderId;
  // console.log(`[MapDisplay RENDER] shouldDisplayRightPanel (LOGIC NOT USED FOR DISPLAY): ${shouldDisplayRightPanel}`);


  return (
    <div className="h-full w-full flex relative">
        <div className="absolute inset-0 z-0">
          {renderMapArea()}
        </div>
        
        {!enRouteProviderInfo && <BottomSearchContainer onSearch={handleSearchFromBottomBar} />}

        {enRouteProviderInfo && (
            <Card className="absolute top-4 left-1/2 -translate-x-1/2 z-30 shadow-xl bg-background/95 backdrop-blur-sm w-auto max-w-[calc(100%-2rem)] md:max-w-md">
                <CardHeader className="p-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={enRouteProviderInfo.provider.avatarUrl} alt={enRouteProviderInfo.provider.name} data-ai-hint={enRouteProviderInfo.provider.dataAiHint || "provider avatar"}/>
                            <AvatarFallback>{enRouteProviderInfo.provider.name.substring(0,1)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-base flex items-center">
                                {enRouteProviderInfo.status === "En camino" ? (
                                    <Navigation className="h-5 w-5 mr-2 text-primary animate-pulse" />
                                ) : (
                                    <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                                )}
                                {enRouteProviderInfo.provider.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                                {enRouteProviderInfo.status} - ETA: {enRouteProviderInfo.eta}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        )}
    </div>
  );
}

    