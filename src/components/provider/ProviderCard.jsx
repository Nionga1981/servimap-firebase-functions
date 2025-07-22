'use client';

import React, { useState } from 'react';
import { 
  Star, 
  MapPin, 
  Clock, 
  Phone, 
  MessageCircle,
  Crown,
  Shield,
  Verified,
  Heart,
  MoreHorizontal,
  Calendar,
  DollarSign,
  ChevronRight,
  Badge as BadgeIcon,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function ProviderCard({ 
  provider, 
  variant = 'default', // default, compact, featured, search-result
  showActions = true,
  onClick,
  className = ""
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(provider.isFavorite || false);
  const [isLoading, setIsLoading] = useState(false);

  // Calcular distancia
  const getDistanceText = () => {
    if (provider.distance) {
      return provider.distance < 1 
        ? `${Math.round(provider.distance * 1000)}m`
        : `${provider.distance.toFixed(1)}km`;
    }
    return null;
  };

  // Obtener texto de disponibilidad
  const getAvailabilityText = () => {
    if (!provider.isAvailable) return 'No disponible';
    if (provider.availabilityText) return provider.availabilityText;
    return 'Disponible ahora';
  };

  // Obtener color de disponibilidad
  const getAvailabilityColor = () => {
    if (!provider.isAvailable) return 'text-gray-500';
    if (provider.availabilityText?.includes('hoy')) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Manejar click en favoritos
  const handleFavoriteClick = async (e) => {
    e.stopPropagation();
    setIsLoading(true);
    
    try {
      // Llamada a API para toggle favorito
      const response = await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: provider.id })
      });

      if (response.ok) {
        setIsFavorite(!isFavorite);
        toast({
          title: isFavorite ? "Eliminado de favoritos" : "Agregado a favoritos",
          description: isFavorite 
            ? `${provider.displayName} eliminado de tus favoritos`
            : `${provider.displayName} agregado a tus favoritos`
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar favoritos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar click en contactar
  const handleContactClick = (e) => {
    e.stopPropagation();
    navigate(`/chat?provider=${provider.id}`);
  };

  // Manejar click en agendar
  const handleScheduleClick = (e) => {
    e.stopPropagation();
    navigate(`/request/${provider.id}`);
  };

  // Manejar click en la tarjeta
  const handleCardClick = () => {
    if (onClick) {
      onClick(provider);
    } else {
      navigate(`/provider/${provider.id}`);
    }
  };

  // Renderizar variante compacta
  if (variant === 'compact') {
    return (
      <Card 
        className={`hover:shadow-md transition-all duration-200 cursor-pointer ${className}`}
        onClick={handleCardClick}
      >
        <CardContent className="p-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={provider.photoURL} alt={provider.displayName} />
              <AvatarFallback>
                {provider.displayName?.charAt(0) || 'P'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1">
                <h3 className="font-medium text-sm truncate">{provider.displayName}</h3>
                {provider.isPremium && <Crown className="h-3 w-3 text-yellow-500" />}
                {provider.isVerified && <Verified className="h-3 w-3 text-blue-500" />}
              </div>
              
              <p className="text-xs text-gray-600 truncate">{provider.specialty}</p>
              
              <div className="flex items-center space-x-2 mt-1">
                <div className="flex items-center">
                  <Star className="h-3 w-3 text-yellow-500 fill-current" />
                  <span className="text-xs ml-1">{provider.rating?.toFixed(1) || 'N/A'}</span>
                </div>
                {getDistanceText() && (
                  <span className="text-xs text-gray-500">{getDistanceText()}</span>
                )}
              </div>
            </div>
            
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderizar variante destacada
  if (variant === 'featured') {
    return (
      <Card 
        className={`hover:shadow-lg transition-all duration-200 cursor-pointer border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 ${className}`}
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Header con badge destacado */}
            <div className="flex items-start justify-between">
              <Badge className="bg-purple-600 text-white">
                <Crown className="h-3 w-3 mr-1" />
                Destacado
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFavoriteClick}
                className="p-1 h-auto"
                disabled={isLoading}
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
              </Button>
            </div>

            {/* Información principal */}
            <div className="flex items-start space-x-3">
              <Avatar className="h-16 w-16">
                <AvatarImage src={provider.photoURL} alt={provider.displayName} />
                <AvatarFallback>
                  {provider.displayName?.charAt(0) || 'P'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-lg">{provider.displayName}</h3>
                  {provider.isPremium && <Crown className="h-4 w-4 text-yellow-500" />}
                  {provider.isVerified && <Verified className="h-4 w-4 text-blue-500" />}
                </div>
                
                <p className="text-gray-600 mb-2">{provider.specialty}</p>
                
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-500 fill-current mr-1" />
                    <span className="font-medium">{provider.rating?.toFixed(1) || 'N/A'}</span>
                    <span className="text-gray-500 ml-1">({provider.reviewCount || 0})</span>
                  </div>
                  
                  {getDistanceText() && (
                    <div className="flex items-center text-gray-500">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{getDistanceText()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Precio y disponibilidad */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-600">Desde </span>
                <span className="font-semibold text-lg text-green-600">
                  ${provider.priceRange?.min || 'N/A'}
                </span>
              </div>
              
              <Badge 
                variant={provider.isAvailable ? "secondary" : "outline"}
                className={provider.isAvailable ? "bg-green-100 text-green-800" : ""}
              >
                <Clock className="h-3 w-3 mr-1" />
                {getAvailabilityText()}
              </Badge>
            </div>

            {/* Botones de acción */}
            {showActions && (
              <div className="flex space-x-2">
                <Button 
                  onClick={handleContactClick}
                  variant="outline" 
                  className="flex-1"
                  size="sm"
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Contactar
                </Button>
                <Button 
                  onClick={handleScheduleClick}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  size="sm"
                  disabled={!provider.isAvailable}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Agendar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderizar variante por defecto
  return (
    <Card 
      className={`hover:shadow-md transition-all duration-200 cursor-pointer ${className}`}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <Avatar className="h-14 w-14">
                <AvatarImage src={provider.photoURL} alt={provider.displayName} />
                <AvatarFallback>
                  {provider.displayName?.charAt(0) || 'P'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold truncate">{provider.displayName}</h3>
                  {provider.isPremium && <Crown className="h-4 w-4 text-yellow-500" />}
                  {provider.isVerified && <Verified className="h-4 w-4 text-blue-500" />}
                  {provider.isCommunityLocal && (
                    <Badge variant="outline" className="text-xs">
                      Local
                    </Badge>
                  )}
                </div>
                
                <p className="text-gray-600 text-sm mb-2 truncate">{provider.specialty}</p>
                
                {/* Rating y distancia */}
                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-500 fill-current mr-1" />
                    <span className="font-medium">{provider.rating?.toFixed(1) || 'N/A'}</span>
                    <span className="text-gray-500 ml-1">({provider.reviewCount || 0})</span>
                  </div>
                  
                  {getDistanceText() && (
                    <div className="flex items-center text-gray-500">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{getDistanceText()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFavoriteClick}
              className="p-1 h-auto"
              disabled={isLoading}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
            </Button>
          </div>

          {/* Precio y disponibilidad */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {provider.priceRange && (
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-600">
                    ${provider.priceRange.min} - ${provider.priceRange.max}
                  </span>
                </div>
              )}
              
              <div className={`flex items-center space-x-1 ${getAvailabilityColor()}`}>
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">{getAvailabilityText()}</span>
                {provider.emergencyAvailable && (
                  <Zap className="h-3 w-3 text-yellow-500" title="Servicio de emergencia disponible" />
                )}
              </div>
            </div>

            {/* Badges adicionales */}
            <div className="flex flex-col items-end space-y-1">
              {provider.isPremium && (
                <Badge className="bg-yellow-100 text-yellow-800">
                  Premium
                </Badge>
              )}
              {provider.fastResponse && (
                <Badge variant="outline" className="text-xs">
                  Respuesta rápida
                </Badge>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          {showActions && (
            <div className="flex space-x-2 pt-2">
              <Button 
                onClick={handleContactClick}
                variant="outline" 
                className="flex-1"
                size="sm"
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Contactar
              </Button>
              <Button 
                onClick={handleScheduleClick}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                size="sm"
                disabled={!provider.isAvailable}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Agendar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Componente para lista de prestadores
export function ProviderList({ 
  providers = [], 
  loading = false, 
  variant = 'default',
  onProviderClick,
  className = ""
}) {
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(3)].map((_, index) => (
          <ProviderCardSkeleton key={index} variant={variant} />
        ))}
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No se encontraron prestadores
        </h3>
        <p className="text-gray-600">
          Intenta expandir tu radio de búsqueda o ajustar los filtros
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          variant={variant}
          onClick={onProviderClick}
        />
      ))}
    </div>
  );
}

// Componente skeleton para loading
export function ProviderCardSkeleton({ variant = 'default' }) {
  if (variant === 'compact') {
    return (
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="h-14 w-14 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <div className="h-8 bg-gray-200 rounded flex-1 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded flex-1 animate-pulse"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}