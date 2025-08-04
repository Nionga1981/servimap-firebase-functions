/**
 * LoadingStates - Material Design 3 Loading States Component for ServiMap
 * 
 * Conjunto de componentes para diferentes estados de carga: spinners, skeletons,
 * progress bars, placeholders y estados de carga específicos para la aplicación.
 * 
 * @component
 * @example
 * <LoadingSpinner size="large" label="Cargando servicios..." />
 * <SkeletonCard variant="provider" />
 * <ProgressLoader progress={75} label="Subiendo archivo..." />
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Loader2,
  CircleDot,
  RefreshCw,
  Upload,
  Download,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Search,
  MapPin,
  Users,
  MessageCircle,
  Star,
  Calendar,
  Clock
} from 'lucide-react';

// Props base para todos los componentes de loading
interface BaseLoadingProps {
  /** Clase CSS adicional */
  className?: string;
}

// ===============================
// SPINNER COMPONENTS
// ===============================

interface LoadingSpinnerProps extends BaseLoadingProps {
  /** Tamaño del spinner */
  size?: 'small' | 'medium' | 'large' | 'xl';
  /** Color del spinner */
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  /** Texto de carga */
  label?: string;
  /** Mostrar en centro de pantalla */
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'primary',
  label,
  fullScreen = false,
  className
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'text-[var(--color-primary-60)]',
    secondary: 'text-[var(--color-secondary-60)]',
    white: 'text-white',
    gray: 'text-gray-500'
  };

  const content = (
    <div className={cn(
      "flex flex-col items-center gap-3",
      className
    )}>
      <Loader2 className={cn(
        "animate-spin",
        sizeClasses[size],
        colorClasses[color]
      )} />
      {label && (
        <p className={cn(
          "text-sm font-medium",
          color === 'white' ? 'text-white' : 'text-gray-600'
        )}>
          {label}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

// Spinner con puntos animados
export const DotsLoader: React.FC<BaseLoadingProps & {
  size?: 'small' | 'medium' | 'large';
}> = ({ size = 'medium', className }) => {
  const dotSizes = {
    small: 'w-1.5 h-1.5',
    medium: 'w-2 h-2',
    large: 'w-3 h-3'
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "bg-[var(--color-primary-60)] rounded-full animate-pulse",
            dotSizes[size]
          )}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  );
};

// ===============================
// PROGRESS COMPONENTS
// ===============================

interface ProgressLoaderProps extends BaseLoadingProps {
  /** Progreso (0-100) */
  progress: number;
  /** Etiqueta del progreso */
  label?: string;
  /** Mostrar porcentaje */
  showPercentage?: boolean;
  /** Color de la barra */
  color?: 'primary' | 'secondary' | 'success' | 'warning';
  /** Tamaño de la barra */
  size?: 'small' | 'medium' | 'large';
}

export const ProgressLoader: React.FC<ProgressLoaderProps> = ({
  progress,
  label,
  showPercentage = true,
  color = 'primary',
  size = 'medium',
  className
}) => {
  const colorClasses = {
    primary: 'bg-[var(--color-primary-60)]',
    secondary: 'bg-[var(--color-secondary-60)]',
    success: 'bg-green-500',
    warning: 'bg-yellow-500'
  };

  const heightClasses = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-3'
  };

  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={cn("w-full", className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm text-gray-500">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      
      <div className={cn(
        "w-full bg-gray-200 rounded-full overflow-hidden",
        heightClasses[size]
      )}>
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out rounded-full",
            colorClasses[color]
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

// Progress circular
export const CircularProgress: React.FC<BaseLoadingProps & {
  progress?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}> = ({ 
  progress, 
  size = 40, 
  strokeWidth = 4, 
  color = 'var(--color-primary-60)',
  className 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = progress !== undefined ? circumference - (progress / 100) * circumference : 0;

  return (
    <div className={cn("relative inline-flex", className)}>
      <svg
        width={size}
        height={size}
        className={progress === undefined ? "animate-spin" : ""}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: `${size / 2}px ${size / 2}px`
          }}
        />
      </svg>
    </div>
  );
};

// ===============================
// SKELETON COMPONENTS
// ===============================

interface SkeletonProps extends BaseLoadingProps {
  /** Altura del skeleton */
  height?: string | number;
  /** Ancho del skeleton */
  width?: string | number;
  /** Forma del skeleton */
  variant?: 'rectangular' | 'circular' | 'rounded';
  /** Animación */
  animated?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  height = 20,
  width = '100%',
  variant = 'rectangular',
  animated = true,
  className
}) => {
  const variantClasses = {
    rectangular: 'rounded-none',
    circular: 'rounded-full',
    rounded: 'rounded-md'
  };

  return (
    <div
      className={cn(
        "bg-gray-200",
        variantClasses[variant],
        animated && "animate-pulse",
        className
      )}
      style={{ height, width }}
    />
  );
};

// Skeleton Cards específicos para ServiMap
export const SkeletonCard: React.FC<BaseLoadingProps & {
  variant: 'provider' | 'service' | 'notification' | 'chat' | 'simple';
}> = ({ variant, className }) => {
  const renderProviderSkeleton = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="flex gap-3">
        <Skeleton variant="circular" width={64} height={64} />
        <div className="flex-1 space-y-2">
          <Skeleton height={20} width="75%" />
          <Skeleton height={16} width="50%" />
          <div className="flex gap-2">
            <Skeleton height={16} width={60} />
            <Skeleton height={16} width={40} />
          </div>
          <div className="flex gap-2 mt-3">
            <Skeleton height={32} width={80} />
            <Skeleton height={32} width={60} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderServiceSkeleton = () => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <Skeleton height={192} width="100%" />
      <div className="p-4 space-y-3">
        <Skeleton height={20} width="90%" />
        <Skeleton height={16} width="60%" />
        <Skeleton height={14} width="100%" />
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" width={32} height={32} />
            <div className="space-y-1">
              <Skeleton height={14} width={60} />
              <Skeleton height={12} width={40} />
            </div>
          </div>
          <Skeleton height={18} width={80} />
        </div>
      </div>
    </div>
  );

  const renderNotificationSkeleton = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="flex gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} width="70%" />
          <Skeleton height={14} width="40%" />
          <Skeleton height={14} width="100%" />
          <div className="flex gap-2">
            <Skeleton height={24} width={60} />
            <Skeleton height={24} width={80} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderChatSkeleton = () => (
    <div className="flex gap-3 animate-pulse">
      <Skeleton variant="circular" width={32} height={32} />
      <div className="flex-1 space-y-2">
        <Skeleton height={16} width="60%" />
        <div className="bg-gray-100 rounded-2xl p-3 max-w-xs">
          <Skeleton height={14} width="100%" />
          <Skeleton height={14} width="80%" className="mt-1" />
        </div>
      </div>
    </div>
  );

  const renderSimpleSkeleton = () => (
    <div className="space-y-3 animate-pulse">
      <Skeleton height={20} width="100%" />
      <Skeleton height={16} width="80%" />
      <Skeleton height={16} width="60%" />
    </div>
  );

  const skeletons = {
    provider: renderProviderSkeleton,
    service: renderServiceSkeleton,
    notification: renderNotificationSkeleton,
    chat: renderChatSkeleton,
    simple: renderSimpleSkeleton
  };

  return (
    <div className={className}>
      {skeletons[variant]()}
    </div>
  );
};

// ===============================
// ESTADOS ESPECÍFICOS DE SERVIMAP
// ===============================

interface SearchLoadingProps extends BaseLoadingProps {
  query?: string;
  type?: 'services' | 'providers' | 'locations';
}

export const SearchLoading: React.FC<SearchLoadingProps> = ({
  query,
  type = 'services',
  className
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const typeLabels = {
    services: 'servicios',
    providers: 'prestadores',
    locations: 'ubicaciones'
  };

  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <div className="relative">
        <Search className="w-12 h-12 text-[var(--color-primary-60)] animate-pulse" />
        <div className="absolute -bottom-2 -right-2">
          <CircularProgress size={24} />
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-lg font-medium text-gray-700">
          Buscando {typeLabels[type]}{dots}
        </p>
        {query && (
          <p className="text-sm text-gray-500 mt-1">
            &quot;{query}&quot;
          </p>
        )}
      </div>
    </div>
  );
};

interface MapLoadingProps extends BaseLoadingProps {
  /** Mensaje personalizado */
  message?: string;
}

export const MapLoading: React.FC<MapLoadingProps> = ({
  message = "Cargando mapa...",
  className
}) => (
  <div className={cn(
    "flex flex-col items-center justify-center h-64 bg-gray-100 rounded-lg",
    className
  )}>
    <MapPin className="w-12 h-12 text-[var(--color-primary-60)] animate-bounce" />
    <p className="text-gray-600 mt-3">{message}</p>
    <DotsLoader className="mt-2" />
  </div>
);

interface ConnectionStatusProps extends BaseLoadingProps {
  /** Estado de conexión */
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  /** Mensaje personalizado */
  message?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  message,
  className
}) => {
  const statusConfigs = {
    connecting: {
      icon: Wifi,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      defaultMessage: 'Conectando...'
    },
    connected: {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      defaultMessage: 'Conectado'
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      defaultMessage: 'Sin conexión'
    },
    reconnecting: {
      icon: RefreshCw,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      defaultMessage: 'Reconectando...'
    }
  };

  const config = statusConfigs[status];
  const IconComponent = config.icon;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg border",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <IconComponent className={cn(
        "w-5 h-5",
        config.color,
        (status === 'connecting' || status === 'reconnecting') && "animate-spin"
      )} />
      <span className="text-sm font-medium text-gray-700">
        {message || config.defaultMessage}
      </span>
    </div>
  );
};

// ===============================
// COMPONENTES DE UPLOAD/DOWNLOAD
// ===============================

interface FileUploadProgressProps extends BaseLoadingProps {
  /** Nombre del archivo */
  fileName: string;
  /** Progreso de subida (0-100) */
  progress: number;
  /** Tamaño del archivo */
  fileSize?: string;
  /** Estado del upload */
  status?: 'uploading' | 'completed' | 'error';
}

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  fileName,
  progress,
  fileSize,
  status = 'uploading',
  className
}) => {
  const statusIcons = {
    uploading: Upload,
    completed: CheckCircle,
    error: AlertCircle
  };

  const statusColors = {
    uploading: 'text-blue-500',
    completed: 'text-green-500',
    error: 'text-red-500'
  };

  const IconComponent = statusIcons[status];

  return (
    <div className={cn(
      "bg-white border border-gray-200 rounded-lg p-4",
      className
    )}>
      <div className="flex items-start gap-3">
        <IconComponent className={cn(
          "w-5 h-5 mt-0.5",
          statusColors[status],
          status === 'uploading' && "animate-pulse"
        )} />
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {fileName}
          </p>
          {fileSize && (
            <p className="text-xs text-gray-500">{fileSize}</p>
          )}
          
          {status === 'uploading' && (
            <div className="mt-2">
              <ProgressLoader
                progress={progress}
                showPercentage={true}
                size="small"
              />
            </div>
          )}
          
          {status === 'completed' && (
            <p className="text-xs text-green-600 mt-1">Subida completada</p>
          )}
          
          {status === 'error' && (
            <p className="text-xs text-red-600 mt-1">Error al subir archivo</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ===============================
// LOADING LISTS
// ===============================

export const LoadingList: React.FC<BaseLoadingProps & {
  /** Número de items a mostrar */
  count?: number;
  /** Tipo de skeleton */
  itemType?: 'provider' | 'service' | 'notification' | 'simple';
}> = ({ count = 3, itemType = 'simple', className }) => (
  <div className={cn("space-y-4", className)}>
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} variant={itemType} />
    ))}
  </div>
);

export default LoadingSpinner;