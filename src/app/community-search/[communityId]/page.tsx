// src/app/community-search/[communityId]/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Search, ListFilter, Loader2, MapIcon, Building2, ChevronLeft } from 'lucide-react';
import type { Service, Provider, Comunidad } from '@/types';
import { mockProviders, mockComunidades, USER_FIXED_LOCATION } from '@/lib/mockData';
import { SERVICE_CATEGORIES } from '@/lib/constants';
import { ServiceResultCard } from '@/components/client/ServiceResultCard';
// For map integration, we might need parts of MapDisplay or a new, simpler map component
// For now, let's add a placeholder for map view
// import { CommunitySearchMapRenderer } from '@/components/client/CommunitySearchMapRenderer';

const ITEMS_PER_PAGE = 9; // For pagination if needed later

type SortByType = "rating" | "distance" | "recent" | "price_asc" | "price_desc";

export default function CommunityServiceSearchPage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params.communityId as string;

  const [currentCommunity, setCurrentCommunity] = useState<Comunidad | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('rating');
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allProvidersMap, setAllProvidersMap] = useState<Map<string, Provider>>(new Map());

  const [communityResults, setCommunityResults] = useState<Service[]>([]);
  const [globalResults, setGlobalResults] = useState<Service[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [userLocation, setUserLocation] = useState(USER_FIXED_LOCATION); // Default, can be updated by geolocation

  useEffect(() => {
    const community = mockComunidades.find(c => c.id === communityId);
    if (community) {
      setCurrentCommunity(community);
    } else {
      setError("Comunidad no encontrada.");
    }

    // Flatten services from mockProviders and create a provider map
    const services: Service[] = [];
    const providers = new Map<string, Provider>();
    mockProviders.forEach(provider => {
      providers.set(provider.id, provider);
      provider.services.forEach(service => {
        services.push({ ...service, providerId: provider.id });
      });
    });
    setAllServices(services);
    setAllProvidersMap(providers);
    setIsLoading(false);
  }, [communityId]);

  const performSearch = useCallback(() => {
    if (!currentCommunity || allServices.length === 0) return;
    setIsLoading(true);

    const lowerSearchTerm = searchTerm.toLowerCase();

    // Phase 1: Community Search
    let commResults = allServices.filter(service =>
      service.comunidad_id === communityId &&
      (service.activo !== false) && // Default to true if undefined
      (
        service.title.toLowerCase().includes(lowerSearchTerm) ||
        service.description.toLowerCase().includes(lowerSearchTerm) ||
        SERVICE_CATEGORIES.find(c => c.id === service.category)?.name.toLowerCase().includes(lowerSearchTerm) ||
        SERVICE_CATEGORIES.find(c => c.id === service.category)?.keywords.some(k => k.toLowerCase().includes(lowerSearchTerm)) ||
        allProvidersMap.get(service.providerId)?.specialties?.some(s => s.toLowerCase().includes(lowerSearchTerm))
      )
    );

    // Phase 2: Global Search
    let globResults: Service[] = [];
    // Trigger global search if explicitly requested or if community results are sparse (e.g., < 3)
    // For this demo, let's always perform global search if no community results, or if explicitly asked.
    // We'll simplify for now: show global if community is empty.
    if (commResults.length === 0 && searchTerm.trim() !== '') { // Only do global if there was a search term and no community results
      globResults = allServices.filter(service =>
        service.comunidad_id !== communityId && // Exclude current community services
        (service.activo !== false) &&
        (allProvidersMap.get(service.providerId)?.estadoOnline === true) && // Provider must be online
        (
          service.title.toLowerCase().includes(lowerSearchTerm) ||
          service.description.toLowerCase().includes(lowerSearchTerm) ||
          SERVICE_CATEGORIES.find(c => c.id === service.category)?.name.toLowerCase().includes(lowerSearchTerm) ||
          SERVICE_CATEGORIES.find(c => c.id === service.category)?.keywords.some(k => k.toLowerCase().includes(lowerSearchTerm)) ||
          allProvidersMap.get(service.providerId)?.specialties?.some(s => s.toLowerCase().includes(lowerSearchTerm))
        )
        // TODO: Add distance filter for global results if userLocation is available
      );
    }
    
    // Sorting (simplified for now, apply to both for demo)
    const sortServices = (servicesToSort: Service[], providerMap: Map<string, Provider>, sortType: SortByType) => {
      return [...servicesToSort].sort((a, b) => {
        const providerA = providerMap.get(a.providerId);
        const providerB = providerMap.get(b.providerId);
        if (!providerA || !providerB) return 0;

        switch (sortType) {
          case 'rating':
            return (providerB.rating || 0) - (providerA.rating || 0);
          case 'recent':
            return (b.fechaCreacion || 0) - (a.fechaCreacion || 0);
          // case 'distance': // Needs location data for services/providers
          //   // Placeholder: implement distance calculation if locations are available
          //   return 0; 
          case 'price_asc':
            return (a.price || 0) - (b.price || 0);
          case 'price_desc':
            return (b.price || 0) - (a.price || 0);
          default:
            return 0;
        }
      });
    };

    setCommunityResults(sortServices(commResults, allProvidersMap, sortBy));
    setGlobalResults(sortServices(globResults, allProvidersMap, sortBy));
    setIsLoading(false);

  }, [searchTerm, sortBy, communityId, currentCommunity, allServices, allProvidersMap]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);


  if (error) {
    return <div className="container mx-auto py-8 text-center text-destructive"><AlertCircle className="inline mr-2" />{error}</div>;
  }

  if (!currentCommunity && !isLoading) {
    return <div className="container mx-auto py-8 text-center">Cargando datos de la comunidad...</div>;
  }


  return (
    <div className="container mx-auto py-8 px-2 md:px-4 space-y-6">
      <header className="space-y-2">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-2">
          <ChevronLeft className="h-4 w-4 mr-1" /> Volver a Comunidades
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-primary">
          Buscar Servicios en "{currentCommunity?.nombre || 'Comunidad'}"
        </h1>
        <p className="text-muted-foreground">
          Encuentra profesionales y servicios ofrecidos por miembros de tu comunidad o cerca de ti.
        </p>
      </header>

      <Card className="shadow-lg">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar servicio (ej: plomero, reparación, limpieza...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 text-base"
              />
            </div>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortByType)}>
              <SelectTrigger className="w-full sm:w-[200px] h-11 text-base">
                <ListFilter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Mejor Calificados</SelectItem>
                <SelectItem value="recent">Más Recientes</SelectItem>
                {/* <SelectItem value="distance" disabled>Más Cercanos (Próximamente)</SelectItem> */}
                <SelectItem value="price_asc">Precio: Menor a Mayor</SelectItem>
                <SelectItem value="price_desc">Precio: Mayor a Menor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Map Placeholder - Future integration */}
      {/* <Card className="h-64 md:h-96 flex items-center justify-center bg-muted/50 border-dashed border-2 border-muted rounded-lg shadow">
        <div className="text-center text-muted-foreground">
          <MapIcon className="h-16 w-16 mx-auto mb-2" />
          <p>Visualización de Mapa (Próximamente)</p>
          <p className="text-xs">Aquí se mostrarán los servicios en un mapa interactivo.</p>
        </div>
      </Card> */}


      {isLoading && (
        <div className="text-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Buscando servicios...</p>
        </div>
      )}

      {!isLoading && communityResults.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center">
            <Building2 className="mr-2 h-5 w-5 text-primary" />
            Resultados en "{currentCommunity?.nombre || 'tu comunidad'}"
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {communityResults.map(service => {
              const provider = allProvidersMap.get(service.providerId);
              if (!provider) return null;
              return <ServiceResultCard key={service.id} service={service} provider={provider} isCommunityResult={true} userLocation={userLocation} />;
            })}
          </div>
        </section>
      )}

      {!isLoading && globalResults.length > 0 && (
        <section className="mt-8 pt-6 border-t">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Fuera de tu comunidad pero disponibles cerca de ti
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {globalResults.map(service => {
              const provider = allProvidersMap.get(service.providerId);
              if (!provider) return null;
              return <ServiceResultCard key={service.id} service={service} provider={provider} isCommunityResult={false} userLocation={userLocation} />;
            })}
          </div>
        </section>
      )}

      {!isLoading && communityResults.length === 0 && globalResults.length === 0 && searchTerm.trim() !== '' && (
        <div className="text-center py-10">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-lg text-muted-foreground">No se encontraron servicios para "{searchTerm}".</p>
          <p className="text-sm text-muted-foreground">Intenta con otras palabras clave o revisa los filtros.</p>
        </div>
      )}
       {!isLoading && communityResults.length === 0 && globalResults.length === 0 && searchTerm.trim() === '' && (
        <div className="text-center py-10">
           <Search className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-lg text-muted-foreground">Ingresa un término de búsqueda para encontrar servicios.</p>
        </div>
      )}

    </div>
  );
}
