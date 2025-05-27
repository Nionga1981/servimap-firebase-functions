// src/components/client/MapDisplay.tsx
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
import { BottomSearchContainer } from './BottomSearchContainer'; // Changed to named import

// Define the Google Maps API key, prioritizing environment variable, then fallback
const FALLBACK_GOOGLE_MAPS_API_KEY = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; // Your hardcoded key
const apiKeyToUse = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || FALLBACK_GOOGLE_MAPS_API_KEY;

console.log('[MapDisplay Module] Effective Google Maps API Key being used:', apiKeyToUse ? '********' : 'NOT DEFINED');


const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const defaultMapZoom = 13; // Adjusted zoom level for wider view
const enRouteZoom = 14;

const USER_MARKER_ICON = {
  path: google.maps.SymbolPath.CIRCLE,
  scale: 8,
  fillColor: '#4285F4', // Google Blue
  fillOpacity: 1,
  strokeWeight: 2,
  strokeColor: 'white',
};

// Helper function to convert Lucide icons to SVG Data URIs
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
    console.error("[MapDisplay] Error generating Lucide icon Data URI:", error);
    return '';
  }
};


const calculateDistance = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

interface EnRouteProviderInfo {
  provider: Provider;
  status: "En camino" | "Ha llegado";
  eta: string;
  currentLocation: google.maps.LatLngLiteral;
}

const mapStyles: google.maps.MapTypeStyle[] = [
  {
    featureType: "poi", // Puntos de Interés (general)
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "poi.business", // Negocios
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "transit", // Transporte público
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "landscape.natural", // Paisajes naturales
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  // Puedes añadir más reglas para ocultar otros elementos si es necesario
];

const MapContentComponent = React.memo(({
  mapCenter,
  mapZoom,
  userLocation, // Renamed for clarity, this is the fixed user location
  providersToDisplayOnMap,
  onMapLoad,
  onMapUnmount,
  onMarkerClick,
  selectedProviderForInfoWindow,
  onInfoWindowClose,
  enRouteProviderInfo,
  directionsResponse,
  categoryIconCache,
}: {
  mapCenter: google.maps.LatLngLiteral;
  mapZoom: number;
  userLocation: google.maps.LatLngLiteral | null;
  providersToDisplayOnMap: Provider[];
  onMapLoad: (map: google.maps.Map) => void;
  onMapUnmount: (map: google.maps.Map) => void;
  onMarkerClick: (provider: Provider) => void;
  selectedProviderForInfoWindow: Provider | null;
  onInfoWindowClose: () => void;
  enRouteProviderInfo: EnRouteProviderInfo | null;
  directionsResponse: google.maps.DirectionsResult | null;
  categoryIconCache: React.MutableRefObject<Record<string, string>>;
}) => {
  // console.log("[MapDisplay MapContentComponent] Rendering. User location:", userLocation);
  // console.log("[MapDisplay MapContentComponent] Providers on map:", providersToDisplayOnMap.length);
  // console.log("[MapDisplay MapContentComponent] EnRouteProviderInfo:", enRouteProviderInfo);

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
        clickableIcons: false, // This helps but styles are more effective for hiding
      }}
    >
      {userLocation && !enRouteProviderInfo && ( // Show user marker only if no provider is en-route
        <MarkerF
          position={userLocation}
          title="Tu Ubicación"
          icon={USER_MARKER_ICON}
        />
      )}

      {enRouteProviderInfo && enRouteProviderInfo.provider.location && (
        <MarkerF
          position={enRouteProviderInfo.currentLocation}
          title={`${enRouteProviderInfo.provider.name} (${enRouteProviderInfo.status})`}
          icon={USER_MARKER_ICON} // Placeholder, ideally a vehicle icon
          zIndex={1000}
        />
      )}

      {/* Render other providers unless one is en-route and we only want to show that one */}
      {(!enRouteProviderInfo || (enRouteProviderInfo && providersToDisplayOnMap.length > 0)) && 
        providersToDisplayOnMap.map(provider => {
          if (!provider.location) return null;

          const mainCategory = SERVICE_CATEGORIES.find(c => c.id === (provider.services[0]?.category || 'handyman'));
          let markerIconUrl = '';

          if (mainCategory && mainCategory.icon) {
            if (categoryIconCache.current[mainCategory.id]) {
              markerIconUrl = categoryIconCache.current[mainCategory.id];
            } else {
              try {
                const generatedUri = lucideIconToDataUri(mainCategory.icon, "#3F51B5", 30); // Explicit color
                if (generatedUri) {
                  markerIconUrl = generatedUri;
                  categoryIconCache.current[mainCategory.id] = markerIconUrl;
                } else {
                  console.warn(`[MapDisplay] Failed to generate icon URI for category ${mainCategory.id}`);
                }
              } catch (e) {
                console.error(`[MapDisplay] Error creating icon for ${mainCategory.id}`, e);
              }
            }
          }

          let markerIconConfig: google.maps.Icon | undefined = undefined;
          if (markerIconUrl && typeof window !== 'undefined' && window.google && window.google.maps) {
            try {
              markerIconConfig = {
                url: markerIconUrl,
                scaledSize: new window.google.maps.Size(30, 30), // Adjust size as needed
                anchor: new window.google.maps.Point(15, 30),    // Adjust anchor (center bottom)
              };
            } catch (e) {
              console.error("[MapDisplay] Error creating google.maps.Size/Point for icon:", e);
            }
          }
          
          // Do not render marker if it's the provider currently en-route (to avoid duplication)
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

      {selectedProviderForInfoWindow && userLocation && (
        <InfoWindowF
          position={selectedProviderForInfoWindow.location}
          onCloseClick={onInfoWindowClose}
          options={{
            pixelOffset: new google.maps.Size(0, -35) // Adjust to appear above the icon
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
                userLocation.lat,
                userLocation.lng,
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
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || FALLBACK_GOOGLE_MAPS_API_KEY;
  console.log('[MapDisplay Component] googleMapsApiKey value:', googleMapsApiKey ? '********' : 'NOT DEFINED (using fallback or empty)');
  
  const libraries = useMemo(() => ['places', 'geometry'] as ("places" | "geometry")[], []);
  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "", 
    libraries,
    id: 'google-map-script-servimap'
  });

  console.log('[MapDisplay] isMapApiLoaded:', isMapApiLoaded);
  if (mapApiLoadError) {
    console.error('[MapDisplay] mapApiLoadError:', mapApiLoadError);
  }

  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const userLocation = USER_FIXED_LOCATION; // User location is now fixed
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(defaultMapZoom);
  
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [selectedProviderForInfoWindow, setSelectedProviderForInfoWindow] = useState<Provider | null>(null);
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false); // Panel for search results

  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  
  const categoryIconCache = useRef<Record<string, string>>({});

  const [enRouteProviderInfo, setEnRouteProviderInfo] = useState<EnRouteProviderInfo | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const categoryParam = useMemo(() => searchParams.get('category'), [searchParams]);
  const currentHiredProviderId = useMemo(() => searchParams.get('hiredProviderId'), [searchParams]);
  const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const onMapLoad = useCallback((map: google.maps.Map) => {
    console.log('[MapDisplay] Map loaded:', map);
    setMapInstance(map);
    // map.setCenter(mapCenter); // Centering will be handled by effects or bounds
    // map.setZoom(mapZoom);
  }, []);

  const onMapUnmount = useCallback((map: google.maps.Map) => {
    console.log('[MapDisplay] Map unmounted.');
    setMapInstance(null);
    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current);
    }
  }, []);

  const updateDisplayedProviders = useCallback(() => {
    console.log(`[MapDisplay updateDisplayedProviders] CALLED. UserLoc: ${userLocation.lat},${userLocation.lng}, Category: ${categoryParam}, Search: '${currentSearchTerm}', Hired: ${currentHiredProviderId}`);
    
    if (currentHiredProviderId) {
        console.log('[MapDisplay updateDisplayedProviders] Hired provider active, not updating general provider list.');
        // setDisplayedProviders([]); // Keep previous providers visible if desired
        // setProvidersVisibleInPanel(false);
        return;
    }

    let filtered = [...mockProviders];
    console.log('[MapDisplay updateDisplayedProviders] Initial mockProviders count:', filtered.length);

    // 1. Filter by distance
    filtered = filtered.filter(provider => {
      if (!provider.location) return false;
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        provider.location.lat,
        provider.location.lng
      );
      return distance <= 20; // 20 km radius
    });
    console.log('[MapDisplay updateDisplayedProviders] Providers after distance filter (<=20km):', filtered.length, filtered.map(p=>p.name));

    // 2. Filter by category (if categoryParam exists and is not 'all')
    if (categoryParam && categoryParam !== 'all') {
      filtered = filtered.filter(provider => 
        provider.services.some(service => service.category === categoryParam)
      );
      console.log(`[MapDisplay updateDisplayedProviders] Providers after category filter ('${categoryParam}'):`, filtered.length, filtered.map(p=>p.name));
    }

    // 3. Filter by search term
    if (currentSearchTerm.trim() !== '') {
      const searchTermLower = currentSearchTerm.toLowerCase();
      console.log(`[MapDisplay updateDisplayedProviders] Applying search term: '${searchTermLower}'`);
      const providersBeforeSearch = [...filtered];
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
      console.log(`[MapDisplay updateDisplayedProviders] Providers AFTER text search ('${searchTermLower}'). Before: ${providersBeforeSearch.length}, After: ${filtered.length}`, filtered.map(p=>p.name));
    }
    
    // 4. Prioritize active providers then sort by rating
    const activeProviders = filtered.filter(p => p.isAvailable);
    const inactiveProviders = filtered.filter(p => !p.isAvailable);

    let finalProviders: Provider[];
    if (activeProviders.length > 0) {
      finalProviders = activeProviders;
      console.log('[MapDisplay updateDisplayedProviders] Showing ACTIVE providers. Count:', finalProviders.length);
    } else {
      finalProviders = inactiveProviders;
      console.log('[MapDisplay updateDisplayedProviders] No active providers, showing INACTIVE. Count:', finalProviders.length);
    }
    finalProviders.sort((a, b) => b.rating - a.rating);
    
    console.log('[MapDisplay updateDisplayedProviders] Final sorted providers:', finalProviders.length, finalProviders.map(p => `${p.name} (Rating: ${p.rating}, Active: ${p.isAvailable})`));
    setDisplayedProviders(finalProviders);
    
    const shouldShowPanel = finalProviders.length > 0 && (!!categoryParam || currentSearchTerm.trim() !== '');
    setProvidersVisibleInPanel(shouldShowPanel);
    console.log(`[MapDisplay updateDisplayedProviders] Panel visibility: ${shouldShowPanel}`);

  }, [userLocation, categoryParam, currentSearchTerm, currentHiredProviderId]);

  // Effect for initial load and when category or search term changes
  useEffect(() => {
    console.log('[MapDisplay useEffect for filters] categoryParam:', categoryParam, 'currentSearchTerm:', currentSearchTerm, "currentHiredProviderId:", currentHiredProviderId);
    if (!currentHiredProviderId) { // Only update general list if no provider is hired
        updateDisplayedProviders();
    } else {
        // If a provider is hired, we might want to clear or keep existing markers based on UX
        // For now, we keep them if the user was already browsing/searching
        // If the user navigates directly with hiredProviderId, displayedProviders will be empty initially
        if (displayedProviders.length === 0) {
             setProvidersVisibleInPanel(false); // Ensure panel is hidden if no prior search
        }
    }
  }, [userLocation, categoryParam, currentSearchTerm, currentHiredProviderId, updateDisplayedProviders]);


  const simulateProviderMovement = useCallback((route: google.maps.DirectionsRoute | undefined, providerToSimulate: Provider) => {
    if (!route || !route.legs || route.legs.length === 0 || !route.legs[0].steps || route.legs[0].steps.length === 0) {
      console.error("[MapDisplay simulateProviderMovement] Invalid route data for simulation.");
      setEnRouteProviderInfo(prev => prev ? { ...prev, status: "Ha llegado", eta: "0 min", currentLocation: USER_FIXED_LOCATION } : null);
      return;
    }
    console.log("[MapDisplay simulateProviderMovement] Starting simulation for route:", route);

    const allPathPoints: google.maps.LatLng[] = route.legs[0].steps.flatMap(step => step.path);
    let currentPointIndex = 0;

    const moveNext = () => {
      if (currentPointIndex >= allPathPoints.length) {
        console.log("[MapDisplay simulateProviderMovement] Simulation: Provider arrived at destination.");
        setEnRouteProviderInfo(prev => {
          if (!prev) return null;
          // Remove hiredProviderId from URL query params
          const params = new URLSearchParams(window.location.search);
          params.delete('hiredProviderId');
          router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
          return {
            ...prev,
            status: "Ha llegado",
            eta: "0 min",
            currentLocation: userLocation // Snap to user's location
          };
        });
         if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
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
      
      simulationTimeoutRef.current = setTimeout(moveNext, 1000); // Move every 1 second
    };

    if (providerToSimulate?.location) {
        console.log("[MapDisplay simulateProviderMovement] Initializing enRouteProviderInfo for:", providerToSimulate.name, "ETA:", route.legs[0].duration?.text);
        setEnRouteProviderInfo({
            provider: providerToSimulate,
            status: "En camino",
            eta: route.legs[0].duration?.text || "Calculando...",
            currentLocation: providerToSimulate.location, 
        });
        moveNext();
    }
  }, [router, userLocation]);


  // Effect for handling hired provider and fetching directions
  useEffect(() => {
    if (currentHiredProviderId && isMapApiLoaded && mapInstance && userLocation) {
      console.log('[MapDisplay] useEffect for hiredProviderId. Current ID from URL:', currentHiredProviderId);
      const providerInRoute = mockProviders.find(p => p.id === currentHiredProviderId);

      if (providerInRoute && providerInRoute.location) {
        console.log('[MapDisplay] Found providerInRoute:', providerInRoute.name, "Location:", providerInRoute.location);
        
        // Do not hide other providers or their panel if user was already searching
        // setProvidersVisibleInPanel(false); // Panel for general search results
        setSelectedProviderForInfoWindow(null); // Close any open info window

        const directionsService = new window.google.maps.DirectionsService();
        console.log('[MapDisplay] Requesting directions from:', providerInRoute.location, 'to:', userLocation);
        
        directionsService.route(
          {
            origin: providerInRoute.location,
            destination: userLocation,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            console.log('[MapDisplay] DirectionsService callback. Status:', status);
            if (status === window.google.maps.DirectionsStatus.OK && result) {
              console.log('[MapDisplay] Directions result:', result);
              setDirectionsResponse(result);
              const etaText = result.routes[0]?.legs[0]?.duration?.text || "Calculando...";
              console.log('[MapDisplay] Route found. ETA:', etaText);
              
              if (mapInstance && providerInRoute.location && userLocation ) {
                const bounds = new window.google.maps.LatLngBounds();
                bounds.extend(providerInRoute.location);
                bounds.extend(userLocation);
                mapInstance.fitBounds(bounds);
                // Optional: Add a listener to ensure zoom is not too high after fitBounds
                const listener = window.google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
                    if (mapInstance.getZoom()! > 16) mapInstance.setZoom(16); // Don't zoom in too much
                    window.google.maps.event.removeListener(listener);
                });
              }
              setMapZoom(enRouteZoom); // Set a specific zoom for en-route view
              simulateProviderMovement(result.routes[0], providerInRoute);

            } else {
              console.error(`[MapDisplay] Error fetching directions: ${status}`, result);
              // Fallback if directions fail
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
        console.warn(`[MapDisplay] Hired provider with ID ${currentHiredProviderId} not found or has no location.`);
        setEnRouteProviderInfo(null);
        setDirectionsResponse(null);
        const params = new URLSearchParams(window.location.search);
        params.delete('hiredProviderId');
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
      }
    } else if (!currentHiredProviderId && enRouteProviderInfo) { // If hiredProviderId is removed from URL, clear enRoute state
      console.log("[MapDisplay] Hired provider ID removed from URL, clearing enRoute state.");
      setEnRouteProviderInfo(null);
      setDirectionsResponse(null);
       if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }
    }
  }, [currentHiredProviderId, isMapApiLoaded, mapInstance, userLocation, simulateProviderMovement, router]);


  const handleSearchFromBottomBar = useCallback((term: string) => {
    console.log('[MapDisplay handleSearchFromBottomBar] Search term:', term);
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
    if (!apiKeyToUse) {
         return (
            <div className="p-4 text-center text-destructive-foreground bg-destructive rounded-md h-full flex flex-col items-center justify-center">
                <AlertCircle className="h-12 w-12 mb-4" />
                <h3 className="font-semibold text-xl">Configuración Requerida</h3>
                <p className="text-md">La API Key de Google Maps no está configurada correctamente.</p>
            </div>
        );
    }
    if (mapApiLoadError) {
      console.error("[MapDisplay renderMapArea] Google Maps API load error:", mapApiLoadError);
      return (
        <div className="flex items-center justify-center h-full text-destructive p-4 text-center">
            <AlertCircle className="h-8 w-8 mr-2"/> Error al cargar Google Maps: {mapApiLoadError.message}.<br/>Revisa la API Key y tu conexión a internet.
        </div>
      );
    }
    if (!isMapApiLoaded) {
      console.log("[MapDisplay renderMapArea] Google Maps API loading...");
      return (
        <div className="flex flex-col items-center justify-center h-full bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Cargando Mapa...</p>
        </div>
      );
    }
    
    // console.log("[MapDisplay renderMapArea] Rendering MapContentComponent. Center:", mapCenter, "Zoom:", mapZoom);
    return (
      <MapContentComponent
        mapCenter={mapCenter}
        mapZoom={mapZoom}
        userLocation={userLocation}
        providersToDisplayOnMap={displayedProviders}
        onMapLoad={onMapLoad}
        onMapUnmount={onMapUnmount}
        onMarkerClick={handleMarkerClick}
        selectedProviderForInfoWindow={selectedProviderForInfoWindow}
        onInfoWindowClose={handleInfoWindowClose}
        enRouteProviderInfo={enRouteProviderInfo}
        directionsResponse={directionsResponse}
        categoryIconCache={categoryIconCache}
      />
    );
  };
  
  const shouldDisplayRightPanel = providersVisibleInPanel && displayedProviders.length > 0 && !currentHiredProviderId;
  // console.log(`[MapDisplay RENDER] shouldDisplayRightPanel: ${shouldDisplayRightPanel} (providersVisibleInPanel: ${providersVisibleInPanel}, displayedProviders: ${displayedProviders.length}, currentHiredProviderId: ${currentHiredProviderId})`);


  return (
    <div className="h-full w-full flex relative">
        {/* Main map area */}
        <div className={cn(
            "transition-all duration-300 ease-in-out relative",
            shouldDisplayRightPanel ? "w-full md:w-2/3" : "w-full", // Full width on mobile if panel is shown
            "h-full"
        )}>
            {renderMapArea()}
        </div>

        {/* Provider list panel - only for larger screens */}
        {shouldDisplayRightPanel && (
            <div className="hidden md:block w-1/3 h-full border-l border-border bg-background shadow-lg overflow-y-auto p-4 space-y-3">
                <h2 className="text-lg font-semibold text-primary mb-2">Proveedores Encontrados</h2>
                {displayedProviders.map(provider => (
                    <ProviderPreviewCard key={provider.id} provider={provider} />
                ))}
            </div>
        )}
        
        {/* Bottom search and banners container OR EnRoutePanel */}
        {enRouteProviderInfo ? (
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
        ) : (
           <BottomSearchContainer onSearch={handleSearchFromBottomBar} />
        )}
    </div>
  );
}
