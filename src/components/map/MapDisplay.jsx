'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  GoogleMap, 
  useJsApiLoader, 
  Marker, 
  InfoWindow,
  MarkerClusterer 
} from '@react-google-maps/api';
import { 
  MapPin, 
  Star, 
  Clock, 
  Crown, 
  Shield,
  Navigation,
  ZoomIn,
  ZoomOut,
  Layers,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

// Configuración del mapa
const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 19.4326,
  lng: -99.1332 // Ciudad de México
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
  gestureHandling: 'greedy',
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'transit',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

export default function MapDisplay({ 
  providers = [], 
  businesses = [],
  selectedProvider = null,
  onProviderSelect,
  onMapClick,
  showControls = true,
  className = "",
  height = "400px"
}) {
  const { currentLocation, requestLocation } = useLocation();
  const { userProfile } = useAuth();
  
  const [map, setMap] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(13);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState({
    providers: true,
    businesses: true,
    premium: true,
    available: true
  });
  const [isLoading, setIsLoading] = useState(false);

  const mapRef = useRef(null);

  // Cargar Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places', 'geometry']
  });

  // Actualizar centro del mapa cuando cambie la ubicación
  useEffect(() => {
    if (currentLocation) {
      setMapCenter({
        lat: currentLocation.lat,
        lng: currentLocation.lng
      });
    }
  }, [currentLocation]);

  // Centrar mapa en proveedor seleccionado
  useEffect(() => {
    if (selectedProvider && map) {
      const providerLocation = {
        lat: selectedProvider.location._latitude,
        lng: selectedProvider.location._longitude
      };
      map.panTo(providerLocation);
      setSelectedMarker(selectedProvider);
    }
  }, [selectedProvider, map]);

  const onLoad = useCallback((map) => {
    setMap(map);
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
    mapRef.current = null;
  }, []);

  // Obtener proveedores en el área visible
  const refreshProviders = async () => {
    if (!map) return;

    setIsLoading(true);
    try {
      const bounds = map.getBounds();
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      const response = await fetch('/api/providers/in-bounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounds: {
            north: ne.lat(),
            south: sw.lat(),
            east: ne.lng(),
            west: sw.lng()
          },
          filters: visibleTypes
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Actualizar providers a través del componente padre
        // onProvidersUpdate?.(data.providers);
      }
    } catch (error) {
      console.error('Error refreshing providers:', error);
      toast({
        title: "Error",
        description: "No se pudieron actualizar los prestadores",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Ir a ubicación actual
  const goToCurrentLocation = () => {
    if (currentLocation && map) {
      map.panTo({
        lat: currentLocation.lat,
        lng: currentLocation.lng
      });
      map.setZoom(15);
    } else {
      requestLocation();
    }
  };

  // Crear íconos personalizados para markers
  const getMarkerIcon = (type, isAvailable, isPremium) => {
    let color = '#9ca3af'; // Gris por defecto
    
    if (type === 'provider') {
      if (!isAvailable) {
        color = '#9ca3af'; // Gris para no disponible
      } else if (isPremium) {
        color = '#FFD700'; // Gold para premium
      } else {
        color = '#3ce923'; // Verde para disponible
      }
    } else if (type === 'business') {
      color = '#60cdff'; // Azul para negocios
    }

    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 8
    };
  };

  // Manejar click en marker
  const handleMarkerClick = (item, type) => {
    setSelectedMarker(item);
    if (onProviderSelect && type === 'provider') {
      onProviderSelect(item);
    }
  };

  // Filtrar items según filtros activos
  const getFilteredProviders = () => {
    return providers.filter(provider => {
      if (!visibleTypes.providers) return false;
      if (!visibleTypes.available && !provider.isAvailable) return false;
      if (!visibleTypes.premium && provider.isPremium) return false;
      return true;
    });
  };

  const getFilteredBusinesses = () => {
    return visibleTypes.businesses ? businesses : [];
  };

  if (loadError) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ height }}>
        <div className="text-center p-6">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Error cargando el mapa</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ height }}>
        <div className="text-center p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`} style={{ height }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
        onClick={onMapClick}
        onZoomChanged={() => {
          if (map) {
            setMapZoom(map.getZoom());
          }
        }}
      >
        {/* Marker de ubicación actual */}
        {currentLocation && (
          <Marker
            position={{
              lat: currentLocation.lat,
              lng: currentLocation.lng
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
              scale: 10
            }}
            title="Tu ubicación"
          />
        )}

        {/* Markers de prestadores */}
        {getFilteredProviders().map((provider) => (
          <Marker
            key={provider.id}
            position={{
              lat: provider.location._latitude,
              lng: provider.location._longitude
            }}
            icon={getMarkerIcon('provider', provider.isAvailable, provider.isPremium)}
            onClick={() => handleMarkerClick(provider, 'provider')}
            title={provider.displayName}
          />
        ))}

        {/* Markers de negocios */}
        {getFilteredBusinesses().map((business) => (
          <Marker
            key={business.id}
            position={{
              lat: business.location._latitude,
              lng: business.location._longitude
            }}
            icon={getMarkerIcon('business')}
            onClick={() => handleMarkerClick(business, 'business')}
            title={business.businessName}
          />
        ))}

        {/* InfoWindow para marker seleccionado */}
        {selectedMarker && (
          <InfoWindow
            position={{
              lat: selectedMarker.location._latitude,
              lng: selectedMarker.location._longitude
            }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <MarkerInfoCard item={selectedMarker} />
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Controles del mapa */}
      {showControls && (
        <>
          {/* Controles de zoom */}
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => map?.setZoom(map.getZoom() + 1)}
              className="bg-white shadow-md"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => map?.setZoom(map.getZoom() - 1)}
              className="bg-white shadow-md"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Control de ubicación actual */}
          <div className="absolute bottom-20 right-4">
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentLocation}
              className="bg-white shadow-md"
            >
              <Navigation className="h-4 w-4" />
            </Button>
          </div>

          {/* Controles de filtros */}
          <div className="absolute top-4 left-4 flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="bg-white shadow-md"
            >
              <Layers className="h-4 w-4 mr-1" />
              Capas
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={refreshProviders}
              disabled={isLoading}
              className="bg-white shadow-md"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Panel de filtros */}
          {showFilters && (
            <div className="absolute top-16 left-4 bg-white rounded-lg shadow-lg p-4 space-y-3 min-w-48">
              <h3 className="font-semibold text-sm">Mostrar en el mapa:</h3>
              
              <FilterToggle
                label="Prestadores"
                checked={visibleTypes.providers}
                onChange={(checked) => setVisibleTypes(prev => ({ ...prev, providers: checked }))}
                color="green"
              />
              
              <FilterToggle
                label="Negocios locales"
                checked={visibleTypes.businesses}
                onChange={(checked) => setVisibleTypes(prev => ({ ...prev, businesses: checked }))}
                color="blue"
              />
              
              <FilterToggle
                label="Solo disponibles"
                checked={visibleTypes.available}
                onChange={(checked) => setVisibleTypes(prev => ({ ...prev, available: checked }))}
                color="green"
              />
              
              <FilterToggle
                label="Premium"
                checked={visibleTypes.premium}
                onChange={(checked) => setVisibleTypes(prev => ({ ...prev, premium: checked }))}
                color="yellow"
              />
            </div>
          )}
        </>
      )}

      {/* Leyenda del mapa */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3">
        <div className="flex items-center space-x-4 text-xs">
          <LegendItem color="#3ce923" label="Disponible" />
          <LegendItem color="#FFD700" label="Premium" />
          <LegendItem color="#60cdff" label="Negocio" />
          <LegendItem color="#9ca3af" label="No disponible" />
        </div>
      </div>
    </div>
  );
}

// Componente para la tarjeta de información del marker
function MarkerInfoCard({ item }) {
  const isProvider = !!item.displayName;
  
  return (
    <Card className="min-w-64 max-w-80">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-sm">
                {isProvider ? item.displayName : item.businessName}
              </h3>
              <p className="text-xs text-gray-600">
                {isProvider ? item.specialty : item.category}
              </p>
            </div>
            
            {isProvider && (
              <div className="flex items-center space-x-1">
                {item.isPremium && <Crown className="h-4 w-4 text-yellow-500" />}
                {item.isProvider && <Shield className="h-4 w-4 text-blue-500" />}
              </div>
            )}
          </div>

          {/* Calificación */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
              <span className="text-sm ml-1">{item.rating?.toFixed(1) || 'N/A'}</span>
            </div>
            <span className="text-xs text-gray-500">
              ({item.reviewCount || 0} reseñas)
            </span>
          </div>

          {/* Estado de disponibilidad */}
          {isProvider && (
            <div>
              <Badge 
                variant={item.isAvailable ? "secondary" : "outline"}
                className={item.isAvailable ? "bg-green-100 text-green-800" : ""}
              >
                <Clock className="h-3 w-3 mr-1" />
                {item.isAvailable ? 'Disponible ahora' : 'No disponible'}
              </Badge>
            </div>
          )}

          {/* Precio aproximado */}
          {item.priceRange && (
            <p className="text-sm text-gray-600">
              Desde ${item.priceRange.min} - ${item.priceRange.max}
            </p>
          )}

          {/* Botones de acción */}
          <div className="flex space-x-2 pt-2">
            <Button size="sm" className="flex-1">
              Ver perfil
            </Button>
            {isProvider && item.isAvailable && (
              <Button size="sm" variant="outline" className="flex-1">
                Contactar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente para toggle de filtros
function FilterToggle({ label, checked, onChange, color }) {
  return (
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 focus:ring-purple-500"
      />
      <div className={`w-3 h-3 rounded-full bg-${color}-500`}></div>
      <span className="text-sm">{label}</span>
    </label>
  );
}

// Componente para item de leyenda
function LegendItem({ color, label }) {
  return (
    <div className="flex items-center space-x-1">
      <div 
        className="w-3 h-3 rounded-full border border-white" 
        style={{ backgroundColor: color }}
      ></div>
      <span>{label}</span>
    </div>
  );
}