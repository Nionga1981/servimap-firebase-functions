/**
 * ProviderCard - Material Design 3 Provider Card Component for ServiMap
 * 
 * Tarjeta de prestador con información completa: foto, rating, precio, disponibilidad,
 * especialidades, distancia y acciones rápidas. Optimizada para listas de resultados.
 * 
 * @component
 * @example
 * <ProviderCard 
 *   provider={{
 *     id: "123",
 *     name: "Juan Pérez",
 *     profession: "Plomero",
 *     rating: 4.8,
 *     reviewCount: 156,
 *     hourlyRate: 25000,
 *     avatar: "/avatars/juan.jpg",
 *     isOnline: true,
 *     distance: 2.5,
 *     specialties: ["Reparaciones", "Instalaciones"],
 *     responseTime: "~15 min"
 *   }}
 *   onContact={() => openChat("123")}
 *   onViewProfile={() => navigate("/provider/123")}
 *   onCall={() => initiateCall("123")}
 * />
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Star, 
  MapPin, 
  Clock, 
  Phone, 
  MessageCircle, 
  Heart,
  Shield,
  Zap,
  User,
  Calendar,
  Award,
  ChevronRight,
  Verified
} from 'lucide-react';
import { ServiButton } from './servi-button';

interface Provider {
  /** ID único del prestador */
  id: string;
  /** Nombre completo */
  name: string;
  /** Profesión/especialidad principal */
  profession: string;
  /** Avatar/foto de perfil */
  avatar?: string;
  /** Rating promedio (0-5) */
  rating: number;
  /** Número de reseñas */
  reviewCount: number;
  /** Tarifa por hora en pesos */
  hourlyRate?: number;
  /** Si está conectado/disponible ahora */
  isOnline: boolean;
  /** Distancia en kilómetros */
  distance?: number;
  /** Especialidades/servicios */
  specialties?: string[];
  /** Tiempo de respuesta promedio */
  responseTime?: string;
  /** Si es verificado */
  isVerified?: boolean;
  /** Si tiene servicio de emergencia */
  hasEmergencyService?: boolean;
  /** Nivel de experiencia */
  experienceLevel?: 'junior' | 'intermediate' | 'senior' | 'expert';
  /** Descripción corta */
  shortDescription?: string;
  /** Si está disponible para videollamada */
  hasVideoCall?: boolean;
}

interface ProviderCardProps {
  /** Datos del prestador */
  provider: Provider;
  /** Variante de la tarjeta */
  variant?: 'default' | 'compact' | 'featured' | 'list';
  /** Si está en favoritos */
  isFavorite?: boolean;
  /** Callback para contactar */
  onContact?: () => void;
  /** Callback para ver perfil completo */
  onViewProfile?: () => void;
  /** Callback para llamar */
  onCall?: () => void;
  /** Callback para agregar/quitar de favoritos */
  onToggleFavorite?: () => void;
  /** Callback para solicitar servicio inmediato */
  onRequestService?: () => void;
  /** Mostrar acciones */
  showActions?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

// Componente de rating con estrellas
const RatingStars: React.FC<{ rating: number; size?: 'sm' | 'md' }> = ({ 
  rating, 
  size = 'sm' 
}) => {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = i < Math.floor(rating);
    const partial = i === Math.floor(rating) && rating % 1 > 0;
    
    return (
      <Star
        key={i}
        className={cn(
          size === 'sm' ? 'w-4 h-4' : 'w-5 h-5',
          filled ? 'fill-yellow-400 text-yellow-400' : 
          partial ? 'fill-yellow-400/50 text-yellow-400' : 'text-gray-300'
        )}
      />
    );
  });

  return <div className="flex items-center gap-1">{stars}</div>;
};

// Badge de estado
const StatusBadge: React.FC<{ isOnline: boolean }> = ({ isOnline }) => (
  <div className={cn(
    "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
    isOnline 
      ? "bg-green-100 text-green-700" 
      : "bg-gray-100 text-gray-600"
  )}>
    <div className={cn(
      "w-2 h-2 rounded-full",
      isOnline ? "bg-green-500" : "bg-gray-400"
    )} />
    {isOnline ? "Disponible" : "No disponible"}
  </div>
);

// Badge de nivel de experiencia
const ExperienceBadge: React.FC<{ level: Provider['experienceLevel'] }> = ({ level }) => {
  if (!level) return null;

  const configs = {
    junior: { label: 'Junior', color: 'bg-blue-100 text-blue-700' },
    intermediate: { label: 'Intermedio', color: 'bg-purple-100 text-purple-700' },
    senior: { label: 'Senior', color: 'bg-orange-100 text-orange-700' },
    expert: { label: 'Experto', color: 'bg-red-100 text-red-700' }
  };

  const config = configs[level];

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
      config.color
    )}>
      <Award className="w-3 h-3" />
      {config.label}
    </span>
  );
};

export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  variant = 'default',
  isFavorite = false,
  onContact,
  onViewProfile,
  onCall,
  onToggleFavorite,
  onRequestService,
  showActions = true,
  className
}) => {
  const [imageError, setImageError] = useState(false);

  // Estilos base según variante
  const getVariantStyles = () => {
    switch (variant) {
      case 'compact':
        return 'p-3';
      case 'featured':
        return 'p-6 bg-gradient-to-br from-[var(--color-primary-95)] to-white border-2 border-[var(--color-primary-60)]/20';
      case 'list':
        return 'p-4 flex-row items-center';
      default:
        return 'p-4';
    }
  };

  return (
    <div className={cn(
      // Base styles
      "bg-white rounded-xl shadow-md border border-gray-100 transition-all duration-200",
      "hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
      "cursor-pointer",
      // Variant styles
      getVariantStyles(),
      className
    )}
    onClick={onViewProfile}
    >
      <div className={cn(
        "flex gap-4",
        variant === 'list' ? '' : 'flex-col'
      )}>
        {/* Header con avatar y info básica */}
        <div className={cn(
          "flex items-start gap-3",
          variant === 'list' ? 'flex-shrink-0' : ''
        )}>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "rounded-full overflow-hidden bg-gray-200",
              variant === 'compact' ? 'w-12 h-12' : 'w-16 h-16'
            )}>
              {provider.avatar && !imageError ? (
                <img
                  src={provider.avatar}
                  alt={provider.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--color-primary-90)]">
                  <User className="w-6 h-6 text-[var(--color-primary-60)]" />
                </div>
              )}
            </div>
            
            {/* Estado online */}
            <div className={cn(
              "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
              provider.isOnline ? "bg-green-500" : "bg-gray-400"
            )} />

            {/* Badge verificado */}
            {provider.isVerified && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <Verified className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* Info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 truncate text-lg">
                  {provider.name}
                </h3>
                <p className="text-sm text-gray-600 truncate">
                  {provider.profession}
                </p>
              </div>

              {/* Botón favorito */}
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
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 mt-1">
              <RatingStars rating={provider.rating} />
              <span className="text-sm font-medium text-gray-900">
                {provider.rating.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">
                ({provider.reviewCount})
              </span>
            </div>
          </div>
        </div>

        {/* Información adicional */}
        <div className={cn(
          "space-y-3",
          variant === 'list' ? 'flex-1' : ''
        )}>
          {/* Estado y badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge isOnline={provider.isOnline} />
            <ExperienceBadge level={provider.experienceLevel} />
            
            {provider.hasEmergencyService && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                <Zap className="w-3 h-3" />
                Emergencias
              </span>
            )}
          </div>

          {/* Información de servicio */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {provider.hourlyRate && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Desde:</span>
                <span className="font-semibold text-[var(--color-primary-60)]">
                  ${provider.hourlyRate.toLocaleString()}/h
                </span>
              </div>
            )}
            
            {provider.distance && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{provider.distance.toFixed(1)} km</span>
              </div>
            )}
            
            {provider.responseTime && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{provider.responseTime}</span>
              </div>
            )}

            {provider.hasVideoCall && (
              <div className="flex items-center gap-2 text-green-600">
                <Shield className="w-4 h-4" />
                <span>Videollamada</span>
              </div>
            )}
          </div>

          {/* Especialidades */}
          {provider.specialties && provider.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {provider.specialties.slice(0, 3).map((specialty, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                >
                  {specialty}
                </span>
              ))}
              {provider.specialties.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">
                  +{provider.specialties.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Descripción corta */}
          {provider.shortDescription && variant !== 'compact' && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {provider.shortDescription}
            </p>
          )}

          {/* Acciones */}
          {showActions && (
            <div className="flex gap-2 pt-2">
              {onContact && (
                <ServiButton
                  variant="filled"
                  size="small"
                  startIcon={<MessageCircle className="w-4 h-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onContact();
                  }}
                  className="flex-1"
                >
                  Contactar
                </ServiButton>
              )}
              
              {onCall && provider.hasVideoCall && (
                <ServiButton
                  variant="outlined"
                  size="small"
                  startIcon={<Phone className="w-4 h-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCall();
                  }}
                >
                  Llamar
                </ServiButton>
              )}

              {onRequestService && provider.isOnline && (
                <ServiButton
                  variant="tonal"
                  size="small"
                  startIcon={<Zap className="w-4 h-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestService();
                  }}
                >
                  Ahora
                </ServiButton>
              )}
            </div>
          )}
        </div>

        {/* Indicador de más info (para variant list) */}
        {variant === 'list' && (
          <div className="flex-shrink-0 self-center">
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>
    </div>
  );
};

// Componente de esqueleto para loading
export const ProviderCardSkeleton: React.FC<{ variant?: ProviderCardProps['variant'] }> = ({ 
  variant = 'default' 
}) => (
  <div className={cn(
    "bg-white rounded-xl shadow-md border border-gray-100 animate-pulse",
    variant === 'compact' ? 'p-3' : 'p-4'
  )}>
    <div className="flex gap-3">
      <div className={cn(
        "rounded-full bg-gray-200",
        variant === 'compact' ? 'w-12 h-12' : 'w-16 h-16'
      )} />
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-12" />
        </div>
      </div>
    </div>
  </div>
);

// Variants predefinidos
export const ProviderCardVariants = {
  Default: ProviderCard,
  Compact: (props: ProviderCardProps) => <ProviderCard {...props} variant="compact" />,
  Featured: (props: ProviderCardProps) => <ProviderCard {...props} variant="featured" />,
  List: (props: ProviderCardProps) => <ProviderCard {...props} variant="list" />
};

export default ProviderCard;