
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import type { LucideIcon } from 'lucide-react';
import { GoogleMap, MarkerF, useJsApiLoader, PolylineF, DirectionsService, DirectionsRenderer, InfoWindowF } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { MapPinned, Search, WifiOff, Loader2 as LoaderIcon, LocateFixed, Car, Clock, AlertTriangle, X, Shield, Briefcase, Star, User, MapPin, Filter } from 'lucide-react';
import type { Provider, Service } from '@/types';
import { cn } from "@/lib/utils";
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData';
import { SERVICE_CATEGORIES, DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { BottomSearchContainer } from './BottomSearchContainer';
import { Input } from '@/components/ui/input';
import { ProviderPreviewCard } from './ProviderPreviewCard';


// Helper function to convert Lucide Icon component to SVG Data URI
function lucideIconToDataUri(
  IconComponent: LucideIcon,
  options: { size?: number; color?: string; strokeWidth?: number } = {}
): string {
  const { size = 24, color = '#3F51B5', strokeWidth = 2 } = options;
  if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') {
    console.error('[MapDisplay lucideIconToDataUri] Invalid IconComponent passed:', IconComponent);
    return '';
  }
  try {
    const element = React.createElement(IconComponent, { color, size, strokeWidth });
    const svgString = ReactDOMServer.renderToStaticMarkup(element);
    const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;
    // console.log(`[MapDisplay] Generated iconDataUri (first 100 chars): ${dataUri.substring(0,100)}`);
    return dataUri;
  } catch (error) {
    console.error('[MapDisplay lucideIconToDataUri] Error rendering Lucide icon to SVG string:', error, IconComponent);
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
              }
            } catch (e) {
               console.error(`[MapDisplay] Error calling lucideIconToDataUri for ${serviceCategory.id}:`, e);
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
             console.error(`[MapDisplay] Error creating google.maps.Size/Point for ${provider.name}:`, e);
          }
        }
        
        return (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={provider.name}
            icon={markerIcon}
            onClick={() => onMarkerClick(provider)}
          />
        )
      })}

      {selectedProviderForInfoWindow && selectedProviderForInfoWindow.location && userLocationToDisplay && (
        <InfoWindowF
          position={selectedProviderForInfoWindow.location}
          onCloseClick={onInfoWindowClose}
          options={{
            pixelOffset: new window.google.maps.Size(0, -35)
          }}
        >
          <div className="p-2 shadow-lg rounded-md bg-background max-w-xs">
            <h4 className="text-md font-semibold text-primary mb-1">{selectedProviderForInfoWindow.name}</h4>
            <div className="text-xs text-muted-foreground mb-1">
              <Star className="inline-block h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />
              {selectedProviderForInfoWindow.rating.toFixed(1)}
              <span className="mx-1">·</span>
              <MapPin className="inline-block h-3 w-3 mr-1" />
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
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Aunque no se use para filtrar ahora
  const categoryIconCache = useRef(new Map<string, string>());

  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = useMemo(() => searchParams.get('category'), [searchParams]);
  const currentHiredProviderId = useMemo(() => searchParams.get('hiredProviderId'), [searchParams]);

  const [enRouteProviderInfo, setEnRouteProviderInfo] = useState<EnRouteProviderInfo | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const simulationTimeoutIds = useRef<NodeJS.Timeout[]>([]);

  const [selectedProviderForInfoWindow, setSelectedProviderForInfoWindow] = useState<Provider | null>(null);

  const onMapLoadCallback = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
    if (userLocation) map.setCenter(userLocation);
    map.setZoom(mapZoom);
  }, [userLocation, mapZoom]);

  const onMapUnmountCallback = useCallback(() => {
    setMapInstance(null);
    setDirectionsResponse(null);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];
  }, []);

  const simulateProviderMovement = useCallback((route: google.maps.DirectionsRoute, provider: Provider) => {
    console.log("[MapDisplay] simulateProviderMovement started for route:", route);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];

    if (!route.legs || !route.legs[0] || !route.legs[0].steps || !userLocation) {
      console.warn("[MapDisplay] Simulation: Route has no steps or userLocation is null. Arriving directly.");
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

    console.log(`[MapDisplay] Simulation: Total steps: ${steps.length}, Step duration: ${stepDuration}ms, Total sim duration: ${totalSimulationDuration}ms`);

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
        
        console.log(`[MapDisplay] Simulating step ${index + 1}/${steps.length}: Moving to lat: ${newLocation.lat}, lng: ${newLocation.lng}, ETA: ${newEta}`);
        setEnRouteProviderInfo(prev => {
          if (!prev) return null; 
          return { ...prev, currentLocation: newLocation, eta: newEta };
        });

        if (mapInstance) {
          mapInstance.panTo(newLocation);
        }

        if (index === steps.length - 1) {
          console.log("[MapDisplay] Simulation: Provider arrived at destination.");
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
    console.log("[MapDisplay] useEffect for hiredProviderId. Current ID from URL:", currentHiredProviderId);
    if (!currentHiredProviderId && enRouteProviderInfo) {
      console.log("[MapDisplay] No hired provider ID, resetting enRoute state.");
      setEnRouteProviderInfo(null);
      setDirectionsResponse(null);
      simulationTimeoutIds.current.forEach(clearTimeout);
      simulationTimeoutIds.current = [];
      if (userLocation) {
        setMapCenter(userLocation); 
        if(mapInstance) mapInstance.setZoom(mapZoom);
      }
      return;
    }
    
    if (currentHiredProviderId && isMapApiLoaded && mapInstance && userLocation) {
      console.log("[MapDisplay] Hired provider ID detected:", currentHiredProviderId);
      const providerInRoute = mockProviders.find(p => p.id === currentHiredProviderId);
      console.log("[MapDisplay] Found providerInRoute:", providerInRoute);

      if (providerInRoute && providerInRoute.location) {
        // No limpiar displayedProviders ni selectedProviderForInfoWindow
        
        setEnRouteProviderInfo({
          provider: providerInRoute,
          currentLocation: providerInRoute.location, 
          status: "En camino",
          eta: "Calculando...",
          route: null, 
        });
        
        if (typeof window !== 'undefined' && window.google && window.google.maps) {
            const directionsService = new window.google.maps.DirectionsService();
            console.log("[MapDisplay] Requesting directions from:", providerInRoute.location, "to:", userLocation);
            directionsService.route(
              {
                origin: providerInRoute.location,
                destination: userLocation,
                travelMode: window.google.maps.TravelMode.DRIVING,
              },
              (result, status) => {
                console.log("[MapDisplay] DirectionsService callback. Status:", status, "Result:", result);
                if (status === window.google.maps.DirectionsStatus.OK && result) {
                  setDirectionsResponse(result);
                  const route = result.routes[0];
                  if (route && route.legs[0] && route.legs[0].duration) {
                    const etaText = route.legs[0].duration.text;
                    console.log("[MapDisplay] Route found. ETA:", etaText);
                    setEnRouteProviderInfo(prev => prev ? {...prev, eta: etaText, route } : null);
                    if (mapInstance && route.bounds) {
                      mapInstance.fitBounds(route.bounds);
                    }
                    simulateProviderMovement(route, providerInRoute);
                  } else {
                    console.warn("[MapDisplay] Route found but no duration info.");
                    setEnRouteProviderInfo(prev => prev ? {...prev, eta: "ETA no disp." } : null);
                  }
                } else {
                  console.error("[MapDisplay] Directions request failed. Status:", status);
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
  }, [currentHiredProviderId, isMapApiLoaded, mapInstance, userLocation, simulateProviderMovement, mapZoom]); 


  // Efecto para manejar la carga inicial y los cambios de categoría
 useEffect(() => {
    console.log(`[MapDisplay category-useEffect] Triggered. categoryParam: ${categoryParam}, userLocation: ${!!userLocation}, isMapApiLoaded: ${isMapApiLoaded}, currentHiredProviderId: ${currentHiredProviderId}`);
    
    if (!userLocation || !isMapApiLoaded) {
      console.log("[MapDisplay category-useEffect] User location or map API not ready, returning.");
      return;
    }
  
    let filtered = [...mockProviders];
    console.log(`[MapDisplay category-useEffect] Initial mockProviders count: ${filtered.length}`);
  
    // 1. Filtrar por distancia (dentro de 20km)
    filtered = filtered.filter(provider => {
      if (provider.location) {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
        return distance <= 20;
      }
      return false;
    });
    console.log(`[MapDisplay category-useEffect] Providers after distance filter: ${filtered.length}`);
  
    // 2. Filtrar por categoría (si categoryParam existe y no es 'all')
    const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
    if (isActiveCategoryFilter) {
      filtered = filtered.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
      console.log(`[MapDisplay category-useEffect] Providers after category filter ('${categoryParam}'): ${filtered.length}`);
    }
  
    // 3. Ordenar por calificación
    filtered.sort((a, b) => b.rating - a.rating);
  
    setDisplayedProviders(filtered);
    console.log(`[MapDisplay category-useEffect] Final displayedProviders count: ${filtered.length}, setting providersVisibleInPanel to: ${!!(categoryParam && filtered.length > 0)}`);

    // Mostrar el panel si hay un filtro de categoría activo (incluyendo "all") y hay resultados
    if (categoryParam) { 
      setProvidersVisibleInPanel(filtered.length > 0);
    } else {
       setProvidersVisibleInPanel(false);
    }
  
    // Ajustar el centro del mapa si no hay un proveedor en ruta y no es una actualizacion por cambio de categoria
    if (mapInstance && !currentHiredProviderId && !categoryParam) {
      mapInstance.setCenter(userLocation);
      mapInstance.setZoom(mapZoom); 
    }
  
  }, [userLocation, categoryParam, isMapApiLoaded, mapInstance, currentHiredProviderId, mapZoom]);


  const handleSearch = () => {
    // Esta función actualmente no se usa activamente ya que la búsqueda se simula
    // o se activa por categorías. Si se reactiva la búsqueda por texto, esta lógica se usaría.
    console.log(`[MapDisplay handleSearch] Called. Term: '${searchTerm}', Category: '${categoryParam}'`);
    if (!userLocation) {
      console.log("[MapDisplay handleSearch] No user location, cannot search.");
      return;
    }

    let filtered = [...mockProviders];
    // ... (lógica de filtrado como antes) ...

    setDisplayedProviders(filtered);
    setProvidersVisibleInPanel(filtered.length > 0);
    console.log(`[MapDisplay handleSearch] Final displayedProviders count: ${filtered.length}, panel visible: ${filtered.length > 0}`);
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
              width={48}
              height={48}
              className="w-12 h-12 rounded-full border-2 border-primary object-cover"
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

  // Panel lateral para resultados de búsqueda/categoría
  // Se muestra si providersVisibleInPanel es true Y no hay un currentHiredProviderId
  const shouldDisplayRightPanel = providersVisibleInPanel && displayedProviders.length > 0 && !currentHiredProviderId;
  console.log(`[MapDisplay RENDER] displayedProviders count: ${displayedProviders.length}, providersVisibleInPanel: ${providersVisibleInPanel}, categoryParam: ${categoryParam}, currentHiredProviderId: ${currentHiredProviderId}, enRoute: ${!!enRouteProviderInfo}, shouldDisplayRightPanel value: ${shouldDisplayRightPanel}`);


  return (
    <div className="h-full w-full relative">
      <div className="absolute inset-0 z-0">
        {renderMapArea()}
      </div>
      
      {enRouteProviderInfo && <EnRouteProviderPanel />}
      
      <BottomSearchContainer /> 
      
      {shouldDisplayRightPanel && (
        <div className="absolute top-0 right-0 h-full w-full md:w-1/3 bg-background/90 backdrop-blur-md shadow-lg z-20 p-4 overflow-y-auto space-y-4 transform transition-transform md:translate-x-0">
           <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-primary">Proveedores Encontrados</h2>
            <Button variant="ghost" size="icon" onClick={() => setProvidersVisibleInPanel(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          {displayedProviders.map(provider => (
            <ProviderPreviewCard key={provider.id} provider={provider} />
          ))}
          {displayedProviders.length === 0 && providersVisibleInPanel && (
            <p className="text-muted-foreground text-center">No se encontraron proveedores para los criterios seleccionados.</p>
          )}
        </div>
      )}
    </div>
  );
}

    