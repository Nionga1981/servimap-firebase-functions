'use client';

import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Plus, 
  Edit, 
  Trash2, 
  Star,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Award,
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Share2,
  Download,
  Grid,
  List,
  Search,
  Filter,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Heart,
  MessageCircle,
  Play,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function ProviderPortfolio({ providerId, className = "" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [portfolio, setPortfolio] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    completedDate: '',
    images: [],
    videos: [],
    isVisible: true,
    tags: []
  });

  // Categorías disponibles
  const categories = [
    { id: 'all', label: 'Todos', count: 0 },
    { id: 'limpieza', label: 'Limpieza', count: 0 },
    { id: 'plomeria', label: 'Plomería', count: 0 },
    { id: 'electricidad', label: 'Electricidad', count: 0 },
    { id: 'jardineria', label: 'Jardinería', count: 0 },
    { id: 'construccion', label: 'Construcción', count: 0 },
    { id: 'otros', label: 'Otros', count: 0 }
  ];

  // Datos mock del portfolio
  const mockPortfolio = [
    {
      id: '1',
      title: 'Remodelación completa de cocina',
      description: 'Renovación total de cocina incluyendo instalación de nuevos gabinetes, encimeras de granito y electrodomésticos modernos.',
      category: 'construccion',
      location: 'Polanco, CDMX',
      completedDate: new Date('2024-01-15'),
      images: [
        'https://picsum.photos/800/600?random=1',
        'https://picsum.photos/800/600?random=2',
        'https://picsum.photos/800/600?random=3'
      ],
      videos: ['https://sample-videos.com/mp4/720/mp4/SampleVideo_720x480_1mb.mp4'],
      rating: 5.0,
      clientName: 'Familia Rodríguez',
      projectValue: 85000,
      duration: '3 semanas',
      isVisible: true,
      tags: ['remodelación', 'cocina', 'modernización'],
      likes: 24,
      views: 180
    },
    {
      id: '2',
      title: 'Instalación eléctrica industrial',
      description: 'Instalación completa del sistema eléctrico para nave industrial de 500m².',
      category: 'electricidad',
      location: 'Naucalpan, Estado de México',
      completedDate: new Date('2024-01-10'),
      images: [
        'https://picsum.photos/800/600?random=4',
        'https://picsum.photos/800/600?random=5'
      ],
      videos: [],
      rating: 4.8,
      clientName: 'Industrias del Norte',
      projectValue: 120000,
      duration: '2 semanas',
      isVisible: true,
      tags: ['industrial', 'instalación', 'alta tensión'],
      likes: 18,
      views: 95
    },
    {
      id: '3',
      title: 'Jardín vertical corporativo',
      description: 'Diseño e implementación de jardín vertical de 20m² en oficinas corporativas.',
      category: 'jardineria',
      location: 'Santa Fe, CDMX',
      completedDate: new Date('2024-01-05'),
      images: [
        'https://picsum.photos/800/600?random=6',
        'https://picsum.photos/800/600?random=7',
        'https://picsum.photos/800/600?random=8',
        'https://picsum.photos/800/600?random=9'
      ],
      videos: ['https://sample-videos.com/mp4/720/mp4/SampleVideo_720x480_2mb.mp4'],
      rating: 4.9,
      clientName: 'Tech Solutions SA',
      projectValue: 45000,
      duration: '1 semana',
      isVisible: true,
      tags: ['jardín vertical', 'corporativo', 'sustentable'],
      likes: 32,
      views: 210
    },
    {
      id: '4',
      title: 'Reparación sistema de plomería',
      description: 'Reparación y actualización completa del sistema de plomería en edificio residencial.',
      category: 'plomeria',
      location: 'Roma Norte, CDMX',
      completedDate: new Date('2023-12-28'),
      images: [
        'https://picsum.photos/800/600?random=10'
      ],
      videos: [],
      rating: 4.7,
      clientName: 'Condominio Torres del Parque',
      projectValue: 35000,
      duration: '5 días',
      isVisible: false,
      tags: ['plomería', 'reparación', 'residencial'],
      likes: 12,
      views: 67
    },
    {
      id: '5',
      title: 'Limpieza post-construcción',
      description: 'Limpieza profunda post-construcción de oficinas corporativas de 800m².',
      category: 'limpieza',
      location: 'Interlomas, Estado de México',
      completedDate: new Date('2023-12-20'),
      images: [
        'https://picsum.photos/800/600?random=11',
        'https://picsum.photos/800/600?random=12'
      ],
      videos: [],
      rating: 5.0,
      clientName: 'Desarrollos Comerciales',
      projectValue: 18000,
      duration: '2 días',
      isVisible: true,
      tags: ['limpieza', 'post-construcción', 'comercial'],
      likes: 8,
      views: 45
    }
  ];

  useEffect(() => {
    loadPortfolio();
  }, [providerId]);

  useEffect(() => {
    updateCategoryCounts();
  }, [portfolio]);

  const loadPortfolio = async () => {
    setLoading(true);
    try {
      // TODO: Cargar portfolio real
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPortfolio(mockPortfolio);
    } catch (error) {
      console.error('Error loading portfolio:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el portfolio",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateCategoryCounts = () => {
    const counts = portfolio.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      acc.all = (acc.all || 0) + 1;
      return acc;
    }, {});

    categories.forEach(cat => {
      cat.count = counts[cat.id] || 0;
    });
  };

  const filteredPortfolio = portfolio.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  const handleAddItem = async () => {
    if (!newItem.title || !newItem.category) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa el título y la categoría",
        variant: "destructive"
      });
      return;
    }

    try {
      const item = {
        ...newItem,
        id: Date.now().toString(),
        completedDate: new Date(newItem.completedDate),
        likes: 0,
        views: 0,
        rating: 0
      };

      setPortfolio(prev => [item, ...prev]);
      
      toast({
        title: "Proyecto agregado",
        description: "El proyecto se agregó exitosamente al portfolio"
      });

      setNewItem({
        title: '',
        description: '',
        category: '',
        location: '',
        completedDate: '',
        images: [],
        videos: [],
        isVisible: true,
        tags: []
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el proyecto",
        variant: "destructive"
      });
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      setPortfolio(prev => prev.filter(item => item.id !== itemId));
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto se eliminó del portfolio"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el proyecto",
        variant: "destructive"
      });
    }
  };

  const toggleVisibility = async (itemId) => {
    try {
      setPortfolio(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, isVisible: !item.isVisible }
          : item
      ));
      
      const item = portfolio.find(p => p.id === itemId);
      toast({
        title: item?.isVisible ? "Proyecto oculto" : "Proyecto visible",
        description: item?.isVisible 
          ? "El proyecto ya no será visible para los clientes"
          : "El proyecto ahora es visible para los clientes"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la visibilidad",
        variant: "destructive"
      });
    }
  };

  const sharePortfolio = () => {
    const shareUrl = `${window.location.origin}/provider/${providerId}/portfolio`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Enlace copiado",
      description: "El enlace del portfolio ha sido copiado al portapapeles"
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  const getCategoryLabel = (categoryId) => {
    return categories.find(cat => cat.id === categoryId)?.label || categoryId;
  };

  const PortfolioItemDialog = ({ item }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Eye className="h-4 w-4 mr-2" />
          Ver detalles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Imágenes principales */}
          {item.images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {item.images.map((image, index) => (
                <div key={index} className="aspect-video rounded-lg overflow-hidden">
                  <img 
                    src={image} 
                    alt={`${item.title} - ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Información del proyecto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Descripción</h4>
                <p className="text-gray-700">{item.description}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Detalles</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                    <span>{item.location}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                    <span>Completado en {formatDate(item.completedDate)}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-gray-500 mr-2" />
                    <span>Duración: {item.duration}</span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 text-gray-500 mr-2" />
                    <span>Valor: {formatCurrency(item.projectValue)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Cliente</h4>
                <p className="text-gray-700">{item.clientName}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Calificación</h4>
                <div className="flex items-center">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`h-4 w-4 ${i < Math.floor(item.rating) ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
                      />
                    ))}
                  </div>
                  <span className="ml-2 text-sm text-gray-600">({item.rating})</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Estadísticas</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Heart className="h-4 w-4 mr-2" />
                    <span>{item.likes} me gusta</span>
                  </div>
                  <div className="flex items-center">
                    <Eye className="h-4 w-4 mr-2" />
                    <span>{item.views} visualizaciones</span>
                  </div>
                </div>
              </div>

              {item.tags.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Etiquetas</h4>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Videos */}
          {item.videos.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Videos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {item.videos.map((video, index) => (
                  <div key={index} className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Play className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Video del proyecto</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  const AddItemDialog = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Proyecto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Proyecto</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Título del proyecto *</Label>
              <Input
                id="title"
                value={newItem.title}
                onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Remodelación de cocina"
              />
            </div>

            <div>
              <Label htmlFor="category">Categoría *</Label>
              <Select 
                value={newItem.category} 
                onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(cat => cat.id !== 'all').map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={newItem.description}
              onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe el proyecto realizado..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                value={newItem.location}
                onChange={(e) => setNewItem(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Ej: Polanco, CDMX"
              />
            </div>

            <div>
              <Label htmlFor="completedDate">Fecha de finalización</Label>
              <Input
                id="completedDate"
                type="date"
                value={newItem.completedDate}
                onChange={(e) => setNewItem(prev => ({ ...prev, completedDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label>Imágenes del proyecto</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Arrastra las imágenes aquí o haz clic para seleccionar</p>
              <p className="text-xs text-gray-500">Máximo 10 imágenes, JPG o PNG</p>
              <Button variant="outline" className="mt-4">
                <Camera className="h-4 w-4 mr-2" />
                Seleccionar Imágenes
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isVisible"
              checked={newItem.isVisible}
              onChange={(e) => setNewItem(prev => ({ ...prev, isVisible: e.target.checked }))}
              className="rounded"
            />
            <Label htmlFor="isVisible">Visible en el portfolio público</Label>
          </div>

          <div className="flex space-x-3">
            <Button variant="outline" className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleAddItem} className="flex-1">
              Agregar Proyecto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderPortfolioGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredPortfolio.map((item) => (
        <Card key={item.id} className="hover:shadow-lg transition-all duration-200">
          <div className="relative">
            {item.images.length > 0 ? (
              <div className="aspect-video rounded-t-lg overflow-hidden">
                <img 
                  src={item.images[0]} 
                  alt={item.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                />
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-gray-400" />
              </div>
            )}
            
            <div className="absolute top-3 right-3 flex space-x-2">
              {!item.isVisible && (
                <Badge className="bg-gray-800 text-white">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Oculto
                </Badge>
              )}
              <Badge className="bg-white text-gray-800">
                {getCategoryLabel(item.category)}
              </Badge>
            </div>

            {item.images.length > 1 && (
              <div className="absolute bottom-3 right-3">
                <Badge className="bg-black/50 text-white">
                  +{item.images.length - 1}
                </Badge>
              </div>
            )}
          </div>
          
          <CardContent className="p-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>{formatDate(item.completedDate)}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center">
                    <Heart className="h-3 w-3 mr-1" />
                    <span>{item.likes}</span>
                  </div>
                  <div className="flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    <span>{item.views}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`h-3 w-3 ${i < Math.floor(item.rating) ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
                    />
                  ))}
                  <span className="ml-1 text-xs text-gray-600">({item.rating})</span>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <PortfolioItemDialog item={item} />
                    <DropdownMenuItem onClick={() => toggleVisibility(item.id)}>
                      {item.isVisible ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Mostrar
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderPortfolioList = () => (
    <div className="space-y-4">
      {filteredPortfolio.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-4">
              <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                {item.images.length > 0 ? (
                  <img 
                    src={item.images[0]} 
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {getCategoryLabel(item.category)}
                      </Badge>
                      {!item.isVisible && (
                        <Badge className="bg-gray-100 text-gray-600 text-xs">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Oculto
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span>{item.location}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{formatDate(item.completedDate)}</span>
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1" />
                        <span>{formatCurrency(item.projectValue)}</span>
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
                      <PortfolioItemDialog item={item} />
                      <DropdownMenuItem onClick={() => toggleVisibility(item.id)}>
                        {item.isVisible ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Ocultar
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Mostrar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-lg mb-6"></div>
          <div className="h-16 bg-gray-200 rounded-lg mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
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
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
            <Award className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
            <p className="text-gray-600">{portfolio.length} proyectos completados</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={sharePortfolio}>
            <Share2 className="h-4 w-4 mr-2" />
            Compartir
          </Button>
          <AddItemDialog />
        </div>
      </div>

      {/* Filtros y controles */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar proyectos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label} ({cat.count})
                  </SelectItem>
                ))}
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

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{portfolio.length}</div>
            <div className="text-sm text-gray-600">Proyectos Totales</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {portfolio.filter(p => p.isVisible).length}
            </div>
            <div className="text-sm text-gray-600">Públicos</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {portfolio.reduce((acc, p) => acc + p.views, 0)}
            </div>
            <div className="text-sm text-gray-600">Visualizaciones</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {portfolio.reduce((acc, p) => acc + p.likes, 0)}
            </div>
            <div className="text-sm text-gray-600">Me Gusta</div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Content */}
      {filteredPortfolio.length === 0 ? (
        <div className="text-center py-12">
          <Award className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm || selectedCategory !== 'all' 
              ? 'No se encontraron proyectos' 
              : 'No tienes proyectos aún'
            }
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory !== 'all'
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Agrega tu primer proyecto para mostrar tu trabajo'
            }
          </p>
          {!searchTerm && selectedCategory === 'all' && (
            <AddItemDialog />
          )}
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? renderPortfolioGrid() : renderPortfolioList()}
        </>
      )}
    </div>
  );
}