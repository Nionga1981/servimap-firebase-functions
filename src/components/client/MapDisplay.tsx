
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import type { LucideIcon } from 'lucide-react';
import { GoogleMap, MarkerF, useJsApiLoader, PolylineF, InfoWindowF, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { MapPinned, WifiOff, Loader2 as LoaderIcon, LocateFixed, Car, Clock, AlertTriangle, X, User, MapPin as MapPinIcon, Filter, Star, Search } from 'lucide-react'; // Asegúrate de que Search esté importado
import type { Provider, Service } from '@/types';
import { cn } from "@/lib/utils";
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData';
import { SERVICE_CATEGORIES, DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { BottomSearchContainer } from './BottomSearchContainer';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { Input } from '@/components/ui/input'; // Asegúrate de que Input esté importado

// TEMPORARY HARDCODE - REMOVE FOR PRODUCTION
const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; 
// console.log('[MapDisplay Module] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY from env:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
// console.log('[MapDisplay Component] Effective googleMapsApiKey value:', googleMapsApiKey);

function lucideIconToDataUri(
  IconComponent: LucideIcon,
  options: { size?: number; color?: string; strokeWidth?: number } = {}
): string {
  const { size = 24, color = '#3F51B5', strokeWidth = 2 } = options;
  if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') {
    // console.error('[MapDisplay lucideIconToDataUri] Invalid IconComponent passed:', IconComponent);
    return '';
  }
  try {
    const element = React.createElement(IconComponent, { color, size, strokeWidth });
    const svgString = ReactDOMServer.renderToStaticMarkup(element);
    // console.log(`[MapDisplay] SVG string for ${IconComponent.displayName || IconComponent.name || 'icon'}: ${svgString.substring(0,100)}`);
    const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;
    // console.log(`[MapDisplay] Generated iconDataUri for ${IconComponent.displayName || IconComponent.name || 'icon'} (first 100 chars): ${dataUri.substring(0,100)}`);
    return dataUri;
  } catch (error) {
    // console.error(`[MapDisplay lucideIconToDataUri] Error rendering Lucide icon to SVG string for ${IconComponent.name || 'icon'}:`, error, IconComponent);
    return '';
  }
}

const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: 0,
};

const mapOptions: google.maps.MapOptions = {
  styles: [
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
    { featureType: "poi.medical", stylers: [{ visibility: "off" }]},
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }]},
    { featureType: "poi.school", stylers: [{ visibility: "off" }]},
    { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }]},
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "transit.station.airport", stylers: [{ visibility: "off" }]},
    { featureType: "transit.station.bus", stylers: [{ visibility: "off" }]},
    { featureType: "transit.station.rail", stylers: [{ visibility: "off" }]},
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  ],
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControl: false,
  rotateControl: false,
  scaleControl: false,
  clickableIcons: false,
};

const libraries = ['places'] as ("places")[];

const MapContentComponent = React.memo(({
  center,
  zoom,
  onLoad,
  onUnmount,
  userLocationToDisplay,
  providersToDisplayOnMap,
  children,
  categoryIconCache,
  onMarkerClick,
  selectedProviderForInfoWindow,
  onInfoWindowClose,
}: {
  center: google.maps.LatLngLiteral;
  zoom: number;
  onLoad: (map: google.maps.Map) => void;
  onUnmount: () => void;
  userLocationToDisplay: google.maps.LatLngLiteral | null;
  providersToDisplayOnMap: Provider[];
  children?: React.ReactNode;
  categoryIconCache: React.RefObject<Map<string, string>>;
  onMarkerClick: (provider: Provider) => void;
  selectedProviderForInfoWindow: Provider | null;
  onInfoWindowClose: () => void;
}) => {
  // console.log("[MapDisplay MapContentComponent] Rendering. Selected provider for InfoWindow:", selectedProviderForInfoWindow?.name);
  // console.log("[MapDisplay MapContentComponent] userLocationToDisplay:", userLocationToDisplay);
  // console.log("[MapDisplay MapContentComponent] providersToDisplayOnMap count:", providersToDisplayOnMap.length);

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={zoom}
      options={mapOptions}
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
            fillColor: "hsl(var(--primary))",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
          }}
          zIndex={10}
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
            try {
              iconDataUri = lucideIconToDataUri(serviceCategory.icon); 
              if (iconDataUri) {
                categoryIconCache.current?.set(serviceCategory.id, iconDataUri);
                // console.log(`[MapDisplay] Cached icon for ${serviceCategory.id}`);
              }
            } catch (e) {
              // console.error(`[MapDisplay] Error calling lucideIconToDataUri for ${serviceCategory.id} (${serviceCategory.name}):`, e, serviceCategory.icon);
            }
          }
        }
        
        let markerIcon: google.maps.Icon | undefined = undefined;
        if (iconDataUri && typeof window !== 'undefined' && window.google && window.google.maps) {
          try {
            markerIcon = {
                url: iconDataUri,
                scaledSize: new window.google.maps.Size(32, 32), 
                anchor: new window.google.maps.Point(16, 32),    
            };
          } catch (e) {
            // console.error(`[MapDisplay] Error creating google.maps.Size/Point for ${provider.name}:`, e);
          }
        }
        
        return (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={provider.name}
            icon={markerIcon} // Usará el pin predeterminado si markerIcon es undefined
            onClick={() => onMarkerClick(provider)}
          />
        )
      })}

      {selectedProviderForInfoWindow && selectedProviderForInfoWindow.location && userLocationToDisplay && (
        <InfoWindowF
          position={selectedProviderForInfoWindow.location}
          onCloseClick={onInfoWindowClose}
          options={{
            pixelOffset: typeof window !== 'undefined' && window.google && window.google.maps ? new window.google.maps.Size(0, -35) : undefined
          }}
        >
          <div className="p-2 shadow-lg rounded-md bg-background max-w-xs">
            <h4 className="text-md font-semibold text-primary mb-1">{selectedProviderForInfoWindow.name}</h4>
            <div className="text-xs text-muted-foreground mb-1">
              <Star className="inline-block h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />
              {selectedProviderForInfoWindow.rating.toFixed(1)}
              <span className="mx-1">·</span>
              <MapPinIcon className="inline-block h-3 w-3 mr-1" />
              {calculateDistance(
                userLocationToDisplay.lat,
                userLocationToDisplay.lng,
                selectedProviderForInfoWindow.location.lat,
                selectedProviderForInfoWindow.location.lng
              ).toFixed(1)} km
            </div>
             <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {SERVICE_CATEGORIES.find(cat => cat.id === selectedProviderForInfoWindow.services[0]?.category)?.name || 'Servicios varios'}
            </p>
            <Button asChild size="sm" className="w-full">
              <Link href={`/provider-profile/${selectedProviderForInfoWindow.id}`}>
                Ver Perfil y Solicitar
              </Link>
            </Button>
          </div>
        </InfoWindowF>
      )}

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
  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "",
    libraries,
    id: 'google-map-script-servimap'
  });

  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(USER_FIXED_LOCATION);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(13); 
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  // El panel lateral de proveedores está eliminado visualmente, pero mantenemos el estado por si se reintroduce
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false); 
  
  const categoryIconCache = useRef(new Map<string, string>());

  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = useMemo(() => searchParams.get('category'), [searchParams]);
  const currentHiredProviderId = useMemo(() => searchParams.get('hiredProviderId'), [searchParams]);
  
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');

  const [enRouteProviderInfo, setEnRouteProviderInfo] = useState<EnRouteProviderInfo | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const simulationTimeoutIds = useRef<NodeJS.Timeout[]>([]);

  const [selectedProviderForInfoWindow, setSelectedProviderForInfoWindow] = useState<Provider | null>(null);

  const onMapLoadCallback = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
    map.setCenter(mapCenter);
    map.setZoom(mapZoom);
  }, [mapCenter, mapZoom]);

  const onMapUnmountCallback = useCallback(() => {
    setMapInstance(null);
    setDirectionsResponse(null);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];
  }, []);
  
  const updateDisplayedProviders = useCallback(() => {
    console.log(`[MapDisplay updateDisplayedProviders] Called. UserLocation: ${!!userLocation}, CategoryParam: ${categoryParam}, SearchTerm: ${currentSearchTerm}`);
    if (!userLocation) {
      setDisplayedProviders([]);
      setProvidersVisibleInPanel(false);
      return;
    }

    let filtered = [...mockProviders];
    console.log(`[MapDisplay updateDisplayedProviders] Initial mockProviders count: ${filtered.length}`);

    // 1. Filter by distance (within 20km)
    filtered = filtered.filter(provider => {
      if (provider.location) {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
        return distance <= 20;
      }
      return false;
    });
    console.log(`[MapDisplay updateDisplayedProviders] Providers after distance filter: ${filtered.length}`);

    // 2. Filter by category (if categoryParam exists and not 'all')
    const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
    if (isActiveCategoryFilter) {
      filtered = filtered.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
      console.log(`[MapDisplay updateDisplayedProviders] Providers after category filter ('${categoryParam}'): ${filtered.length}`);
    }
    
    // 3. Filter by search term (if currentSearchTerm exists)
    let filteredBySearchTerm = [...filtered]; // Start with already filtered list
    if (currentSearchTerm && currentSearchTerm.trim() !== '') {
      const searchTermLower = currentSearchTerm.toLowerCase().trim();
      console.log(`[MapDisplay updateDisplayedProviders] Applying search term filter: '${searchTermLower}'. Providers before text search: ${filteredBySearchTerm.length}`);
      filteredBySearchTerm = filteredBySearchTerm.filter(provider => {
        const nameMatch = provider.name.toLowerCase().includes(searchTermLower);
        const specialtyMatch = provider.specialties?.some(spec => spec.toLowerCase().includes(searchTermLower));
        const serviceMatch = provider.services.some(service => 
          service.title.toLowerCase().includes(searchTermLower) ||
          service.description.toLowerCase().includes(searchTermLower) ||
          (SERVICE_CATEGORIES.find(cat => cat.id === service.category)?.name.toLowerCase().includes(searchTermLower))
        );
        // console.log(`[MapDisplay updateDisplayedProviders] Provider: ${provider.name}, NameMatch: ${nameMatch}, SpecialtyMatch: ${specialtyMatch}, ServiceMatch: ${serviceMatch}`);
        return nameMatch || specialtyMatch || serviceMatch;
      });
      console.log(`[MapDisplay updateDisplayedProviders] Providers after search term filter ('${currentSearchTerm}'): ${filteredBySearchTerm.length}`);
    } else {
        console.log(`[MapDisplay updateDisplayedProviders] No search term or empty search term. Skipping text filter. Providers count: ${filteredBySearchTerm.length}`);
    }

    // 4. Prioritize Active vs. Inactive from the result of all previous filters
    const activeProviders = filteredBySearchTerm.filter(p => p.isAvailable);
    console.log(`[MapDisplay updateDisplayedProviders] Active providers from filtered list: ${activeProviders.length}`);
    const inactiveProviders = filteredBySearchTerm.filter(p => !p.isAvailable);
    console.log(`[MapDisplay updateDisplayedProviders] Inactive providers from filtered list: ${inactiveProviders.length}`);
    
    let finalProvidersToShow: Provider[];
    if (activeProviders.length > 0) {
      finalProvidersToShow = activeProviders;
      console.log(`[MapDisplay updateDisplayedProviders] Prioritizing ${activeProviders.length} active providers.`);
    } else if (inactiveProviders.length > 0) {
      finalProvidersToShow = inactiveProviders;
      console.log(`[MapDisplay updateDisplayedProviders] No active providers found, showing ${inactiveProviders.length} inactive providers.`);
    } else {
      finalProvidersToShow = []; 
      console.log(`[MapDisplay updateDisplayedProviders] No active or inactive providers found matching criteria.`);
    }
    
    // 5. Sort by rating
    finalProvidersToShow.sort((a, b) => b.rating - a.rating);

    setDisplayedProviders(finalProvidersToShow);
    setProvidersVisibleInPanel(finalProvidersToShow.length > 0); // Show panel if there are results
    console.log(`[MapDisplay updateDisplayedProviders] Final displayedProviders count: ${finalProvidersToShow.length}. Panel visible: ${finalProvidersToShow.length > 0}`);

  }, [userLocation, categoryParam, currentSearchTerm]);


  useEffect(() => {
    if (userLocation && isMapApiLoaded && !currentHiredProviderId) {
        updateDisplayedProviders();
    }
  }, [userLocation, categoryParam, currentSearchTerm, isMapApiLoaded, updateDisplayedProviders, currentHiredProviderId]);


  const simulateProviderMovement = useCallback((route: google.maps.DirectionsRoute, provider: Provider) => {
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];

    if (!route.legs || !route.legs[0] || !route.legs[0].steps || !userLocation) {
       if (userLocation) {
        const arrivalTimeout = setTimeout(() => {
          setEnRouteProviderInfo(prev => prev ? { ...prev, currentLocation: userLocation, status: "Ha llegado", eta: "0 min" } : null);
          if (mapInstance) { mapInstance.panTo(userLocation); mapInstance.setZoom(17); }
        }, 5000); 
        simulationTimeoutIds.current.push(arrivalTimeout);
      }
      return;
    }

    const steps = route.legs[0].steps;
    let cumulativeDelay = 0;
    const totalSimulationDuration = Math.max(10000, Math.min(20000, (route.legs[0].duration?.value || steps.length * 2) * 1000 * 0.1)); 
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
        
        let remainingSecondsInSimulation = 0;
        for(let i = index + 1; i < steps.length; i++) {
          remainingSecondsInSimulation += (route.legs[0].steps[i].duration?.value || ((route.legs[0].duration?.value || steps.length * 2) / steps.length) );
        }
        const remainingMinutes = Math.ceil(remainingSecondsInSimulation / 60);
        const newEta = remainingMinutes > 0 ? `${remainingMinutes} min` : "Casi llega";
        
        setEnRouteProviderInfo(prev => {
          if (!prev) return null;
          return { ...prev, currentLocation: newLocation, eta: newEta };
        });

        if (mapInstance) {
          mapInstance.panTo(newLocation);
        }

        if (index === steps.length - 1) { 
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
  }, [mapInstance, userLocation]);


  useEffect(() => {
    if (!currentHiredProviderId && enRouteProviderInfo) { 
      setEnRouteProviderInfo(null);
      setDirectionsResponse(null);
      simulationTimeoutIds.current.forEach(clearTimeout);
      simulationTimeoutIds.current = [];
      if (userLocation) {
        setMapCenter(userLocation); 
        if(mapInstance) mapInstance.setZoom(mapZoom); 
      }
      updateDisplayedProviders(); 
      return;
    }
    
    if (currentHiredProviderId && isMapApiLoaded && mapInstance && userLocation) {
      const providerInRoute = mockProviders.find(p => p.id === currentHiredProviderId);

      if (providerInRoute && providerInRoute.location) {
        setEnRouteProviderInfo({
          provider: providerInRoute,
          currentLocation: providerInRoute.location, 
          status: "En camino",
          eta: "Calculando...",
          route: null, 
        });
        
        // setProvidersVisibleInPanel(false); // No longer needed to hide panel here

        if (typeof window !== 'undefined' && window.google && window.google.maps) {
            const directionsService = new window.google.maps.DirectionsService();
            directionsService.route(
              {
                origin: providerInRoute.location,
                destination: userLocation,
                travelMode: window.google.maps.TravelMode.DRIVING,
              },
              (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK && result) {
                  setDirectionsResponse(result);
                  const route = result.routes[0];
                  if (route && route.legs[0] && route.legs[0].duration) {
                    const etaText = route.legs[0].duration.text;
                    setEnRouteProviderInfo(prev => prev ? {...prev, eta: etaText, route } : null);
                    if (mapInstance && route.bounds) {
                      mapInstance.fitBounds(route.bounds);
                    }
                    simulateProviderMovement(route, providerInRoute);
                  } else {
                    setEnRouteProviderInfo(prev => prev ? {...prev, eta: "ETA no disp." } : null);
                  }
                } else {
                  setEnRouteProviderInfo(prev => prev ? {...prev, eta: "Error ruta" } : null);
                    if (mapInstance && providerInRoute.location && userLocation) {
                        const bounds = new window.google.maps.LatLngBounds();
                        bounds.extend(providerInRoute.location);
                        bounds.extend(userLocation);
                        mapInstance.fitBounds(bounds);
                    }
                }
              }
            );
        }
      }
    }
    return () => {
      simulationTimeoutIds.current.forEach(clearTimeout);
      simulationTimeoutIds.current = [];
    };
  }, [currentHiredProviderId, isMapApiLoaded, mapInstance, userLocation, simulateProviderMovement, mapZoom, updateDisplayedProviders]);


  const handleSearchFromBottomBar = useCallback((term: string) => {
    console.log(`[MapDisplay handleSearchFromBottomBar] Search term received: '${term}'`);
    setCurrentSearchTerm(term);
    // updateDisplayedProviders() will be called by the useEffect reacting to currentSearchTerm change
  }, []);

  const renderMapArea = () => {
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
       return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <WifiOff className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Error Cargando Google Maps</p>
          <p className="text-sm text-center">Error al cargar la API. Revisa la consola para más detalles.</p>
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
        
    return (
      <MapContentComponent
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onMapLoadCallback}
        onUnmount={onMapUnmountCallback}
        userLocationToDisplay={userLocation} 
        providersToDisplayOnMap={displayedProviders}
        categoryIconCache={categoryIconCache}
        onMarkerClick={setSelectedProviderForInfoWindow}
        selectedProviderForInfoWindow={selectedProviderForInfoWindow}
        onInfoWindowClose={() => setSelectedProviderForInfoWindow(null)}
      >
        {directionsResponse && enRouteProviderInfo && (
            <DirectionsRenderer 
              directions={directionsResponse} 
              options={{ 
                suppressMarkers: true, 
                preserveViewport: true,
                 polylineOptions: {
                  strokeColor: "hsl(var(--accent))", 
                  strokeOpacity: 0.8,
                  strokeWeight: 6,
                }
              }} 
            />
        )}
        {enRouteProviderInfo?.provider.location && enRouteProviderInfo.currentLocation && (
           <MarkerF
             key={enRouteProviderInfo.provider.id + "-route"}
             position={enRouteProviderInfo.currentLocation}
             title={enRouteProviderInfo.provider.name + (enRouteProviderInfo.status === "En camino" ? " (En camino)" : " (Ha llegado)")}
             icon={ typeof window !== 'undefined' && window.google && window.google.maps ? { 
                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, 
                scale: 5,
                strokeColor: "hsl(var(--accent))", 
                fillColor: "hsl(var(--accent))",
                fillOpacity: 1,
             } : undefined}
             zIndex={typeof window !== 'undefined' && window.google && window.google.maps ? window.google.maps.Marker.MAX_ZINDEX + 1 : undefined}
           />
        )}
      </MapContentComponent>
    );
  };
  
  const EnRouteProviderPanel = () => {
    if (!enRouteProviderInfo || !enRouteProviderInfo.provider) return null;
    const { provider, status, eta } = enRouteProviderInfo;
    const providerCategory = SERVICE_CATEGORIES.find(c => c.id === provider.services[0]?.category);
    const IconComponent = providerCategory?.icon || Car; 

    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-auto max-w-sm z-30 bg-background/90 backdrop-blur-sm shadow-xl rounded-lg p-3">
        <div className="flex items-center gap-3 mb-2">
          <Image 
              src={provider.avatarUrl || DEFAULT_USER_AVATAR} 
              alt={provider.name} 
              width={36} 
              height={36}
              className="w-9 h-9 rounded-full border-2 border-primary object-cover"
              data-ai-hint={provider.dataAiHint || "provider avatar"}
              style={{objectFit: "cover"}}
          />
          <div>
            <h3 className="text-md font-semibold text-primary">{provider.name}</h3>
            <p className="text-xs text-muted-foreground">{providerCategory?.name || "Servicio Contratado"}</p>
          </div>
           <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => router.push('/')}>
              <X className="h-4 w-4" />
              <span className="sr-only">Cancelar Seguimiento</span>
          </Button>
        </div>
        <div className="text-center">
          {status === "En camino" ? (
            <>
              <div className="flex items-center justify-center gap-1 text-sm font-medium text-foreground mb-0.5">
                <IconComponent className="w-4 h-4 text-primary" />
                <span>{status}</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-accent">
                <Clock className="w-5 h-5" />
                <span>Llega en {eta}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-1 text-md font-bold text-green-600">
              <IconComponent className="w-5 h-5" />
              <span>¡{provider.name} ha llegado!</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // El panel lateral está eliminado visualmente, pero la lógica de `providersVisibleInPanel` se mantiene
  // por si se decide reintroducir una forma diferente de mostrar la lista de proveedores.
  // Por ahora, no tendrá efecto visual.
  // const shouldDisplayRightPanel = providersVisibleInPanel && displayedProviders.length > 0 && !currentHiredProviderId;
  // console.log(`[MapDisplay RENDER] displayedProviders count: ${displayedProviders.length}, providersVisibleInPanel: ${providersVisibleInPanel}, categoryParam: ${categoryParam}, currentSearchTerm: ${currentSearchTerm}, currentHiredProviderId: ${currentHiredProviderId}, enRoute: ${!!enRouteProviderInfo}`);

  return (
    <div className="h-full w-full relative">
      <div className="absolute inset-0 z-0">
        {renderMapArea()}
      </div>
      
      <BottomSearchContainer onSearch={handleSearchFromBottomBar} />
      
      {enRouteProviderInfo && <EnRouteProviderPanel />}
    </div>
  );
}
