// Simple Google Maps implementation for ServiMap
"use client";

import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, Phone, Star, Search } from 'lucide-react';

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 19.4326,
  lng: -99.1332
};

const mockProviders = [
  {
    id: 1,
    name: "Carlos Martínez",
    service: "Plomería",
    rating: 4.9,
    reviews: 156,
    available: true,
    price: "$300/hr",
    position: { lat: 19.4326, lng: -99.1332 }
  },
  {
    id: 2,
    name: "Ana García",
    service: "Limpieza", 
    rating: 4.8,
    reviews: 89,
    available: true,
    price: "$250/hr",
    position: { lat: 19.4350, lng: -99.1300 }
  },
  {
    id: 3,
    name: "Miguel López",
    service: "Electricidad",
    rating: 4.9,
    reviews: 203,
    available: false,
    price: "$400/hr",
    position: { lat: 19.4280, lng: -99.1380 }
  }
];

export function SimpleMapDisplay() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  const filteredProviders = mockProviders.filter(provider =>
    provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.service.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isLoaded) return <div className="flex items-center justify-center h-full">Cargando mapa...</div>;

  return (
    <div className="relative h-full w-full">
      {/* Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-white rounded-lg shadow-lg p-3">
          <div className="flex gap-2">
            <Search className="h-5 w-5 text-gray-400 mt-2" />
            <Input
              type="text"
              placeholder="Buscar servicios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {/* Google Map */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* User location marker */}
        <Marker
          position={center}
          icon={{
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="8" fill="#3B82F6" stroke="white" stroke-width="2"/>
                <circle cx="10" cy="10" r="3" fill="white"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(20, 20),
          }}
          title="Tu ubicación"
        />

        {/* Provider markers */}
        {filteredProviders.map((provider) => (
          <Marker
            key={provider.id}
            position={provider.position}
            onClick={() => setSelectedProvider(provider)}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 3C19.418 3 23 6.582 23 11C23 17 15 27 15 27S7 17 7 11C7 6.582 10.582 3 15 3Z" 
                        fill="${provider.available ? '#10B981' : '#6B7280'}" stroke="white" stroke-width="2"/>
                  <circle cx="15" cy="11" r="4" fill="white"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(30, 30),
            }}
            title={`${provider.name} - ${provider.service}`}
          />
        ))}

        {/* Info window */}
        {selectedProvider && (
          <InfoWindow
            position={selectedProvider.position}
            onCloseClick={() => setSelectedProvider(null)}
          >
            <Card className="w-64 border-0 shadow-none">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{selectedProvider.name}</h3>
                    <Badge variant={selectedProvider.available ? "default" : "secondary"}>
                      {selectedProvider.available ? "Disponible" : "Ocupado"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{selectedProvider.service}</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="text-sm">{selectedProvider.rating}</span>
                    <span className="text-sm text-gray-500">({selectedProvider.reviews} reseñas)</span>
                  </div>
                  <p className="font-medium text-blue-600">{selectedProvider.price}</p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => alert(`Conectando con ${selectedProvider.name}...`)}
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Contactar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => alert(`Solicitando ${selectedProvider.service}...`)}
                      disabled={!selectedProvider.available}
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      Solicitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Results counter */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2">
        <p className="text-sm font-medium">
          {filteredProviders.length} prestador{filteredProviders.length !== 1 ? 'es' : ''} encontrado{filteredProviders.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}