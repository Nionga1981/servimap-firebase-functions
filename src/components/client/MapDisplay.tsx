
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import type { LucideIcon } from 'lucide-react';
import { GoogleMap, MarkerF, useJsApiLoader, PolylineF, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card'; // CardFooter might not be needed
import { MapPinned, Search, WifiOff, Loader2 as LoaderIcon, LocateFixed, Car, Clock, AlertTriangle, X } from 'lucide-react';
import type { Provider } from '@/types';
// ProviderPreviewCard is not used in this layout.
import { Button } from '@/components/ui/button';
// Input is not used directly in MapDisplay for search anymore.
import { cn } from "@/lib/utils";
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData';
import { SERVICE_CATEGORIES, DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { BottomSearchContainer } from './BottomSearchContainer';

// Helper function to convert Lucide Icon component to SVG Data URI
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
    const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;
    // console.log(`[MapDisplay] Generated iconDataUri for category: ${dataUri.substring(0,100)}...`);
    return dataUri;
  } catch (error) {
    // console.error('[MapDisplay lucideIconToDataUri] Error rendering Lucide icon to SVG string:', error, IconComponent);
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
            fillColor: "#3F51B5", 
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
            try {
              iconDataUri = lucideIconToDataUri(serviceCategory.icon, { color: '#3F51B5' });
              if (iconDataUri) {
                categoryIconCache.current?.set(serviceCategory.id, iconDataUri);
              }
            } catch (e) {
              // console.error(`[MapDisplay] Error calling lucideIconToDataUri for ${serviceCategory.id}:`, e);
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
            title={`${provider.name} (Calificación: ${provider.rating.toFixed(1)})`}
            icon={markerIcon}
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
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

export function MapDisplay() {
  const libraries = useMemo(() => ['places'] as const, []);
  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; 

  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries,
    id: 'google-map-script-servimap'
  });

  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(USER_FIXED_LOCATION);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [searchTerm, setSearchTerm] = useState(''); // Currently not connected to BottomSearchContainer input
  const categoryIconCache = useRef(new Map<string, string>());

  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = useMemo(() => searchParams.get('category'), [searchParams]);
  const currentHiredProviderId = useMemo(() => searchParams.get('hiredProviderId'), [searchParams]);

  const [enRouteProviderInfo, setEnRouteProviderInfo] = useState<EnRouteProviderInfo | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const simulationTimeoutIds = useRef<NodeJS.Timeout[]>([]);

  const onMapLoadCallback = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
    if (userLocation) {
      map.setCenter(userLocation);
      map.setZoom(mapZoom);
    }
  }, [userLocation, mapZoom]);

  const onMapUnmountCallback = useCallback(() => {
    setMapInstance(null);
    setDirectionsResponse(null);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];
  }, []);

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
      if (userLocation) setMapCenter(userLocation);
      setMapZoom(13); 
      return;
    }
    
    if (currentHiredProviderId && isMapApiLoaded && mapInstance && userLocation) {
      const providerInRoute = mockProviders.find(p => p.id === currentHiredProviderId);

      if (providerInRoute && providerInRoute.location) {
        setDisplayedProviders([]); 
        
        setEnRouteProviderInfo({
          provider: providerInRoute,
          currentLocation: providerInRoute.location,
          status: "En camino",
          eta: "Calculando...",
          route: null,
        });
        
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
  }, [currentHiredProviderId, isMapApiLoaded, mapInstance, userLocation, router, simulateProviderMovement]);


  useEffect(() => {
    if (currentHiredProviderId || !userLocation || !isMapApiLoaded) {
      if (!currentHiredProviderId) {
        setDisplayedProviders([]);
      }
      return;
    }

    let filtered = [...mockProviders];
    filtered = filtered.filter(provider => {
      if (provider.location) {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
        return distance <= 20; 
      }
      return false;
    });
    
    const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
    if (isActiveCategoryFilter) {
      filtered = filtered.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
    }
    
    // Search term filtering is not active with BottomSearchContainer yet
    // if (searchTerm.trim() !== '') { ... }
    
    filtered.sort((a, b) => b.rating - a.rating); 
    setDisplayedProviders(filtered);
    
  }, [userLocation, categoryParam, searchTerm, isMapApiLoaded, currentHiredProviderId]);

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
        <div className="flex flex-col items-center justify-center h-full text-primary p-4 bg-background/80">
          <LoaderIcon className="h-12 w-12 animate-spin mb-4" />
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
        categoryIconCache={categoryIconCache}
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
                rotation: 0, 
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
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-11/12 max-w-md z-20">
        <Card className="shadow-xl bg-background/90 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-4 p-4">
            <Image 
                src={provider.avatarUrl || DEFAULT_USER_AVATAR} 
                alt={provider.name} 
                width={64}
                height={64}
                className="w-16 h-16 rounded-full border-2 border-primary object-cover"
                data-ai-hint={provider.dataAiHint || "provider avatar"}
                style={{objectFit: "cover"}}
            />
            <div>
              <h3 className="text-lg font-semibold text-primary">{provider.name}</h3>
              <p className="text-sm text-muted-foreground">{providerCategory?.name || "Servicio Contratado"}</p>
            </div>
             <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => router.push('/')}>
                <X className="h-5 w-5" />
                <span className="sr-only">Cancelar Seguimiento</span>
            </Button>
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
                router.push('/'); 
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
        let initialProviders = [...mockProviders].filter(provider => {
            if (provider.location) {
                const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
                return distance <= 20;
            }
            return false;
        });

        const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
        if (isActiveCategoryFilter) {
            initialProviders = initialProviders.filter(provider =>
                provider.services.some(service => service.category === categoryParam)
            );
        }
        initialProviders.sort((a,b) => b.rating - a.rating);
        setDisplayedProviders(initialProviders);
      
        if (mapInstance) {
          mapInstance.setCenter(userLocation);
          mapInstance.setZoom(mapZoom); 
        }
    }
  }, [userLocation, isMapApiLoaded, mapInstance, mapZoom, categoryParam, currentHiredProviderId]);


  return (
    <div className="h-full w-full relative"> {/* Main container for map and overlays */}
      <div className="absolute inset-0 z-0"> {/* Map container */}
        {renderMapArea()}
      </div>
      
      {enRouteProviderInfo && <EnRouteProviderPanel />}
      {/* Only show BottomSearchContainer if no provider is en-route */}
      {!enRouteProviderInfo && <BottomSearchContainer />} 
    </div>
  );
}

    