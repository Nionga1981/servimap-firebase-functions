# ServiMap UI Components - Material Design 3

Esta librería contiene componentes UI especializados para ServiMap siguiendo las guías de Material Design 3. Todos los componentes están optimizados para móvil-first y son completamente accesibles.

## 🎨 Componentes Principales

### Navigation Components

#### BottomNavigationBar
Navegación principal móvil con tabs animados y badges de notificación.

```tsx
import { BottomNavigationBar } from '@/components/ui';

// Uso básico
<BottomNavigationBar 
  activeTab="home"
  onTabChange={(tab) => navigateToTab(tab)}
  badges={{ messages: 3, services: 1 }}
/>

// Variante para prestadores
<BottomNavigationVariants.Provider
  activeTab="dashboard"
  onTabChange={handleTabChange}
/>
```

#### TopAppBar
Header adaptativo con múltiples variantes y comportamientos de scroll.

```tsx
import { TopAppBar, TopAppBarVariants } from '@/components/ui';

// Header principal
<TopAppBarVariants.Main
  onNavigationClick={() => openDrawer()}
  onSearchToggle={(searchMode) => setSearchMode(searchMode)}
/>

// Header de chat
<TopAppBarVariants.Chat
  title="Juan Pérez"
  subtitle="En línea"
  onNavigationClick={() => goBack()}
/>
```

### Card Components

#### ProviderCard
Tarjeta de prestador con información completa y acciones.

```tsx
import { ProviderCard } from '@/components/ui';

<ProviderCard
  provider={{
    id: "123",
    name: "Juan Pérez",
    profession: "Plomero",
    rating: 4.8,
    reviewCount: 156,
    hourlyRate: 25000,
    isOnline: true,
    distance: 2.5,
    specialties: ["Reparaciones", "Instalaciones"]
  }}
  onContact={() => openChat("123")}
  onViewProfile={() => navigate("/provider/123")}
  variant="default" // default | compact | featured | list
/>
```

#### ServiceCard
Tarjeta de servicio con imágenes, precio y detalles.

```tsx
import { ServiceCard } from '@/components/ui';

<ServiceCard
  service={{
    id: "456",
    title: "Reparación de tubería",
    description: "Reparación completa con garantía",
    category: "Plomería",
    price: { min: 50000, max: 120000, type: "range" },
    images: ["/service1.jpg"],
    provider: { name: "Juan Pérez", rating: 4.8 }
  }}
  onContact={() => openChat()}
  onRequestService={() => requestService()}
  variant="default" // default | compact | featured | horizontal
/>
```

### Input Components

#### ServiSearchBar
Barra de búsqueda avanzada con IA y sugerencias.

```tsx
import { ServiSearchBar } from '@/components/ui';

<ServiSearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  onSearch={handleSearch}
  suggestions={searchSuggestions}
  recentSearches={recentSearches}
  voice={true}
  location={true}
  variant="standard" // standard | docked | full
/>
```

#### LocationInput
Input de ubicación con mapa y GPS integrado.

```tsx
import { LocationInput } from '@/components/ui';

<LocationInput
  value={location}
  onChange={setLocation}
  onLocationSelect={(locationData) => handleLocationSelect(locationData)}
  showCurrentLocation={true}
  showMapPicker={true}
  savedLocations={userSavedLocations}
/>
```

### Action Components

#### FloatingActionButton
Botón de acción flotante con múltiples variantes.

```tsx
import { FloatingActionButton, FloatingActionButtonVariants, MultiActionFAB } from '@/components/ui';

// FAB simple
<FloatingActionButton
  variant="primary"
  icon={<Plus />}
  onClick={() => createService()}
  position="bottom-right"
  scrollBehavior="hide"
/>

// FAB extendido
<FloatingActionButtonVariants.Extended
  label="Solicitar servicio"
  onClick={handleRequest}
/>

// Multi-Action FAB
<MultiActionFAB
  actions={[
    { icon: <MessageCircle />, label: "Chat", onClick: openChat },
    { icon: <Camera />, label: "Foto", onClick: takePhoto },
    { icon: <Zap />, label: "Emergencia", onClick: emergency }
  ]}
/>
```

### Communication Components

#### ChatBubble
Mensajes de chat con múltiples tipos y reacciones.

```tsx
import { ChatBubble } from '@/components/ui';

<ChatBubble
  message={{
    id: "msg1",
    type: "text",
    content: "Hola, necesito un plomero",
    timestamp: new Date(),
    sender: { id: "user1", name: "Cliente" },
    status: "delivered"
  }}
  isOwn={false}
  onReaction={(emoji) => addReaction(emoji)}
  onReply={() => replyToMessage()}
/>

// Mensaje con cotización
<ChatBubble
  message={{
    type: "quotation",
    quotation: {
      title: "Reparación tubería",
      price: 75000,
      description: "Reparación completa"
    }
    // ... otros campos
  }}
  isOwn={true}
/>
```

#### NotificationCard
Tarjetas de notificación con tipos específicos.

```tsx
import { NotificationCard, NotificationList } from '@/components/ui';

<NotificationCard
  notification={{
    id: "notif1",
    type: "service_request",
    title: "Nueva solicitud",
    message: "Juan te ha solicitado un servicio",
    timestamp: new Date(),
    isRead: false,
    priority: "high"
  }}
  onRead={() => markAsRead()}
  onAction={() => viewRequest()}
  variant="default" // default | compact | expanded
/>

// Lista de notificaciones
<NotificationList
  notifications={notifications}
  onNotificationRead={handleRead}
  onNotificationAction={handleAction}
/>
```

### State Components

#### LoadingStates
Estados de carga personalizados para diferentes contextos.

```tsx
import { 
  LoadingSpinner, 
  ProgressLoader, 
  SearchLoading, 
  SkeletonCard,
  LoadingList 
} from '@/components/ui';

// Spinner básico
<LoadingSpinner 
  size="large"
  label="Cargando servicios..."
  fullScreen={false}
/>

// Progreso de subida
<ProgressLoader
  progress={uploadProgress}
  label="Subiendo archivo..."
  showPercentage={true}
/>

// Loading específico de búsqueda
<SearchLoading
  query="plomero"
  type="services"
/>

// Skeletons
<SkeletonCard variant="provider" />
<LoadingList count={5} itemType="service" />
```

#### EmptyStates
Estados vacíos con ilustraciones y acciones sugeridas.

```tsx
import { EmptyState, EmptyStateVariants, StateHandler } from '@/components/ui';

// Estado vacío básico
<EmptyState
  variant="no-results"
  title="No se encontraron servicios"
  description="Intenta ajustar los filtros"
  actionLabel="Cambiar filtros"
  onAction={() => openFilters()}
/>

// Variantes predefinidas
<EmptyStateVariants.FirstTime
  onAction={() => startOnboarding()}
/>

<EmptyStateVariants.NoConnection
  onAction={() => retry()}
/>

// Manejador de estados múltiples
<StateHandler
  loading={isLoading}
  error={error}
  empty={data.length === 0}
  emptyStateProps={{ variant: "no-services" }}
>
  {/* Contenido cuando hay datos */}
  <ServicesList services={data} />
</StateHandler>
```

## 🎨 Theming y Personalización

### Design Tokens
Los componentes usan las variables CSS definidas en `design-tokens.css`:

```css
/* Usar en componentes personalizados */
.custom-component {
  background: var(--color-primary-60);
  color: var(--color-on-primary);
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
}
```

### Personalización de Componentes
Todos los componentes aceptan `className` para personalización:

```tsx
<ProviderCard
  provider={providerData}
  className="shadow-xl border-2 border-blue-200"
/>

<ServiButton
  variant="filled"
  className="!bg-gradient-to-r from-purple-500 to-pink-500"
>
  Botón personalizado
</ServiButton>
```

## 📱 Responsive Design

Todos los componentes siguen un enfoque mobile-first:

```tsx
// Los componentes se adaptan automáticamente
<ServiceCard variant="horizontal" /> // En desktop
<ServiceCard variant="default" />   // En móvil

// Control manual con Tailwind
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {services.map(service => (
    <ServiceCard key={service.id} service={service} />
  ))}
</div>
```

## ♿ Accesibilidad

Todos los componentes incluyen:
- **ARIA labels** y roles apropiados
- **Navegación por teclado** completa
- **Contraste de colores** WCAG AA
- **Texto alternativo** para imágenes
- **Estados focus** visibles

```tsx
// Ejemplo de uso accesible
<FloatingActionButton
  icon={<Plus />}
  onClick={createService}
  aria-label="Crear nuevo servicio"
  tooltip="Crear servicio"
/>
```

## 🔧 Integración con ServiMap

### Hooks Recomendados
```tsx
// Hook personalizado para providers
const useProviders = (location, filters) => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Lógica de carga...
  
  return { providers, loading, error };
};

// Uso en componente
const ProvidersList = () => {
  const { providers, loading, error } = useProviders(location, filters);
  
  return (
    <StateHandler loading={loading} error={error} empty={providers.length === 0}>
      <div className="space-y-4">
        {providers.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onContact={() => startChat(provider.id)}
          />
        ))}
      </div>
    </StateHandler>
  );
};
```

### Patrones de Composición
```tsx
// Layout típico de página
const ServiceSearchPage = () => (
  <div className="min-h-screen bg-gray-50">
    <TopAppBarVariants.Search
      onNavigationClick={() => goBack()}
      searchProps={{
        value: query,
        onChange: setQuery,
        onSearch: handleSearch
      }}
    />
    
    <main className="pt-16 pb-20 px-4">
      <StateHandler
        loading={loading}
        error={error}
        empty={services.length === 0}
      >
        <div className="space-y-4">
          {services.map(service => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </StateHandler>
    </main>
    
    <BottomNavigationBar
      activeTab="search"
      onTabChange={navigateToTab}
    />
    
    <FloatingActionButton
      variant="extended"
      label="Filtrar"
      icon={<Filter />}
      onClick={openFilters}
    />
  </div>
);
```

## 🚀 Performance

### Optimizaciones Incluidas
- **Lazy loading** de imágenes
- **Virtual scrolling** en listas grandes  
- **Memoización** de componentes pesados
- **Code splitting** automático
- **Preload** de assets críticos

### Mejores Prácticas
```tsx
// Usar React.memo para listas
const MemoizedProviderCard = React.memo(ProviderCard);

// Lazy loading de modales
const LazyModal = lazy(() => import('./HeavyModal'));

// Intersection Observer para scroll infinito
const useInfiniteScroll = (loadMore) => {
  // Implementación...
};
```

## 📋 Testing

Los componentes incluyen:
- **Props types** completos
- **Storybook stories** para cada variante
- **Unit tests** con React Testing Library
- **Visual regression tests** con Chromatic

```tsx
// Ejemplo de test
import { render, screen, fireEvent } from '@testing-library/react';
import { ProviderCard } from '@/components/ui';

test('should call onContact when contact button is clicked', () => {
  const mockOnContact = jest.fn();
  
  render(
    <ProviderCard 
      provider={mockProvider} 
      onContact={mockOnContact}
    />
  );
  
  fireEvent.click(screen.getByText('Contactar'));
  expect(mockOnContact).toHaveBeenCalled();
});
```

## 🔄 Actualizaciones

Para mantenerse actualizado con Material Design 3:

1. **Seguir changelog** de Material Design
2. **Actualizar design tokens** regularmente  
3. **Review components** trimestralmente
4. **Testing** en dispositivos reales
5. **Feedback** de usuarios finales

---

**Documentación actualizada:** Agosto 2025  
**Versión:** 1.0.0  
**Compatibilidad:** Material Design 3.0+