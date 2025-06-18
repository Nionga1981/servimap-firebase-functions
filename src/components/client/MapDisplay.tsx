// src/components/client/MapDisplay.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import { GoogleMap, MarkerF, useJsApiLoader, InfoWindowF, DirectionsRenderer } from '@react-google-maps/api';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, CheckCircle, Loader2, MapPin, Search, Star, Navigation, XCircle, Building2, ShieldQuestion, Route as RouteIcon } from 'lucide-react';
import { mockProviders, USER_FIXED_LOCATION, mockCategoriasServicio } from '@/lib/mockData';
import { SERVICE_CATEGORIES } from '@/lib/constants';
import type { Provider, CategoriaServicio, ProviderLocation } from '@/types';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { BottomSearchContainer } from '@/components/client/BottomSearchContainer';
import { CategoryIconBar } from './CategoryIconBar';

const FALLBACK_GOOGLE_MAPS_API_KEY = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU";
const PROVIDER_SEARCH_RADIUS_KM = 5; // Default search radius if not in specific mode

const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const defaultMapZoom = 13;
const enRouteZoom = 15;
const providerViewZoom = 14;


const lucideIconToDataUri = (IconComponent: LucideIcon | undefined, color = "#008080", size = 32) => {
  if (typeof window === 'undefined' || !IconComponent) {
    const GenericIcon = Building2; // Fallback icon
    const svgString = ReactDOMServer.renderToStaticMarkup(
      <GenericIcon color={color} size={size} strokeWidth={2.5} />
    );
    const SvgWithXmlns = `<?xml version="1.0" encoding="UTF-8"?>` + svgString.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(SvgWithXmlns)}`;
  }
  try {
    const svgString = ReactDOMServer.renderToStaticMarkup(
      <IconComponent color={color} size={size} strokeWidth={2.5} />
    );
    const SvgWithXmlns = `<?xml version="1.0" encoding="UTF-8"?>` + svgString.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(SvgWithXmlns)}`;
  } catch (error) {
    console.error("[MapDisplay] Error generating Lucide icon Data URI:", error);
    const GenericIcon = Building2; // Fallback icon on error
    const svgString = ReactDOMServer.renderToStaticMarkup(
      <GenericIcon color={color} size={size} strokeWidth={2.5} />
    );
    const SvgWithXmlns = `<?xml version="1.0" encoding="UTF-8"?>` + svgString.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(SvgWithXmlns)}`;
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
  status: "En camino" | "Ha llegado" | "Visualizando ruta";
  eta: string;
  currentLocation: ProviderLocation; // For simulation or actual provider location
  isRouteViewOnly?: boolean; // Flag to distinguish from actual hiring
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
  hiredProviderId, // To know if we are in "hired" mode
  viewProviderRouteId, // To know if we are in "view route" mode
}: {
  mapCenter: ProviderLocation;
  mapZoom: number;
  userLocationToDisplay: ProviderLocation | null;
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
  hiredProviderId: string | null;
  viewProviderRouteId: string | null;
}) => {

  const userMarkerIconObject = useMemo(() => {
    if (isMapApiLoaded && typeof window !== 'undefined' && window.google && window.google.maps) {
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#008080', // Teal color for user
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: 'white',
      };
    }
    return undefined;
  }, [isMapApiLoaded]);

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
        zoomControl: true,
        zoomControlOptions: { position: (typeof window !== 'undefined' && window.google?.maps?.ControlPosition.RIGHT_BOTTOM) },
        rotateControl: false,
        scaleControl: false,
        clickableIcons: false,
      }}
    >
      {userLocationToDisplay && userMarkerIconObject && (
        <MarkerF
          position={userLocationToDisplay}
          title="Tu Ubicación"
          icon={userMarkerIconObject}
          zIndex={1001} // Higher zIndex for user marker
        />
      )}

      {providersToDisplayOnMap.map(provider => {
        // Determine which location to use for the marker
        const isCurrentFocusProvider = hiredProviderId === provider.id || viewProviderRouteId === provider.id;
        const locationToDisplay = (isCurrentFocusProvider && provider.ubicacionExacta)
          ? provider.ubicacionExacta
          : provider.ubicacionAproximada;

        if (!locationToDisplay) return null;

        // Special marker for provider currently in "en route" or "view route" mode
        if (enRouteProviderInfo && enRouteProviderInfo.provider.id === provider.id) {
          const enRouteCategoryData = SERVICE_CATEGORIES.find(c => c.id === (provider.services[0]?.category));
          const enRouteProviderLucideIcon = enRouteCategoryData?.icon;
          let enRouteMarkerIconUrl = '';
           if (enRouteProviderLucideIcon && isMapApiLoaded) {
              const cacheKey = `enroute_${provider.services[0]?.category || 'default'}_${enRouteProviderInfo.isRouteViewOnly ? 'view' : 'hired'}`;
              if (categoryIconCache.current[cacheKey]) {
                  enRouteMarkerIconUrl = categoryIconCache.current[cacheKey];
              } else {
                  // Use a different color/size for "view route" vs "hired & en route"
                  const iconColor = enRouteProviderInfo.isRouteViewOnly ? '#4A90E2' : '#FFA07A'; // Blue for view, LightSalmon for hired
                  const iconSize = enRouteProviderInfo.isRouteViewOnly ? 34 : 36;
                  const uri = lucideIconToDataUri(enRouteProviderLucideIcon, iconColor, iconSize);
                  if (uri) {
                      enRouteMarkerIconUrl = uri;
                      categoryIconCache.current[cacheKey] = uri;
                  }
              }
          }
          const enRouteMarkerConfig = enRouteMarkerIconUrl && typeof window !== 'undefined' && window.google?.maps ? {
              url: enRouteMarkerIconUrl,
              scaledSize: new window.google.maps.Size(enRouteProviderInfo.isRouteViewOnly ? 34 : 36, enRouteProviderInfo.isRouteViewOnly ? 34 : 36),
              anchor: new window.google.maps.Point(enRouteProviderInfo.isRouteViewOnly ? 17 : 18, enRouteProviderInfo.isRouteViewOnly ? 34 : 36),
          } : undefined;

          return (
              <MarkerF
                  key={`${provider.id}-enroute`}
                  position={enRouteProviderInfo.currentLocation} // This marker moves
                  title={`${provider.name} (${enRouteProviderInfo.status})`}
                  icon={enRouteMarkerConfig}
                  zIndex={1000} // High zIndex
              />
          );
        }

        // Standard marker for other providers
        const mainCategoryData = SERVICE_CATEGORIES.find(c => c.id === (provider.services[0]?.category));
        const mainCategoryLucideIcon = mainCategoryData?.icon;
        let markerIconUrl = '';

        if (isMapApiLoaded) {
          const cacheKey = provider.services[0]?.category || 'default_marker';
          if (categoryIconCache.current[cacheKey]) {
            markerIconUrl = categoryIconCache.current[cacheKey];
          } else {
            const generatedUri = lucideIconToDataUri(mainCategoryLucideIcon, "#008080", 32); // Standard color
            if (generatedUri) {
              markerIconUrl = generatedUri;
              categoryIconCache.current[cacheKey] = markerIconUrl;
            }
          }
        }

        const markerIconConfig = markerIconUrl && typeof window !== 'undefined' && window.google?.maps ? {
          url: markerIconUrl,
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 32),
        } : undefined;

        return (
          <MarkerF
            key={provider.id}
            position={locationToDisplay}
            title={provider.name}
            onClick={() => onMarkerClick(provider)}
            icon={markerIconConfig || { 
              path: (typeof window !== 'undefined' && window.google?.maps?.SymbolPath.CIRCLE), // Fallback
              scale: 6,
              fillColor: "#008080",
              fillOpacity: 1,
              strokeWeight: 0,
            }}
          />
        );
      })}

      {selectedProviderForInfoWindow && userLocationToDisplay && !enRouteProviderInfo && ( // Don't show info window if a route is active
        <InfoWindowF
          position={selectedProviderForInfoWindow.ubicacionAproximada} // Always show InfoWindow at approx. location
          onCloseClick={onInfoWindowClose}
          options={{
            pixelOffset: (typeof window !== 'undefined' && window.google?.maps) ? new window.google.maps.Size(0, -35) : undefined
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
                selectedProviderForInfoWindow.ubicacionAproximada.lat,
                selectedProviderForInfoWindow.ubicacionAproximada.lng
              ).toFixed(1)} km (aprox.)
            </div>
            <Button asChild size="sm" className="w-full mt-2 bg-accent hover:bg-accent/90 text-accent-foreground">
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
            suppressMarkers: true, // We handle markers ourselves
            polylineOptions: {
              strokeColor: enRouteProviderInfo?.isRouteViewOnly ? '#4A90E2' : '#FFA07A', // Blue for view, LightSalmon for hired
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

  const libraries = useMemo(() => ['places', 'geometry'] as ("places" | "geometry")[], []);
  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "",
    libraries,
    id: 'google-map-script-servimap-main'
  });

  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [mapCenter, setMapCenter] = useState<ProviderLocation>(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(defaultMapZoom);

  const [userLocation, setUserLocation] = useState<ProviderLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showManualLocationInput, setShowManualLocationInput] = useState(false);

  const [allCategories, setAllCategories] = useState<CategoriaServicio[]>([]);
  const [activeCategories, setActiveCategories] = useState<CategoriaServicio[]>([]);
  
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [selectedProviderForInfoWindow, setSelectedProviderForInfoWindow] = useState<Provider | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryIconCache = useRef<Record<string, string>>({});
  const [enRouteProviderInfo, setEnRouteProviderInfo] = useState<EnRouteProviderInfo | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stepTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const hiredProviderId = useMemo(() => searchParams.get('hiredProviderId'), [searchParams]);
  const viewProviderRouteId = useMemo(() => searchParams.get('viewProviderRoute'), [searchParams]); // New param
  // const viewServiceId = useMemo(() => searchParams.get('serviceId'), [searchParams]); // For context if needed

  const categoryQueryParam = useMemo(() => searchParams.get('category'), [searchParams]);

  useEffect(() => {
    setAllCategories(mockCategoriasServicio);
    setAllProviders(mockProviders);
  }, []);

  useEffect(() => {
    if (categoryQueryParam) {
      setSelectedCategory(categoryQueryParam);
    }
  }, [categoryQueryParam]);

  const currentMode = useMemo(() => {
    if (hiredProviderId) return 'hired';
    if (viewProviderRouteId) return 'view_route';
    return 'browsing';
  }, [hiredProviderId, viewProviderRouteId]);


  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          if (currentMode === 'browsing') setMapCenter(loc);
          setLocationError(null);
          setShowManualLocationInput(false);
        },
        (error) => {
          console.warn(`Error de Geolocalización: ${error.message}`);
          setLocationError(`Geolocalización denegada. Usando ubicación predeterminada.`);
          setUserLocation(USER_FIXED_LOCATION);
          if (currentMode === 'browsing') setMapCenter(USER_FIXED_LOCATION);
          setShowManualLocationInput(true);
        }
      );
    } else {
      setLocationError("Geolocalización no soportada. Usando ubicación predeterminada.");
      setUserLocation(USER_FIXED_LOCATION);
      if (currentMode === 'browsing') setMapCenter(USER_FIXED_LOCATION);
      setShowManualLocationInput(true);
    }
  }, [currentMode]); // Re-check geolocation if mode changes, though USER_FIXED_LOCATION will persist if denied

  useEffect(() => {
    if (!userLocation || allProviders.length === 0 || allCategories.length === 0) {
      setDisplayedProviders([]);
      setActiveCategories([]);
      return;
    }

    // If in hired or view_route mode, only display that provider
    if (currentMode === 'hired' && hiredProviderId) {
      const hired = allProviders.find(p => p.id === hiredProviderId);
      setDisplayedProviders(hired ? [hired] : []);
      setActiveCategories([]); // No category bar in these modes
      return;
    }
    if (currentMode === 'view_route' && viewProviderRouteId) {
      const providerToView = allProviders.find(p => p.id === viewProviderRouteId);
      setDisplayedProviders(providerToView ? [providerToView] : []);
      setActiveCategories([]);
      return;
    }

    // Browsing mode filtering
    let providersFilteredByLocationAndStatus = allProviders.filter(p => {
      if (!p.estadoOnline || !p.ubicacionAproximada) return false;
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        p.ubicacionAproximada.lat,
        p.ubicacionAproximada.lng
      );
      return distance <= PROVIDER_SEARCH_RADIUS_KM;
    });

    const relevantCategoryIds = new Set<string>();
    providersFilteredByLocationAndStatus.forEach(p => {
      p.services.forEach(s => relevantCategoryIds.add(s.category));
    });
    const activeCatsForBar = allCategories.filter(c => relevantCategoryIds.has(c.id));
    setActiveCategories(activeCatsForBar);

    let categoryFilteredProviders = providersFilteredByLocationAndStatus;
    if (selectedCategory) {
      categoryFilteredProviders = providersFilteredByLocationAndStatus.filter(p =>
        p.services.some(s => s.category === selectedCategory)
      );
    }

    let searchFilteredProviders = categoryFilteredProviders;
    if (searchTerm.trim() !== '') {
      const termLower = searchTerm.toLowerCase();
      searchFilteredProviders = categoryFilteredProviders.filter(p =>
        p.name.toLowerCase().includes(termLower) ||
        p.services.some(s => s.title.toLowerCase().includes(termLower)) ||
        (SERVICE_CATEGORIES.find(sc => p.services.some(serv => serv.category === sc.id))?.name.toLowerCase().includes(termLower)) ||
        p.specialties?.some(sp => sp.toLowerCase().includes(termLower))
      );
    }
    setDisplayedProviders(searchFilteredProviders);

  }, [userLocation, allProviders, allCategories, selectedCategory, searchTerm, currentMode, hiredProviderId, viewProviderRouteId]);


  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
  }, []);

  const onMapUnmount = useCallback((map: google.maps.Map) => {
    setMapInstance(null);
    if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
    if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
  }, []);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setSelectedProviderForInfoWindow(null);
  };
  
  const handleSearchSubmit = () => {
    console.log("Search submitted:", searchTerm);
  };

  const handleCategoryFilter = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setSelectedProviderForInfoWindow(null);
    if (mapInstance && userLocation && currentMode === 'browsing') { 
        mapInstance.panTo(userLocation);
        mapInstance.setZoom(defaultMapZoom);
    }
    const params = new URLSearchParams(window.location.search);
    if (categoryId) {
      params.set('category', categoryId);
    } else {
      params.delete('category');
    }
    // Remove route/hired params if changing category
    params.delete('hiredProviderId');
    params.delete('viewProviderRoute');
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  };

  const handleMarkerClick = useCallback((provider: Provider) => {
    if (currentMode === 'browsing') {
      setSelectedProviderForInfoWindow(provider);
      if (provider.ubicacionAproximada && mapInstance) {
        mapInstance.panTo(provider.ubicacionAproximada);
      }
    }
  }, [currentMode, mapInstance]);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedProviderForInfoWindow(null);
  }, []);

  const simulateProviderMovement = useCallback((route: google.maps.DirectionsRoute | undefined, providerToSimulate: Provider, isViewOnly: boolean) => {
    if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
    if (!route || !route.legs?.[0]?.steps?.length || !providerToSimulate.ubicacionExacta || !userLocation) {
      setEnRouteProviderInfo(prev => prev ? { ...prev, status: "Ha llegado", eta: "0 min", currentLocation: userLocation || USER_FIXED_LOCATION, isRouteViewOnly: isViewOnly } : null);
      if (isViewOnly) { // If it was just a view, clear the route param
        const params = new URLSearchParams(window.location.search);
        params.delete('viewProviderRoute');
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
      }
      return;
    }

    const allPathPoints: google.maps.LatLng[] = route.legs[0].steps.flatMap(step => step.path);
    let currentPointIndex = 0;

    setEnRouteProviderInfo({
        provider: providerToSimulate,
        status: isViewOnly ? "Visualizando ruta" : "En camino",
        eta: route.legs[0].duration?.text || "Calculando...",
        currentLocation: providerToSimulate.ubicacionExacta, // Start at provider's exact location
        isRouteViewOnly: isViewOnly,
    });

    const moveNext = () => {
      if (currentPointIndex >= allPathPoints.length || !userLocation) {
        setEnRouteProviderInfo(prev => prev ? { ...prev, status: "Ha llegado", eta: "0 min", currentLocation: userLocation, isRouteViewOnly: isViewOnly } : null);
        if(stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
        
        const params = new URLSearchParams(window.location.search);
        if (isViewOnly) params.delete('viewProviderRoute');
        else params.delete('hiredProviderId'); // If it was a hired provider arriving
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        return;
      }

      const nextLatLng = allPathPoints[currentPointIndex].toJSON();
      const remainingDurationSeconds = route.legs[0].duration?.value ? (route.legs[0].duration.value * (1 - (currentPointIndex / allPathPoints.length))) : 0;
      const etaMinutes = Math.max(0, Math.round(remainingDurationSeconds / 60));

      setEnRouteProviderInfo(prev => prev ? { ...prev, currentLocation: nextLatLng, eta: `${etaMinutes} min (sim.)` } : null);
      currentPointIndex++;
      stepTimeoutRef.current = setTimeout(moveNext, isViewOnly ? 1800 : 1200); // Slower for view only
    };
    moveNext();
  }, [userLocation, router]);

  useEffect(() => {
    if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
    if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
    setDirectionsResponse(null);
    setEnRouteProviderInfo(null); // Clear previous route info

    const providerIdForRoute = hiredProviderId || viewProviderRouteId;
    const isViewOnlyRoute = !!viewProviderRouteId && !hiredProviderId;

    if (providerIdForRoute && isMapApiLoaded && mapInstance && userLocation) {
      const providerInRoute = allProviders.find(p => p.id === providerIdForRoute);

      if (providerInRoute && providerInRoute.ubicacionExacta) {
        setSelectedProviderForInfoWindow(null); // Hide info window when route is active
        setMapZoom(isViewOnlyRoute ? providerViewZoom : enRouteZoom);

        if (typeof window !== 'undefined' && window.google?.maps?.DirectionsService) {
          const directionsService = new window.google.maps.DirectionsService();
          directionsService.route(
            {
              origin: providerInRoute.ubicacionExacta,
              destination: userLocation,
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (status === window.google.maps.DirectionsStatus.OK && result) {
                setDirectionsResponse(result);
                if (mapInstance && providerInRoute.ubicacionExacta && userLocation && window.google?.maps) {
                  const bounds = new window.google.maps.LatLngBounds();
                  bounds.extend(providerInRoute.ubicacionExacta); // Provider's start
                  bounds.extend(userLocation); // User's end
                  mapInstance.fitBounds(bounds);
                   const listener = window.google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
                        if (mapInstance.getZoom()! > 16) mapInstance.setZoom(16); // Don't zoom in too much
                        if(window.google?.maps && listener) window.google.maps.event.removeListener(listener);
                    });
                }
                simulateProviderMovement(result.routes[0], providerInRoute, isViewOnlyRoute);
              } else {
                console.error(`Error al obtener direcciones: ${status}`, result);
                 setEnRouteProviderInfo({
                    provider: providerInRoute,
                    status: isViewOnlyRoute ? "Visualizando ruta" : "En camino",
                    eta: "Ruta no disponible",
                    currentLocation: providerInRoute.ubicacionExacta,
                    isRouteViewOnly: isViewOnlyRoute,
                  });
                setDisplayedProviders([providerInRoute]); 
                setMapCenter(providerInRoute.ubicacionExacta);
              }
            }
          );
        }
      } else {
        setEnRouteProviderInfo(null);
      }
    } else if (currentMode === 'browsing') { // No hired or view route ID
      setEnRouteProviderInfo(null);
      setMapZoom(defaultMapZoom);
      if (userLocation) setMapCenter(userLocation);
    }
  }, [currentMode, hiredProviderId, viewProviderRouteId, isMapApiLoaded, mapInstance, userLocation, simulateProviderMovement, router, allProviders]);


  const renderMapArea = () => {
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
      return (
        <div className="flex items-center justify-center h-full text-destructive p-4 text-center">
          <AlertCircle className="h-8 w-8 mr-2" /> Error al cargar Google Maps: {mapApiLoadError.message}
        </div>
      );
    }
    if (!isMapApiLoaded || (!userLocation && !showManualLocationInput) ) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">
            {isMapApiLoaded && !userLocation && !locationError ? "Obteniendo ubicación..." : "Cargando Mapa..."}
          </p>
        </div>
      );
    }
     if (showManualLocationInput && !userLocation) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <ShieldQuestion className="h-12 w-12 text-primary mb-3"/>
          <p className="text-primary mb-1 font-semibold">{locationError || "No se pudo obtener tu ubicación."}</p>
          <p className="text-sm text-muted-foreground mb-3">Para una mejor experiencia, por favor permite el acceso a tu ubicación o usa la opción predeterminada.</p>
          <Button
            onClick={() => {
              setUserLocation(USER_FIXED_LOCATION);
              setMapCenter(USER_FIXED_LOCATION);
              setLocationError(null);
              setShowManualLocationInput(false);
            }}
            variant="outline"
            className="shadow-sm hover:shadow-md"
          >
            Usar Ubicación Predeterminada (Culiacán)
          </Button>
        </div>
      );
    }

    return (
      <MapContentComponent
        mapCenter={mapCenter}
        mapZoom={mapZoom}
        userLocationToDisplay={userLocation}
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
        hiredProviderId={hiredProviderId}
        viewProviderRouteId={viewProviderRouteId}
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* Top Search and Category Bar Area - Only in browsing mode */}
      {currentMode === 'browsing' && (
        <div className="absolute top-0 left-0 right-0 z-20 p-3 md:p-4 space-y-3 bg-gradient-to-b from-background via-background/90 to-transparent">
          {/* Search Bar */}
          <Card className="shadow-lg rounded-lg bg-background backdrop-blur-sm border border-border/50">
              <CardContent className="p-0 flex items-center">
              <Search className="h-5 w-5 text-muted-foreground ml-3" />
              <Input
                  type="text"
                  placeholder="¿Qué servicio estás buscando?"
                  value={searchTerm}
                  onChange={handleSearchInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  className="flex-grow text-base border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-12 placeholder:text-muted-foreground placeholder:font-normal"
                  aria-label="Buscar servicio"
              />
              {searchTerm && (
                  <Button variant="ghost" size="icon" onClick={() => setSearchTerm('')} className="h-9 w-9 mr-1">
                      <XCircle className="h-5 w-5 text-muted-foreground hover:text-destructive"/>
                  </Button>
              )}
              </CardContent>
          </Card>

          {/* Category Icons Bar */}
          {activeCategories.length > 0 && (
            <div className="bg-background/80 backdrop-blur-sm rounded-lg shadow-md">
               <CategoryIconBar
                  categories={activeCategories}
                  onCategorySelect={handleCategoryFilter}
                  selectedCategoryId={selectedCategory}
              />
            </div>
          )}
        </div>
      )}

      {/* Map Area */}
      <div className="flex-grow relative z-0">
        {renderMapArea()}
      </div>

      {/* En-Route or View-Route Provider Panel */}
      {enRouteProviderInfo && (
        <Card className="absolute top-4 left-1/2 -translate-x-1/2 z-30 shadow-xl bg-background/95 backdrop-blur-sm w-auto max-w-[calc(100%-2rem)] md:max-w-md">
          <CardHeader className="p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={enRouteProviderInfo.provider.avatarUrl} alt={enRouteProviderInfo.provider.name} data-ai-hint={enRouteProviderInfo.provider.dataAiHint || "provider avatar"}/>
                <AvatarFallback>{enRouteProviderInfo.provider.name.substring(0, 1)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-base flex items-center">
                  {enRouteProviderInfo.status === "En camino" ? (
                    <Navigation className="h-5 w-5 mr-2 text-primary animate-pulse" />
                  ) : enRouteProviderInfo.status === "Visualizando ruta" ? (
                    <RouteIcon className="h-5 w-5 mr-2 text-blue-500" />
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

      {/* Bottom Banners - only show if not in "en route" or "view_route" mode */}
      {currentMode === 'browsing' && (
        <div className="absolute bottom-0 left-0 right-0 z-10 p-2 sm:p-3">
          <BottomSearchContainer />
        </div>
      )}
    </div>
  );
}
