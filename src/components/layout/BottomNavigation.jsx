'use client';

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Calendar, 
  MessageCircle, 
  User,
  Crown,
  Shield,
  Bell,
  Plus,
  MapPin
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';

export default function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { unreadCount, unreadChats, upcomingServices } = useNotifications();
  
  const [isProviderMode, setIsProviderMode] = useState(false);

  // Detectar si el usuario está en modo prestador
  useEffect(() => {
    const providerMode = localStorage.getItem('provider_mode') === 'true';
    setIsProviderMode(providerMode);
  }, []);

  const isPremium = userProfile?.premiumStatus?.active;
  const isProvider = userProfile?.isProvider;

  // Configuración de navegación según el modo
  const getNavigationItems = () => {
    if (isProviderMode && isProvider) {
      return [
        {
          id: 'provider-home',
          label: 'Inicio',
          icon: Home,
          path: '/provider/dashboard',
          badge: null
        },
        {
          id: 'provider-requests',
          label: 'Solicitudes',
          icon: Bell,
          path: '/provider/requests',
          badge: unreadCount > 0 ? unreadCount : null
        },
        {
          id: 'provider-schedule',
          label: 'Agenda',
          icon: Calendar,
          path: '/provider/schedule',
          badge: upcomingServices > 0 ? upcomingServices : null
        },
        {
          id: 'chat',
          label: 'Chats',
          icon: MessageCircle,
          path: '/chat',
          badge: unreadChats > 0 ? unreadChats : null
        },
        {
          id: 'profile',
          label: 'Perfil',
          icon: User,
          path: '/profile',
          badge: null,
          premium: isPremium,
          provider: isProvider
        }
      ];
    }

    // Modo usuario normal
    return [
      {
        id: 'home',
        label: 'Inicio',
        icon: Home,
        path: '/',
        badge: null
      },
      {
        id: 'search',
        label: 'Buscar',
        icon: Search,
        path: '/search',
        badge: null
      },
      {
        id: 'schedule',
        label: 'Agenda',
        icon: Calendar,
        path: '/schedule',
        badge: upcomingServices > 0 ? upcomingServices : null
      },
      {
        id: 'chat',
        label: 'Mensajes',
        icon: MessageCircle,
        path: '/chat',
        badge: unreadChats > 0 ? unreadChats : null
      },
      {
        id: 'profile',
        label: 'Perfil',
        icon: User,
        path: '/profile',
        badge: null,
        premium: isPremium,
        provider: isProvider
      }
    ];
  };

  const navigationItems = getNavigationItems();

  // Determinar si una ruta está activa
  const isActiveRoute = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Manejar navegación
  const handleNavigation = (item) => {
    navigate(item.path);
  };

  // Toggle modo prestador
  const toggleProviderMode = () => {
    const newMode = !isProviderMode;
    setIsProviderMode(newMode);
    localStorage.setItem('provider_mode', newMode.toString());
    
    // Redirigir al dashboard apropiado
    if (newMode) {
      navigate('/provider/dashboard');
    } else {
      navigate('/');
    }
  };

  return (
    <>
      {/* FAB para toggle de modo prestador */}
      {isProvider && (
        <div className="fixed bottom-20 right-4 z-40">
          <Button
            onClick={toggleProviderMode}
            className={`
              rounded-full w-14 h-14 shadow-lg transition-all duration-200 hover:scale-105
              ${isProviderMode 
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-purple-500 hover:bg-purple-600'
              }
            `}
          >
            {isProviderMode ? (
              <MapPin className="h-6 w-6 text-white" />
            ) : (
              <Shield className="h-6 w-6 text-white" />
            )}
          </Button>
        </div>
      )}

      {/* Barra de navegación inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-around py-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.path);
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item)}
                  className={`
                    relative flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1
                    transition-colors duration-200 group
                    ${isActive 
                      ? 'text-purple-600' 
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  {/* Ícon container */}
                  <div className="relative mb-1">
                    <Icon 
                      className={`
                        h-6 w-6 transition-transform duration-200
                        ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                      `} 
                    />
                    
                    {/* Badges premium/provider */}
                    {item.id === 'profile' && (
                      <>
                        {item.premium && (
                          <Crown className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500" />
                        )}
                        {item.provider && !item.premium && (
                          <Shield className="absolute -top-1 -right-1 h-3 w-3 text-blue-500" />
                        )}
                      </>
                    )}
                    
                    {/* Badge de notificaciones */}
                    {item.badge && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                      >
                        {item.badge > 9 ? '9+' : item.badge}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Label */}
                  <span className={`
                    text-xs font-medium truncate transition-colors duration-200
                    ${isActive ? 'text-purple-600' : 'text-gray-500'}
                  `}>
                    {item.label}
                  </span>
                  
                  {/* Indicador activo */}
                  {isActive && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-purple-600 rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Indicador de modo prestador */}
        {isProviderMode && isProvider && (
          <div className="bg-blue-50 border-t border-blue-200 py-1">
            <div className="max-w-md mx-auto px-4">
              <div className="flex items-center justify-center space-x-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-800">
                  Modo Prestador Activo
                </span>
              </div>
            </div>
          </div>
        )}
      </nav>
      
      {/* Espaciador para el contenido */}
      <div className={`h-16 ${isProviderMode && isProvider ? 'pb-8' : ''}`}></div>
    </>
  );
}

// Hook personalizado para obtener información de navegación
export function useBottomNavigation() {
  const location = useLocation();
  const { userProfile } = useAuth();
  
  const [currentTab, setCurrentTab] = useState('home');
  const [isProviderMode, setIsProviderMode] = useState(false);

  useEffect(() => {
    const path = location.pathname;
    
    // Determinar tab activo basado en la ruta
    if (path === '/') {
      setCurrentTab('home');
    } else if (path.startsWith('/search')) {
      setCurrentTab('search');
    } else if (path.startsWith('/schedule')) {
      setCurrentTab('schedule');
    } else if (path.startsWith('/chat')) {
      setCurrentTab('chat');
    } else if (path.startsWith('/profile')) {
      setCurrentTab('profile');
    } else if (path.startsWith('/provider')) {
      setCurrentTab('provider-' + path.split('/')[2]);
      setIsProviderMode(true);
    } else {
      setCurrentTab('home');
    }
  }, [location.pathname]);

  return {
    currentTab,
    isProviderMode,
    isPremium: userProfile?.premiumStatus?.active,
    isProvider: userProfile?.isProvider
  };
}

// Componente alternativo para tablets/desktop
export function SideNavigation() {
  const { currentTab, isProviderMode, isPremium, isProvider } = useBottomNavigation();
  const navigate = useNavigate();
  
  // En tablets/desktop, la navegación puede ser lateral
  const navigationItems = [
    { id: 'home', label: 'Inicio', icon: Home, path: '/' },
    { id: 'search', label: 'Buscar', icon: Search, path: '/search' },
    { id: 'schedule', label: 'Agenda', icon: Calendar, path: '/schedule' },
    { id: 'chat', label: 'Mensajes', icon: MessageCircle, path: '/chat' },
    { id: 'profile', label: 'Perfil', icon: User, path: '/profile' }
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-bold text-lg">ServiMap</span>
        </div>
      </div>
      
      <nav className="flex-1 px-4">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-purple-50 text-purple-600 border-r-2 border-purple-600' 
                    : 'text-gray-600 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      
      {/* Upgrade section */}
      {!isPremium && (
        <div className="p-4 border-t">
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-4 text-white">
            <Crown className="h-6 w-6 mb-2" />
            <h3 className="font-semibold">Upgrade a Premium</h3>
            <p className="text-sm opacity-90 mt-1">
              Accede a funciones exclusivas
            </p>
            <Button 
              variant="secondary" 
              size="sm" 
              className="mt-3 w-full"
              onClick={() => navigate('/premium')}
            >
              Saber más
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}