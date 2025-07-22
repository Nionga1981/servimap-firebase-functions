'use client';

import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Star, 
  MapPin, 
  Clock, 
  Phone, 
  MessageCircle,
  Calendar,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Grid,
  List,
  Crown,
  Shield,
  Verified,
  MoreHorizontal,
  Share2,
  Copy,
  Trash2,
  Edit,
  ChevronDown,
  Users,
  Award,
  Sparkles,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function FavoritesManager({ className = "" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [filteredFavorites, setFilteredFavorites] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [favoritesList, setFavoritesList] = useState([]);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [selectedFavorites, setSelectedFavorites] = useState([]);

  // Datos mock para demostración
  const mockFavorites = [
    {
      id: '1',
      providerId: 'p1',
      displayName: 'María González',
      specialty: 'Limpieza Residencial',
      photoURL: null,
      rating: 4.9,
      reviewCount: 127,
      priceRange: { min: 150, max: 300 },
      distance: 1.2,
      isAvailable: true,
      isPremium: true,
      isVerified: true,
      fastResponse: true,
      emergencyAvailable: true,
      servicesCompleted: 8,
      lastServiceDate: new Date('2024-01-15'),
      addedDate: new Date('2023-12-20'),
      notes: 'Excelente trabajo en limpieza profunda',
      category: 'limpieza',
      lists: ['preferidos', 'limpieza-casa']
    },
    {
      id: '2',
      providerId: 'p2',
      displayName: 'Carlos Méndez',
      specialty: 'Plomería y Reparaciones',
      photoURL: null,
      rating: 4.7,
      reviewCount: 89,
      priceRange: { min: 200, max: 450 },
      distance: 2.8,
      isAvailable: false,
      isPremium: true,
      isVerified: true,
      fastResponse: false,
      emergencyAvailable: true,
      servicesCompleted: 4,
      lastServiceDate: new Date('2024-01-10'),
      addedDate: new Date('2024-01-05'),
      notes: 'Muy puntual y profesional',
      category: 'plomeria',
      lists: ['casa']
    },
    {
      id: '3',
      providerId: 'p3',
      displayName: 'Ana López',
      specialty: 'Electricista Certificada',
      photoURL: null,
      rating: 4.8,
      reviewCount: 156,
      priceRange: { min: 180, max: 350 },
      distance: 0.8,
      isAvailable: true,
      isPremium: false,
      isVerified: true,
      fastResponse: true,
      emergencyAvailable: false,
      servicesCompleted: 3,
      lastServiceDate: new Date('2024-01-08'),
      addedDate: new Date('2023-11-15'),
      notes: 'Muy confiable para trabajo eléctrico',
      category: 'electricidad',
      lists: ['preferidos']
    },
    {
      id: '4',
      providerId: 'p4',
      displayName: 'Pedro Ramírez',
      specialty: 'Jardinería y Paisajismo',
      photoURL: null,
      rating: 4.6,
      reviewCount: 73,
      priceRange: { min: 120, max: 280 },
      distance: 3.5,
      isAvailable: true,
      isPremium: false,
      isVerified: false,
      fastResponse: true,
      emergencyAvailable: false,
      servicesCompleted: 2,
      lastServiceDate: new Date('2023-12-28'),
      addedDate: new Date('2023-12-01'),
      notes: '',
      category: 'jardineria',
      lists: []
    }
  ];

  const mockFavoriteLists = [
    {
      id: '1',
      name: 'Preferidos',
      description: 'Mis prestadores de confianza',
      providersCount: 3,
      isDefault: true,
      createdAt: new Date('2023-11-01'),
      color: 'red'
    },
    {
      id: '2',
      name: 'Casa',
      description: 'Servicios para el hogar',
      providersCount: 2,
      isDefault: false,
      createdAt: new Date('2023-12-01'),
      color: 'blue'
    },
    {
      id: '3',
      name: 'Limpieza Casa',
      description: 'Especialistas en limpieza',
      providersCount: 1,
      isDefault: false,
      createdAt: new Date('2024-01-01'),
      color: 'green'
    }
  ];

  useEffect(() => {
    loadFavorites();
    loadFavoriteLists();
  }, []);

  useEffect(() => {
    filterAndSortFavorites();
  }, [favorites, searchTerm, selectedCategory, sortBy]);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      // TODO: Reemplazar con llamada real a la API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setFavorites(mockFavorites);
    } catch (error) {
      console.error('Error loading favorites:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los favoritos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFavoriteLists = async () => {
    try {
      // TODO: Reemplazar con llamada real a la API
      setFavoritesList(mockFavoriteLists);
    } catch (error) {
      console.error('Error loading favorite lists:', error);
    }
  };

  const filterAndSortFavorites = () => {
    let filtered = [...favorites];

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(favorite => 
        favorite.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        favorite.specialty.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por categoría
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(favorite => favorite.category === selectedCategory);
    }

    // Ordenar
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate));
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'services':
        filtered.sort((a, b) => b.servicesCompleted - a.servicesCompleted);
        break;
      case 'distance':
        filtered.sort((a, b) => a.distance - b.distance);
        break;
      case 'name':
        filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      default:
        break;
    }

    setFilteredFavorites(filtered);
  };

  const removeFavorite = async (favoriteId) => {
    try {
      // TODO: Llamada a API para remover favorito
      setFavorites(prev => prev.filter(f => f.id !== favoriteId));
      toast({
        title: "Favorito eliminado",
        description: "El prestador ha sido removido de tus favoritos"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el favorito",
        variant: "destructive"
      });
    }
  };

  const createFavoriteList = async () => {
    if (!newListName.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa un nombre para la lista",
        variant: "destructive"
      });
      return;
    }

    try {
      const newList = {
        id: Date.now().toString(),
        name: newListName,
        description: newListDescription,
        providersCount: 0,
        isDefault: false,
        createdAt: new Date(),
        color: 'purple'
      };

      setFavoritesList(prev => [...prev, newList]);
      setNewListName('');
      setNewListDescription('');
      
      toast({
        title: "Lista creada",
        description: `Lista "${newListName}" creada exitosamente`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear la lista",
        variant: "destructive"
      });
    }
  };

  const shareProvider = (provider) => {
    const shareUrl = `${window.location.origin}/provider/${provider.providerId}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Enlace copiado",
      description: "El enlace del prestador ha sido copiado al portapapeles"
    });
  };

  const contactProvider = (provider) => {
    navigate(`/chat?provider=${provider.providerId}`);
  };

  const scheduleService = (provider) => {
    navigate(`/request/${provider.providerId}`);
  };

  const getDistanceText = (distance) => {
    return distance < 1 
      ? `${Math.round(distance * 1000)}m`
      : `${distance.toFixed(1)}km`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('es-MX', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const getCategories = () => {
    const categories = [...new Set(favorites.map(f => f.category))];
    return categories.map(cat => ({
      value: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1)
    }));
  };

  const renderFavoriteCard = (favorite) => (
    <Card key={favorite.id} className="hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <Avatar className="h-12 w-12">
                <AvatarImage src={favorite.photoURL} alt={favorite.displayName} />
                <AvatarFallback>
                  {favorite.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold truncate">{favorite.displayName}</h3>
                  {favorite.isPremium && <Crown className="h-4 w-4 text-yellow-500" />}
                  {favorite.isVerified && <Verified className="h-4 w-4 text-blue-500" />}
                </div>
                
                <p className="text-gray-600 text-sm mb-2 truncate">{favorite.specialty}</p>
                
                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-500 fill-current mr-1" />
                    <span className="font-medium">{favorite.rating?.toFixed(1)}</span>
                    <span className="text-gray-500 ml-1">({favorite.reviewCount})</span>
                  </div>
                  
                  <div className="flex items-center text-gray-500">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{getDistanceText(favorite.distance)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => shareProvider(favorite)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/provider/${favorite.providerId}`)}>
                  <Users className="h-4 w-4 mr-2" />
                  Ver perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => removeFavorite(favorite.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div>
                <span className="text-gray-600">Servicios: </span>
                <span className="font-medium">{favorite.servicesCompleted}</span>
              </div>
              <div>
                <span className="text-gray-600">Último: </span>
                <span className="font-medium">{formatDate(favorite.lastServiceDate)}</span>
              </div>
            </div>
            
            <Badge 
              variant={favorite.isAvailable ? "secondary" : "outline"}
              className={favorite.isAvailable ? "bg-green-100 text-green-800" : ""}
            >
              <Clock className="h-3 w-3 mr-1" />
              {favorite.isAvailable ? 'Disponible' : 'Ocupado'}
            </Badge>
          </div>

          {/* Precio */}
          {favorite.priceRange && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Desde </span>
              <span className="font-semibold text-green-600">
                {formatCurrency(favorite.priceRange.min)}
              </span>
            </div>
          )}

          {/* Notas */}
          {favorite.notes && (
            <div className="p-2 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">{favorite.notes}</p>
            </div>
          )}

          {/* Badges adicionales */}
          <div className="flex flex-wrap gap-2">
            {favorite.fastResponse && (
              <Badge variant="outline" className="text-xs">
                Respuesta rápida
              </Badge>
            )}
            {favorite.emergencyAvailable && (
              <Badge variant="outline" className="text-xs">
                Emergencias
              </Badge>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex space-x-2 pt-2">
            <Button 
              onClick={() => contactProvider(favorite)}
              variant="outline" 
              className="flex-1"
              size="sm"
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Contactar
            </Button>
            <Button 
              onClick={() => scheduleService(favorite)}
              className="flex-1"
              size="sm"
              disabled={!favorite.isAvailable}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Agendar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderFavoriteListItem = (favorite) => (
    <div key={favorite.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-center space-x-3 flex-1">
        <Avatar className="h-10 w-10">
          <AvatarImage src={favorite.photoURL} alt={favorite.displayName} />
          <AvatarFallback>
            {favorite.displayName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium truncate">{favorite.displayName}</h3>
            {favorite.isPremium && <Crown className="h-3 w-3 text-yellow-500" />}
            {favorite.isVerified && <Verified className="h-3 w-3 text-blue-500" />}
          </div>
          <p className="text-sm text-gray-600 truncate">{favorite.specialty}</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <div className="flex items-center text-sm">
            <Star className="h-3 w-3 text-yellow-500 fill-current mr-1" />
            <span>{favorite.rating?.toFixed(1)}</span>
          </div>
          <div className="text-xs text-gray-500">{favorite.servicesCompleted} servicios</div>
        </div>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => contactProvider(favorite)}
            className="h-8 w-8 p-0"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scheduleService(favorite)}
            className="h-8 w-8 p-0"
            disabled={!favorite.isAvailable}
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => shareProvider(favorite)}>
                <Share2 className="h-4 w-4 mr-2" />
                Compartir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => removeFavorite(favorite.id)} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-lg mb-6"></div>
          <div className="h-16 bg-gray-200 rounded-lg mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl">
            <Heart className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Favoritos</h1>
            <p className="text-gray-600">{favorites.length} prestadores guardados</p>
          </div>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Sparkles className="h-4 w-4 mr-2" />
              Nueva Lista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Lista de Favoritos</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="listName">Nombre de la lista</Label>
                <Input
                  id="listName"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Ej: Limpieza del hogar"
                />
              </div>
              <div>
                <Label htmlFor="listDescription">Descripción (opcional)</Label>
                <Textarea
                  id="listDescription"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Describe para qué usarás esta lista"
                  rows={3}
                />
              </div>
              <Button onClick={createFavoriteList} className="w-full">
                Crear Lista
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros y controles */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre o especialidad..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {getCategories().map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Más recientes</SelectItem>
                <SelectItem value="rating">Mayor rating</SelectItem>
                <SelectItem value="services">Más servicios</SelectItem>
                <SelectItem value="distance">Más cerca</SelectItem>
                <SelectItem value="name">Nombre A-Z</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs para listas */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="all">
            Todos ({favorites.length})
          </TabsTrigger>
          {favoritesList.slice(0, 3).map(list => (
            <TabsTrigger key={list.id} value={list.id}>
              {list.name} ({list.providersCount})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {filteredFavorites.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'No se encontraron favoritos' 
                  : 'No tienes favoritos aún'
                }
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedCategory !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Explora prestadores y agrégalos a tus favoritos'
                }
              </p>
              <Button onClick={() => navigate('/search')}>
                Buscar Prestadores
              </Button>
            </div>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
                : 'space-y-3'
            }>
              {filteredFavorites.map(favorite => 
                viewMode === 'grid' 
                  ? renderFavoriteCard(favorite)
                  : renderFavoriteListItem(favorite)
              )}
            </div>
          )}
        </TabsContent>

        {favoritesList.map(list => (
          <TabsContent key={list.id} value={list.id} className="space-y-4">
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Lista: {list.name}
              </h3>
              <p className="text-gray-600 mb-4">
                {list.description || 'Sin descripción'}
              </p>
              <p className="text-sm text-gray-500">
                Esta funcionalidad estará disponible próximamente
              </p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}