import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Phone, 
  MessageCircle, 
  Mail, 
  Globe, 
  Facebook,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Building,
  Calendar,
  Share2,
  Heart,
  Camera,
  Video,
  Navigation,
  Check,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

const BusinessProfile = ({ businessId, onBack }) => {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [error, setError] = useState('');

  // Datos mock para desarrollo
  const mockBusiness = {
    id: 'biz_001',
    name: 'Farmacia San José',
    category: 'Farmacia',
    address: 'Av. Reforma 123, Col. Centro',
    location: { lat: 19.4326, lng: -99.1332 },
    subscriptionStatus: 'active',
    isLaunchPromo: true,
    promoEndsAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 días
    profile: {
      description: 'Farmacia con más de 20 años de experiencia. Contamos con medicamentos de patente y genéricos, servicio de consultas médicas y entrega a domicilio. Aceptamos todas las tarjetas y ofrecemos descuentos especiales para adultos mayores.',
      photos: [
        'https://via.placeholder.com/600x400/3ce923/white?text=Farmacia+Exterior',
        'https://via.placeholder.com/600x400/ac7afc/white?text=Interior+Medicamentos',
        'https://via.placeholder.com/600x400/60cdff/white?text=Area+Consultas'
      ],
      video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      hours: {
        monday: { open: '08:00', close: '20:00', closed: false },
        tuesday: { open: '08:00', close: '20:00', closed: false },
        wednesday: { open: '08:00', close: '20:00', closed: false },
        thursday: { open: '08:00', close: '20:00', closed: false },
        friday: { open: '08:00', close: '20:00', closed: false },
        saturday: { open: '08:00', close: '18:00', closed: false },
        sunday: { open: '09:00', close: '14:00', closed: false }
      },
      contact: {
        phone: '55 1234 5678',
        whatsapp: '55 1234 5678',
        email: 'farmacia.sanjose@email.com',
        facebook: 'facebook.com/farmacia-san-jose',
        website: 'www.farmaciasanjose.com'
      },
      rating: 4.7,
      reviewCount: 127
    },
    stats: {
      views: 1250,
      clicks: 89,
      monthlyViews: 340
    },
    ambassador: {
      name: 'Juan Pérez',
      code: 'JUAN2025001'
    },
    createdAt: new Date('2024-12-01')
  };

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setBusiness(mockBusiness);
      setLoading(false);
    }, 800);
  }, [businessId]);

  const getDayName = (dayKey) => {
    const days = {
      monday: 'Lunes',
      tuesday: 'Martes', 
      wednesday: 'Miércoles',
      thursday: 'Jueves',
      friday: 'Viernes',
      saturday: 'Sábado',
      sunday: 'Domingo'
    };
    return days[dayKey] || dayKey;
  };

  const formatHours = (hours) => {
    if (hours.closed) return 'Cerrado';
    return `${hours.open} - ${hours.close}`;
  };

  const isOpenNow = () => {
    if (!business?.profile?.hours) return false;
    
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    const todayHours = business.profile.hours[currentDay];
    if (!todayHours || todayHours.closed) return false;
    
    return currentTime >= todayHours.open && currentTime <= todayHours.close;
  };

  const nextPhoto = () => {
    if (business?.profile?.photos) {
      setCurrentPhotoIndex((prev) => 
        prev === business.profile.photos.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevPhoto = () => {
    if (business?.profile?.photos) {
      setCurrentPhotoIndex((prev) => 
        prev === 0 ? business.profile.photos.length - 1 : prev - 1
      );
    }
  };

  const handleContact = (type, value) => {
    switch (type) {
      case 'phone':
        window.open(`tel:${value}`);
        break;
      case 'whatsapp':
        window.open(`https://wa.me/${value.replace(/\s/g, '')}`);
        break;
      case 'email':
        window.open(`mailto:${value}`);
        break;
      case 'website':
        window.open(`https://${value.replace(/^https?:\/\//, '')}`);
        break;
      case 'facebook':
        window.open(`https://${value.replace(/^https?:\/\//, '')}`);
        break;
      default:
        break;
    }
  };

  const getDirections = () => {
    if (business?.location) {
      const { lat, lng } = business.location;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    }
  };

  const shareProfile = async () => {
    const shareData = {
      title: business?.name,
      text: `Visita ${business?.name} - ${business?.category}`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Fallback a copiar link
        navigator.clipboard.writeText(window.location.href);
        alert('Link copiado al portapapeles');
      }
    } else {
      setShowShareDialog(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ac7afc]"></div>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>
            No se pudo cargar la información del negocio.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header con navegación */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" />
          Volver
        </Button>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsFavorite(!isFavorite)}
            className={isFavorite ? 'text-red-500 border-red-500' : ''}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </Button>
          <Button variant="outline" onClick={shareProfile}>
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Header del negocio */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-[#ac7afc] rounded-lg flex items-center justify-center">
              <Building className="w-8 h-8 text-white" />
            </div>
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#ac7afc] mb-1">{business.name}</h1>
              <p className="text-gray-600 mb-2">{business.category}</p>
              
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">{business.address}</span>
              </div>
              
              {business.profile.rating && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-4 h-4 ${
                          i < Math.floor(business.profile.rating) 
                            ? 'text-[#FFD700] fill-current' 
                            : 'text-gray-300'
                        }`} 
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{business.profile.rating}</span>
                  <span className="text-sm text-gray-500">({business.profile.reviewCount} reseñas)</span>
                </div>
              )}
            </div>
            
            <div className="text-right">
              <Badge className={`mb-2 ${isOpenNow() ? 'bg-[#3ce923] text-white' : 'bg-red-500 text-white'}`}>
                {isOpenNow() ? 'Abierto' : 'Cerrado'}
              </Badge>
              
              {business.isLaunchPromo && (
                <Badge className="bg-[#FFD700] text-black block">
                  🎉 Promoción 3x1
                </Badge>
              )}
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {business.profile.contact.phone && (
              <Button 
                onClick={() => handleContact('phone', business.profile.contact.phone)}
                className="bg-[#3ce923] hover:bg-green-600 text-white"
              >
                <Phone className="w-4 h-4 mr-2" />
                Llamar
              </Button>
            )}
            
            {business.profile.contact.whatsapp && (
              <Button 
                onClick={() => handleContact('whatsapp', business.profile.contact.whatsapp)}
                className="bg-[#25D366] hover:bg-green-600 text-white"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            )}
            
            <Button 
              onClick={getDirections}
              className="bg-[#60cdff] hover:bg-blue-500 text-white"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Direcciones
            </Button>
            
            {business.profile.contact.website && (
              <Button 
                onClick={() => handleContact('website', business.profile.contact.website)}
                variant="outline"
                className="text-[#ac7afc] border-[#ac7afc]"
              >
                <Globe className="w-4 h-4 mr-2" />
                Sitio Web
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Galería de fotos */}
      {business.profile.photos && business.profile.photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#ac7afc]" />
              Fotos ({business.profile.photos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <img 
                src={business.profile.photos[currentPhotoIndex]}
                alt={`${business.name} - Foto ${currentPhotoIndex + 1}`}
                className="w-full h-64 md:h-80 object-cover rounded-lg cursor-pointer"
                onClick={() => setShowGallery(true)}
              />
              
              {business.profile.photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                {business.profile.photos.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentPhotoIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            {business.profile.photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                {business.profile.photos.slice(0, 4).map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Miniatura ${index + 1}`}
                    className={`h-16 object-cover rounded cursor-pointer border-2 ${
                      index === currentPhotoIndex ? 'border-[#ac7afc]' : 'border-transparent'
                    }`}
                    onClick={() => setCurrentPhotoIndex(index)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información y descripción */}
        <div className="space-y-6">
          {/* Descripción */}
          {business.profile.description && (
            <Card>
              <CardHeader>
                <CardTitle>Acerca de {business.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">{business.profile.description}</p>
                
                {business.profile.video && (
                  <div className="mt-4">
                    <Button 
                      variant="outline"
                      className="text-[#ac7afc] border-[#ac7afc]"
                      onClick={() => window.open(business.profile.video)}
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Ver Video
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Información de contacto */}
          <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {business.profile.contact.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-[#3ce923]" />
                  <span className="flex-1">{business.profile.contact.phone}</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleContact('phone', business.profile.contact.phone)}
                  >
                    Llamar
                  </Button>
                </div>
              )}
              
              {business.profile.contact.whatsapp && (
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-[#25D366]" />
                  <span className="flex-1">{business.profile.contact.whatsapp}</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleContact('whatsapp', business.profile.contact.whatsapp)}
                  >
                    WhatsApp
                  </Button>
                </div>
              )}
              
              {business.profile.contact.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[#60cdff]" />
                  <span className="flex-1">{business.profile.contact.email}</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleContact('email', business.profile.contact.email)}
                  >
                    Email
                  </Button>
                </div>
              )}
              
              {business.profile.contact.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-[#ac7afc]" />
                  <span className="flex-1">{business.profile.contact.website}</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleContact('website', business.profile.contact.website)}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              )}
              
              {business.profile.contact.facebook && (
                <div className="flex items-center gap-3">
                  <Facebook className="w-5 h-5 text-[#1877F2]" />
                  <span className="flex-1">Facebook</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleContact('facebook', business.profile.contact.facebook)}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Horarios y información adicional */}
        <div className="space-y-6">
          {/* Horarios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#ac7afc]" />
                Horarios de Atención
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(business.profile.hours).map(([day, hours]) => (
                  <div key={day} className="flex items-center justify-between">
                    <span className="font-medium capitalize">{getDayName(day)}</span>
                    <span className={`${
                      hours.closed 
                        ? 'text-gray-500' 
                        : isOpenNow() && day === new Date().toLocaleDateString('en-US', { weekday: 'lowercase' })
                          ? 'text-[#3ce923] font-semibold'
                          : 'text-gray-700'
                    }`}>
                      {formatHours(hours)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isOpenNow() ? 'bg-[#3ce923]' : 'bg-red-500'}`}></div>
                  <span className="font-medium">
                    {isOpenNow() ? 'Abierto ahora' : 'Cerrado ahora'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del embajador */}
          {business.ambassador && (
            <Card>
              <CardHeader>
                <CardTitle>Embajador ServiMap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#ac7afc] rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {business.ambassador.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{business.ambassador.name}</p>
                    <p className="text-sm text-gray-600">Código: {business.ambassador.code}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Este negocio está registrado y verificado por un Embajador oficial de ServiMap
                </p>
              </CardContent>
            </Card>
          )}

          {/* Promoción de lanzamiento */}
          {business.isLaunchPromo && business.promoEndsAt && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🎉</span>
                  <h3 className="font-semibold text-yellow-800">¡Promoción de Lanzamiento!</h3>
                </div>
                <p className="text-sm text-yellow-700 mb-2">
                  Este negocio está en promoción especial 3x1. ¡Aprovecha mientras dure!
                </p>
                <p className="text-xs text-yellow-600">
                  Promoción válida hasta: {business.promoEndsAt.toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Estadísticas */}
          {business.stats && (
            <Card>
              <CardHeader>
                <CardTitle>Estadísticas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-[#ac7afc]">{business.stats.views.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Visualizaciones</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#3ce923]">{business.stats.clicks}</p>
                    <p className="text-xs text-gray-600">Clics</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#60cdff]">{business.stats.monthlyViews}</p>
                    <p className="text-xs text-gray-600">Este mes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog para galería completa */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Galería - {business.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {business.profile.photos?.map((photo, index) => (
              <img
                key={index}
                src={photo}
                alt={`${business.name} - Foto ${index + 1}`}
                className="w-full h-48 object-cover rounded-lg"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para compartir */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir {business.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={window.location.href}
                readOnly
                className="flex-1 p-2 border rounded text-sm"
              />
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setShowShareDialog(false);
                  alert('Link copiado');
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessProfile;