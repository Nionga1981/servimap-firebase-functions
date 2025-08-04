/**
 * NotificationCard - Material Design 3 Notification Card Component for ServiMap
 * 
 * Tarjeta de notificación con múltiples tipos: info, success, warning, error, service.
 * Incluye acciones, avatares, timestamps y estados de lectura/no lectura.
 * 
 * @component
 * @example
 * <NotificationCard
 *   notification={{
 *     id: "123",
 *     type: "service_request",
 *     title: "Nueva solicitud de servicio",
 *     message: "Juan Pérez te ha solicitado un servicio de plomería",
 *     timestamp: new Date(),
 *     isRead: false,
 *     avatar: "/avatar.jpg",
 *     priority: "high"
 *   }}
 *   onRead={() => markAsRead("123")}
 *   onAction={() => viewServiceRequest("123")}
 *   onDismiss={() => dismissNotification("123")}
 * />
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Bell,
  BellRing,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  MessageCircle,
  DollarSign,
  Calendar,
  Star,
  User,
  MapPin,
  Clock,
  Zap,
  Shield,
  Heart,
  TrendingUp,
  Gift,
  Settings,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal
} from 'lucide-react';
import { ServiButton } from './servi-button';

interface NotificationData {
  /** ID único de la notificación */
  id: string;
  /** Tipo de notificación */
  type: 'info' | 'success' | 'warning' | 'error' | 'service_request' | 'service_update' | 
        'payment' | 'message' | 'review' | 'promotion' | 'system' | 'emergency';
  /** Título principal */
  title: string;
  /** Mensaje descriptivo */
  message: string;
  /** Timestamp de la notificación */
  timestamp: Date;
  /** Si ha sido leída */
  isRead: boolean;
  /** Prioridad */
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  /** Avatar del remitente/relacionado */
  avatar?: string;
  /** Imagen adicional */
  image?: string;
  /** Datos adicionales específicos del tipo */
  metadata?: {
    userId?: string;
    serviceId?: string;
    amount?: number;
    currency?: string;
    rating?: number;
    location?: string;
    actionUrl?: string;
    [key: string]: any;
  };
  /** Acciones disponibles */
  actions?: Array<{
    label: string;
    action: 'primary' | 'secondary' | 'destructive';
    onClick: () => void;
  }>;
}

interface NotificationCardProps {
  /** Datos de la notificación */
  notification: NotificationData;
  /** Variante de la tarjeta */
  variant?: 'default' | 'compact' | 'expanded';
  /** Callback cuando se marca como leída */
  onRead?: () => void;
  /** Callback para acción principal */
  onAction?: () => void;
  /** Callback para descartar */
  onDismiss?: () => void;
  /** Callback para menú de opciones */
  onOptionsMenu?: () => void;
  /** Mostrar acciones */
  showActions?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

// Formatear timestamp relativo
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'hace un momento';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `hace ${minutes} min`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `hace ${hours} h`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `hace ${days} día${days > 1 ? 's' : ''}`;
  } else {
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  }
};

// Obtener configuración de tipo de notificación
const getNotificationConfig = (type: NotificationData['type']) => {
  const configs = {
    info: {
      icon: Info,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700'
    },
    success: {
      icon: CheckCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700'
    },
    warning: {
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700'
    },
    error: {
      icon: AlertCircle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700'
    },
    service_request: {
      icon: Bell,
      color: 'bg-[var(--color-primary-60)]',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700'
    },
    service_update: {
      icon: BellRing,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700'
    },
    payment: {
      icon: DollarSign,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700'
    },
    message: {
      icon: MessageCircle,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700'
    },
    review: {
      icon: Star,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700'
    },
    promotion: {
      icon: Gift,
      color: 'bg-pink-500',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200',
      textColor: 'text-pink-700'
    },
    system: {
      icon: Settings,
      color: 'bg-gray-500',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-700'
    },
    emergency: {
      icon: Zap,
      color: 'bg-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700'
    }
  };

  return configs[type] || configs.info;
};

// Componente de avatar
const NotificationAvatar: React.FC<{ 
  avatar?: string; 
  type: NotificationData['type'];
  name?: string;
}> = ({ avatar, type, name }) => {
  const [imageError, setImageError] = useState(false);
  const config = getNotificationConfig(type);
  const IconComponent = config.icon;

  if (avatar && !imageError) {
    return (
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
        <img
          src={avatar}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className={cn(
      "w-10 h-10 rounded-full flex items-center justify-center",
      config.color
    )}>
      <IconComponent className="w-5 h-5 text-white" />
    </div>
  );
};

// Componente de contenido específico por tipo
const NotificationContent: React.FC<{ notification: NotificationData }> = ({ notification }) => {
  const renderSpecificContent = () => {
    switch (notification.type) {
      case 'payment':
        if (notification.metadata?.amount) {
          return (
            <div className="flex items-center gap-2 mt-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-green-600">
                ${notification.metadata.amount.toLocaleString()} {notification.metadata.currency || 'COP'}
              </span>
            </div>
          );
        }
        break;
      
      case 'review':
        if (notification.metadata?.rating) {
          return (
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-4 h-4",
                    i < notification.metadata!.rating! 
                      ? "fill-yellow-400 text-yellow-400" 
                      : "text-gray-300"
                  )}
                />
              ))}
              <span className="ml-1 text-sm text-gray-600">
                {notification.metadata.rating}/5
              </span>
            </div>
          );
        }
        break;
      
      case 'service_request':
      case 'service_update':
        if (notification.metadata?.location) {
          return (
            <div className="flex items-center gap-2 mt-1">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {notification.metadata.location}
              </span>
            </div>
          );
        }
        break;
    }

    return null;
  };

  return <div>{renderSpecificContent()}</div>;
};

// Componente de badge de prioridad
const PriorityBadge: React.FC<{ priority: NotificationData['priority'] }> = ({ priority }) => {
  if (!priority || priority === 'low') return null;

  const configs = {
    medium: { label: 'Media', color: 'bg-yellow-100 text-yellow-700' },
    high: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
    urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700 animate-pulse' }
  };

  const config = configs[priority];

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
      config.color
    )}>
      {config.label}
    </span>
  );
};

export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  variant = 'default',
  onRead,
  onAction,
  onDismiss,
  onOptionsMenu,
  showActions = true,
  className
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const config = getNotificationConfig(notification.type);

  // Estilos según variante
  const getVariantStyles = () => {
    switch (variant) {
      case 'compact':
        return 'p-3';
      case 'expanded':
        return 'p-6';
      default:
        return 'p-4';
    }
  };

  // Manejar click en la tarjeta
  const handleCardClick = () => {
    if (!notification.isRead && onRead) {
      onRead();
    }
    if (onAction) {
      onAction();
    }
  };

  return (
    <div 
      className={cn(
        // Base styles
        "bg-white rounded-xl border transition-all duration-200 cursor-pointer",
        "hover:shadow-md active:scale-[0.99]",
        // Estado de lectura
        notification.isRead 
          ? "border-gray-200" 
          : `${config.borderColor} bg-gradient-to-r from-white to-${config.bgColor}`,
        // Prioridad urgente
        notification.priority === 'urgent' && "ring-2 ring-red-200 ring-opacity-50",
        // Variant styles
        getVariantStyles(),
        className
      )}
      onClick={handleCardClick}
    >
      <div className="flex gap-3">
        {/* Avatar/Icono */}
        <div className="flex-shrink-0">
          <NotificationAvatar 
            avatar={notification.avatar}
            type={notification.type}
            name={notification.metadata?.userName}
          />
        </div>

        {/* Contenido principal */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={cn(
                  "font-semibold truncate",
                  variant === 'compact' ? 'text-sm' : 'text-base',
                  !notification.isRead && 'text-gray-900'
                )}>
                  {notification.title}
                </h3>
                <PriorityBadge priority={notification.priority} />
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(notification.timestamp)}</span>
                {!notification.isRead && (
                  <span className="w-2 h-2 bg-[var(--color-primary-60)] rounded-full" />
                )}
              </div>
            </div>

            {/* Acciones del header */}
            <div className="flex items-center gap-1">
              {/* Marcar como leído/no leído */}
              <button
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onRead?.();
                }}
                title={notification.isRead ? "Marcar como no leído" : "Marcar como leído"}
              >
                {notification.isRead ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-[var(--color-primary-60)]" />
                )}
              </button>

              {/* Menú de opciones */}
              <div className="relative">
                <button
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>

                {/* Dropdown menu */}
                {showMenu && (
                  <div className="absolute right-0 top-8 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction?.();
                        setShowMenu(false);
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ver detalles
                    </button>
                    
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss?.();
                        setShowMenu(false);
                      }}
                    >
                      <X className="w-4 h-4" />
                      Descartar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mensaje */}
          <p className={cn(
            "text-gray-600 line-clamp-2 mb-2",
            variant === 'compact' ? 'text-sm' : 'text-base'
          )}>
            {notification.message}
          </p>

          {/* Contenido específico del tipo */}
          <NotificationContent notification={notification} />

          {/* Imagen adicional */}
          {notification.image && variant !== 'compact' && (
            <div className="mt-3">
              <img
                src={notification.image}
                alt="Imagen de notificación"
                className="w-full h-32 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Acciones */}
          {showActions && notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {notification.actions.map((action, index) => (
                <ServiButton
                  key={index}
                  variant={
                    action.action === 'primary' ? 'filled' :
                    action.action === 'destructive' ? 'filled' : 'outlined'
                  }
                  color={action.action === 'destructive' ? 'error' : 'primary'}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                >
                  {action.label}
                </ServiButton>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente de lista de notificaciones
export const NotificationList: React.FC<{
  notifications: NotificationData[];
  onNotificationRead?: (id: string) => void;
  onNotificationAction?: (id: string) => void;
  onNotificationDismiss?: (id: string) => void;
  variant?: NotificationCardProps['variant'];
  className?: string;
}> = ({
  notifications,
  onNotificationRead,
  onNotificationAction,
  onNotificationDismiss,
  variant = 'default',
  className
}) => {
  if (notifications.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No tienes notificaciones</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          variant={variant}
          onRead={() => onNotificationRead?.(notification.id)}
          onAction={() => onNotificationAction?.(notification.id)}
          onDismiss={() => onNotificationDismiss?.(notification.id)}
        />
      ))}
    </div>
  );
};

// Skeleton para loading
export const NotificationCardSkeleton: React.FC<{ variant?: NotificationCardProps['variant'] }> = ({ 
  variant = 'default' 
}) => (
  <div className={cn(
    "bg-white rounded-xl border border-gray-200 animate-pulse",
    variant === 'compact' ? 'p-3' : 'p-4'
  )}>
    <div className="flex gap-3">
      <div className="w-10 h-10 bg-gray-200 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="flex gap-2">
          <div className="h-6 bg-gray-200 rounded w-16" />
          <div className="h-6 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  </div>
);

export default NotificationCard;