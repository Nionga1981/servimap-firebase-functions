import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, Navigation, Target, Check, X } from 'lucide-react';

const LocationPicker = ({ 
  onLocationSelect, 
  initialLocation = null,
  allowManualEntry = true,
  showSearchBox = true,
  mapHeight = '400px',
  className = ''
}) => {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState(null);
  const [draggedLocation, setDraggedLocation] = useState(null);
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const searchBoxRef = useRef(null);

  // Initialize Google Maps
  useEffect(() => {
    if (window.google && window.google.maps) {
      initializeMap();
    } else {
      // Load Google Maps script if not already loaded
      loadGoogleMapsScript();
    }
  }, []);

  // Update marker when selectedLocation changes
  useEffect(() => {
    if (mapInstanceRef.current && selectedLocation) {
      updateMarker(selectedLocation);
      mapInstanceRef.current.setCenter(selectedLocation);
    }
  }, [selectedLocation]);

  const loadGoogleMapsScript = () => {
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initializeMap;
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    const defaultLocation = selectedLocation || { lat: 19.4326, lng: -99.1332 }; // Mexico City

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: defaultLocation,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    // Create draggable marker
    markerRef.current = new window.google.maps.Marker({
      position: defaultLocation,
      map: mapInstanceRef.current,
      draggable: true,
      title: 'Arrastra para seleccionar ubicación'
    });

    // Handle marker drag
    markerRef.current.addListener('dragend', (event) => {
      const newLocation = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      setDraggedLocation(newLocation);
      reverseGeocode(newLocation);
    });

    // Handle map click
    mapInstanceRef.current.addListener('click', (event) => {
      const newLocation = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      setSelectedLocation(newLocation);
      updateMarker(newLocation);
      reverseGeocode(newLocation);
    });

    // Initialize search box if enabled
    if (showSearchBox && searchBoxRef.current) {
      initializeSearchBox();
    }

    setMapLoaded(true);
    
    // Get user's current location
    getCurrentLocation();
  };

  const initializeSearchBox = () => {
    if (!window.google || !searchBoxRef.current) return;

    const searchBox = new window.google.maps.places.SearchBox(searchBoxRef.current);
    
    // Listen for place changes
    searchBox.addListener('places_changed', () => {
      const places = searchBox.getPlaces();
      if (places.length === 0) return;

      const place = places[0];
      if (!place.geometry || !place.geometry.location) return;

      const location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };

      setSelectedLocation(location);
      updateMarker(location);
      mapInstanceRef.current.setCenter(location);
      
      // Clear search results
      setShowResults(false);
      setSearchResults([]);
    });
  };

  const updateMarker = (location) => {
    if (markerRef.current) {
      markerRef.current.setPosition(location);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentUserLocation(userLocation);
          
          // If no initial location, use user's location
          if (!selectedLocation) {
            setSelectedLocation(userLocation);
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setCenter(userLocation);
              updateMarker(userLocation);
            }
          }
        },
        (error) => {
          console.log('Error getting current location:', error);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    }
  };

  const searchPlaces = async (query) => {
    if (!query.trim() || !window.google) return;

    setIsSearching(true);
    
    try {
      const service = new window.google.maps.places.PlacesService(mapInstanceRef.current);
      
      const request = {
        query: query,
        location: selectedLocation || currentUserLocation || { lat: 19.4326, lng: -99.1332 },
        radius: 5000,
        fields: ['name', 'geometry', 'formatted_address', 'place_id']
      };

      service.textSearch(request, (results, status) => {
        setIsSearching(false);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          const searchResults = results.slice(0, 5).map(place => ({
            id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            }
          }));
          
          setSearchResults(searchResults);
          setShowResults(true);
        } else {
          setSearchResults([]);
          setShowResults(false);
        }
      });
    } catch (error) {
      console.error('Error searching places:', error);
      setIsSearching(false);
    }
  };

  const reverseGeocode = async (location) => {
    if (!window.google) return;

    const geocoder = new window.google.maps.Geocoder();
    
    geocoder.geocode({ location }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const address = results[0].formatted_address;
        setSearchQuery(address);
      }
    });
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.length > 2) {
      searchPlaces(value);
    } else {
      setShowResults(false);
      setSearchResults([]);
    }
  };

  const handleSearchResultClick = (result) => {
    setSelectedLocation(result.location);
    setSearchQuery(result.address);
    setShowResults(false);
    setSearchResults([]);
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(result.location);
      updateMarker(result.location);
    }
  };

  const handleUseCurrentLocation = () => {
    if (currentUserLocation) {
      setSelectedLocation(currentUserLocation);
      setSearchQuery('Tu ubicación actual');
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter(currentUserLocation);
        updateMarker(currentUserLocation);
      }
    } else {
      getCurrentLocation();
    }
  };

  const handleConfirmLocation = () => {
    const finalLocation = draggedLocation || selectedLocation;
    if (finalLocation && onLocationSelect) {
      onLocationSelect({
        ...finalLocation,
        address: searchQuery
      });
    }
  };

  const handleCancel = () => {
    if (onLocationSelect) {
      onLocationSelect(null);
    }
  };

  return (
    <div className={`location-picker ${className}`}>
      {/* Search Box */}
      {showSearchBox && (
        <div className="relative mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              ref={searchBoxRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              placeholder="Buscar dirección o lugar..."
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSearchResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900">{result.name}</div>
                      <div className="text-sm text-gray-600">{result.address}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleUseCurrentLocation}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Navigation className="w-4 h-4" />
          <span className="text-sm font-medium">Usar mi ubicación</span>
        </button>
        
        <div className="text-sm text-gray-600">
          <Target className="w-4 h-4 inline mr-1" />
          Toca el mapa o arrastra el marcador
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div
          ref={mapRef}
          style={{ height: mapHeight }}
          className="w-full rounded-lg border border-gray-300"
        />
        
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <span className="text-gray-600">Cargando mapa...</span>
            </div>
          </div>
        )}
      </div>

      {/* Location Info */}
      {(selectedLocation || draggedLocation) && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start space-x-3">
            <MapPin className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Ubicación seleccionada</div>
              <div className="text-sm text-gray-600 mt-1">
                {searchQuery || 'Coordenadas: ' + 
                  `${(draggedLocation || selectedLocation).lat.toFixed(6)}, ${(draggedLocation || selectedLocation).lng.toFixed(6)}`}
              </div>
              {draggedLocation && (
                <div className="text-xs text-blue-600 mt-1">
                  ℹ️ Ubicación modificada arrastrando el marcador
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Coordinates Entry */}
      {allowManualEntry && (
        <div className="mt-4 p-4 border border-gray-200 rounded-lg">
          <div className="text-sm font-medium text-gray-700 mb-2">
            O ingresa coordenadas manualmente:
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="any"
              placeholder="Latitud"
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              onChange={(e) => {
                const lat = parseFloat(e.target.value);
                if (!isNaN(lat) && selectedLocation) {
                  const newLocation = { ...selectedLocation, lat };
                  setSelectedLocation(newLocation);
                }
              }}
            />
            <input
              type="number"
              step="any"
              placeholder="Longitud"
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              onChange={(e) => {
                const lng = parseFloat(e.target.value);
                if (!isNaN(lng) && selectedLocation) {
                  const newLocation = { ...selectedLocation, lng };
                  setSelectedLocation(newLocation);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {onLocationSelect && (
        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={handleCancel}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Cancelar</span>
          </button>
          
          <button
            onClick={handleConfirmLocation}
            disabled={!selectedLocation && !draggedLocation}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            <span>Confirmar ubicación</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;