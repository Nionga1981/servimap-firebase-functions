'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/hooks/use-toast';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import Header from '@/components/layout/Header';
import BottomNavigation from '@/components/layout/BottomNavigation';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import OfflineIndicator from '@/components/pwa/OfflineIndicator';

// Lazy load de páginas principales
const HomePage = React.lazy(() => import('@/pages/HomePage'));
const AuthPage = React.lazy(() => import('@/pages/AuthPage'));
const SearchPage = React.lazy(() => import('@/pages/SearchPage'));
const ChatPage = React.lazy(() => import('@/pages/ChatPage'));
const ProfilePage = React.lazy(() => import('@/pages/ProfilePage'));
const ProviderProfile = React.lazy(() => import('@/pages/ProviderProfile'));
const ServiceRequest = React.lazy(() => import('@/pages/ServiceRequest'));
const CommunityPage = React.lazy(() => import('@/pages/CommunityPage'));
const SchedulePage = React.lazy(() => import('@/pages/SchedulePage'));
const NotificationsPage = React.lazy(() => import('@/pages/NotificationsPage'));

// CSS Variables para colores ServiMap
const cssVariables = `
  :root {
    /* Brand Colors */
    --primary: #ac7afc;
    --secondary: #3ce923;
    --tertiary: #FFD700;
    --alternate: #60cdff;
    
    /* Utility Colors */
    --text-primary: #14181b;
    --text-secondary: #576366;
    --bg-primary: #f1f4f8;
    --bg-secondary: #ffffff;
    
    /* Additional ServiMap Colors */
    --success: var(--secondary);
    --warning: var(--tertiary);
    --error: #ef4444;
    --info: var(--alternate);
    
    /* Shadows */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }
  
  body {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }
  
  .servimap-primary { color: var(--primary); }
  .servimap-secondary { color: var(--secondary); }
  .servimap-tertiary { color: var(--tertiary); }
  .servimap-alternate { color: var(--alternate); }
  
  .bg-servimap-primary { background-color: var(--primary); }
  .bg-servimap-secondary { background-color: var(--secondary); }
  .bg-servimap-tertiary { background-color: var(--tertiary); }
  .bg-servimap-alternate { background-color: var(--alternate); }
`;

// Componente de Shell principal
function AppShell({ children }) {
  const { user, loading } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState(null);

  // Detectar estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Service Worker Registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado:', registration);
        })
        .catch((error) => {
          console.error('Error registrando Service Worker:', error);
        });
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          {/* Logo placeholder */}
          <div className="w-32 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg mb-4 mx-auto flex items-center justify-center">
            <span className="text-white font-bold text-lg">ServiMap</span>
          </div>
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-4">Cargando ServiMap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Indicador de estado offline */}
      {!isOnline && <OfflineIndicator />}
      
      {/* Header */}
      {user && <Header />}
      
      {/* Contenido principal */}
      <main className="flex-1 pb-16 md:pb-0">
        <ErrorBoundary>
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-96">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
      
      {/* Navegación inferior */}
      {user && <BottomNavigation />}
      
      {/* Install Prompt */}
      {installPrompt && (
        <InstallPrompt 
          prompt={installPrompt} 
          onDismiss={() => setInstallPrompt(null)} 
        />
      )}
    </div>
  );
}

// Componente de rutas protegidas
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

// Componente principal de la App
export default function App() {
  useEffect(() => {
    // Inyectar CSS variables
    const style = document.createElement('style');
    style.textContent = cssVariables;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <NotificationProvider>
              <AppShell>
                <Routes>
                  {/* Ruta de autenticación */}
                  <Route path="/auth" element={<AuthPage />} />
                  
                  {/* Rutas protegidas */}
                  <Route path="/" element={
                    <ProtectedRoute>
                      <HomePage />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/search" element={
                    <ProtectedRoute>
                      <SearchPage />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/chat" element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/chat/:chatId" element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/provider/:providerId" element={
                    <ProtectedRoute>
                      <ProviderProfile />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/request/:providerId" element={
                    <ProtectedRoute>
                      <ServiceRequest />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/community" element={
                    <ProtectedRoute>
                      <CommunityPage />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/community/:communityId" element={
                    <ProtectedRoute>
                      <CommunityPage />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/schedule" element={
                    <ProtectedRoute>
                      <SchedulePage />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/notifications" element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  } />
                  
                  {/* Redirect por defecto */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
              
              {/* Sistema de notificaciones toast */}
              <Toaster />
            </NotificationProvider>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

// Componente de loading global para Suspense
export function GlobalLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-24 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg mb-4 mx-auto flex items-center justify-center">
          <span className="text-white font-bold">ServiMap</span>
        </div>
        <LoadingSpinner size="lg" />
        <p className="text-gray-600 mt-4">Cargando...</p>
      </div>
    </div>
  );
}

// Versiones específicas para diferentes tamaños de pantalla
export function MobileApp() {
  return (
    <div className="md:hidden">
      <App />
    </div>
  );
}

export function DesktopApp() {
  return (
    <div className="hidden md:block">
      <div className="max-w-6xl mx-auto">
        <App />
      </div>
    </div>
  );
}