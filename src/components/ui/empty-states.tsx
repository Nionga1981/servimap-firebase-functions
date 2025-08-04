/**
 * EmptyStates - Material Design 3 Empty States Component for ServiMap
 * 
 * Conjunto de componentes para mostrar estados vacíos con ilustraciones,
 * mensajes contextuales y acciones sugeridas para mejorar la UX.
 * 
 * @component
 * @example
 * <EmptyState
 *   variant="no-results"
 *   title="No se encontraron servicios"
 *   description="Intenta ajustar los filtros o buscar en otra ubicación"
 *   actionLabel="Cambiar filtros"
 *   onAction={() => openFilters()}
 * />
 */

import { cn } from '@/lib/utils';
import { 
  Search,
  MapPin,
  Users,
  MessageCircle,
  Bell,
  Star,
  Calendar,
  Clock,
  Wifi,
  Shield,
  Heart,
  Briefcase,
  Camera,
  FileText,
  Zap,
  AlertTriangle,
  RefreshCw,
  Plus,
  Filter,
  Settings,
  Eye,
  EyeOff,
  Smile,
  Coffee,
  Sparkles
} from 'lucide-react';
import { ServiButton } from './servi-button';

interface EmptyStateProps {
  /** Variante del estado vacío */
  variant?: 
    | 'no-results' 
    | 'no-services' 
    | 'no-providers' 
    | 'no-messages' 
    | 'no-notifications'
    | 'no-favorites'
    | 'no-history'
    | 'no-reviews'
    | 'no-appointments'
    | 'no-connection'
    | 'maintenance'
    | 'error'
    | 'unauthorized'
    | 'first-time'
    | 'custom';
  /** Título principal */
  title?: string;
  /** Descripción detallada */
  description?: string;
  /** Icono personalizado */
  icon?: React.ReactNode;
  /** Ilustración personalizada */
  illustration?: string;
  /** Etiqueta del botón de acción */
  actionLabel?: string;
  /** Callback del botón de acción */
  onAction?: () => void;
  /** Etiqueta del botón secundario */
  secondaryActionLabel?: string;
  /** Callback del botón secundario */
  onSecondaryAction?: () => void;
  /** Tamaño del componente */
  size?: 'small' | 'medium' | 'large';
  /** Contenido adicional personalizado */
  children?: React.ReactNode;
  /** Clase CSS adicional */
  className?: string;
}

// Configuraciones predefinidas para diferentes estados
const getEmptyStateConfig = (variant: EmptyStateProps['variant']) => {
  const configs = {
    'no-results': {
      icon: Search,
      title: 'No se encontraron resultados',
      description: 'Intenta ajustar los filtros de búsqueda o cambiar la ubicación',
      actionLabel: 'Cambiar filtros',
      color: 'text-gray-400'
    },
    'no-services': {
      icon: Briefcase,
      title: 'No hay servicios disponibles',
      description: 'Parece que no hay servicios en tu área. Intenta expandir el radio de búsqueda',
      actionLabel: 'Ampliar búsqueda',
      color: 'text-blue-400'
    },
    'no-providers': {
      icon: Users,
      title: 'No hay prestadores cerca',
      description: 'No encontramos prestadores en tu ubicación actual',
      actionLabel: 'Cambiar ubicación',
      color: 'text-purple-400'
    },
    'no-messages': {
      icon: MessageCircle,
      title: 'No tienes conversaciones',
      description: 'Cuando contactes a un prestador, las conversaciones aparecerán aquí',
      actionLabel: 'Buscar servicios',
      color: 'text-green-400'
    },
    'no-notifications': {
      icon: Bell,
      title: 'No tienes notificaciones',
      description: 'Te avisaremos cuando tengas actualizaciones importantes',
      actionLabel: 'Explorar servicios',
      color: 'text-yellow-400'
    },
    'no-favorites': {
      icon: Heart,
      title: 'No tienes favoritos',
      description: 'Guarda tus prestadores y servicios favoritos para acceder rápidamente',
      actionLabel: 'Explorar servicios',
      color: 'text-red-400'
    },
    'no-history': {
      icon: Clock,
      title: 'No tienes historial',
      description: 'Tu historial de servicios contratados aparecerá aquí',
      actionLabel: 'Solicitar servicio',
      color: 'text-indigo-400'
    },
    'no-reviews': {
      icon: Star,
      title: 'No tienes reseñas',
      description: 'Las reseñas de tus servicios completados aparecerán aquí',
      actionLabel: 'Ver historial',
      color: 'text-yellow-400'
    },
    'no-appointments': {
      icon: Calendar,
      title: 'No tienes citas programadas',
      description: 'Programa servicios para fechas específicas y gestiona tu agenda',
      actionLabel: 'Programar servicio',
      color: 'text-blue-400'
    },
    'no-connection': {
      icon: Wifi,
      title: 'Sin conexión a internet',
      description: 'Verifica tu conexión e intenta nuevamente',
      actionLabel: 'Reintentar',
      color: 'text-gray-400'
    },
    'maintenance': {
      icon: Settings,
      title: 'Mantenimiento en progreso',
      description: 'Estamos mejorando la plataforma. Regresa en unos minutos',
      actionLabel: 'Actualizar',
      color: 'text-orange-400'
    },
    'error': {
      icon: AlertTriangle,
      title: 'Algo salió mal',
      description: 'Ocurrió un error inesperado. Por favor intenta nuevamente',
      actionLabel: 'Reintentar',
      color: 'text-red-400'
    },
    'unauthorized': {
      icon: Shield,
      title: 'Acceso no autorizado',
      description: 'Necesitas iniciar sesión para acceder a esta sección',
      actionLabel: 'Iniciar sesión',
      color: 'text-gray-400'
    },
    'first-time': {
      icon: Sparkles,
      title: '¡Bienvenido a ServiMap!',
      description: 'Encuentra servicios profesionales cerca de ti. Comienza explorando',
      actionLabel: 'Explorar servicios',
      color: 'text-[var(--color-primary-60)]'
    },
    'custom': {
      icon: Eye,
      title: 'Estado personalizado',
      description: 'Configura tu contenido personalizado',
      actionLabel: 'Acción',
      color: 'text-gray-400'
    }
  };

  return configs[variant || 'custom'] || configs.custom;
};

// Componente de ilustración animada
const AnimatedIllustration: React.FC<{
  icon: React.ComponentType<any>;
  color: string;
  size: EmptyStateProps['size'];
}> = ({ icon: IconComponent, color, size }) => {
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32'
  };

  return (
    <div className="relative">
      {/* Background circle */}
      <div className={cn(
        "rounded-full opacity-10 absolute inset-0",
        color.replace('text-', 'bg-')
      )} />
      
      {/* Icon */}
      <div className={cn(
        "flex items-center justify-center rounded-full",
        sizeClasses[size || 'medium']
      )}>
        <IconComponent className={cn(
          color,
          size === 'small' ? 'w-8 h-8' : 
          size === 'large' ? 'w-16 h-16' : 'w-12 h-12'
        )} />
      </div>
      
      {/* Animated dots */}
      <div className="absolute -top-2 -right-2">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                color.replace('text-', 'bg-')
              )}
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'custom',
  title,
  description,
  icon,
  illustration,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  size = 'medium',
  children,
  className
}) => {
  const config = getEmptyStateConfig(variant);
  const IconComponent = (typeof icon === 'function' ? icon : config.icon) as React.ComponentType<any>;

  const containerPadding = {
    small: 'py-8 px-4',
    medium: 'py-12 px-6',
    large: 'py-16 px-8'
  };

  const titleSize = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl'
  };

  const descriptionSize = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg'
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      containerPadding[size],
      className
    )}>
      {/* Ilustración */}
      {illustration ? (
        <img
          src={illustration}
          alt={title || config.title}
          className={cn(
            "mb-6",
            size === 'small' ? 'w-32 h-32' : 
            size === 'large' ? 'w-48 h-48' : 'w-40 h-40'
          )}
        />
      ) : (
        <div className="mb-6">
          <AnimatedIllustration
            icon={IconComponent}
            color={config.color}
            size={size}
          />
        </div>
      )}

      {/* Contenido */}
      <div className="max-w-md">
        <h3 className={cn(
          "font-semibold text-gray-900 mb-3",
          titleSize[size]
        )}>
          {title || config.title}
        </h3>
        
        <p className={cn(
          "text-gray-600 mb-6 leading-relaxed",
          descriptionSize[size]
        )}>
          {description || config.description}
        </p>
      </div>

      {/* Acciones */}
      {(actionLabel || onAction || secondaryActionLabel || onSecondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {(actionLabel || onAction) && (
            <ServiButton
              variant="filled"
              onClick={onAction}
              className="min-w-32"
            >
              {actionLabel || config.actionLabel}
            </ServiButton>
          )}
          
          {(secondaryActionLabel || onSecondaryAction) && (
            <ServiButton
              variant="outlined"
              onClick={onSecondaryAction}
              className="min-w-32"
            >
              {secondaryActionLabel}
            </ServiButton>
          )}
        </div>
      )}

      {/* Contenido personalizado */}
      {children && (
        <div className="mt-6 w-full max-w-md">
          {children}
        </div>
      )}
    </div>
  );
};

// Estados específicos predefinidos
export const EmptyStateVariants = {
  // Sin resultados de búsqueda
  NoResults: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="no-results"
      {...props}
    />
  ),

  // Primera vez usando la app
  FirstTime: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="first-time"
      size="large"
      {...props}
    />
  ),

  // Error de conexión
  NoConnection: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="no-connection"
      {...props}
    />
  ),

  // Sin favoritos
  NoFavorites: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="no-favorites"
      {...props}
    />
  ),

  // Sin mensajes
  NoMessages: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="no-messages"
      {...props}
    />
  )
};

// Componente para estados de carga con contenido vacío
export const EmptyStateWithLoading: React.FC<EmptyStateProps & {
  loading: boolean;
  loadingText?: string;
}> = ({ loading, loadingText = "Cargando...", ...props }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary-60)] mb-4" />
        <p className="text-gray-600">{loadingText}</p>
      </div>
    );
  }

  return <EmptyState {...props} />;
};

// Componente para múltiples estados (loading, error, empty, content)
export const StateHandler: React.FC<{
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyStateProps?: EmptyStateProps;
  children: React.ReactNode;
  className?: string;
}> = ({
  loading,
  error,
  empty,
  emptyStateProps,
  children,
  className
}) => {
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary-60)]" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Error al cargar"
        description={error}
        actionLabel="Reintentar"
        className={className}
        {...emptyStateProps}
      />
    );
  }

  if (empty) {
    return (
      <EmptyState
        variant="no-results"
        className={className}
        {...emptyStateProps}
      />
    );
  }

  return <>{children}</>;
};

// Componente de estado vacío para listas específicas
export const ListEmptyState: React.FC<{
  type: 'services' | 'providers' | 'messages' | 'notifications' | 'history';
  searchQuery?: string;
  onAction?: () => void;
  className?: string;
}> = ({ type, searchQuery, onAction, className }) => {
  const getListConfig = () => {
    const baseConfigs = {
      services: {
        variant: 'no-services' as const,
        actionLabel: 'Explorar todas las categorías'
      },
      providers: {
        variant: 'no-providers' as const,
        actionLabel: 'Ampliar área de búsqueda'
      },
      messages: {
        variant: 'no-messages' as const,
        actionLabel: 'Iniciar conversación'
      },
      notifications: {
        variant: 'no-notifications' as const,
        actionLabel: 'Explorar servicios'
      },
      history: {
        variant: 'no-history' as const,
        actionLabel: 'Contratar primer servicio'
      }
    };

    const config = baseConfigs[type];

    // Personalizar para búsquedas
    if (searchQuery) {
      return {
        variant: 'no-results' as const,
        title: `No se encontraron ${type}`,
        description: `No hay resultados para "${searchQuery}". Intenta con otros términos de búsqueda.`,
        actionLabel: 'Limpiar búsqueda'
      };
    }

    return config;
  };

  const config = getListConfig();

  return (
    <EmptyState
      {...config}
      onAction={onAction}
      className={className}
    />
  );
};

export default EmptyState;