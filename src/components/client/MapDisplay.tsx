
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import type { LucideIcon } from 'lucide-react';
import { GoogleMap, MarkerF, useJsApiLoader, PolylineF, InfoWindowF } from '@react-google-maps/api';
// import { DirectionsService, DirectionsRenderer } from '@react-google-maps/api'; // Temporarily commented
import { Button } from '@/components/ui/button';
import { WifiOff, Loader2 as LoaderIcon, Car, Clock, AlertTriangle, X, Star, Search, MapPin, Wrench, Zap, Sparkles, BookOpen, Flower2, Palette, Hammer, Briefcase, Cog, Baby, Stethoscope, HeartPulse } from 'lucide-react';
import type { Provider, Service } from '@/types';
import { cn } from "@/lib/utils";
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData';
import { SERVICE_CATEGORIES, DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { BottomSearchContainer } from './BottomSearchContainer';
import { Input } from '@/components/ui/input';

// Temporarily hardcode API key for debugging
const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; 
// console.log('[MapDisplay Component] Hardcoded googleMapsApiKey value:', googleMapsApiKey);

// Function to convert Lucide icons to SVG Data URIs
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
    // console.log(`[MapDisplay] SVG string for ${IconComponent.displayName || (IconComponent as any).name || 'icon'}: ${svgString.substring(0,100)}`);
    const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;
    // console.log(`[MapDisplay] Generated iconDataUri for ${IconComponent.displayName || (IconComponent as any).name || 'icon'} (first 100 chars): ${dataUri.substring(0,100)}`);
    return dataUri;
  } catch (error) {
    console.error(`[MapDisplay lucideIconToDataUri] Error rendering Lucide icon to SVG string for ${IconComponent?.displayName || (IconComponent as any)?.name || 'icon'}:`, error, IconComponent);
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
  { elementType: "geometry", stylers: [{ color: "#f0f2f5" }] }, // Adjusted to light gray background
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
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] }, // Adjusted water color
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
  clickableIcons: false, // This was already set to false
};

interface EnRouteProviderInfo {
  provider: Provider;
  currentLocation: google.maps.LatLngLiteral;
  status: "En camino" | "Ha llegado";
  eta: string;
  route: google.maps.DirectionsRoute | null; // To store the actual route for polyline
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
  // directionsResponse, // This was for the DirectionsRenderer component which we simplified
  enRouteProviderInfo
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
  // directionsResponse: google.maps.DirectionsResult | null; // Simplified
  enRouteProviderInfo: EnRouteProviderInfo | null;
}) => {
  // console.log("[MapDisplay MapContentComponent] Rendering. Selected provider for InfoWindow:", selectedProviderForInfoWindow?.name);
  // console.log("[MapDisplay MapContentComponent] enRouteProviderInfo:", enRouteProviderInfo);
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
            fillColor: "hsl(var(--primary))", // Blue from theme
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
          }}
          zIndex={10}
        />
      )}
      {providersToDisplayOnMap.map(provider => {
        if (!provider.location) return null;
        // Do not render a regular marker if this provider is the one currently en-route
        if (enRouteProviderInfo && enRouteProviderInfo.provider.id === provider.id) {
          return null;
        }

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
              } else {
                // console.warn(`[MapDisplay] lucideIconToDataUri returned empty for ${serviceCategory.id}`);
              }
            } catch (e) {
               console.error(`[MapDisplay] Error calling lucideIconToDataUri for ${serviceCategory.id} (${serviceCategory.name}):`, e, serviceCategory.icon);
            }
          }
        }
        
        let markerIcon: google.maps.Icon | string | google.maps.Symbol | undefined = undefined;
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
        } else if (iconDataUri) {
          // console.warn("[MapDisplay] iconDataUri present, but window.google.maps not fully available for Size/Point.");
        }
        
        return (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={provider.name}
            icon={markerIcon}
            onClick={() => onMarkerClick(provider)}
            // Do not show if this provider is en-route (covered by a separate marker)
            visible={!(enRouteProviderInfo && enRouteProviderInfo.provider.id === provider.id)}
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
      
      {/* START: Simplified EnRoute Logic - No DirectionsRenderer */}
      {enRouteProviderInfo?.route && enRouteProviderInfo.route.overview_polyline && (
        <PolylineF
          path={google.maps.geometry.encoding.decodePath(enRouteProviderInfo.route.overview_polyline as string)}
          options={{
            strokeColor: "hsl(var(--accent))",
            strokeOpacity: 0.8,
            strokeWeight: 6,
            zIndex: 1, // Ensure polyline is below the enRoute marker
          }}
        />
      )}
      {enRouteProviderInfo?.currentLocation && (
          <MarkerF
            key={enRouteProviderInfo.provider.id + "-route"} // Unique key
            position={enRouteProviderInfo.currentLocation}
            title={enRouteProviderInfo.provider.name + (enRouteProviderInfo.status === "En camino" ? " (En camino)" : " (Ha llegado)")}
            icon={ typeof window !== 'undefined' && window.google && window.google.maps ? { 
              path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, 
              scale: 5,
              strokeColor: "hsl(var(--accent))", // Green from theme
              fillColor: "hsl(var(--accent))",
              fillOpacity: 1,
            } : undefined}
            zIndex={typeof window !== 'undefined' && window.google && window.google.maps ? window.google.maps.Marker.MAX_ZINDEX + 1 : undefined} // Ensure it's on top
          />
      )}
      {/* END: Simplified EnRoute Logic */}
      {children}
    </GoogleMap>
  );
});
MapContentComponent.displayName = 'MapContentComponent';


export function MapDisplay() {
  // Corrected useMemo syntax as per user's instruction
  const libraries = useMemo(() => ['places', 'geometry'] as ("places" | "geometry")[], []);
  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "", 
    libraries,
    id: 'google-map-script-servimap'
  });

  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(USER_FIXED_LOCATION);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(13); 
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>(mockProviders); 
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false);
  
  const categoryIconCache = useRef(new Map<string, string>());

  const searchParams = useSearchParams();
  const router = useRouter();
  
  const categoryParam = useMemo(() => searchParams.get('category'), [searchParams]);
  const currentHiredProviderId = useMemo(() => searchParams.get('hiredProviderId'), [searchParams]);
  
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');

  const [enRouteProviderInfo, setEnRouteProviderInfo] = useState<EnRouteProviderInfo | null>(null);
  // const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null); // From original complex Directions
  const simulationTimeoutIds = useRef<NodeJS.Timeout[]>([]);

  const [selectedProviderForInfoWindow, setSelectedProviderForInfoWindow] = useState<Provider | null>(null);

  const onMapLoadCallback = useCallback((map: google.maps.Map) => {
    // console.log("[MapDisplay] Map loaded successfully. Instance:", map);
    setMapInstance(map);
    map.setCenter(mapCenter); 
    map.setZoom(mapZoom);
  }, [mapCenter, mapZoom]);

  const onMapUnmountCallback = useCallback(() => {
    // console.log("[MapDisplay] Map unmounted.");
    setMapInstance(null);
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];
  }, []);


 const updateDisplayedProviders = useCallback(() => {
    // console.log(`[MapDisplay updateDisplayedProviders] Called. UserLocation: ${!!userLocation}, CategoryParam: ${categoryParam}, SearchTerm: ${currentSearchTerm}`);
    if (!userLocation) {
      // console.log("[MapDisplay updateDisplayedProviders] No user location, clearing providers.");
      setDisplayedProviders([]);
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
    
    const isActiveCategoryFilter = categoryParam && categoryParam !== 'all' && categoryParam !== '';
    if (isActiveCategoryFilter) {
      // console.log(`[MapDisplay updateDisplayedProviders] Applying category filter: '${categoryParam}'`);
      filtered = filtered.filter(provider =>
        provider.services.some(service => service.category === categoryParam)
      );
      // console.log(`[MapDisplay updateDisplayedProviders] Providers after category filter ('${categoryParam}'): ${filtered.length}`);
    }
    
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
          // Reverted: No longer filtering by keywords array, ensure categoryDetails exists
          // const categoryKeywordsMatch = categoryDetails?.keywords?.some(keyword => keyword.toLowerCase().includes(searchTermLower));
          
          return titleMatch || descriptionMatch || categoryNameMatch; // Removed categoryKeywordsMatch
        });
        
        return nameMatch || specialtyMatch || serviceMatch;
      });
      // console.log(`[MapDisplay updateDisplayedProviders] Providers after search term filter ('${currentSearchTerm}'): ${filtered.length}`);
    }
    
    let activeProviders = filtered.filter(p => p.isAvailable);
    let inactiveProviders = filtered.filter(p => !p.isAvailable);

    let finalProviders: Provider[];
    if (activeProviders.length > 0) {
        // console.log("[MapDisplay updateDisplayedProviders] Prioritizing active providers.");
        finalProviders = activeProviders;
    } else {
        // console.log("[MapDisplay updateDisplayedProviders] No active providers found, showing inactive ones.");
        finalProviders = inactiveProviders; 
    }
    
    finalProviders.sort((a, b) => b.rating - a.rating);

    // console.log(`[MapDisplay updateDisplayedProviders] Final providers to display (${finalProviders.length}):`, finalProviders.map(p => p.name));
    setDisplayedProviders(finalProviders);
    // setProvidersVisibleInPanel(finalProviders.length > 0 && (!!categoryParam || !!currentSearchTerm.trim()));
    
  }, [userLocation, categoryParam, currentSearchTerm]);

  // Effect for initial load and category changes
  useEffect(() => {
    // console.log(`[MapDisplay category/search-useEffect] Triggered. UserLocation: ${!!userLocation}, Category: ${categoryParam}, Search: ${currentSearchTerm}, HiredID: ${currentHiredProviderId}`);
    if (userLocation && !currentHiredProviderId) { 
      updateDisplayedProviders();
      // Show panel if a category is selected and results are found
      if (categoryParam) { // This includes "all"
         const hasResults = mockProviders.filter(p => {
            if (!p.location || calculateDistance(userLocation.lat, userLocation.lng, p.location.lat, p.location.lng) > 20) return false;
            if (categoryParam !== 'all' && !p.services.some(s => s.category === categoryParam)) return false;
            return true;
         }).length > 0;
         // console.log(`[MapDisplay category-useEffect] Category '${categoryParam}' selected. Has results: ${hasResults}. Setting panel visibility.`);
         setProvidersVisibleInPanel(hasResults);
      } else {
         // If no category is selected (e.g. initial load, or URL cleared), panel visibility controlled by search
         // console.log("[MapDisplay category-useEffect] No category selected. Panel visibility depends on search.");
         // setProvidersVisibleInPanel(false); // Let handleSearch control this
      }
    } else if (!currentHiredProviderId) {
      // console.log("[MapDisplay category-useEffect] No user location or hired provider, clearing displayed providers.");
      setDisplayedProviders([]);
      setProvidersVisibleInPanel(false);
    }
  }, [userLocation, categoryParam, currentHiredProviderId, updateDisplayedProviders]);


  // Effect for hired provider (simulates route and arrival)
  useEffect(() => {
    // console.log(`[MapDisplay hiredProvider-useEffect] Triggered. CurrentHiredProviderId: ${currentHiredProviderId}, MapLoaded: ${isMapApiLoaded}, MapInstance: ${!!mapInstance}, UserLocation: ${!!userLocation}`);
    
    simulationTimeoutIds.current.forEach(clearTimeout);
    simulationTimeoutIds.current = [];

    if (!currentHiredProviderId) { 
      // console.log("[MapDisplay hiredProvider-useEffect] No hired provider. Clearing enRouteInfo.");
      setEnRouteProviderInfo(null);
      // If we just cleared a hired provider, re-run the normal provider display logic
      // updateDisplayedProviders(); // This might be redundant if category/search useEffect also runs
      return;
    }
    
    if (isMapApiLoaded && mapInstance && userLocation) {
      const providerInRoute = mockProviders.find(p => p.id === currentHiredProviderId);

      if (providerInRoute && providerInRoute.location) {
        // console.log(`[MapDisplay hiredProvider-useEffect] Initiating simulation for ${providerInRoute.name}`);
        setProvidersVisibleInPanel(false); // Hide search results panel when tracking
        setSelectedProviderForInfoWindow(null); // Close any open info windows

        // Simplified simulation as DirectionsService and Renderer are commented out
        // For a real app, here you would call DirectionsService
        const simplifiedEta = "10-15 min (sim.)"; 
        const mockRoute = { // Create a mock route object for the simplified polyline
            overview_polyline: google.maps.geometry.encoding.encodePath([
                new google.maps.LatLng(providerInRoute.location.lat, providerInRoute.location.lng),
                new google.maps.LatLng(userLocation.lat, userLocation.lng)
            ]),
            // Add other necessary fields if PolylineF or other components expect them
        } as google.maps.DirectionsRoute;

        setEnRouteProviderInfo({
          provider: providerInRoute,
          currentLocation: providerInRoute.location,
          status: "En camino",
          eta: simplifiedEta,
          route: mockRoute, // Provide a simplified route for the polyline
        });

        if (mapInstance && providerInRoute.location && userLocation) {
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(providerInRoute.location);
            bounds.extend(userLocation);
            mapInstance.fitBounds(bounds);
        }
        
        const arrivalTimeoutId = setTimeout(() => {
            // console.log(`[MapDisplay hiredProvider-useEffect] Simplified simulation: ${providerInRoute.name} has arrived.`);
            setEnRouteProviderInfo(prev => prev ? { ...prev, currentLocation: userLocation, status: "Ha llegado", eta: "0 min" } : null);
            if(mapInstance) {
                mapInstance.panTo(userLocation);
                mapInstance.setZoom(17); // Zoom in on arrival
            }
        }, 15000); // Simulate arrival in 15 seconds
        simulationTimeoutIds.current.push(arrivalTimeoutId);

      } else {
        // console.warn(`[MapDisplay hiredProvider-useEffect] Hired provider with ID ${currentHiredProviderId} not found or has no location.`);
      }
    } else {
      // console.log("[MapDisplay hiredProvider-useEffect] Conditions not met for simulation:", {isMapApiLoaded, mapInstance: !!mapInstance, userLocation: !!userLocation});
    }
    return () => {
      simulationTimeoutIds.current.forEach(clearTimeout);
      simulationTimeoutIds.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [currentHiredProviderId, isMapApiLoaded, mapInstance, userLocation /*Removed updateDisplayedProviders as it might cause loop */]);


  const handleSearchFromBottomBar = useCallback((term: string) => {
    // console.log(`[MapDisplay handleSearchFromBottomBar] Search term received: '${term}'`);
    setCurrentSearchTerm(term);
    // The useEffect reacting to currentSearchTerm will call updateDisplayedProviders
    // and handle panel visibility based on results.
    // We need to explicitly set the panel visible if search term yields results
    if (term.trim() !== '') {
        updateDisplayedProviders(); // This should now also filter by text
        const results = mockProviders.filter(provider => {
            if (!provider.location || calculateDistance(userLocation!.lat, userLocation!.lng, provider.location.lat, provider.location.lng) > 20) return false;
            if (categoryParam && categoryParam !== 'all' && !provider.services.some(s => s.category === categoryParam)) return false;
            
            const searchTermLower = term.toLowerCase().trim();
            const nameMatch = provider.name.toLowerCase().includes(searchTermLower);
            const specialtyMatch = provider.specialties?.some(spec => spec.toLowerCase().includes(searchTermLower));
            const serviceMatch = provider.services.some(service => {
                const titleMatch = service.title.toLowerCase().includes(searchTermLower);
                const descriptionMatch = service.description.toLowerCase().includes(searchTermLower);
                const categoryDetails = SERVICE_CATEGORIES.find(cat => cat.id === service.category);
                const categoryNameMatch = categoryDetails?.name.toLowerCase().includes(searchTermLower);
                return titleMatch || descriptionMatch || categoryNameMatch;
            });
            return nameMatch || specialtyMatch || serviceMatch;
        });
        // console.log(`[MapDisplay handleSearchFromBottomBar] Search for '${term}' found ${results.length} providers. Setting panel visibility.`);
        setProvidersVisibleInPanel(results.length > 0);
    } else {
        // If search term is cleared, behavior depends on categoryParam
        if (categoryParam && categoryParam !== 'all') {
            // console.log(`[MapDisplay handleSearchFromBottomBar] Search cleared, category '${categoryParam}' active. Updating display.`);
            updateDisplayedProviders(); // Re-filter by category
            // Visibility will be handled by the useEffect for categoryParam
        } else {
            // console.log(`[MapDisplay handleSearchFromBottomBar] Search cleared, no category. Hiding panel.`);
            setDisplayedProviders(mockProviders.filter(p => p.location && calculateDistance(userLocation!.lat, userLocation!.lng, p.location.lat, p.location.lng) <= 20)); // Show all nearby
            setProvidersVisibleInPanel(false); // Hide panel if search is cleared and no category
        }
    }

  }, [updateDisplayedProviders, userLocation, categoryParam]); // Added userLocation and categoryParam dependencies

  const renderMapArea = () => {
    // console.log(`[MapDisplay renderMapArea] isMapApiLoaded: ${isMapApiLoaded}, mapApiLoadError: ${mapApiLoadError}, userLocation: ${!!userLocation}`);
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
          <p className="text-sm text-center">Hubo un problema al cargar la API de Google Maps. Revisa la consola del navegador y la configuración de tu API Key.</p>
          {/* <p className="text-xs text-center mt-1">Error: {mapApiLoadError.message}</p> */}
        </div>
      );
    }

    if (!isMapApiLoaded || !userLocation) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-primary p-4 bg-background/80 backdrop-blur-sm">
          <LoaderIcon className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-semibold">Cargando Mapa y Ubicación...</p>
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
        // directionsResponse={null} // Simplified, no DirectionsRenderer for now
        enRouteProviderInfo={enRouteProviderInfo}
      />
    );
  };
  
  const EnRouteProviderPanel = () => {
    if (!enRouteProviderInfo || !enRouteProviderInfo.provider) return null;
    const { provider, status, eta } = enRouteProviderInfo;
    const providerCategory = SERVICE_CATEGORIES.find(c => c.id === provider.services[0]?.category);
    
    let IconComponent = Car; 
    if (providerCategory && providerCategory.icon) {
        IconComponent = providerCategory.icon;
    }

    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-auto max-w-[calc(100%-2rem)] sm:max-w-sm z-30 bg-background/90 backdrop-blur-sm shadow-xl rounded-lg p-3">
        <div className="flex items-center gap-3 mb-2">
          <Image 
              src={provider.avatarUrl || DEFAULT_USER_AVATAR} 
              alt={provider.name} 
              width={20} // Smaller avatar
              height={20}
              className="rounded-full border-2 border-primary object-cover"
              data-ai-hint={provider.dataAiHint || "provider avatar"}
              style={{objectFit: "cover"}}
          />
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-primary truncate max-w-[150px] sm:max-w-none">{provider.name}</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{providerCategory?.name || "Servicio Contratado"}</p>
          </div>
           <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-destructive h-6 w-6 sm:h-7 sm:w-7" 
             onClick={() => {
              // console.log("[MapDisplay EnRouteProviderPanel] Closing/Cancelling route.");
              setEnRouteProviderInfo(null); 
              router.push('/'); // Clear hiredProviderId from URL
              updateDisplayedProviders(); // Refresh provider list
            }}
           >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sr-only">Cancelar Seguimiento</span>
          </Button>
        </div>
        <div className="text-center">
          {status === "En camino" ? (
            <>
              <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs font-medium text-foreground mb-0.5">
                <IconComponent className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                <span>{status}</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-sm sm:text-md font-bold text-accent">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Llega en {eta}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-1 text-sm sm:text-md font-bold text-green-600">
              <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>¡{provider.name} ha llegado!</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const shouldDisplayRightPanel = !currentHiredProviderId && providersVisibleInPanel && displayedProviders.length > 0;
  // console.log(`[MapDisplay RENDER] displayedProviders count: ${displayedProviders.length}, providersVisibleInPanel: ${providersVisibleInPanel}, categoryParam: ${categoryParam}, currentSearchTerm: ${currentSearchTerm}, currentHiredProviderId: ${currentHiredProviderId}, enRoute: ${!!enRouteProviderInfo}, shouldDisplayRightPanel: ${shouldDisplayRightPanel}`);

  return (
    <div className="h-full w-full relative">
      <div className={cn("absolute inset-0 z-0")}>
        {renderMapArea()}
      </div>
      
      {/* Right Panel for Provider List - Conditionally Rendered */}
      {shouldDisplayRightPanel && (
         <div className="absolute top-0 right-0 h-full w-full md:w-1/3 lg:w-1/4 bg-background/90 backdrop-blur-sm shadow-lg z-20 p-4 overflow-y-auto space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold text-primary">
                    {categoryParam && categoryParam !== 'all' 
                        ? `Servicios de ${SERVICE_CATEGORIES.find(c => c.id === categoryParam)?.name || 'Categoría'}` 
                        : currentSearchTerm 
                            ? `Resultados para "${currentSearchTerm}"` 
                            : "Proveedores Cercanos"}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setProvidersVisibleInPanel(false)} className="text-muted-foreground hover:text-primary">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Cerrar panel</span>
                </Button>
            </div>
            {displayedProviders.length > 0 ? (
                displayedProviders.map(provider => (
                    <ProviderPreviewCard key={provider.id} provider={provider} />
                ))
            ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No se encontraron proveedores para tu selección.</p>
            )}
        </div>
      )}
      
      {!enRouteProviderInfo && <BottomSearchContainer onSearch={handleSearchFromBottomBar} />}
      
      {enRouteProviderInfo && <EnRouteProviderPanel />}

    </div>
  );
}

