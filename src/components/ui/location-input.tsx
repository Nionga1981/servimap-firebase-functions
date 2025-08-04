/**
 * LocationInput - Material Design 3 Location Input Component for ServiMap
 * 
 * Input de ubicación con integración de mapas, autocompletado de direcciones,
 * detección de ubicación GPS y selección manual en mapa.
 * 
 * @component
 * @example
 * <LocationInput
 *   value="Carrera 15 #93-47, Bogotá"
 *   onChange={(location) => setLocation(location)}
 *   onLocationSelect={(coords) => handleLocationSelect(coords)}
 *   placeholder="Ingresa tu ubicación"
 *   showCurrentLocation={true}
 *   showMapPicker={true}
 * />
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { 
  MapPin, 
  Navigation, 
  Search,
  X,
  Loader2,
  Map,
  Home,
  Briefcase,
  Clock,
  Star,
  ChevronDown,
  Target,
  AlertCircle
} from 'lucide-react';
import { ServiButton } from './servi-button';

interface LocationCoordinates {
  lat: number;
  lng: number;
}

interface LocationData {
  /** Dirección formateada */
  address: string;
  /** Coordenadas */
  coordinates?: LocationCoordinates;
  /** Ciudad */
  city?: string;
  /** Departamento/Estado */
  state?: string;
  /** País */
  country?: string;
  /** Código postal */
  postalCode?: string;
  /** Tipo de lugar (casa, oficina, etc.) */
  placeType?: 'home' | 'work' | 'other';
  /** Nombre personalizado */
  customName?: string;
}

interface LocationSuggestion {
  /** ID único de la sugerencia */
  id: string;
  /** Dirección principal */
  address: string;
  /** Descripción secundaria */
  description?: string;
  /** Coordenadas */
  coordinates: LocationCoordinates;
  /** Tipo de lugar */
  type: 'address' | 'business' | 'landmark';
  /** Distancia en metros (opcional) */
  distance?: number;
}

interface SavedLocation extends LocationData {
  /** ID único */
  id: string;
  /** Nombre para mostrar */
  name: string;
  /** Icono personalizado */
  icon?: React.ReactNode;
  /** Usado frecuentemente */
  isFrequent?: boolean;
}

interface LocationInputProps {
  /** Valor actual */
  value: string;
  /** Callback cuando cambia el valor */
  onChange: (value: string) => void;
  /** Callback cuando se selecciona una ubicación completa */
  onLocationSelect?: (location: LocationData) => void;
  /** Placeholder del input */
  placeholder?: string;
  /** Mostrar botón de ubicación actual */
  showCurrentLocation?: boolean;
  /** Mostrar selector de mapa */
  showMapPicker?: boolean;
  /** Ubicaciones guardadas del usuario */
  savedLocations?: SavedLocation[];
  /** Sugerencias personalizadas */
  customSuggestions?: LocationSuggestion[];
  /** Error de validación */
  error?: string;
  /** Estado de loading */
  loading?: boolean;
  /** Deshabilitado */
  disabled?: boolean;
  /** Mostrar solo direcciones (no negocios) */
  addressOnly?: boolean;
  /** País para filtrar resultados */
  country?: string;
  /** Clase CSS adicional */
  className?: string;
}

// Hook para obtener ubicación actual
const useCurrentLocation = () => {
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLoading(false);
      },
      (error) => {
        setError('No se pudo obtener la ubicación');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutos
      }
    );
  }, []);

  return { location, loading, error, getCurrentLocation };
};

export const LocationInput: React.FC<LocationInputProps> = ({
  value,
  onChange,
  onLocationSelect,
  placeholder = "Ingresa tu ubicación",
  showCurrentLocation = true,
  showMapPicker = false,
  savedLocations = [],
  customSuggestions = [],
  error,
  loading = false,
  disabled = false,
  addressOnly = false,
  country = 'CO',
  className
}) => {
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const { location: currentLocation, loading: gpsLoading, getCurrentLocation } = useCurrentLocation();

  // Simulated address search (en producción usar Google Places API)
  const searchAddresses = useCallback(async (query: string): Promise<LocationSuggestion[]> => {
    if (query.length < 3) return [];

    // Simulación de resultados de búsqueda
    const mockResults: LocationSuggestion[] = [
      {
        id: '1',
        address: `${query} #12-34`,
        description: 'Bogotá, Colombia',
        coordinates: { lat: 4.7110, lng: -74.0721 },
        type: 'address'
      },
      {
        id: '2',
        address: `${query} Centro Comercial`,
        description: 'Centro comercial • 2.5 km',
        coordinates: { lat: 4.7150, lng: -74.0681 },
        type: 'business',
        distance: 2500
      },
      {
        id: '3',
        address: `Parque ${query}`,
        description: 'Parque público • 1.8 km',
        coordinates: { lat: 4.7080, lng: -74.0751 },
        type: 'landmark',
        distance: 1800
      }
    ];

    return mockResults;
  }, []);

  // Buscar sugerencias con debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length >= 3) {
      debounceRef.current = setTimeout(async () => {
        setLoadingSuggestions(true);
        try {
          const results = await searchAddresses(value);
          setSuggestions(results);
        } catch (error) {
          console.error('Error searching addresses:', error);
        } finally {
          setLoadingSuggestions(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, searchAddresses]);

  // Manejar click fuera del componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manejar selección de sugerencia
  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    onChange(suggestion.address);
    onLocationSelect?.({
      address: suggestion.address,
      coordinates: suggestion.coordinates,
      city: suggestion.description?.split(',')[0],
      country: 'Colombia'
    });
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  // Manejar selección de ubicación guardada
  const handleSavedLocationSelect = (savedLocation: SavedLocation) => {
    onChange(savedLocation.address);
    onLocationSelect?.(savedLocation);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  // Manejar ubicación actual
  const handleCurrentLocation = async () => {
    getCurrentLocation();
    // En producción, usar reverse geocoding para obtener la dirección
    if (currentLocation) {
      onChange(`${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`);
      onLocationSelect?.({
        address: 'Mi ubicación actual',
        coordinates: currentLocation
      });
    }
  };

  // Limpiar input
  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  // Mostrar/ocultar sugerencias
  const toggleSuggestions = () => {
    if (focused || value.length > 0 || savedLocations.length > 0) {
      setShowSuggestions(true);
    }
  };

  const showLocationOptions = savedLocations.length > 0 && value.length === 0;
  const showSearchResults = suggestions.length > 0 && value.length >= 3;
  const showDropdown = showSuggestions && (showLocationOptions || showSearchResults || loadingSuggestions);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Input principal */}
      <div className={cn(
        "relative flex items-center gap-3 px-4 py-3 bg-[var(--color-surface-container-highest)] rounded-xl transition-all duration-200",
        focused && "ring-2 ring-[var(--color-primary-60)]/20 bg-white shadow-md",
        error && "ring-2 ring-error/20 bg-red-50",
        disabled && "opacity-50 cursor-not-allowed"
      )}>
        {/* Icono de ubicación */}
        <MapPin className={cn(
          "w-5 h-5 flex-shrink-0 transition-colors duration-200",
          focused ? "text-[var(--color-primary-60)]" : "text-[var(--color-on-surface-variant)]",
          error && "text-error"
        )} />

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            toggleSuggestions();
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]"
          autoComplete="off"
        />

        {/* Acciones del lado derecho */}
        <div className="flex items-center gap-1">
          {/* Loading */}
          {(loading || gpsLoading) && (
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary-60)]" />
          )}

          {/* Clear button */}
          {value && !loading && (
            <button
              type="button"
              className="p-1.5 hover:bg-black/5 rounded-full transition-colors"
              onClick={handleClear}
              disabled={disabled}
            >
              <X className="w-4 h-4 text-[var(--color-on-surface-variant)]" />
            </button>
          )}

          {/* Ubicación actual */}
          {showCurrentLocation && (
            <button
              type="button"
              className="p-1.5 hover:bg-[var(--color-primary-60)]/10 rounded-full transition-colors"
              onClick={handleCurrentLocation}
              disabled={disabled || gpsLoading}
              title="Usar mi ubicación actual"
            >
              <Navigation className="w-5 h-5 text-[var(--color-primary-60)]" />
            </button>
          )}

          {/* Selector de mapa */}
          {showMapPicker && (
            <button
              type="button"
              className="p-1.5 hover:bg-[var(--color-primary-60)]/10 rounded-full transition-colors"
              onClick={() => setShowMapModal(true)}
              disabled={disabled}
              title="Seleccionar en mapa"
            >
              <Map className="w-5 h-5 text-[var(--color-primary-60)]" />
            </button>
          )}

          {/* Dropdown indicator */}
          {(savedLocations.length > 0 || suggestions.length > 0) && (
            <ChevronDown className={cn(
              "w-4 h-4 text-[var(--color-on-surface-variant)] transition-transform duration-200",
              showDropdown && "rotate-180"
            )} />
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 mt-2 text-sm text-error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Dropdown de sugerencias */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg border border-[var(--color-outline-variant)] overflow-hidden z-50 max-h-80 overflow-y-auto">
          {/* Ubicaciones guardadas */}
          {showLocationOptions && (
            <div className="p-2">
              <div className="px-3 py-2 text-sm font-medium text-[var(--color-on-surface-variant)]">
                Ubicaciones guardadas
              </div>
              {savedLocations.map((location) => (
                <button
                  key={location.id}
                  className="w-full px-3 py-3 text-left hover:bg-[var(--color-surface-container)] rounded-lg transition-colors flex items-center gap-3"
                  onClick={() => handleSavedLocationSelect(location)}
                >
                  <div className="flex-shrink-0">
                    {location.icon || (
                      location.placeType === 'home' ? <Home className="w-5 h-5 text-green-600" /> :
                      location.placeType === 'work' ? <Briefcase className="w-5 h-5 text-blue-600" /> :
                      <MapPin className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--color-on-surface)] truncate">
                      {location.name}
                    </div>
                    <div className="text-sm text-[var(--color-on-surface-variant)] truncate">
                      {location.address}
                    </div>
                  </div>
                  {location.isFrequent && (
                    <Star className="w-4 h-4 text-yellow-500" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Separador */}
          {showLocationOptions && showSearchResults && (
            <div className="border-t border-[var(--color-outline-variant)]" />
          )}

          {/* Loading de sugerencias */}
          {loadingSuggestions && (
            <div className="p-4 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary-60)]" />
              <span className="ml-2 text-sm text-[var(--color-on-surface-variant)]">
                Buscando ubicaciones...
              </span>
            </div>
          )}

          {/* Resultados de búsqueda */}
          {showSearchResults && !loadingSuggestions && (
            <div className="p-2">
              <div className="px-3 py-2 text-sm font-medium text-[var(--color-on-surface-variant)]">
                Resultados de búsqueda
              </div>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  className="w-full px-3 py-3 text-left hover:bg-[var(--color-surface-container)] rounded-lg transition-colors flex items-start gap-3"
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {suggestion.type === 'business' ? (
                      <Briefcase className="w-4 h-4 text-blue-600" />
                    ) : suggestion.type === 'landmark' ? (
                      <Star className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <MapPin className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--color-on-surface)] line-clamp-1">
                      {suggestion.address}
                    </div>
                    {suggestion.description && (
                      <div className="text-sm text-[var(--color-on-surface-variant)] line-clamp-1">
                        {suggestion.description}
                      </div>
                    )}
                  </div>
                  {suggestion.distance && (
                    <div className="text-xs text-[var(--color-on-surface-variant)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {suggestion.distance > 1000 
                        ? `${(suggestion.distance / 1000).toFixed(1)} km`
                        : `${suggestion.distance}m`
                      }
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Usar ubicación actual */}
          {showCurrentLocation && value.length > 0 && (
            <>
              <div className="border-t border-[var(--color-outline-variant)]" />
              <div className="p-2">
                <button
                  className="w-full px-3 py-3 text-left hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-3"
                  onClick={handleCurrentLocation}
                  disabled={gpsLoading}
                >
                  <Target className="w-5 h-5 text-[var(--color-primary-60)]" />
                  <span className="text-[var(--color-primary-60)] font-medium">
                    {gpsLoading ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal de mapa (placeholder) */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/50 z-[var(--z-modal)] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Seleccionar ubicación</h3>
              <button
                className="p-2 hover:bg-gray-100 rounded-full"
                onClick={() => setShowMapModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Placeholder para mapa */}
            <div className="bg-gray-200 h-64 rounded-lg flex items-center justify-center mb-4">
              <div className="text-center">
                <Map className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Mapa interactivo</p>
                <p className="text-sm text-gray-500">Funcionalidad en desarrollo</p>
              </div>
            </div>

            <div className="flex gap-3">
              <ServiButton
                variant="outlined"
                onClick={() => setShowMapModal(false)}
                className="flex-1"
              >
                Cancelar
              </ServiButton>
              <ServiButton
                variant="filled"
                onClick={() => setShowMapModal(false)}
                className="flex-1"
              >
                Confirmar
              </ServiButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationInput;