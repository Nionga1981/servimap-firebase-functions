'use client';

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, 
  Settings, 
  User, 
  MapPin, 
  Search,
  Menu,
  X,
  Crown,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation as useLocationContext } from '@/contexts/LocationContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const { currentLocation, locationName } = useLocationContext();
  const { unreadCount } = useNotifications();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Detectar scroll para efectos visuales
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cerrar menú al navegar
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const isPremium = userProfile?.premiumStatus?.active;
  const isProvider = userProfile?.isProvider;

  return (
    <header className={`sticky top-0 z-50 bg-white transition-all duration-200 ${
      isScrolled ? 'shadow-md border-b' : 'border-b border-gray-100'
    }`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo y ubicación */}
          <div className="flex items-center space-x-3 flex-1">
            {/* Logo ServiMap */}
            <Link 
              to="/" 
              className="flex items-center space-x-2 group"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent hidden sm:block">
                ServiMap
              </span>
            </Link>

            {/* Ubicación actual */}
            <div className="hidden md:flex items-center space-x-1 text-gray-600 max-w-48 truncate">
              <MapPin className="h-4 w-4 text-purple-500 flex-shrink-0" />
              <span className="text-sm truncate">
                {locationName || 'Detectando ubicación...'}
              </span>
            </div>
          </div>

          {/* Búsqueda en desktop */}
          <div className="hidden lg:flex flex-1 max-w-md mx-4">
            <div 
              className="w-full bg-gray-50 hover:bg-gray-100 rounded-full px-4 py-2 cursor-pointer transition-colors"
              onClick={() => navigate('/search')}
            >
              <div className="flex items-center space-x-2 text-gray-500">
                <Search className="h-4 w-4" />
                <span className="text-sm">Busca servicios cerca de ti...</span>
              </div>
            </div>
          </div>

          {/* Acciones del usuario */}
          <div className="flex items-center space-x-2">
            {/* Botón de búsqueda en móvil */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden p-2"
              onClick={() => navigate('/search')}
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Notificaciones */}
            <Button
              variant="ghost"
              size="sm"
              className="relative p-2"
              onClick={() => navigate('/notifications')}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>

            {/* Perfil de usuario */}
            <Button
              variant="ghost"
              size="sm"
              className="relative p-2"
              onClick={() => navigate('/profile')}
            >
              <div className="relative">
                <User className="h-5 w-5" />
                {isPremium && (
                  <Crown className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                )}
                {isProvider && !isPremium && (
                  <Shield className="h-3 w-3 text-blue-500 absolute -top-1 -right-1" />
                )}
              </div>
            </Button>

            {/* Menú hamburguesa para móvil */}
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden p-2"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <MobileMenu 
                  user={user}
                  userProfile={userProfile}
                  onNavigate={(path) => {
                    navigate(path);
                    setIsMenuOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>

            {/* Configuración en desktop */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex p-2"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Ubicación en móvil */}
        <div className="md:hidden mt-2">
          <div className="flex items-center space-x-1 text-gray-600">
            <MapPin className="h-4 w-4 text-purple-500" />
            <span className="text-sm truncate">
              {locationName || 'Detectando ubicación...'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

// Componente del menú móvil
function MobileMenu({ user, userProfile, onNavigate }) {
  const isPremium = userProfile?.premiumStatus?.active;
  const isProvider = userProfile?.isProvider;

  return (
    <div className="py-6">
      {/* Perfil del usuario */}
      <div className="px-6 pb-6 border-b">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900">
                {user?.displayName || 'Usuario'}
              </h3>
              {isPremium && <Crown className="h-4 w-4 text-yellow-500" />}
              {isProvider && !isPremium && <Shield className="h-4 w-4 text-blue-500" />}
            </div>
            <p className="text-sm text-gray-600">{user?.email}</p>
            {isPremium && (
              <Badge variant="secondary" className="mt-1 bg-yellow-100 text-yellow-800">
                Premium
              </Badge>
            )}
            {isProvider && (
              <Badge variant="secondary" className="mt-1 bg-blue-100 text-blue-800">
                Prestador
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="px-6 py-4 space-y-2">
        <MenuItem 
          icon={User}
          label="Mi Perfil"
          onClick={() => onNavigate('/profile')}
        />
        <MenuItem 
          icon={Search}
          label="Buscar Servicios"
          onClick={() => onNavigate('/search')}
        />
        <MenuItem 
          icon={Bell}
          label="Notificaciones"
          onClick={() => onNavigate('/notifications')}
        />
        <MenuItem 
          icon={Settings}
          label="Configuración"
          onClick={() => onNavigate('/settings')}
        />
        
        {isProvider && (
          <>
            <div className="border-t pt-2 mt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Prestador
              </p>
              <MenuItem 
                icon={Shield}
                label="Panel de Control"
                onClick={() => onNavigate('/provider/dashboard')}
              />
              <MenuItem 
                icon={Settings}
                label="Configurar Servicios"
                onClick={() => onNavigate('/provider/services')}
              />
            </div>
          </>
        )}

        {!isPremium && (
          <div className="border-t pt-2 mt-4">
            <MenuItem 
              icon={Crown}
              label="Upgrade a Premium"
              onClick={() => onNavigate('/premium')}
              className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
            />
          </div>
        )}
      </nav>

      {/* Información adicional */}
      <div className="px-6 pt-4 border-t">
        <div className="text-xs text-gray-500 space-y-1">
          <p>ServiMap v1.0.0</p>
          <p>¿Necesitas ayuda? <span className="text-purple-600 underline">Contactanos</span></p>
        </div>
      </div>
    </div>
  );
}

// Componente de item del menú
function MenuItem({ icon: Icon, label, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left hover:bg-gray-50 transition-colors ${className}`}
    >
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}