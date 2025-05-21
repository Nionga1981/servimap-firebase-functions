
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import type { LucideIcon } from 'lucide-react';
import { GoogleMap, MarkerF, useJsApiLoader, PolylineF, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MapPinned, Search, AlertTriangle, WifiOff, Loader2 as LoaderIcon, LocateFixed, Car, Clock } from 'lucide-react';
import type { Provider, Service } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData';
import { SERVICE_CATEGORIES, DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useSearchParams, useRouter } from 'next/navigation';

// Helper function to convert Lucide Icon component to SVG Data URI
function lucideIconToDataUri(
  IconComponent: LucideIcon,
  options: { size?: number; color?: string; strokeWidth?: number } = {}
): string {
  const { size = 24, color = '#3F51B5', strokeWidth = 2 } = options; // Using a fixed hex color
  if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') {
    console.error('[MapDisplay lucideIconToDataUri] Invalid IconComponent passed:', IconComponent);
    return '';
  }
  try {
    const element = React.createElement(IconComponent, { color, size, strokeWidth });
    const svgString = ReactDOMServer.renderToStaticMarkup(element);
    // console.log(`[MapDisplay lucideIconToDataUri] SVG string for ${IconComponent.displayName || 'icon'}:`, svgString);
    const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;
    // console.log(`[MapDisplay lucideIconToDataUri] Generated Data URI (first 100 chars) for ${IconComponent.displayName || 'icon'}: ${dataUri.substring(0,100)}...`);
    return dataUri;
  } catch (error) {
    console.error('[MapDisplay lucideIconToDataUri] Error rendering Lucide icon to SVG string:', error, IconComponent);
    return '';
  }
}


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
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
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
  categoryIconCache,
}: {
  center: google.maps.LatLngLiteral;
  zoom: number;
  onLoad: (map: google.maps.Map) => void;
  onUnmount: () => void;
  userLocationToDisplay: google.maps.LatLngLiteral | null;
  providersToDisplayOnMap: Provider[];
  children?: React.ReactNode;
  categoryIconCache: React.RefObject<Map<string, string>>;
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
          title="Tu ubicación simulada"
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "hsl(var(--primary))", // Blue color for user
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
          }}
        />
      )}
      {providersToDisplayOnMap.map(provider => {
        if (!provider.location) return null;

        const serviceCategory = SERVICE_CATEGORIES.find(cat => cat.id === provider.services[0]?.category);
        let iconDataUri: string | undefined = undefined;
        
        if (serviceCategory && serviceCategory.icon) {
          if (categoryIconCache.current?.has(serviceCategory.id)) {
            iconDataUri = categoryIconCache.current.get(serviceCategory.id);
          } else {
            iconDataUri = lucideIconToDataUri(serviceCategory.icon);
            if (iconDataUri) {
              console.log(`[MapDisplay] Generated iconDataUri for ${serviceCategory.id}: ${iconDataUri.substring(0,100)}...`);
              categoryIconCache.current?.set(serviceCategory.id, iconDataUri);
            } else {
              console.warn(`[MapDisplay] Failed to generate iconDataUri for ${serviceCategory.id}`);
            }
          }
        }
        
        let markerIcon: google.maps.Icon | undefined = undefined;
        if (iconDataUri && typeof window !== 'undefined' && window.google && window.google.maps) {
            try {
                markerIcon = {
                    url: iconDataUri,
                    scaledSize: new window.google.maps.Size(32, 32), // Adjust size as needed
                    anchor: new window.google.maps.Point(16, 32),    // Center bottom
                };
                // console.log(`[MapDisplay] Using custom icon for ${provider.name}:`, markerIcon);
            } catch (e) {
                console.error(`[MapDisplay] Error creating google.maps.Size/Point for ${provider.name}:`, e);
            }
        } else if (iconDataUri) {
            // console.warn(`[MapDisplay] window.google.maps not available (yet?) for custom icon for ${provider.name}. iconDataUri was present.`);
        } else {
            // console.log(`[MapDisplay] No custom icon for ${provider.name}. Using default marker.`);
        }
        
        return (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={`${provider.name} (Calificación: ${provider.rating.toFixed(1)})`}
            icon={markerIcon} // Use custom icon if available, otherwise default
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
  const distance = R * c;
  // console.log(`[MapDisplay calculateDistance] From (${lat1},${lon1}) to (${lat2},${lon2}) = ${distance.toFixed(1)} km`);
  return distance;
};


export function MapDisplay() {
  const libraries = useMemo(() => ['places'] as const, []);
  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; // Hardcoded for debugging

  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries,
    id: 'google-map-script-servimap'
  });

  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(USER_FIXED_LOCATION);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(13); // Zoom out a bit more
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const categoryIconCache = useRef(new Map<string, string>());


  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = useMemo(() => searchParams.get('category'), [searchParams]);
  const currentHiredProviderId = useMemo(() => searchParams.get('hiredProviderId'), [searchParams]);

  const [enRouteProviderInfo, setEnRouteProviderInfo] = useState<EnRouteProviderInfo | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const simulationTimeoutIds = useRef<NodeJS.Timeout[]>([]);

  // console.log(`[MapDisplay RENDER] dp: ${displayedProviders.length}, pVPanel: ${providersVisibleInPanel}, cat: ${categoryParam}, search: ${searchTerm}, hiredId: ${currentHiredProviderId}, mapApi: ${isMapApiLoaded}`);

  const onMapLoadCallback = useCallback((map: google.maps.Map) => {
    console.log("[MapDisplay] Google Map component successfully loaded.");
    setMapInstance(map);
    if (userLocation) {
      map.setCenter(userLocation);
      map.setZoom(mapZoom);
    }
  }, [userLocation, mapZoom]);

  const onMapUnmountCallback = useCallback(() => {
    console.log("[MapDisplay] Google Map component unmounted.");
    setMapInstance(null);
    setDirectionsResponse(null);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];
  }, []);

  const simulateProviderMovement = useCallback((route: google.maps.DirectionsRoute, provider: Provider) => {
    console.log('[MapDisplay simulateProviderMovement] Started for route with provider:', provider.name);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];

    if (!route.legs || !route.legs[0] || !route.legs[0].steps || !userLocation) {
      console.error('[MapDisplay simulateProviderMovement] No steps in route or userLocation missing. Route:', route);
      if (userLocation) {
        const arrivalTimeout = setTimeout(() => {
          setEnRouteProviderInfo(prev => prev ? {
            ...prev,
            currentLocation: userLocation,
            status: "Ha llegado",
            eta: "0 min",
          } : null);
          console.log('[MapDisplay simulateProviderMovement] Fallback: Provider arrived at user location.');
          if (mapInstance) {
            mapInstance.panTo(userLocation);
            mapInstance.setZoom(17);
          }
        }, 5000);
        simulationTimeoutIds.current.push(arrivalTimeout);
      }
      return;
    }

    const steps = route.legs[0].steps;
    let cumulativeDelay = 0;
    // Simulate travel over ~10-20 seconds total by adjusting stepDuration
    const totalSimulationDuration = Math.max(10000, Math.min(20000, (route.legs[0].duration?.value || steps.length * 2) * 1000 * 0.1)); // between 10-20s or 10% of real time
    const stepDuration = Math.max(500, totalSimulationDuration / steps.length);

    steps.forEach((step, index) => {
      const timeoutId = setTimeout(() => {
        if (!userLocation) return;

        let newLocation: google.maps.LatLngLiteral;
        if (typeof step.end_location.lat === 'function' && typeof step.end_location.lng === 'function') {
          newLocation = { lat: step.end_location.lat(), lng: step.end_location.lng() };
        } else {
          newLocation = step.end_location as google.maps.LatLngLiteral;
        }
         // console.log(`[MapDisplay simulateProviderMovement] Simulating step ${index + 1}/${steps.length}: Moving to`, newLocation);

        let remainingSecondsInSimulation = 0;
        for (let i = index + 1; i < steps.length; i++) {
          remainingSecondsInSimulation += (route.legs[0].steps[i].duration?.value || ( (route.legs[0].duration?.value || steps.length * 2) / steps.length) );
        }
        const remainingMinutes = Math.ceil(remainingSecondsInSimulation / 60);
        const newEta = remainingMinutes > 0 ? `${remainingMinutes} min` : "Casi llega";
        
        setEnRouteProviderInfo(prev => {
          if (!prev) return null;
          // console.log(`[MapDisplay simulateProviderMovement] Updating enRouteProviderInfo.currentLocation to:`, newLocation);
          return { ...prev, currentLocation: newLocation, eta: newEta };
        });

        if (mapInstance) {
          mapInstance.panTo(newLocation);
        }

        if (index === steps.length - 1) {
          console.log('[MapDisplay simulateProviderMovement] Simulation: Provider arrived at destination.');
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
     console.log(`[MapDisplay simulateProviderMovement] Total ${steps.length} steps scheduled. Step duration: ${stepDuration}ms, Total sim time: ${cumulativeDelay}ms`);
  }, [mapInstance, userLocation]);


 useEffect(() => {
    // console.log('[MapDisplay hiredProvider-useEffect] currentHiredProviderId:', currentHiredProviderId, 'isMapApiLoaded:', isMapApiLoaded, 'mapInstance:', !!mapInstance, 'userLocation:', !!userLocation);

    if (!currentHiredProviderId && enRouteProviderInfo) {
      // console.log('[MapDisplay hiredProvider-useEffect] No hiredProviderId, clearing enRouteProviderInfo and directions.');
      setEnRouteProviderInfo(null);
      setDirectionsResponse(null);
      simulationTimeoutIds.current.forEach(clearTimeout);
      simulationTimeoutIds.current = [];
      if (userLocation) setMapCenter(userLocation); // Reset map center to user
      setMapZoom(13); // Reset zoom
      handleSearch(); // Re-populate nearby providers if any
      return;
    }
    
    if (currentHiredProviderId && isMapApiLoaded && mapInstance && userLocation) {
      const providerInRoute = mockProviders.find(p => p.id === currentHiredProviderId);
      // console.log('[MapDisplay hiredProvider-useEffect] Found providerInRoute:', providerInRoute);

      if (providerInRoute && providerInRoute.location) {
        setProvidersVisibleInPanel(false); // Hide normal provider list
        setDisplayedProviders([]); // Clear normal provider list
        
        // Initialize enRouteProviderInfo
        setEnRouteProviderInfo({
          provider: providerInRoute,
          currentLocation: providerInRoute.location, // Start at provider's location
          status: "En camino",
          eta: "Calculando...",
          route: null,
        });
        
        // console.log('[MapDisplay hiredProvider-useEffect] Requesting directions from:', providerInRoute.location, 'to:', userLocation);
        if (typeof window !== 'undefined' && window.google && window.google.maps) {
            const directionsService = new window.google.maps.DirectionsService();
            directionsService.route(
              {
                origin: providerInRoute.location,
                destination: userLocation,
                travelMode: window.google.maps.TravelMode.DRIVING,
              },
              (result, status) => {
                console.log('[MapDisplay hiredProvider-useEffect] DirectionsService callback. Status:', status, 'Result:', result);
                if (status === window.google.maps.DirectionsStatus.OK && result) {
                  setDirectionsResponse(result);
                  const route = result.routes[0];
                  if (route && route.legs[0] && route.legs[0].duration) {
                    const etaText = route.legs[0].duration.text;
                    console.log('[MapDisplay hiredProvider-useEffect] Route found. ETA:', etaText);
                    setEnRouteProviderInfo(prev => prev ? {...prev, eta: etaText, route } : null);
                    if (mapInstance && route.bounds) {
                      mapInstance.fitBounds(route.bounds);
                    }
                    simulateProviderMovement(route, providerInRoute);
                  } else {
                    console.error('[MapDisplay hiredProvider-useEffect] Route or leg duration not found in directions result.');
                    setEnRouteProviderInfo(prev => prev ? {...prev, eta: "ETA no disp." } : null);
                  }
                } else {
                  console.error(`[MapDisplay hiredProvider-useEffect] Error fetching directions ${status}`);
                  setEnRouteProviderInfo(prev => prev ? {...prev, eta: "Error ruta" } : null);
                    if (mapInstance && providerInRoute.location && userLocation) { // Fallback fit bounds
                        const bounds = new window.google.maps.LatLngBounds();
                        bounds.extend(providerInRoute.location);
                        bounds.extend(userLocation);
                        mapInstance.fitBounds(bounds);
                    }
                }
              }
            );
        } else {
            console.warn('[MapDisplay hiredProvider-useEffect] window.google.maps not available when trying to request directions.');
        }
      } else {
        // console.log('[MapDisplay hiredProvider-useEffect] Hired provider or its location not found for ID:', currentHiredProviderId);
      }
    }
    // Cleanup timeouts when effect re-runs or component unmounts
    return () => {
      simulationTimeoutIds.current.forEach(clearTimeout);
      simulationTimeoutIds.current = [];
    };
  }, [currentHiredProviderId, isMapApiLoaded, mapInstance, userLocation, router, simulateProviderMovement]); // Added router and simulateProviderMovement


  useEffect(() => {
    // console.log(`[MapDisplay category-useEffect] Triggered. userLocation: ${!!userLocation}, categoryParam: ${categoryParam}, hiredId: ${currentHiredProviderId}, searchTerm: "${searchTerm}", isMapLoaded: ${isMapApiLoaded}`);
    
    if (currentHiredProviderId || !userLocation || !isMapApiLoaded) {
        // console.log("[MapDisplay category-useEffect] Bailing: Hired provider active, or no user location, or map not loaded.");
        if (!currentHiredProviderId) { // Only clear if no hired provider
            setDisplayedProviders([]);
            // setProvidersVisibleInPanel(false); // Do not hide panel if category is changing
        }
        return;
    }

    let filtered = [...mockProviders];
    // console.log('[MapDisplay category-useEffect] Initial providers for filtering:', filtered.length);

    // 1. Filter by distance
    filtered = filtered.filter(provider => {
      if (provider.location) {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
        return distance <= 20; // Max 20km
      }
      return false;
    });
    // console.log('[MapDisplay category-useEffect] Providers after distance filter (20km):', filtered.length);

    // 2. Filter by category (if categoryParam exists and is not 'all')
    const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
    if (isActiveCategoryFilter) {
      // console.log(`[MapDisplay category-useEffect] Applying specific category filter: ${categoryParam}`);
      filtered = filtered.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
    }
    // console.log('[MapDisplay category-useEffect] Providers after category filter:', filtered.length);
    
    // 3. Filter by search term (if searchTerm exists)
    // This useEffect does not handle search term, handleSearch does.
    
    // 4. Sort by rating
    filtered.sort((a, b) => b.rating - a.rating);
    // console.log('[MapDisplay category-useEffect] BEFORE setDisplayedProviders. Filtered count:', filtered.length);
    setDisplayedProviders(filtered);
    
    // Show panel if category filter is active AND there are results
    if(categoryParam) { // If categoryParam is present (even 'all')
        setProvidersVisibleInPanel(filtered.length > 0);
        // console.log(`[MapDisplay category-useEffect] Active category filter "${categoryParam}". Setting providersVisibleInPanel to ${filtered.length > 0}.`);
    } else {
        // If no categoryParam (e.g., initial load, or navigating to '/'), panel visibility is controlled by handleSearch
        // setProvidersVisibleInPanel(false); 
        // console.log(`[MapDisplay category-useEffect] No active category filter. Panel visibility unchanged by this effect.`);
    }
    
  }, [userLocation, categoryParam, isMapApiLoaded, currentHiredProviderId]); // searchTerm removed, handleSearch takes care of it


  const handleSearch = () => {
    // console.log('[MapDisplay handleSearch] Search triggered. HiredProviderId:', currentHiredProviderId, 'SearchTerm:', searchTerm, 'CategoryParam from URL:', categoryParam);
    if (currentHiredProviderId || !userLocation) {
        // console.log('[MapDisplay handleSearch] Hired provider active or no user location, search aborted.');
        return;
    }

    let tempProviders = [...mockProviders];
    // console.log('[MapDisplay handleSearch] Initial mockProviders count:', tempProviders.length);

    // 1. Filter by distance
    tempProviders = tempProviders.filter(provider => {
      if (provider.location) {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
        return distance <= 20; // Max 20km
      }
      return false;
    });
    // console.log('[MapDisplay handleSearch] Providers after distance filter:', tempProviders.length);
    
    // 2. Filter by category (if categoryParam exists and is not 'all')
    const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
    if (isActiveCategoryFilter) {
      // console.log(`[MapDisplay handleSearch] Applying category filter from URL: ${categoryParam}`);
      tempProviders = tempProviders.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
    }
    // console.log('[MapDisplay handleSearch] Providers after category filter (from URL):', tempProviders.length);
    
    // 3. Filter by search term
    if (searchTerm.trim() !== '') {
        // console.log(`[MapDisplay handleSearch] Applying text search for: "${searchTerm}"`);
        tempProviders = tempProviders.filter(provider =>
            provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            provider.services.some(service => service.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
            provider.specialties?.some(specialty => specialty.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
    // console.log('[MapDisplay handleSearch] Providers after text search:', tempProviders.length);

    // 4. Sort by rating
    tempProviders.sort((a, b) => b.rating - a.rating);

    // console.log('[MapDisplay handleSearch] BEFORE setDisplayedProviders. Filtered count:', tempProviders.length);
    setDisplayedProviders(tempProviders);

    const shouldBeVisible = tempProviders.length > 0;
    // console.log(`[MapDisplay handleSearch] Setting providersVisibleInPanel to ${shouldBeVisible} (based on ${tempProviders.length} results, search: "${searchTerm}", category: "${categoryParam}")`);
    setProvidersVisibleInPanel(shouldBeVisible); 
  };


  const renderMapArea = () => {
    // console.log("[MapDisplay renderMapArea] Attempting to render map. isMapApiLoaded:", isMapApiLoaded, "mapApiLoadError:", !!mapApiLoadError);
    if (!googleMapsApiKey) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Configuración Requerida</p>
          <p className="text-sm text-center">La API Key de Google Maps no está configurada. Por favor, añádela a tu archivo .env como NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.</p>
        </div>
      );
    }

    if (mapApiLoadError) {
      //  console.error("[MapDisplay renderMapArea] mapApiLoadError:", mapApiLoadError);
       return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <WifiOff className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Error Cargando Google Maps</p>
          <p className="text-sm text-center">Error al cargar la API: {mapApiLoadError.message}. Revisa la consola para más detalles.</p>
        </div>
      );
    }

    if (!isMapApiLoaded) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-primary p-4 bg-background/80">
          <LoaderIcon className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-semibold">Cargando Mapa...</p>
        </div>
      );
    }
    
    const providersOnMap = enRouteProviderInfo?.provider ? [] : displayedProviders;
    // console.log("[MapDisplay renderMapArea] Providers to display on map (excluding enRoute):", providersOnMap.length);
    // console.log("[MapDisplay renderMapArea] EnRoute provider info:", enRouteProviderInfo);
    
    return (
      <MapContentComponent
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onMapLoadCallback}
        onUnmount={onMapUnmountCallback}
        userLocationToDisplay={userLocation} 
        providersToDisplayOnMap={providersOnMap}
        categoryIconCache={categoryIconCache}
      >
        {directionsResponse && enRouteProviderInfo && (
            <DirectionsRenderer 
              directions={directionsResponse} 
              options={{ 
                suppressMarkers: true, // We handle our own markers
                preserveViewport: true, // Let our logic control viewport fit
                 polylineOptions: {
                  strokeColor: "hsl(var(--accent))", // Use accent color for route
                  strokeOpacity: 0.8,
                  strokeWeight: 6,
                }
              }} 
            />
        )}
        {/* Marker for the provider who is en-route */}
        {enRouteProviderInfo?.provider.location && enRouteProviderInfo.currentLocation && (
           <MarkerF
             key={enRouteProviderInfo.provider.id + "-route"}
             position={enRouteProviderInfo.currentLocation}
             title={enRouteProviderInfo.provider.name + (enRouteProviderInfo.status === "En camino" ? " (En camino)" : " (Ha llegado)")}
             icon={ typeof window !== 'undefined' && window.google && window.google.maps ? { // Check for window.google.maps
                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, // Example: a moving arrow
                scale: 5,
                strokeColor: "hsl(var(--accent))",
                fillColor: "hsl(var(--accent))",
                fillOpacity: 1,
                rotation: 0, // This might need dynamic calculation based on route segment bearing
             } : undefined}
             zIndex={typeof window !== 'undefined' && window.google && window.google.maps ? window.google.maps.Marker.MAX_ZINDEX + 1 : undefined} // Ensure it's on top
           />
        )}
      </MapContentComponent>
    );
  };
  
  const shouldDisplayRightPanel = providersVisibleInPanel && displayedProviders.length > 0 && isMapApiLoaded && !mapApiLoadError && !!googleMapsApiKey && !enRouteProviderInfo;
  const showNoResultsMessage = providersVisibleInPanel && displayedProviders.length === 0 && (!!categoryParam || searchTerm.trim() !== '') && !enRouteProviderInfo;
  // console.log(`[MapDisplay RENDER] shouldDisplayRightPanel: ${shouldDisplayRightPanel}, showNoResults: ${showNoResultsMessage}`);

  const EnRouteProviderPanel = () => {
    if (!enRouteProviderInfo || !enRouteProviderInfo.provider) return null;
    const { provider, status, eta } = enRouteProviderInfo;
    const providerCategory = SERVICE_CATEGORIES.find(c => c.id === provider.services[0]?.category);
    const IconComponent = providerCategory?.icon || Car;

    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-11/12 max-w-md z-10">
        <Card className="shadow-xl bg-background/90 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-4 p-4">
            <Image 
                src={provider.avatarUrl || DEFAULT_USER_AVATAR} 
                alt={provider.name} 
                width={64}
                height={64}
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
             <Button variant="outline" size="sm" className="mt-4" onClick={() => {
                router.push('/'); // Clear hiredProviderId from URL
                // enRouteProviderInfo will be cleared by its useEffect dependency on currentHiredProviderId
             }}>
                Volver a Búsqueda
             </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

 useEffect(() => {
    if (userLocation && isMapApiLoaded && !currentHiredProviderId) {
        // console.log('[MapDisplay initial-load-useEffect] No filters or hired provider active, loading initial providers within 20km.');
        let initialProviders = mockProviders.filter(provider => {
            if (provider.location) {
                const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
                return distance <= 20;
            }
            return false;
        });
        initialProviders.sort((a, b) => b.rating - a.rating);
        
        // For demonstration, ensure specific types are shown if available
        const requiredCategories = ['doctors', 'plumbing', 'gardening'];
        const demoProviders = initialProviders.filter(p => requiredCategories.includes(p.services[0]?.category));

        const exampleProvidersToShow = initialProviders.filter(p => 
            p.id === 'doctor1' || p.id === 'plumber1' || p.id === 'gardener1'
        );
        
        setDisplayedProviders(exampleProvidersToShow); // Show specific examples by default
        setProvidersVisibleInPanel(exampleProvidersToShow.length > 0); // Make panel visible if examples are found
      
        if (mapInstance) {
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(userLocation);
          exampleProvidersToShow.forEach(p => {
            if (p.location) bounds.extend(p.location);
          });
          mapInstance.fitBounds(bounds);
          if (exampleProvidersToShow.length === 0) {
             mapInstance.setZoom(mapZoom); 
          } else if (mapInstance.getZoom() && mapInstance.getZoom()! > 15) { // Don't zoom in too much
             mapInstance.setZoom(15);
          }
        }
    } else if (!currentHiredProviderId) { // If no hired provider, ensure panel is hidden if no category or search
      if (!categoryParam && !searchTerm) {
       // setProvidersVisibleInPanel(false); // Keep hidden if no active filter/search
      }
    }
  }, [userLocation, isMapApiLoaded, currentHiredProviderId, mapInstance, mapZoom, categoryParam, searchTerm]);


  return (
    <Card className="shadow-xl overflow-hidden h-full flex flex-col">
      {!enRouteProviderInfo && ( 
        <CardHeader className="border-b p-4 space-y-3">
          <div className="flex items-center space-x-2">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Buscar por nombre, servicio, especialidad..." 
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
             (shouldDisplayRightPanel || showNoResultsMessage) ? "md:w-2/3" : "md:w-full" 
           )}>
          {renderMapArea()}
        </div>

        {(shouldDisplayRightPanel || showNoResultsMessage) && (
          <div className={cn(
              "md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-full md:overflow-y-auto space-y-4 flex-shrink-0",
            )}>
            <h3 className="text-lg font-semibold text-primary mb-2">
              {categoryParam && categoryParam !== 'all' && SERVICE_CATEGORIES.find(c=>c.id === categoryParam)
                ? `Proveedores de "${SERVICE_CATEGORIES.find(c=>c.id === categoryParam)?.name}" cercanos:`
                : "Proveedores Cercanos:"}
            </h3>
            {displayedProviders.length > 0 ? (
              displayedProviders.map(provider => ( 
                <ProviderPreviewCard
                  key={provider.id}
                  provider={provider}
                />
              ))
            ) : (
              <p className="text-muted-foreground">No se encontraron proveedores que coincidan con tus criterios.</p>
            )}
          </div>
        )}
         {isMapApiLoaded && !mapApiLoadError && !!googleMapsApiKey && !shouldDisplayRightPanel && !showNoResultsMessage && !enRouteProviderInfo && (
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
