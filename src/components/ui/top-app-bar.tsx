/**
 * TopAppBar - Material Design 3 Top App Bar Component for ServiMap
 * 
 * Header adaptativo con múltiples variantes: small, medium, large, center-aligned.
 * Incluye navegación, acciones, scroll behavior y soporte para búsqueda integrada.
 * 
 * @component
 * @example
 * <TopAppBar 
 *   variant="small"
 *   title="ServiMap"
 *   navigationIcon={<ArrowLeft />}
 *   onNavigationClick={() => history.back()}
 *   actions={[
 *     { icon: <Search />, onClick: () => openSearch(), label: "Buscar" },
 *     { icon: <MoreVertical />, onClick: () => openMenu(), label: "Más opciones" }
 *   ]}
 * />
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  ArrowLeft, 
  Menu, 
  Search, 
  MoreVertical, 
  Bell,
  Filter,
  X,
  ChevronDown
} from 'lucide-react';
import { ServiSearchBar } from './servi-search-bar';

interface TopAppBarAction {
  /** Icono de la acción */
  icon: React.ReactNode;
  /** Función al hacer click */
  onClick: () => void;
  /** Label para accesibilidad */
  label: string;
  /** Badge de notificación */
  badge?: number;
  /** Deshabilitado */
  disabled?: boolean;
}

export interface TopAppBarProps {
  /** Variante del app bar */
  variant?: 'small' | 'center-aligned' | 'medium' | 'large';
  /** Título principal */
  title?: string;
  /** Subtítulo (solo para medium/large) */
  subtitle?: string;
  /** Icono de navegación (hamburger, back, etc.) */
  navigationIcon?: React.ReactNode;
  /** Callback del icono de navegación */
  onNavigationClick?: () => void;
  /** Acciones del lado derecho */
  actions?: TopAppBarAction[];
  /** Mostrar barra de búsqueda integrada */
  searchMode?: boolean;
  /** Props para la búsqueda */
  searchProps?: {
    value: string;
    onChange: (value: string) => void;
    onSearch: (value: string) => void;
    placeholder?: string;
  };
  /** Callback para entrar/salir del modo búsqueda */
  onSearchToggle?: (searchMode: boolean) => void;
  /** Comportamiento en scroll */
  scrollBehavior?: 'fixed' | 'scroll' | 'scroll-snap' | 'elevate';
  /** Color de fondo personalizado */
  backgroundColor?: 'default' | 'surface' | 'primary' | 'transparent';
  /** Contenido adicional debajo del título (para large) */
  children?: React.ReactNode;
  /** Clase CSS adicional */
  className?: string;
}

// Badge para notificaciones en acciones
const ActionBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  
  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-error text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
      {count > 99 ? '99+' : count}
    </span>
  );
};

// Botón de acción individual
const ActionButton: React.FC<{ action: TopAppBarAction }> = ({ action }) => {
  return (
    <button
      className={cn(
        "relative p-3 rounded-full transition-all duration-200",
        "hover:bg-black/5 active:bg-black/10 active:scale-95",
        action.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
      onClick={action.onClick}
      disabled={action.disabled}
      aria-label={action.label}
      title={action.label}
    >
      {action.icon}
      {action.badge && <ActionBadge count={action.badge} />}
    </button>
  );
};

export const TopAppBar: React.FC<TopAppBarProps> = ({
  variant = 'small',
  title = 'ServiMap',
  subtitle,
  navigationIcon,
  onNavigationClick,
  actions = [],
  searchMode = false,
  searchProps,
  onSearchToggle,
  scrollBehavior = 'fixed',
  backgroundColor = 'default',
  children,
  className
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(searchMode);
  const appBarRef = useRef<HTMLElement>(null);

  // Manejar scroll behavior
  useEffect(() => {
    if (scrollBehavior === 'fixed') return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const threshold = 10;

      if (scrollBehavior === 'elevate') {
        setIsScrolled(scrollTop > threshold);
      } else if (scrollBehavior === 'scroll-snap') {
        // Implementar snap behavior
        const appBarHeight = appBarRef.current?.offsetHeight || 64;
        if (scrollTop > appBarHeight / 2) {
          setIsScrolled(true);
        } else {
          setIsScrolled(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollBehavior]);

  // Manejar toggle de búsqueda
  const handleSearchToggle = () => {
    const newSearchMode = !isSearchExpanded;
    setIsSearchExpanded(newSearchMode);
    onSearchToggle?.(newSearchMode);
  };

  // Estilos base según variante
  const getVariantStyles = () => {
    switch (variant) {
      case 'center-aligned':
        return 'h-16 justify-center text-center';
      case 'medium':
        return 'h-24 pb-6';
      case 'large':
        return 'min-h-32 pb-6';
      default: // small
        return 'h-16';
    }
  };

  // Estilos de fondo
  const getBackgroundStyles = () => {
    const base = 'transition-all duration-200';
    
    switch (backgroundColor) {
      case 'surface':
        return `${base} bg-[var(--color-surface-container)]`;
      case 'primary':
        return `${base} bg-[var(--color-primary-60)] text-white`;
      case 'transparent':
        return `${base} bg-transparent`;
      default:
        return `${base} bg-[var(--color-surface)]`;
    }
  };

  // Estilos de elevación
  const getElevationStyles = () => {
    if (scrollBehavior === 'elevate' && isScrolled) {
      return 'shadow-md';
    }
    return variant === 'small' ? 'border-b border-[var(--color-outline-variant)]' : '';
  };

  return (
    <header 
      ref={appBarRef}
      className={cn(
        // Base styles
        "fixed top-0 left-0 right-0 z-[var(--z-fixed)]",
        "flex items-end px-4",
        // Variant styles
        getVariantStyles(),
        // Background
        getBackgroundStyles(),
        // Elevation
        getElevationStyles(),
        // Safe area for mobile devices
        "pt-[env(safe-area-inset-top)]",
        className
      )}
    >
      {/* Modo búsqueda expandida */}
      {isSearchExpanded && searchProps ? (
        <div className="flex items-center w-full h-14 gap-4">
          <button
            className="p-2 rounded-full hover:bg-black/5 active:bg-black/10"
            onClick={handleSearchToggle}
            aria-label="Cerrar búsqueda"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex-1">
            <ServiSearchBar
              {...searchProps}
              variant="docked"
              voice={true}
              location={false}
              className="w-full"
            />
          </div>
        </div>
      ) : (
        // Modo normal
        <div className="flex items-center w-full min-h-[56px]">
          {/* Navegación */}
          {navigationIcon && onNavigationClick && (
            <button
              className="mr-2 p-3 rounded-full hover:bg-black/5 active:bg-black/10 active:scale-95 transition-all duration-200"
              onClick={onNavigationClick}
              aria-label="Navegación"
            >
              {navigationIcon}
            </button>
          )}

          {/* Título y contenido */}
          <div className={cn(
            "flex-1 min-w-0", // min-w-0 para permitir truncate
            variant === 'center-aligned' && !navigationIcon && !actions.length && "text-center"
          )}>
            {/* Título principal */}
            <h1 className={cn(
              "font-medium truncate",
              variant === 'small' ? "text-title-large" : "text-headline-small",
              variant === 'large' && "text-headline-medium"
            )}>
              {title}
            </h1>

            {/* Subtítulo (medium/large) */}
            {subtitle && (variant === 'medium' || variant === 'large') && (
              <p className="text-body-medium text-[var(--color-on-surface-variant)] truncate mt-1">
                {subtitle}
              </p>
            )}

            {/* Contenido adicional (large) */}
            {children && variant === 'large' && (
              <div className="mt-3">
                {children}
              </div>
            )}
          </div>

          {/* Acciones */}
          {actions.length > 0 && (
            <div className="flex items-center ml-2 -mr-3">
              {actions.map((action, index) => (
                <ActionButton key={index} action={action} />
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

// Variants predefinidos para casos comunes
export const TopAppBarVariants = {
  // Header principal de la app
  Main: (props: Partial<TopAppBarProps>) => (
    <TopAppBar
      variant="small"
      title="ServiMap"
      navigationIcon={<Menu className="w-6 h-6" />}
      actions={[
        { 
          icon: <Search className="w-6 h-6" />, 
          onClick: () => props.onSearchToggle?.(true),
          label: "Buscar servicios" 
        },
        { 
          icon: <Bell className="w-6 h-6" />, 
          onClick: () => console.log('Notifications'),
          label: "Notificaciones",
          badge: 3
        }
      ]}
      scrollBehavior="elevate"
      {...props}
    />
  ),

  // Header con búsqueda
  Search: (props: Partial<TopAppBarProps>) => (
    <TopAppBar
      variant="small"
      title="Buscar servicios"
      navigationIcon={<ArrowLeft className="w-6 h-6" />}
      actions={[
        { 
          icon: <Filter className="w-6 h-6" />, 
          onClick: () => console.log('Filters'),
          label: "Filtros" 
        }
      ]}
      searchMode={true}
      {...props}
    />
  ),

  // Header de perfil
  Profile: (props: Partial<TopAppBarProps>) => (
    <TopAppBar
      variant="large"
      title="Mi Perfil"
      subtitle="Gestiona tu información y preferencias"
      navigationIcon={<ArrowLeft className="w-6 h-6" />}
      actions={[
        { 
          icon: <MoreVertical className="w-6 h-6" />, 
          onClick: () => console.log('Menu'),
          label: "Más opciones" 
        }
      ]}
      scrollBehavior="scroll"
      {...props}
    />
  ),

  // Header centrado simple
  Centered: (props: Partial<TopAppBarProps>) => (
    <TopAppBar
      variant="center-aligned"
      {...props}
    />
  ),

  // Header de chat
  Chat: (props: Partial<TopAppBarProps>) => (
    <TopAppBar
      variant="small"
      navigationIcon={<ArrowLeft className="w-6 h-6" />}
      actions={[
        { 
          icon: <Search className="w-6 h-6" />, 
          onClick: () => console.log('Search chat'),
          label: "Buscar en chat" 
        },
        { 
          icon: <MoreVertical className="w-6 h-6" />, 
          onClick: () => console.log('Chat options'),
          label: "Opciones de chat" 
        }
      ]}
      backgroundColor="primary"
      {...props}
    />
  )
};

export default TopAppBar;