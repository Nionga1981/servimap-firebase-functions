/**
 * BottomNavigationBar - Material Design 3 Bottom Navigation Component for ServiMap
 * 
 * Navegación principal móvil con tabs, badges de notificación y ripple effects.
 * Implementa las guías de Material Design 3 para navegación inferior.
 * 
 * @component
 * @example
 * <BottomNavigationBar 
 *   activeTab="home"
 *   onTabChange={(tab) => console.log('Tab changed:', tab)}
 *   badges={{ messages: 3, services: 1 }}
 * />
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Home, 
  Search, 
  Briefcase, 
  MessageCircle, 
  User,
  MapPin,
  Calendar,
  Heart
} from 'lucide-react';

interface NavigationTab {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  badge?: number;
  disabled?: boolean;
}

export interface BottomNavigationBarProps {
  /** Tab actualmente seleccionado */
  activeTab: string;
  /** Callback cuando cambia el tab */
  onTabChange: (tabId: string) => void;
  /** Badges de notificación por tab */
  badges?: Record<string, number>;
  /** Tabs personalizados (opcional) */
  customTabs?: NavigationTab[];
  /** Variante del diseño */
  variant?: 'default' | 'labeled' | 'selected-labeled';
  /** Ocultar en ciertas condiciones */
  hidden?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

// Tabs por defecto para ServiMap
const defaultTabs: NavigationTab[] = [
  {
    id: 'home',
    label: 'Inicio',
    icon: Home
  },
  {
    id: 'search',
    label: 'Buscar',
    icon: Search
  },
  {
    id: 'services',
    label: 'Servicios',
    icon: Briefcase
  },
  {
    id: 'messages',
    label: 'Mensajes',
    icon: MessageCircle
  },
  {
    id: 'profile',
    label: 'Perfil',
    icon: User
  }
];

// Ripple effect para tabs
interface RippleProps {
  x: number;
  y: number;
}

const TabRipple: React.FC<{ ripples: RippleProps[] }> = ({ ripples }) => {
  return (
    <>
      {ripples.map((ripple, index) => (
        <span
          key={index}
          className="absolute bg-current/20 rounded-full animate-ripple pointer-events-none"
          style={{
            left: ripple.x - 25,
            top: ripple.y - 25,
            width: 50,
            height: 50,
          }}
        />
      ))}
    </>
  );
};

// Badge component para notificaciones
const NotificationBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-error text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
      {count > 99 ? '99+' : count}
    </span>
  );
};

// Tab individual
interface NavigationTabComponentProps {
  tab: NavigationTab;
  isActive: boolean;
  badge?: number;
  variant: 'default' | 'labeled' | 'selected-labeled';
  onClick: () => void;
}

const NavigationTabComponent: React.FC<NavigationTabComponentProps> = ({
  tab,
  isActive,
  badge,
  variant,
  onClick
}) => {
  const [ripples, setRipples] = useState<RippleProps[]>([]);
  const Icon = tab.icon;

  const handleClick = (e: React.MouseEvent) => {
    if (tab.disabled) return;

    // Ripple effect
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setRipples([...ripples, { x, y }]);
    setTimeout(() => {
      setRipples((prevRipples) => prevRipples.slice(1));
    }, 400);

    onClick();
  };

  const showLabel = variant === 'labeled' || (variant === 'selected-labeled' && isActive);

  return (
    <button
      className={cn(
        "relative flex-1 flex flex-col items-center justify-center py-3 px-2 transition-all duration-200 overflow-hidden",
        "min-h-[64px] active:scale-95",
        tab.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
      onClick={handleClick}
      disabled={tab.disabled}
      aria-label={tab.label}
      role="tab"
      aria-selected={isActive}
    >
      {/* Icon container */}
      <div className="relative mb-1">
        {/* State layer (background when active) */}
        <div className={cn(
          "absolute inset-0 rounded-full transition-all duration-200",
          "w-8 h-8 -translate-x-4 -translate-y-4",
          isActive 
            ? "bg-[var(--color-secondary-container)] scale-100" 
            : "bg-transparent scale-0"
        )} />
        
        {/* Icon */}
        <Icon 
          className={cn(
            "w-6 h-6 relative z-10 transition-colors duration-200",
            isActive 
              ? "text-[var(--color-on-secondary-container)]" 
              : "text-[var(--color-on-surface-variant)]"
          )}
        />
        
        {/* Badge */}
        {badge && <NotificationBadge count={badge} />}
      </div>

      {/* Label */}
      {showLabel && (
        <span className={cn(
          "text-xs font-medium transition-colors duration-200 leading-none",
          isActive 
            ? "text-[var(--color-on-surface)]" 
            : "text-[var(--color-on-surface-variant)]"
        )}>
          {tab.label}
        </span>
      )}

      {/* Ripple effects */}
      <TabRipple ripples={ripples} />
    </button>
  );
};

export const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  activeTab,
  onTabChange,
  badges = {},
  customTabs,
  variant = 'selected-labeled',
  hidden = false,
  className
}) => {
  const tabs = customTabs || defaultTabs;

  // Auto-hide cuando se hace scroll (opcional)
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingUp = currentScrollY < lastScrollY;
      
      // Solo ocultar si se hace scroll hacia abajo más de 100px
      if (currentScrollY > 100 && !isScrollingUp) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      lastScrollY = currentScrollY;
    };

    // Solo agregar listener si no está forzado a oculto
    if (!hidden) {
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav 
      className={cn(
        // Base styles
        "fixed bottom-0 left-0 right-0 z-[var(--z-fixed)]",
        "bg-[var(--color-surface-container)] border-t border-[var(--color-outline-variant)]",
        "transition-transform duration-300 ease-out",
        // Visibility
        isVisible ? "translate-y-0" : "translate-y-full",
        // Safe area for mobile devices
        "pb-[env(safe-area-inset-bottom)]",
        className
      )}
      role="tablist"
      aria-label="Navegación principal"
    >
      {/* Surface elevation effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
      
      {/* Tabs container */}
      <div className="flex items-stretch relative">
        {tabs.map((tab) => (
          <NavigationTabComponent
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            badge={badges[tab.id]}
            variant={variant}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>
    </nav>
  );
};

// Export variants for different use cases
export const BottomNavigationVariants = {
  // Navegación estándar para clientes
  Client: (props: Omit<BottomNavigationBarProps, 'customTabs'>) => (
    <BottomNavigationBar {...props} />
  ),

  // Navegación para prestadores de servicios
  Provider: (props: Omit<BottomNavigationBarProps, 'customTabs'>) => {
    const providerTabs: NavigationTab[] = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'requests', label: 'Solicitudes', icon: Briefcase },
      { id: 'schedule', label: 'Agenda', icon: Calendar },
      { id: 'messages', label: 'Mensajes', icon: MessageCircle },
      { id: 'profile', label: 'Perfil', icon: User }
    ];

    return <BottomNavigationBar {...props} customTabs={providerTabs} />;
  },

  // Navegación mínima (3 tabs)
  Minimal: (props: Omit<BottomNavigationBarProps, 'customTabs'>) => {
    const minimalTabs: NavigationTab[] = [
      { id: 'home', label: 'Inicio', icon: Home },
      { id: 'search', label: 'Buscar', icon: Search },
      { id: 'profile', label: 'Perfil', icon: User }
    ];

    return <BottomNavigationBar {...props} customTabs={minimalTabs} variant="labeled" />;
  }
};

// Export tab configurations
export const NavigationTabConfigs = {
  client: defaultTabs,
  provider: [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'requests', label: 'Solicitudes', icon: Briefcase },
    { id: 'schedule', label: 'Agenda', icon: Calendar },
    { id: 'messages', label: 'Mensajes', icon: MessageCircle },
    { id: 'profile', label: 'Perfil', icon: User }
  ],
  admin: [
    { id: 'overview', label: 'Resumen', icon: Home },
    { id: 'users', label: 'Usuarios', icon: User },
    { id: 'services', label: 'Servicios', icon: Briefcase },
    { id: 'reports', label: 'Reportes', icon: Search },
    { id: 'settings', label: 'Config', icon: User }
  ]
};

export default BottomNavigationBar;