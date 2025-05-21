
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import type { LucideIcon } from 'lucide-react';
import { GoogleMap, MarkerF, useJsApiLoader, PolylineF, InfoWindowF, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { MapPin, WifiOff, Loader2 as LoaderIcon, LocateFixed, Car, Clock, AlertTriangle, X, User, Filter, Star, Search } from 'lucide-react';
import type { Provider, Service } from '@/types';
import { cn } from "@/lib/utils";
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData';
import { SERVICE_CATEGORIES, DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { BottomSearchContainer } from './BottomSearchContainer';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { Input } from '@/components/ui/input';

// TEMPORARY HARDCODE - REMOVE FOR PRODUCTION
const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU";
// console.log('[MapDisplay Module] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY from env:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
// console.log('[MapDisplay Component] Effective googleMapsApiKey value:', googleMapsApiKey);

function lucideIconToDataUri(
  IconComponent: LucideIcon,
  options: { size?: number; color?: string; strokeWidth?: number } = {}
): string {
  const { size = 24, color = '#3F51B5', strokeWidth = 2 } = options; // Using fixed color
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

const mapOptions: google.maps.MapOptions = {
  styles: mapStyles,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControl: false,
  rotateControl: false,
  scaleControl: false,
  clickableIcons: false,
};

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
            fillColor: "hsl(var(--primary))", // Blue color for user
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
            pixelOffset: typeof window !== 'undefined' && window.google && window.google.maps ? new window.google.maps.Size(0, -35) : undefined
          }}
        >
          <div className="p-2 shadow-lg rounded-md bg-background max-w-xs">
            <h4 className="text-md font-semibold text-primary mb-1">{selectedProviderForInfoWindow.name}</h4>
            <div className="text-xs text-muted-foreground mb-1 flex items-center">
              <Star className="h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />
              {selectedProviderForInfoWindow.rating.toFixed(1)}
              <span className="mx-1">·</span>
              <MapPin className="h-3 w-3 mr-1" />
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
  const libraries = useMemo(() => ['places'] as ("places")[]) , []);
  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "", // Fallback to empty string if undefined
    libraries,
    id: 'google-map-script-servimap'
  });

  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(USER_FIXED_LOCATION);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(13); 
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
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
    // console.log("[MapDisplay] Map instance loaded:", map);
    setMapInstance(map);
    map.setCenter(mapCenter); // Ensure map centers on load
    map.setZoom(mapZoom);
  }, [mapCenter, mapZoom]);

  const onMapUnmountCallback = useCallback(() => {
    // console.log("[MapDisplay] Map instance unmounted.");
    setMapInstance(null);
    setDirectionsResponse(null);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];
  }, []);

  const updateDisplayedProviders = useCallback(() => {
    // console.log(`[MapDisplay updateDisplayedProviders] Called. UserLocation: ${!!userLocation}, CategoryParam: ${categoryParam}, SearchTerm: ${currentSearchTerm}`);
    if (!userLocation) {
      setDisplayedProviders([]);
      // setProvidersVisibleInPanel(false); // Panel visibility is now handled by search/filter actions
      // console.log("[MapDisplay updateDisplayedProviders] No user location, clearing providers.");
      return;
    }

    let filtered = [...mockProviders];
    // console.log(`[MapDisplay updateDisplayedProviders] Initial mockProviders count: ${filtered.length}`);

    // 1. Filter by distance (within 20km)
    filtered = filtered.filter(provider => {
      if (provider.location) {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
        return distance <= 20;
      }
      return false;
    });
    // console.log(`[MapDisplay updateDisplayedProviders] Providers after distance filter: ${filtered.length}`);

    // 2. Filter by category (if categoryParam exists and not 'all')
    const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
    if (isActiveCategoryFilter) {
      filtered = filtered.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
      // console.log(`[MapDisplay updateDisplayedProviders] Providers after category filter ('${categoryParam}'): ${filtered.length}`);
    }
    
    // 3. Filter by search term (if currentSearchTerm exists)
    if (currentSearchTerm && currentSearchTerm.trim() !== '') {
      const searchTermLower = currentSearchTerm.toLowerCase().trim();
      // console.log(`[MapDisplay updateDisplayedProviders] Applying search term filter: '${searchTermLower}'. Providers before text search: ${filtered.length}`);
      
      filtered = filtered.filter(provider => {
        const nameMatch = provider.name.toLowerCase().includes(searchTermLower);
        const specialtyMatch = provider.specialties?.some(spec => spec.toLowerCase().includes(searchTermLower));
        
        const serviceMatch = provider.services.some(service => {
          const titleMatch = service.title.toLowerCase().includes(searchTermLower);
          const descriptionMatch = service.description.toLowerCase().includes(searchTermLower);
          const categoryDetails = SERVICE_CATEGORIES.find(cat => cat.id === service.category);
          const categoryNameMatch = categoryDetails?.name.toLowerCase().includes(searchTermLower);
          const categoryKeywordsMatch = categoryDetails?.keywords.some(keyword => keyword.toLowerCase().includes(searchTermLower));
          
          // console.log(`[MapDisplay updateDisplayedProviders] - Provider: ${provider.name}, Service: ${service.title}, searchTerm: ${searchTermLower}`);
          // console.log(`    titleMatch: ${titleMatch}, descriptionMatch: ${descriptionMatch}, categoryNameMatch: ${categoryNameMatch}, categoryKeywordsMatch: ${categoryKeywordsMatch}`);

          return titleMatch || descriptionMatch || categoryNameMatch || categoryKeywordsMatch;
        });
        
        // console.log(`[MapDisplay updateDisplayedProviders] Provider: ${provider.name} - nameMatch: ${nameMatch}, specialtyMatch: ${specialtyMatch}, serviceMatch: ${serviceMatch}`);
        return nameMatch || specialtyMatch || serviceMatch;
      });
      // console.log(`[MapDisplay updateDisplayedProviders] Providers after search term filter ('${currentSearchTerm}'): ${filtered.length}`);
    } else {
        // console.log(`[MapDisplay updateDisplayedProviders] No search term or empty search term. Skipping text filter. Providers count: ${filtered.length}`);
    }

    // 4. Prioritize Active vs. Inactive
    const activeProviders = filtered.filter(p => p.isAvailable);
    const inactiveProviders = filtered.filter(p => !p.isAvailable);
    
    let finalProviders: Provider[];
    if (activeProviders.length > 0) {
      finalProviders = activeProviders;
    } else {
      finalProviders = inactiveProviders;
    }
    
    // 5. Sort by rating
    finalProviders.sort((a, b) => b.rating - a.rating);

    // console.log(`[MapDisplay updateDisplayedProviders] Final providers to display: ${finalProviders.length}`, finalProviders.map(p => p.name));
    setDisplayedProviders(finalProviders);
    // Panel visibility is set by handleSearch or category useEffect
    
  }, [userLocation, categoryParam, currentSearchTerm]);

  // Effect for initial load and category changes
  useEffect(() => {
    // console.log(`[MapDisplay category-useEffect] Triggered. CategoryParam: ${categoryParam}, UserLocation: ${!!userLocation}`);
    if (userLocation) { // Ensure userLocation is available
      updateDisplayedProviders();
      if (categoryParam) { // If a category filter is active (including "all")
        // console.log(`[MapDisplay category-useEffect] CategoryParam is active: '${categoryParam}'. Setting panel visibility based on results.`);
        // Note: updateDisplayedProviders itself doesn't set panel visibility. We rely on its side effect on displayedProviders.
        // The actual setProvidersVisibleInPanel will happen in handleSearch or if we add it here.
        // For now, let's make it visible if a category is explicitly selected and there are providers.
        const tempFiltered = mockProviders.filter(p => {
            if (p.location) {
                const distance = calculateDistance(userLocation.lat, userLocation.lng, p.location.lat, p.location.lng);
                if (distance > 20) return false;
            } else { return false; }
            if (categoryParam && categoryParam !== 'all') {
                return p.services.some(s => s.category === categoryParam);
            }
            return true; // "all" or no category means pass this stage
        });
        setProvidersVisibleInPanel(tempFiltered.length > 0);

      } else {
        // console.log("[MapDisplay category-useEffect] No categoryParam. Ensuring panel is hidden initially.");
        // setProvidersVisibleInPanel(false); // Panel stays hidden if no category is selected initially
      }
    }
  }, [userLocation, categoryParam, updateDisplayedProviders]);


  // Effect for hired provider (en-route simulation)
  useEffect(() => {
    // console.log(`[MapDisplay hiredProvider-useEffect] Triggered. CurrentHiredProviderId: ${currentHiredProviderId}, MapLoaded: ${isMapApiLoaded}, MapInstance: ${!!mapInstance}, UserLocation: ${!!userLocation}`);
    
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];
    setDirectionsResponse(null); // Clear previous route

    if (!currentHiredProviderId) { 
      // console.log("[MapDisplay hiredProvider-useEffect] No hired provider. Clearing enRouteInfo and ensuring panel visibility logic runs.");
      setEnRouteProviderInfo(null);
      // If we cleared a hired provider, re-evaluate displayed providers based on current filters
      // updateDisplayedProviders(); // This might be redundant if category/search useEffects also run
      return;
    }
    
    if (currentHiredProviderId && isMapApiLoaded && mapInstance && userLocation) {
      // console.log(`[MapDisplay hiredProvider-useEffect] Conditions met. Processing hired provider ID: ${currentHiredProviderId}`);
      const providerInRoute = mockProviders.find(p => p.id === currentHiredProviderId);

      if (providerInRoute && providerInRoute.location) {
        // console.log(`[MapDisplay hiredProvider-useEffect] Found providerInRoute:`, providerInRoute.name);
        setEnRouteProviderInfo({
          provider: providerInRoute,
          currentLocation: providerInRoute.location, 
          status: "En camino",
          eta: "Calculando...",
          route: null, 
        });
        
        setProvidersVisibleInPanel(false); // Hide search results panel when tracking a provider

        if (typeof window !== 'undefined' && window.google && window.google.maps) {
            const directionsService = new window.google.maps.DirectionsService();
            // console.log(`[MapDisplay hiredProvider-useEffect] Requesting directions from:`, providerInRoute.location, `to:`, userLocation);
            directionsService.route(
              {
                origin: providerInRoute.location,
                destination: userLocation,
                travelMode: window.google.maps.TravelMode.DRIVING,
              },
              (result, status) => {
                // console.log(`[MapDisplay hiredProvider-useEffect] DirectionsService callback. Status: ${status}`, result);
                if (status === window.google.maps.DirectionsStatus.OK && result) {
                  setDirectionsResponse(result);
                  const route = result.routes[0];
                  if (route && route.legs[0] && route.legs[0].duration) {
                    const etaText = route.legs[0].duration.text;
                    // console.log(`[MapDisplay hiredProvider-useEffect] Route found. ETA: ${etaText}`);
                    setEnRouteProviderInfo(prev => prev ? {...prev, eta: etaText, route } : null);
                    if (mapInstance && route.bounds) {
                      mapInstance.fitBounds(route.bounds);
                    }
                    simulateProviderMovement(route, providerInRoute, userLocation, mapInstance);
                  } else {
                    // console.warn("[MapDisplay hiredProvider-useEffect] Route found but no duration/legs.");
                    setEnRouteProviderInfo(prev => prev ? {...prev, eta: "ETA no disp." } : null);
                  }
                } else {
                  // console.error(`[MapDisplay hiredProvider-useEffect] Directions error: ${status}`);
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
      } else {
        // console.warn(`[MapDisplay hiredProvider-useEffect] Hired provider with ID ${currentHiredProviderId} not found or has no location.`);
      }
    }
    return () => {
      simulationTimeoutIds.current.forEach(clearTimeout);
      simulationTimeoutIds.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHiredProviderId, isMapApiLoaded, mapInstance, userLocation]); // Removed simulateProviderMovement, mapZoom, updateDisplayedProviders from deps for stability

  const simulateProviderMovement = useCallback((
    route: google.maps.DirectionsRoute, 
    provider: Provider,
    destination: google.maps.LatLngLiteral,
    currentMapInstance: google.maps.Map | null
    ) => {
    // console.log(`[MapDisplay] simulateProviderMovement started for route:`, route);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];

    if (!route.legs || !route.legs[0] || !route.legs[0].steps) {
      // console.warn("[MapDisplay simulateProviderMovement] No route legs or steps to simulate.");
      const arrivalTimeout = setTimeout(() => {
        setEnRouteProviderInfo(prev => prev ? { ...prev, currentLocation: destination, status: "Ha llegado", eta: "0 min" } : null);
        if (currentMapInstance) { currentMapInstance.panTo(destination); currentMapInstance.setZoom(17); }
      }, 5000); 
      simulationTimeoutIds.current.push(arrivalTimeout);
      return;
    }

    const steps = route.legs[0].steps;
    let cumulativeDelay = 0;
    const totalOriginalDurationSeconds = route.legs[0].duration?.value || steps.length * 20; // Default 20s per step if no duration
    const totalSimulationDurationMs = Math.max(10000, Math.min(20000, totalOriginalDurationSeconds * 100)); // Simulate faster: 10% of real time, min 10s, max 20s
    
    // console.log(`[MapDisplay simulateProviderMovement] Total original duration: ${totalOriginalDurationSeconds}s, Simulating over: ${totalSimulationDurationMs}ms, Steps: ${steps.length}`);

    steps.forEach((step, index) => {
      const stepProportion = (step.duration?.value || totalOriginalDurationSeconds / steps.length) / totalOriginalDurationSeconds;
      const stepSimulationTimeMs = stepProportion * totalSimulationDurationMs;
      cumulativeDelay += stepSimulationTimeMs;

      const timeoutId = setTimeout(() => {
        let newLocation: google.maps.LatLngLiteral;
        if (typeof step.end_location.lat === 'function' && typeof step.end_location.lng === 'function') {
          newLocation = { lat: step.end_location.lat(), lng: step.end_location.lng() };
        } else {
          newLocation = step.end_location as google.maps.LatLngLiteral;
        }
        
        let remainingOriginalSecondsInSimulation = 0;
        for(let i = index + 1; i < steps.length; i++) {
          remainingOriginalSecondsInSimulation += (route.legs[0].steps[i].duration?.value || (totalOriginalDurationSeconds / steps.length) );
        }
        const remainingMinutes = Math.max(0,Math.ceil(remainingOriginalSecondsInSimulation / 60)); // ETA based on original remaining duration
        const newEta = remainingMinutes > 0 ? `${remainingMinutes} min` : "Casi llega";
        
        // console.log(`[MapDisplay simulateProviderMovement] Simulating step ${index + 1}/${steps.length}: Moving to`, newLocation, `New ETA: ${newEta}`);
        setEnRouteProviderInfo(prev => {
          if (!prev) return null;
          return { ...prev, currentLocation: newLocation, eta: newEta };
        });

        if (currentMapInstance) {
          currentMapInstance.panTo(newLocation);
        }

        if (index === steps.length - 1) { 
          // console.log("[MapDisplay simulateProviderMovement] Simulation: Provider arrived at destination.");
          setEnRouteProviderInfo(prev => {
            if (!prev) return null;
            return { ...prev, currentLocation: destination, status: "Ha llegado", eta: "0 min" };
          });
          if (currentMapInstance) {
            currentMapInstance.panTo(destination);
            currentMapInstance.setZoom(17); 
          }
        }
      }, cumulativeDelay - stepSimulationTimeMs); // Apply timeout relative to the start of this step
      simulationTimeoutIds.current.push(timeoutId);
    });
  }, []);


  const handleSearchFromBottomBar = useCallback((term: string) => {
    // console.log(`[MapDisplay handleSearchFromBottomBar] Search term received: '${term}'`);
    setCurrentSearchTerm(term);
    updateDisplayedProviders(); // This will apply all filters including the new search term
    // Make panel visible if search yields results
    // The visibility is handled by updateDisplayedProviders setting displayedProviders,
    // and then checking displayedProviders.length > 0
    const tempFiltered = mockProviders.filter(p => {
        if(!userLocation) return false;
        if (p.location) {
            const distance = calculateDistance(userLocation.lat, userLocation.lng, p.location.lat, p.location.lng);
            if (distance > 20) return false;
        } else { return false; }
        
        if (categoryParam && categoryParam !== 'all') {
            if (!p.services.some(s => s.category === categoryParam)) return false;
        }

        if (term && term.trim() !== '') {
            const searchTermLower = term.toLowerCase().trim();
            const nameMatch = p.name.toLowerCase().includes(searchTermLower);
            const specialtyMatch = p.specialties?.some(spec => spec.toLowerCase().includes(searchTermLower));
            const serviceMatch = p.services.some(service => {
              const titleMatch = service.title.toLowerCase().includes(searchTermLower);
              const descriptionMatch = service.description.toLowerCase().includes(searchTermLower);
              const categoryDetails = SERVICE_CATEGORIES.find(cat => cat.id === service.category);
              const categoryNameMatch = categoryDetails?.name.toLowerCase().includes(searchTermLower);
              const categoryKeywordsMatch = categoryDetails?.keywords.some(keyword => keyword.toLowerCase().includes(searchTermLower));
              return titleMatch || descriptionMatch || categoryNameMatch || categoryKeywordsMatch;
            });
            if (!(nameMatch || specialtyMatch || serviceMatch)) return false;
        }
        return true;
    });
    // console.log(`[MapDisplay handleSearchFromBottomBar] Filtered for panel visibility: ${tempFiltered.length}`);
    setProvidersVisibleInPanel(tempFiltered.length > 0);

  }, [updateDisplayedProviders, userLocation, categoryParam]);

  const renderMapArea = () => {
    // console.log(`[MapDisplay renderMapArea] isMapApiLoaded: ${isMapApiLoaded}, mapApiLoadError: ${mapApiLoadError}`);
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
      // console.error("[MapDisplay renderMapArea] Google Maps API load error:", mapApiLoadError);
       return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <WifiOff className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Error Cargando Google Maps</p>
          <p className="text-sm text-center">Error al cargar la API. Revisa la consola para más detalles.</p>
          {/* <p className="text-xs mt-2">Error: {mapApiLoadError.message}</p> */}
        </div>
      );
    }

    if (!isMapApiLoaded) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-primary p-4 bg-background/80 backdrop-blur-sm">
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
                preserveViewport: true, // Let mapInstance.fitBounds handle viewport
                 polylineOptions: {
                  strokeColor: "hsl(var(--accent))", 
                  strokeOpacity: 0.8,
                  strokeWeight: 6,
                }
              }} 
            />
        )}
        {enRouteProviderInfo?.currentLocation && ( // Always show enRouteProvider if info exists
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
    
    let IconComponent = Car; // Default icon
    if (providerCategory && providerCategory.icon) {
        IconComponent = providerCategory.icon;
    }


    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-auto max-w-sm z-30 bg-background/90 backdrop-blur-sm shadow-xl rounded-lg p-3">
        <div className="flex items-center gap-3 mb-2">
          <Image 
              src={provider.avatarUrl || DEFAULT_USER_AVATAR} 
              alt={provider.name} 
              width={24} // Smaller avatar
              height={24}
              className="rounded-full border-2 border-primary object-cover"
              data-ai-hint={provider.dataAiHint || "provider avatar"}
              style={{objectFit: "cover"}}
          />
          <div>
            <h3 className="text-sm font-semibold text-primary">{provider.name}</h3>
            <p className="text-xs text-muted-foreground">{providerCategory?.name || "Servicio Contratado"}</p>
          </div>
           <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-destructive h-7 w-7" onClick={() => router.push('/')}>
              <X className="h-4 w-4" />
              <span className="sr-only">Cancelar Seguimiento</span>
          </Button>
        </div>
        <div className="text-center">
          {status === "En camino" ? (
            <>
              <div className="flex items-center justify-center gap-1 text-xs font-medium text-foreground mb-0.5">
                <IconComponent className="w-3.5 h-3.5 text-primary" />
                <span>{status}</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-md font-bold text-accent">
                <Clock className="w-4 h-4" />
                <span>Llega en {eta}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-1 text-sm font-bold text-green-600">
              <IconComponent className="w-4 h-4" />
              <span>¡{provider.name} ha llegado!</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const shouldDisplayRightPanel = providersVisibleInPanel && displayedProviders.length > 0 && !currentHiredProviderId;
  // console.log(`[MapDisplay RENDER] displayedProviders count: ${displayedProviders.length}, providersVisibleInPanel: ${providersVisibleInPanel}, categoryParam: ${categoryParam}, currentSearchTerm: ${currentSearchTerm}, currentHiredProviderId: ${currentHiredProviderId}, enRoute: ${!!enRouteProviderInfo}, shouldDisplayRightPanel: ${shouldDisplayRightPanel}`);

  return (
    <div className="h-full w-full relative">
      <div className={cn("absolute inset-0 z-0")}>
        {renderMapArea()}
      </div>
      
      {/* Show BottomSearchContainer always, unless a provider is en-route. Re-enabled for continuous use. */}
      {!enRouteProviderInfo && <BottomSearchContainer onSearch={handleSearchFromBottomBar} />}
      
      {enRouteProviderInfo && <EnRouteProviderPanel />}

      {shouldDisplayRightPanel && (
         <div className="absolute top-0 right-0 h-full w-full md:w-1/3 lg:w-1/4 p-4 z-20 bg-background/80 shadow-lg overflow-y-auto space-y-4 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold text-primary">
                    {categoryParam && categoryParam !== 'all' 
                        ? `${SERVICE_CATEGORIES.find(c => c.id === categoryParam)?.name || 'Resultados'}`
                        : 'Proveedores Cercanos'}
                    {currentSearchTerm && ` ("${currentSearchTerm}")`}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setProvidersVisibleInPanel(false)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-5 w-5" />
                </Button>
            </div>
            {displayedProviders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No se encontraron proveedores con estos criterios.</p>
            ) : (
                displayedProviders.map(provider => (
                    <ProviderPreviewCard key={provider.id} provider={provider} />
                ))
            )}
        </div>
      )}
    </div>
  );
}

