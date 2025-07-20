import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, 
  Search, 
  Filter, 
  List, 
  Map, 
  Star, 
  Phone, 
  MessageCircle, 
  Navigation, 
  Building,
  Eye,
  Clock,
  ChevronDown,
  Sliders,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';

const NearbyBusinesses = ({ userLocation, onBusinessSelect }) => {
  const [businesses, setBusinesses] = useState([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [error, setError] = useState('');

  // Filtros
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    rating: [0],
    distance: [2000], // metros
    openNow: false,
    hasPromo: false
  });

  // Datos mock para desarrollo
  const mockBusinesses = [
    {
      id: 'biz_001',
      name: 'Farmacia San José',
      category: 'Farmacia',
      address: 'Av. Reforma 123, Col. Centro',
      location: { lat: 19.4326, lng: -99.1332 },
      distance: 450, // metros
      isLaunchPromo: true,
      subscriptionStatus: 'active',
      profile: {
        description: 'Farmacia con medicamentos de patente y genéricos',
        photos: ['https://via.placeholder.com/200x150/3ce923/white?text=Farmacia'],
        rating: 4.7,
        reviewCount: 127,
        contact: {
          phone: '55 1234 5678',
          whatsapp: '55 1234 5678'
        },
        hours: {
          monday: { open: '08:00', close: '20:00', closed: false },
          tuesday: { open: '08:00', close: '20:00', closed: false },
          wednesday: { open: '08:00', close: '20:00', closed: false },
          thursday: { open: '08:00', close: '20:00', closed: false },
          friday: { open: '08:00', close: '20:00', closed: false },
          saturday: { open: '08:00', close: '18:00', closed: false },
          sunday: { open: '09:00', close: '14:00', closed: false }
        }
      },
      stats: { views: 1250, clicks: 89 }
    },
    {
      id: 'biz_002',
      name: 'Panadería El Sol',
      category: 'Panadería',
      address: 'Calle Principal 456, Col. Roma',
      location: { lat: 19.4284, lng: -99.1410 },
      distance: 850,
      isLaunchPromo: false,
      subscriptionStatus: 'active',
      profile: {
        description: 'Pan artesanal recién horneado todos los días',
        photos: ['https://via.placeholder.com/200x150/FFD700/black?text=Panaderia'],
        rating: 4.5,
        reviewCount: 89,
        contact: {
          phone: '55 8765 4321',
          whatsapp: '55 8765 4321'
        },
        hours: {
          monday: { open: '06:00', close: '19:00', closed: false },
          tuesday: { open: '06:00', close: '19:00', closed: false },
          wednesday: { open: '06:00', close: '19:00', closed: false },
          thursday: { open: '06:00', close: '19:00', closed: false },
          friday: { open: '06:00', close: '19:00', closed: false },
          saturday: { open: '06:00', close: '15:00', closed: false },
          sunday: { open: '', close: '', closed: true }
        }
      },
      stats: { views: 890, clicks: 45 }
    },
    {
      id: 'biz_003',
      name: 'Ferretería Los Compadres',
      category: 'Ferretería',
      address: 'Av. Universidad 789, Col. Del Valle',
      location: { lat: 19.4189, lng: -99.1677 },
      distance: 1200,
      isLaunchPromo: true,
      subscriptionStatus: 'active',
      profile: {
        description: 'Todo para tu hogar y construcción. Herramientas profesionales.',
        photos: ['https://via.placeholder.com/200x150/60cdff/white?text=Ferreteria'],
        rating: 4.3,
        reviewCount: 156,
        contact: {
          phone: '55 5555 0000',
          whatsapp: '55 5555 0000'
        },
        hours: {
          monday: { open: '07:00', close: '18:00', closed: false },
          tuesday: { open: '07:00', close: '18:00', closed: false },
          wednesday: { open: '07:00', close: '18:00', closed: false },
          thursday: { open: '07:00', close: '18:00', closed: false },
          friday: { open: '07:00', close: '18:00', closed: false },
          saturday: { open: '07:00', close: '16:00', closed: false },
          sunday: { open: '', close: '', closed: true }
        }
      },
      stats: { views: 670, clicks: 34 }
    },
    {
      id: 'biz_004',
      name: 'Supermercado Fresh',
      category: 'Supermercado',
      address: 'Blvd. Insurgentes 321, Col. Hipódromo',
      location: { lat: 19.4150, lng: -99.1647 },
      distance: 1800,
      isLaunchPromo: false,
      subscriptionStatus: 'active',
      profile: {
        description: 'Productos frescos y abarrotes a los mejores precios',
        photos: ['https://via.placeholder.com/200x150/ac7afc/white?text=Supermercado'],
        rating: 4.1,
        reviewCount: 234,
        contact: {
          phone: '55 7777 8888',
          whatsapp: '55 7777 8888'
        },
        hours: {
          monday: { open: '07:00', close: '22:00', closed: false },
          tuesday: { open: '07:00', close: '22:00', closed: false },
          wednesday: { open: '07:00', close: '22:00', closed: false },
          thursday: { open: '07:00', close: '22:00', closed: false },
          friday: { open: '07:00', close: '22:00', closed: false },
          saturday: { open: '07:00', close: '22:00', closed: false },
          sunday: { open: '08:00', close: '20:00', closed: false }
        }
      },
      stats: { views: 2100, clicks: 156 }
    }
  ];

  const categories = [
    'Farmacia', 'Panadería', 'Ferretería', 'Supermercado', 'Tienda', 
    'Restaurante', 'Veterinaria', 'Lavandería', 'Papelería', 'Otro'
  ];

  const fetchNearbyBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Simular llamada a API
      // const result = await getNearbyFixedBusinesses({
      //   location: userLocation,
      //   radius: filters.distance[0]
      // });
      
      // Usar datos mock para desarrollo
      setTimeout(() => {
        setBusinesses(mockBusinesses);
        setFilteredBusinesses(mockBusinesses);
        setLoading(false);
      }, 1000);
      
    } catch (err) {
      setError('Error cargando negocios cercanos: ' + err.message);
      setLoading(false);
    }
  }, [userLocation, filters.distance]);

  useEffect(() => {
    if (userLocation) {
      fetchNearbyBusinesses();
    }
  }, [fetchNearbyBusinesses]);

  useEffect(() => {
    applyFilters();
  }, [filters, businesses]);

  const isOpenNow = (hours) => {
    if (!hours) return false;
    
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    const todayHours = hours[currentDay];
    if (!todayHours || todayHours.closed) return false;
    
    return currentTime >= todayHours.open && currentTime <= todayHours.close;
  };

  const applyFilters = () => {
    let filtered = [...businesses];

    // Filtro por búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(business => 
        business.name.toLowerCase().includes(searchLower) ||
        business.category.toLowerCase().includes(searchLower) ||
        business.address.toLowerCase().includes(searchLower)
      );
    }

    // Filtro por categoría
    if (filters.category !== 'all') {
      filtered = filtered.filter(business => business.category === filters.category);
    }

    // Filtro por rating
    if (filters.rating[0] > 0) {
      filtered = filtered.filter(business => 
        business.profile.rating >= filters.rating[0]
      );
    }

    // Filtro por distancia
    filtered = filtered.filter(business => business.distance <= filters.distance[0]);

    // Filtro por abierto ahora
    if (filters.openNow) {
      filtered = filtered.filter(business => isOpenNow(business.profile.hours));
    }

    // Filtro por promoción
    if (filters.hasPromo) {
      filtered = filtered.filter(business => business.isLaunchPromo);
    }

    // Ordenar por distancia
    filtered.sort((a, b) => a.distance - b.distance);

    setFilteredBusinesses(filtered);
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      rating: [0],
      distance: [2000],
      openNow: false,
      hasPromo: false
    });
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const handleContact = (type, value) => {
    switch (type) {
      case 'phone':
        window.open(`tel:${value}`);
        break;
      case 'whatsapp':
        window.open(`https://wa.me/${value.replace(/\s/g, '')}`);
        break;
      default:
        break;
    }
  };

  const getDirections = (business) => {
    if (business.location) {
      const { lat, lng } = business.location;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    }
  };

  // Componente de mapa placeholder
  const MapView = () => (
    <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
      <div className="text-center">
        <Map className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Vista de Mapa</p>
        <p className="text-sm text-gray-500">Google Maps se integrará aquí</p>
        <div className="mt-4 space-y-2">
          {filteredBusinesses.slice(0, 3).map((business) => (
            <div key={business.id} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-[#ac7afc] rounded-full"></div>
              <span>{business.name}</span>
              <span className="text-gray-500">({formatDistance(business.distance)})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#ac7afc] mx-auto mb-4" />
            <p className="text-gray-600">Buscando negocios cercanos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#ac7afc]">Negocios Cercanos</h1>
          <p className="text-gray-600">
            {filteredBusinesses.length} negocios encontrados
            {userLocation && ` cerca de tu ubicación`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-[#ac7afc] hover:bg-purple-600' : ''}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            onClick={() => setViewMode('map')}
            className={viewMode === 'map' ? 'bg-[#ac7afc] hover:bg-purple-600' : ''}
          >
            <Map className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Barra de búsqueda y filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[300px]">
              <Input
                placeholder="Buscar negocios por nombre, categoría o dirección..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full"
              />
            </div>

            <Select 
              value={filters.category} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Sliders className="w-4 h-4" />
              Filtros
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>

            {(filters.search || filters.category !== 'all' || filters.rating[0] > 0 || filters.openNow || filters.hasPromo) && (
              <Button variant="outline" onClick={resetFilters}>
                <X className="w-4 h-4 mr-2" />
                Limpiar
              </Button>
            )}
          </div>

          {/* Filtros avanzados */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Rating mínimo: {filters.rating[0]}{filters.rating[0] > 0 ? ' estrellas' : ' (cualquiera)'}
                  </Label>
                  <Slider
                    value={filters.rating}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}
                    max={5}
                    min={0}
                    step={0.5}
                    className="w-full"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Distancia máxima: {formatDistance(filters.distance[0])}
                  </Label>
                  <Slider
                    value={filters.distance}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, distance: value }))}
                    max={5000}
                    min={100}
                    step={100}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="openNow"
                    checked={filters.openNow}
                    onChange={(e) => setFilters(prev => ({ ...prev, openNow: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="openNow" className="text-sm font-medium">
                    Solo abiertos ahora
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hasPromo"
                    checked={filters.hasPromo}
                    onChange={(e) => setFilters(prev => ({ ...prev, hasPromo: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="hasPromo" className="text-sm font-medium">
                    Con promoción 3x1
                  </Label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contenido principal */}
      {viewMode === 'map' ? (
        <Card>
          <CardContent className="p-6">
            <MapView />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBusinesses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  No se encontraron negocios
                </h3>
                <p className="text-gray-500 mb-4">
                  Intenta ajustar los filtros o buscar en un área más amplia
                </p>
                <Button onClick={resetFilters} className="bg-[#ac7afc] hover:bg-purple-600">
                  Limpiar Filtros
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredBusinesses.map((business) => (
              <Card key={business.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    {/* Imagen */}
                    <div className="w-32 h-24 flex-shrink-0">
                      {business.profile.photos && business.profile.photos[0] ? (
                        <img 
                          src={business.profile.photos[0]}
                          alt={business.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#ac7afc] rounded-lg flex items-center justify-center">
                          <Building className="w-8 h-8 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Información principal */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-semibold text-[#ac7afc] mb-1">
                            {business.name}
                          </h3>
                          <p className="text-gray-600 text-sm">{business.category}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={`${isOpenNow(business.profile.hours) ? 'bg-[#3ce923] text-white' : 'bg-red-500 text-white'}`}>
                            {isOpenNow(business.profile.hours) ? 'Abierto' : 'Cerrado'}
                          </Badge>
                          {business.isLaunchPromo && (
                            <Badge className="bg-[#FFD700] text-black">
                              🎉 Promo
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{formatDistance(business.distance)}</span>
                        </div>
                        
                        {business.profile.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-[#FFD700] fill-current" />
                            <span>{business.profile.rating}</span>
                            <span className="text-gray-500">({business.profile.reviewCount})</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{business.stats.views.toLocaleString()} vistas</span>
                        </div>
                      </div>

                      <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                        {business.profile.description}
                      </p>

                      <p className="text-gray-600 text-sm mb-4">
                        📍 {business.address}
                      </p>

                      {/* Acciones */}
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm"
                          onClick={() => onBusinessSelect?.(business)}
                          className="bg-[#ac7afc] hover:bg-purple-600 text-white"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Ver Perfil
                        </Button>
                        
                        {business.profile.contact.phone && (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleContact('phone', business.profile.contact.phone)}
                            className="text-[#3ce923] border-[#3ce923]"
                          >
                            <Phone className="w-3 h-3 mr-1" />
                            Llamar
                          </Button>
                        )}
                        
                        {business.profile.contact.whatsapp && (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleContact('whatsapp', business.profile.contact.whatsapp)}
                            className="text-[#25D366] border-[#25D366]"
                          >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            WhatsApp
                          </Button>
                        )}
                        
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => getDirections(business)}
                          className="text-[#60cdff] border-[#60cdff]"
                        >
                          <Navigation className="w-3 h-3 mr-1" />
                          Ir
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Resumen de resultados */}
      {filteredBusinesses.length > 0 && (
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-[#ac7afc]">{filteredBusinesses.length}</p>
                <p className="text-sm text-gray-600">Negocios encontrados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#3ce923]">
                  {filteredBusinesses.filter(b => isOpenNow(b.profile.hours)).length}
                </p>
                <p className="text-sm text-gray-600">Abiertos ahora</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#FFD700]">
                  {filteredBusinesses.filter(b => b.isLaunchPromo).length}
                </p>
                <p className="text-sm text-gray-600">Con promoción</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#60cdff]">
                  {formatDistance(Math.min(...filteredBusinesses.map(b => b.distance)))}
                </p>
                <p className="text-sm text-gray-600">Más cercano</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NearbyBusinesses;