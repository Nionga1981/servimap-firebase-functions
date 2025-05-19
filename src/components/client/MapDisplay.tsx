
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MapPinned, Search, AlertTriangle, WifiOff, Loader2, Baby, Wrench, Zap } from 'lucide-react';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard';
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from '@/lib/constants';

const apiKeyFromEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
console.log('[MapDisplay Module] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:', apiKeyFromEnv);

// Ubicación fija del usuario para la demostración
const USER_FIXED_LOCATION = {
  lat: 24.8093, // Galileo 772, Villa Universidad, Culiacán
  lng: -107.4255
};

// Mock providers para demostración
const mockProviders: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100.png?text=MF',
    dataAiHint: 'plumber portrait',
    rating: 4.9,
    isAvailable: true,
    services: [{
      id: 's_p1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos.', price: 90, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water pipes'
    }],
    location: { lat: 24.8050, lng: -107.4200 } // Cerca de Culiacán
  },
  {
    id: 'electrician1',
    name: 'ElectroSoluciones Rápidas',
    avatarUrl: 'https://placehold.co/100x100.png?text=ES',
    dataAiHint: 'electrician smile',
    rating: 4.8,
    isAvailable: true,
    services: [{
      id: 's_e1', title: 'Instalaciones Eléctricas', description: 'Expertos en trabajos eléctricos.', price: 80, category: 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'electrical panel'
    }],
    location: { lat: 24.8150, lng: -107.4300 } // Cerca de Culiacán
  },
  {
    id: 'nanny1',
    name: 'Super Niñeras Ana',
    avatarUrl: 'https://placehold.co/100x100.png?text=SN',
    dataAiHint: 'friendly nanny',
    rating: 4.95,
    isAvailable: true,
    services: [{
      id: 's_n1', title: 'Cuidado Infantil Profesional', description: 'Cuidado amoroso y experto para tus hijos.', price: 75, category: 'child_care', providerId: 'nanny1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'children playing'
    }],
    location: { lat: 24.8000, lng: -107.4150 } // Cerca de Culiacán
  },
  {
    id: 'cleaner1',
    name: 'Limpieza Impecable Hogar',
    avatarUrl: 'https://placehold.co/100x100.png?text=LI',
    dataAiHint: 'cleaning professional',
    rating: 4.9,
    isAvailable: true,
    services: [{
      id: 's_c1', title: 'Limpieza Profunda Residencial', description: 'Dejamos tu casa reluciente.', price: 100, category: 'cleaning', providerId: 'cleaner1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'sparkling clean'
    }],
    location: { lat: 24.7500, lng: -107.3800 } // Un poco más lejos de Culiacán, pero podría estar dentro de 20km
  },
  { // Proveedor más lejano, para probar filtro de distancia
    id: 'plumber_far',
    name: 'Fontanería Distante',
    avatarUrl: 'https://placehold.co/100x100.png?text=FD',
    dataAiHint: 'worker tools',
    rating: 4.5,
    isAvailable: true,
    services: [{ id: 's_pf1', title: 'Servicios de Plomería General', description: 'Atendemos una amplia área.', price: 60, category: 'plumbing', providerId: 'plumber_far', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'wrench set' }],
    location: { lat: 25.0000, lng: -107.6000 } // Más de 20km de Culiacán
  },
  { // Proveedor en otra ciudad, definitivamente fuera del radio
    id: 'gardener_la',
    name: 'Jardines Verdes LA',
    avatarUrl: 'https://placehold.co/100x100.png?text=JVLA',
    dataAiHint: 'gardener nature',
    rating: 4.7,
    isAvailable: false, // Para probar que no disponibles no aparecen
    services: [{ id: 's_g_la', title: 'Mantenimiento de Jardines LA', description: 'Expertos en jardinería en Los Ángeles.', price: 65, category: 'gardening', providerId: 'gardener_la', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'lush garden' }],
    location: { lat: 34.0600, lng: -118.2400 } // Los Angeles
  },
];


const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

// Estilo para ocultar POIs
const mapStyles: google.maps.MapTypeStyle[] = [
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.attraction",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.government",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.medical",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.place_of_worship",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.school",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.sports_complex",
    stylers: [{ visibility: "off" }],
  },
  { // Opcional: reduce la prominencia de las etiquetas de tránsito si es necesario
    featureType: "transit.station",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  { // Opcional: reduce la prominencia de algunas carreteras
    featureType: "road.arterial",
    elementType: "labels",
    stylers: [{ visibility: "on" }], // Mantén las etiquetas de las carreteras principales
  },
  {
    featureType: "road.highway",
    elementType: "labels",
    stylers: [{ visibility: "on" }], // Mantén las etiquetas de las autopistas
  },
  {
    featureType: "road.local",
    elementType: "labels",
    stylers: [{ visibility: "off" }], // Oculta etiquetas de calles locales si deseas máxima limpieza
  },
];


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
  return R * c; // Distancia en km
};


// Define MapContentComponent outside MapDisplay
const MapContentComponent = React.memo(({
  center,
  zoom,
  onLoad,
  onUnmount,
  userLocationToDisplay,
  providersToDisplayOnMap
}: {
  center: { lat: number; lng: number };
  zoom: number;
  onLoad: (map: google.maps.Map) => void;
  onUnmount: () => void;
  userLocationToDisplay: { lat: number; lng: number } | null;
  providersToDisplayOnMap: Provider[];
}) => {
  console.log('[MapContentComponent] Rendering. Center:', center, 'Providers on map:', providersToDisplayOnMap.length);
  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={zoom}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: false,
        rotateControl: false,
        scaleControl: false,
        clickableIcons: false,
        styles: mapStyles, // Aplicar estilos personalizados aquí
      }}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {userLocationToDisplay && (
        <MarkerF
          position={userLocationToDisplay}
          title="Tu ubicación (simulada)"
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
        return provider.location && provider.isAvailable && (
          <MarkerF
            key={provider.id}
            position={provider.location}
            title={`${provider.name} (Calificación: ${provider.rating})`}
            // Iconos personalizados por categoría se implementarían aquí en el futuro
            // Por ejemplo, podrías tener un objeto que mapee categoryId a una URL de icono
            // icon={CATEGORY_ICONS[provider.services[0].category] || DEFAULT_MARKER_ICON_URL}
          />
        )
      })}
    </GoogleMap>
  );
});
MapContentComponent.displayName = 'MapContentComponent';


export function MapDisplay() {
  const userLocation = USER_FIXED_LOCATION; // Usar la ubicación fija
  const [displayedProviders, setDisplayedProviders] = useState<Provider[]>([]);
  const [mapCenter, setMapCenter] = useState(USER_FIXED_LOCATION);
  const [mapZoom, setMapZoom] = useState(14);
  const [, setIsMapComponentLoaded] = useState(false); // Para rastrear si el componente GoogleMap interno se ha cargado
  const [providersVisibleInPanel, setProvidersVisibleInPanel] = useState(false);

  const libraries = useMemo(() => ['places'] as const, []);
  // TEMPORARY HARDCODED - RECUERDA QUITAR ESTO Y USAR .ENV EN UN ENTORNO REAL
  const googleMapsApiKey = "AIzaSyAX3VvtVNBqCK5otabtRkChTMa9_IPegHU"; 

  console.log('[MapDisplay Component] Using hardcoded googleMapsApiKey value:', googleMapsApiKey);
  console.log('[MapDisplay Component] Value from process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (for comparison):', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  const { isLoaded: isMapApiLoaded, loadError: mapApiLoadError } = useJsApiLoader(
    googleMapsApiKey
      ? { googleMapsApiKey, libraries, id: 'google-map-script-servimap' }
      : { skip: true }
  );
  console.log('[MapDisplay Render] isMapApiLoaded:', isMapApiLoaded, 'mapApiLoadError:', mapApiLoadError);

  // Cargar y filtrar proveedores basados en la ubicación fija del usuario
  useEffect(() => {
    console.log("[MapDisplay useEffect] Procesando proveedores con ubicación fija:", userLocation);
    if (userLocation) {
      const providersInRange = mockProviders.filter(provider => {
        if (provider.location && provider.isAvailable) {
          const distance = calculateDistance(userLocation.lat, userLocation.lng, provider.location.lat, provider.location.lng);
          return distance <= 20; // Radio de 20 km
        }
        return false;
      });

      const sortedProviders = providersInRange.sort((a, b) => b.rating - a.rating);
      setDisplayedProviders(sortedProviders);
      
      // Mostrar el panel si se encuentran proveedores cercanos
      if (sortedProviders.length > 0) {
        setProvidersVisibleInPanel(true); // Hacemos visible el panel automáticamente si hay proveedores
        console.log(`[MapDisplay useEffect] ${sortedProviders.length} proveedores encontrados dentro de 20km. El panel será visible.`);
      } else {
        setProvidersVisibleInPanel(false);
        console.log("[MapDisplay useEffect] No se encontraron proveedores dentro de 20km. El panel estará oculto.");
      }
      // Actualizar el centro del mapa a la ubicación del usuario una vez procesado
      setMapCenter(userLocation);
    }
  }, [userLocation]); // Dependencia única: userLocation (que es constante aquí)


  const onMapLoadCallback = useCallback((mapInstance: google.maps.Map) => {
    console.log("Google Map component successfully loaded. Instancia del mapa:", mapInstance);
    setIsMapComponentLoaded(true);
  }, []);

  const onMapUnmountCallback = useCallback(() => {
    console.log("Google Map component unmounted.");
    setIsMapComponentLoaded(false);
  }, []);


  const renderMapArea = () => {
    console.log('[renderMapArea] Current state: isMapApiLoaded:', isMapApiLoaded, 'mapApiLoadError:', mapApiLoadError, 'googleMapsApiKey set:', !!googleMapsApiKey);
    if (!googleMapsApiKey) {
      console.log('[renderMapArea] No API Key');
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Configuración Requerida</p>
          <p className="text-sm text-center">La API Key de Google Maps no está configurada.</p>
        </div>
      );
    }

    if (mapApiLoadError) {
       console.log('[renderMapArea] mapApiLoadError:', mapApiLoadError);
       return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-destructive/10 rounded-md">
          <WifiOff className="h-12 w-12 mb-4" />
          <p className="text-lg font-semibold mb-2">Error Cargando Google Maps</p>
          <p className="text-sm text-center">Error al cargar la API de Google Maps: {mapApiLoadError.message}.</p>
        </div>
      );
    }

    if (!isMapApiLoaded) {
      console.log('[renderMapArea] !isMapApiLoaded (Loading Map API...)');
      return (
        <div className="flex flex-col items-center justify-center h-full text-primary p-4">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-semibold">Cargando Mapa...</p>
        </div>
      );
    }
    
    console.log('[renderMapArea] Rendering MapContentComponent with mapCenter:', mapCenter, 'and userLocation:', userLocation);
    return (
      <MapContentComponent
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onMapLoadCallback}
        onUnmount={onMapUnmountCallback}
        userLocationToDisplay={userLocation} // Pasar la ubicación fija del usuario
        providersToDisplayOnMap={displayedProviders} // Solo los filtrados por distancia
      />
    );
  };

  const showProviderListPanel = isMapApiLoaded && !mapApiLoadError && googleMapsApiKey && providersVisibleInPanel;
  
  const shouldDisplayRightPanel = showProviderListPanel || !googleMapsApiKey || mapApiLoadError;

  return (
    <Card className="shadow-xl overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b p-4">
        {/* La barra de búsqueda está temporalmente oculta para simplificar la UI según la petición */}
        {/* <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="relative flex-grow w-full sm:w-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar servicio, nombre, categoría..." className="pl-8 w-full" />
          </div>
        </div> */}
         <h2 className="text-xl font-semibold text-primary text-center">
          Servicios Cercanos en {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)} (Culiacán)
        </h2>
      </CardHeader>
      <CardContent className="p-0 md:flex flex-grow overflow-hidden">
         <div className={cn(
             "h-[calc(100vh-var(--header-height,150px)-var(--map-header-height,80px))] md:h-auto relative bg-muted flex items-center justify-center text-foreground flex-grow",
             shouldDisplayRightPanel ? "md:w-2/3" : "md:w-full" // Ajuste de ancho dinámico
           )}>
          {renderMapArea()}
        </div>

        {shouldDisplayRightPanel && (
          <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-full md:overflow-y-auto space-y-4 flex-shrink-0">
            {!googleMapsApiKey && (
                <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-full">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="font-semibold text-destructive">Mapa no disponible.</p>
                  <p className="text-sm text-destructive-foreground">API Key no configurada.</p>
                </div>
            )}
            {mapApiLoadError && googleMapsApiKey && (
                <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-full">
                  <WifiOff className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="font-semibold text-destructive">Error al cargar el mapa.</p>
                  <p className="text-sm text-destructive-foreground">{mapApiLoadError.message.split('.')[0]}.</p>
                </div>
            )}

            {isMapApiLoaded && !mapApiLoadError && googleMapsApiKey && providersVisibleInPanel && displayedProviders.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-primary mb-2">Proveedores Cercanos (menos de 20km):</h3>
                {displayedProviders.map(provider => ( 
                    <ProviderPreviewCard
                      key={provider.id}
                      provider={provider}
                      onSelectProvider={(providerId) => alert(`Ver perfil de ${provider.name} (ID: ${providerId}) (funcionalidad pendiente)`)}
                    />
                  ))}
              </>
            )}
            {isMapApiLoaded && !mapApiLoadError && googleMapsApiKey && providersVisibleInPanel && displayedProviders.length === 0 && (
               <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-full">
                <Search className="h-10 w-10 mb-3 text-primary" />
                <p className="font-semibold">No se encontraron proveedores disponibles a menos de 20km.</p>
                <p className="text-sm">Intenta buscar en otra área o expandir tu radio de búsqueda (funcionalidad futura).</p>
              </div>
            )}
             {isMapApiLoaded && !mapApiLoadError && googleMapsApiKey && !providersVisibleInPanel && ( // Mensaje cuando no hay proveedores visibles o no se han buscado
                 <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-full">
                    <MapPinned className="h-10 w-10 mb-3 text-primary" />
                    <p className="font-semibold">Calculando proveedores cercanos...</p>
                    <p className="text-sm">La lista de servicios aparecerá aquí si se encuentran dentro del radio y después de una búsqueda (funcionalidad actual: se muestran si están cerca de Culiacán).</p>
                </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
    

    

    