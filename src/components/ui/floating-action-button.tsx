/**
 * FloatingActionButton - Material Design 3 FAB Component for ServiMap
 * 
 * Botón de acción flotante con múltiples variantes: FAB, Mini FAB, Extended FAB.
 * Incluye animaciones, estados de carga, y comportamiento de scroll automático.
 * 
 * @component
 * @example
 * <FloatingActionButton 
 *   variant="primary"
 *   size="medium"
 *   icon={<Plus />}
 *   onClick={() => createNewService()}
 *   label="Crear servicio"
 * />
 * 
 * <FloatingActionButton 
 *   variant="extended"
 *   icon={<MessageCircle />}
 *   label="Nuevo chat"
 *   onClick={() => startChat()}
 * />
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  MessageCircle, 
  Phone, 
  Zap,
  Camera,
  Edit,
  Share2,
  Upload,
  Download,
  Filter,
  Settings,
  ChevronUp,
  X
} from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface FloatingActionButtonProps {
  /** Variante del FAB */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'surface' | 'extended';
  /** Tamaño del FAB */
  size?: 'small' | 'medium' | 'large';
  /** Icono del botón */
  icon?: React.ReactNode;
  /** Texto para extended FAB */
  label?: string;
  /** Callback al hacer click */
  onClick?: () => void;
  /** Estado de loading */
  loading?: boolean;
  /** Deshabilitado */
  disabled?: boolean;
  /** Posición en pantalla */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left';
  /** Comportamiento en scroll */
  scrollBehavior?: 'hide' | 'shrink' | 'extend' | 'fixed';
  /** Badge de notificación */
  badge?: number;
  /** Tooltip */
  tooltip?: string;
  /** Clase CSS adicional */
  className?: string;
  /** Si debe mostrar ripple effect */
  ripple?: boolean;
}

// Interfaz para FAB con múltiples acciones
interface MultiActionFABProps extends Omit<FloatingActionButtonProps, 'onClick' | 'icon' | 'label'> {
  /** Acciones disponibles */
  actions: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
  }>;
  /** Icono principal (cuando está cerrado) */
  mainIcon?: React.ReactNode;
  /** Si está expandido */
  expanded?: boolean;
  /** Callback cuando cambia el estado expandido */
  onExpandedChange?: (expanded: boolean) => void;
}

// Ripple effect component
interface RippleProps {
  x: number;
  y: number;
}

const FABRipple: React.FC<{ ripples: RippleProps[] }> = ({ ripples }) => {
  return (
    <>
      {ripples.map((ripple, index) => (
        <span
          key={index}
          className="absolute bg-white/30 rounded-full animate-ripple pointer-events-none"
          style={{
            left: ripple.x - 30,
            top: ripple.y - 30,
            width: 60,
            height: 60,
          }}
        />
      ))}
    </>
  );
};

// Badge component para notificaciones
const FABBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  
  return (
    <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] bg-error text-white text-xs font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
      {count > 99 ? '99+' : count}
    </span>
  );
};

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  icon = <Plus className="w-6 h-6" />,
  label,
  onClick,
  loading = false,
  disabled = false,
  position = 'bottom-right',
  scrollBehavior = 'fixed',
  badge,
  tooltip,
  className,
  ripple = true
}) => {
  const [ripples, setRipples] = useState<RippleProps[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isExtended, setIsExtended] = useState(variant === 'extended');
  const fabRef = useRef<HTMLButtonElement>(null);

  // Manejar comportamiento en scroll
  useEffect(() => {
    if (scrollBehavior === 'fixed') return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const isScrollingUp = currentScrollY < lastScrollY;
          
          switch (scrollBehavior) {
            case 'hide':
              setIsVisible(isScrollingUp || currentScrollY < 100);
              break;
            case 'shrink':
              setIsExtended(isScrollingUp && currentScrollY > 100);
              break;
            case 'extend':
              setIsExtended(!isScrollingUp && currentScrollY > 100);
              break;
          }
          
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollBehavior]);

  // Manejar click con ripple effect
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    if (ripple) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setRipples([...ripples, { x, y }]);
      setTimeout(() => {
        setRipples((prevRipples) => prevRipples.slice(1));
      }, 600);
    }

    onClick?.();
  };

  // Estilos base según variante
  const getVariantStyles = () => {
    const baseStyles = "shadow-lg hover:shadow-xl transition-all duration-200";
    
    switch (variant) {
      case 'primary':
        return `${baseStyles} bg-[var(--color-primary-60)] text-white hover:bg-[var(--color-primary-70)]`;
      case 'secondary':
        return `${baseStyles} bg-[var(--color-secondary-60)] text-white hover:bg-[var(--color-secondary-70)]`;
      case 'tertiary':
        return `${baseStyles} bg-[var(--color-tertiary-60)] text-white hover:bg-[var(--color-tertiary-70)]`;
      case 'surface':
        return `${baseStyles} bg-[var(--color-surface-container-high)] text-[var(--color-primary-60)] hover:bg-[var(--color-surface-container-highest)]`;
      case 'extended':
        return `${baseStyles} bg-[var(--color-primary-60)] text-white hover:bg-[var(--color-primary-70)]`;
      default:
        return baseStyles;
    }
  };

  // Estilos de tamaño
  const getSizeStyles = () => {
    if (variant === 'extended' || isExtended) {
      return "h-14 px-6 rounded-full";
    }
    
    switch (size) {
      case 'small':
        return "w-10 h-10 rounded-full";
      case 'large':
        return "w-16 h-16 rounded-full";
      default: // medium
        return "w-14 h-14 rounded-full";
    }
  };

  // Estilos de posición
  const getPositionStyles = () => {
    const base = "fixed z-[var(--z-modal)]";
    
    switch (position) {
      case 'bottom-left':
        return `${base} bottom-6 left-6`;
      case 'bottom-center':
        return `${base} bottom-6 left-1/2 -translate-x-1/2`;
      case 'top-right':
        return `${base} top-6 right-6`;
      case 'top-left':
        return `${base} top-6 left-6`;
      default: // bottom-right
        return `${base} bottom-6 right-6`;
    }
  };

  const showLabel = (variant === 'extended' || isExtended) && label;

  return (
    <button
      ref={fabRef}
      className={cn(
        // Base styles
        "relative inline-flex items-center justify-center font-medium overflow-hidden",
        "active:scale-95 transition-transform duration-150",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-60)]",
        // Variant styles
        getVariantStyles(),
        // Size styles
        getSizeStyles(),
        // Position styles
        getPositionStyles(),
        // Visibility
        !isVisible && "translate-y-20 opacity-0",
        // Disabled styles
        (disabled || loading) && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
      onClick={handleClick}
      disabled={disabled || loading}
      title={tooltip}
      aria-label={tooltip || label || "Acción flotante"}
    >
      {/* Loading state */}
      {loading ? (
        <>
          <Loader2 className="animate-spin w-6 h-6" />
          {showLabel && <span className="ml-3">Cargando...</span>}
        </>
      ) : (
        <>
          {/* Icon */}
          <span className={cn(
            "transition-transform duration-200",
            showLabel && "mr-3"
          )}>
            {icon}
          </span>
          
          {/* Label for extended FAB */}
          {showLabel && (
            <span className="text-base font-medium whitespace-nowrap">
              {label}
            </span>
          )}
        </>
      )}

      {/* Badge */}
      {badge && <FABBadge count={badge} />}

      {/* Ripple effects */}
      {ripple && !disabled && !loading && <FABRipple ripples={ripples} />}
    </button>
  );
};

// Multi-Action FAB Component
export const MultiActionFAB: React.FC<MultiActionFABProps> = ({
  actions,
  mainIcon = <Plus className="w-6 h-6" />,
  expanded = false,
  onExpandedChange,
  ...fabProps
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);

  const toggleExpanded = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandedChange?.(newExpanded);
  };

  return (
    <div className="relative">
      {/* Backdrop */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/20 z-[var(--z-modal-backdrop)]"
          onClick={toggleExpanded}
        />
      )}

      {/* Action buttons */}
      {isExpanded && (
        <div className="absolute bottom-full right-0 mb-4 space-y-3 z-[var(--z-modal)]">
          {actions.map((action, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-3 transition-all duration-200",
                "animate-in slide-in-from-bottom-2 fade-in-0"
              )}
              style={{ 
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'both'
              }}
            >
              {/* Action label */}
              <span className="bg-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium text-gray-700 whitespace-nowrap">
                {action.label}
              </span>
              
              {/* Action button */}
              <button
                className={cn(
                  "w-12 h-12 rounded-full shadow-lg transition-all duration-200",
                  "flex items-center justify-center",
                  "hover:scale-110 active:scale-95",
                  action.color || "bg-[var(--color-surface-container-high)] text-[var(--color-primary-60)]",
                  action.disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!action.disabled) {
                    action.onClick();
                    setIsExpanded(false);
                    onExpandedChange?.(false);
                  }
                }}
                disabled={action.disabled}
              >
                {action.icon}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <FloatingActionButton
        {...fabProps}
        icon={
          <div className={cn(
            "transition-transform duration-300",
            isExpanded && "rotate-45"
          )}>
            {isExpanded ? <X className="w-6 h-6" /> : mainIcon}
          </div>
        }
        onClick={toggleExpanded}
        className="relative z-[var(--z-modal)]"
      />
    </div>
  );
};

// Variants predefinidos
export const FloatingActionButtonVariants = {
  // FAB principal para crear
  Create: (props: Partial<FloatingActionButtonProps>) => (
    <FloatingActionButton
      variant="primary"
      icon={<Plus className="w-6 h-6" />}
      tooltip="Crear nuevo"
      {...props}
    />
  ),

  // FAB para mensajes/chat
  Message: (props: Partial<FloatingActionButtonProps>) => (
    <FloatingActionButton
      variant="primary"
      icon={<MessageCircle className="w-6 h-6" />}
      tooltip="Nuevo mensaje"
      {...props}
    />
  ),

  // FAB extendido para acciones principales
  Extended: (props: Partial<FloatingActionButtonProps>) => (
    <FloatingActionButton
      variant="extended"
      icon={<Plus className="w-6 h-6" />}
      label="Solicitar servicio"
      scrollBehavior="shrink"
      {...props}
    />
  ),

  // FAB de emergencia
  Emergency: (props: Partial<FloatingActionButtonProps>) => (
    <FloatingActionButton
      variant="tertiary"
      icon={<Zap className="w-6 h-6" />}
      tooltip="Servicio de emergencia"
      size="large"
      className="!bg-red-600 hover:!bg-red-700"
      {...props}
    />
  ),

  // Multi-Action FAB para servicios
  ServiceActions: (props: Partial<MultiActionFABProps>) => (
    <MultiActionFAB
      actions={[
        {
          icon: <MessageCircle className="w-5 h-5" />,
          label: "Nuevo chat",
          onClick: () => console.log('New chat'),
          color: "bg-blue-500 text-white"
        },
        {
          icon: <Camera className="w-5 h-5" />,
          label: "Subir foto",
          onClick: () => console.log('Upload photo'),
          color: "bg-green-500 text-white"
        },
        {
          icon: <Zap className="w-5 h-5" />,
          label: "Emergencia",
          onClick: () => console.log('Emergency'),
          color: "bg-red-500 text-white"
        }
      ]}
      {...props}
    />
  )
};

export default FloatingActionButton;