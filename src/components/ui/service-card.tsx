/**
 * ServiceCard - Material Design 3 Service Card Component for ServiMap
 * 
 * Tarjeta de servicio con información detallada: imágenes, descripción, precio,
 * duración, categoría, provider y acciones. Optimizada para marketplace de servicios.
 * 
 * @component
 * @example
 * <ServiceCard 
 *   service={{
 *     id: "456",
 *     title: "Reparación de tubería",
 *     description: "Reparación completa de tuberías con garantía",
 *     category: "Plomería",
 *     price: { min: 50000, max: 120000, type: "range" },
 *     duration: "2-4 horas",
 *     images: ["/service1.jpg", "/service2.jpg"],
 *     provider: { name: "Juan Pérez", rating: 4.8 },
 *     tags: ["Urgente", "Garantía"]
 *   }}
 *   onContact={() => openChat("123")}
 *   onRequestService={() => requestService("456")}
 * />
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  DollarSign, 
  Star, 
  Tag,
  MapPin,
  Shield,
  Zap,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  Award,
  CheckCircle
} from 'lucide-react';
import { ServiButton } from './servi-button';

interface ServicePrice {
  /** Precio mínimo */
  min?: number;
  /** Precio máximo */
  max?: number;
  /** Precio fijo */
  fixed?: number;
  /** Tipo de precio */
  type: 'fixed' | 'range' | 'hourly' | 'negotiable';
  /** Moneda */
  currency?: string;
}

interface ServiceProvider {
  /** ID del prestador */
  id: string;
  /** Nombre del prestador */
  name: string;
  /** Rating del prestador */
  rating: number;
  /** Avatar del prestador */
  avatar?: string;
  /** Si está verificado */
  isVerified?: boolean;
  /** Número de servicios completados */
  completedServices?: number;
}

interface Service {
  /** ID único del servicio */
  id: string;
  /** Título del servicio */
  title: string;
  /** Descripción detallada */
  description: string;
  /** Categoría principal */
  category: string;
  /** Subcategoría */
  subcategory?: string;
  /** Precio del servicio */
  price: ServicePrice;
  /** Duración estimada */
  duration?: string;
  /** Imágenes del servicio */
  images?: string[];
  /** Información del prestador */
  provider: ServiceProvider;
  /** Tags/etiquetas */
  tags?: string[];
  /** Si está disponible ahora */
  availableNow?: boolean;
  /** Si tiene servicio de emergencia */
  hasEmergencyService?: boolean;
  /** Si incluye materiales */
  includesMaterials?: boolean;
  /** Ubicación del servicio */
  location?: string;
  /** Si es un servicio premium */
  isPremium?: boolean;
  /** Garantía en días */
  warrantyDays?: number;
  /** Rating del servicio específico */
  serviceRating?: number;
  /** Número de veces contratado */
  timesHired?: number;
}

interface ServiceCardProps {
  /** Datos del servicio */
  service: Service;
  /** Variante de la tarjeta */
  variant?: 'default' | 'compact' | 'featured' | 'horizontal';
  /** Si está en favoritos */
  isFavorite?: boolean;
  /** Callback para contactar al prestador */
  onContact?: () => void;
  /** Callback para solicitar el servicio */
  onRequestService?: () => void;
  /** Callback para ver más detalles */
  onViewDetails?: () => void;
  /** Callback para agregar/quitar de favoritos */
  onToggleFavorite?: () => void;
  /** Callback para compartir */
  onShare?: () => void;
  /** Mostrar acciones */
  showActions?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

// Componente de precio formateado
const PriceDisplay: React.FC<{ price: ServicePrice }> = ({ price }) => {
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: price.currency || 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  switch (price.type) {
    case 'fixed':
      return (
        <span className="text-xl font-bold text-[var(--color-primary-60)]">
          {formatPrice(price.fixed!)}
        </span>
      );
    case 'range':
      return (
        <span className="text-xl font-bold text-[var(--color-primary-60)]">
          {formatPrice(price.min!)} - {formatPrice(price.max!)}
        </span>
      );
    case 'hourly':
      return (
        <span className="text-xl font-bold text-[var(--color-primary-60)]">
          {formatPrice(price.fixed!)} /hora
        </span>
      );
    case 'negotiable':
      return (
        <span className="text-lg font-semibold text-gray-600">
          Precio a convenir
        </span>
      );
    default:
      return null;
  }
};

// Carrusel de imágenes
const ImageCarousel: React.FC<{ 
  images: string[];
  alt: string;
  variant: ServiceCardProps['variant'];
}> = ({ images, alt, variant }) => {
  const [currentImage, setCurrentImage] = useState(0);
  const [imageError, setImageError] = useState<boolean[]>(new Array(images.length).fill(false));

  if (!images || images.length === 0) {
    return (
      <div className={cn(
        "bg-gray-200 flex items-center justify-center",
        variant === 'compact' ? 'h-32' : 'h-48',
        variant === 'horizontal' ? 'w-32 h-24' : 'w-full'
      )}>
        <Eye className="w-8 h-8 text-gray-400" />
      </div>
    );
  }

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleImageError = (index: number) => {
    setImageError(prev => {
      const newErrors = [...prev];
      newErrors[index] = true;
      return newErrors;
    });
  };

  return (
    <div className={cn(
      "relative overflow-hidden group",
      variant === 'horizontal' ? 'w-32 h-24 rounded-lg' : 'w-full h-48 rounded-t-xl'
    )}>
      {/* Imagen actual */}
      {!imageError[currentImage] ? (
        <img
          src={images[currentImage]}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => handleImageError(currentImage)}
        />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <Eye className="w-8 h-8 text-gray-400" />
        </div>
      )}

      {/* Controles de navegación (solo si hay múltiples imágenes) */}
      {images.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Indicadores */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, index) => (
              <button
                key={index}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  index === currentImage ? "bg-white" : "bg-white/50"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImage(index);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  variant = 'default',
  isFavorite = false,
  onContact,
  onRequestService,
  onViewDetails,
  onToggleFavorite,
  onShare,
  showActions = true,
  className
}) => {
  // Estilos base según variante
  const getVariantStyles = () => {
    switch (variant) {
      case 'compact':
        return 'p-3';
      case 'featured':
        return 'p-6 bg-gradient-to-br from-[var(--color-primary-95)] to-white border-2 border-[var(--color-primary-60)]/20';
      case 'horizontal':
        return 'p-4 flex-row items-start';
      default:
        return 'p-0 pb-4';
    }
  };

  const isHorizontal = variant === 'horizontal';

  return (
    <div 
      className={cn(
        // Base styles
        "bg-white rounded-xl shadow-md border border-gray-100 transition-all duration-200 overflow-hidden",
        "hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        "cursor-pointer",
        // Variant styles
        getVariantStyles(),
        className
      )}
      onClick={onViewDetails}
    >
      <div className={cn(
        "flex gap-4",
        isHorizontal ? '' : 'flex-col'
      )}>
        {/* Imagen */}
        {service.images && service.images.length > 0 && (
          <div className={cn(
            isHorizontal ? 'flex-shrink-0' : ''
          )}>
            <ImageCarousel 
              images={service.images} 
              alt={service.title}
              variant={variant}
            />
          </div>
        )}

        {/* Contenido principal */}
        <div className={cn(
          "flex flex-col",
          isHorizontal ? 'flex-1 min-w-0' : 'px-4'
        )}>
          {/* Header con título y acciones */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 leading-tight">
                {service.title}
              </h3>
              
              {/* Categoría */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-[var(--color-primary-60)] font-medium">
                  {service.category}
                </span>
                {service.subcategory && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-600">
                      {service.subcategory}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="flex gap-1">
              {onToggleFavorite && (
                <button
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                >
                  <Heart className={cn(
                    "w-5 h-5",
                    isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"
                  )} />
                </button>
              )}
              
              {onShare && (
                <button
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare();
                  }}
                  aria-label="Compartir servicio"
                >
                  <Share2 className="w-5 h-5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Descripción */}
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {service.description}
          </p>

          {/* Tags y badges */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {service.availableNow && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <Zap className="w-3 h-3" />
                Disponible ahora
              </span>
            )}
            
            {service.hasEmergencyService && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                <Shield className="w-3 h-3" />
                Emergencias
              </span>
            )}
            
            {service.isPremium && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                <Award className="w-3 h-3" />
                Premium
              </span>
            )}

            {service.warrantyDays && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3" />
                {service.warrantyDays}d garantía
              </span>
            )}
          </div>

          {/* Información de servicio */}
          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            {service.duration && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{service.duration}</span>
              </div>
            )}
            
            {service.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span className="truncate">{service.location}</span>
              </div>
            )}

            {service.timesHired && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>{service.timesHired} contrataciones</span>
              </div>
            )}

            {service.serviceRating && (
              <div className="flex items-center gap-2 text-gray-600">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{service.serviceRating.toFixed(1)} rating</span>
              </div>
            )}
          </div>

          {/* Tags adicionales */}
          {service.tags && service.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {service.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
              {service.tags.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">
                  +{service.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Información del prestador */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                {service.provider.avatar ? (
                  <img
                    src={service.provider.avatar}
                    alt={service.provider.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--color-primary-90)] flex items-center justify-center">
                    <span className="text-xs font-semibold text-[var(--color-primary-60)]">
                      {service.provider.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {service.provider.name}
                </p>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs text-gray-600">
                    {service.provider.rating.toFixed(1)}
                  </span>
                  {service.provider.completedServices && (
                    <span className="text-xs text-gray-500 ml-1">
                      • {service.provider.completedServices} servicios
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Precio */}
            <div className="text-right">
              <PriceDisplay price={service.price} />
            </div>
          </div>

          {/* Acciones */}
          {showActions && (
            <div className="flex gap-2">
              {onContact && (
                <ServiButton
                  variant="outlined"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onContact();
                  }}
                  className="flex-1"
                >
                  Contactar
                </ServiButton>
              )}
              
              {onRequestService && (
                <ServiButton
                  variant="filled"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestService();
                  }}
                  className="flex-1"
                >
                  Solicitar
                </ServiButton>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente de esqueleto para loading
export const ServiceCardSkeleton: React.FC<{ variant?: ServiceCardProps['variant'] }> = ({ 
  variant = 'default' 
}) => (
  <div className={cn(
    "bg-white rounded-xl shadow-md border border-gray-100 animate-pulse overflow-hidden",
    variant === 'compact' ? 'p-3' : variant === 'horizontal' ? 'p-4' : 'p-0 pb-4'
  )}>
    {/* Imagen skeleton */}
    <div className={cn(
      "bg-gray-200",
      variant === 'compact' ? 'h-32 mb-3 rounded' : 
      variant === 'horizontal' ? 'w-32 h-24 rounded-lg mr-4' : 'h-48 mb-4'
    )} />
    
    <div className={cn(
      variant === 'horizontal' ? 'flex-1' : variant !== 'compact' ? 'px-4' : ''
    )}>
      <div className="space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="flex gap-2">
          <div className="h-6 bg-gray-200 rounded w-16" />
          <div className="h-6 bg-gray-200 rounded w-20" />
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="space-y-1">
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-3 bg-gray-200 rounded w-12" />
            </div>
          </div>
          <div className="h-5 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  </div>
);

// Variants predefinidos
export const ServiceCardVariants = {
  Default: ServiceCard,
  Compact: (props: ServiceCardProps) => <ServiceCard {...props} variant="compact" />,
  Featured: (props: ServiceCardProps) => <ServiceCard {...props} variant="featured" />,
  Horizontal: (props: ServiceCardProps) => <ServiceCard {...props} variant="horizontal" />
};

export default ServiceCard;