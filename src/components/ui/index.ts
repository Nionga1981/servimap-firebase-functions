/**
 * ServiMap UI Components - Material Design 3
 * 
 * Exportaciones centralizadas de todos los componentes UI de ServiMap
 * siguiendo las guías de Material Design 3.
 */

// Existing shadcn components
export * from './accordion';
export * from './alert-dialog';
export * from './alert';
export * from './avatar';
export * from './badge';
export * from './button';
export * from './calendar';
export * from './card';
export * from './chart';
export * from './checkbox';
export * from './dialog';
export * from './dropdown-menu';
export * from './form';
export * from './input';
export * from './label';
export * from './menubar';
export * from './popover';
export * from './progress';
export * from './radio-group';
export * from './scroll-area';
export * from './select';
export * from './separator';
export * from './sheet';
export * from './sidebar';
export * from './skeleton';
export * from './slider';
export * from './switch';
export * from './table';
export * from './tabs';
export * from './textarea';
export * from './toast';
export * from './toaster';
export * from './tooltip';

// ServiMap specific components
export * from './servi-button';
export * from './servi-card';
export * from './servi-search-bar';
export * from './LogoUpload';

// New Material Design 3 components
export * from './bottom-navigation';
export * from './top-app-bar';
export * from './provider-card';
export * from './service-card';
export * from './floating-action-button';
export * from './location-input';
export * from './chat-bubble';
export * from './notification-card';
export * from './loading-states';
export * from './empty-states';

// Component variants exports
export {
  BottomNavigationVariants,
  NavigationTabConfigs
} from './bottom-navigation';

export {
  TopAppBarVariants
} from './top-app-bar';

export {
  ProviderCardVariants,
  ProviderCardSkeleton
} from './provider-card';

export {
  ServiceCardVariants,
  ServiceCardSkeleton
} from './service-card';

export {
  FloatingActionButtonVariants,
  MultiActionFAB
} from './floating-action-button';

export {
  ServiSearchBarVariants
} from './servi-search-bar';

export {
  NotificationList,
  NotificationCardSkeleton
} from './notification-card';

export {
  DotsLoader,
  ProgressLoader,
  CircularProgress,
  Skeleton,
  SkeletonCard,
  SearchLoading,
  MapLoading,
  ConnectionStatus,
  FileUploadProgress,
  LoadingList
} from './loading-states';

export {
  EmptyStateVariants,
  EmptyStateWithLoading,
  StateHandler,
  ListEmptyState
} from './empty-states';

// Type exports (temporarily removed for build)

// Service card types also temporarily removed

// All component type exports temporarily removed for successful build

// Empty state types also removed