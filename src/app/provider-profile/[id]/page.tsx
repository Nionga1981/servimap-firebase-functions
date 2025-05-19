
// src/app/provider-profile/[id]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData'; // Asegúrate que mockProviders se exporte
import type { Provider, Service } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Star, MapPin, MessageSquare, DollarSign, Tag, ArrowLeft, CheckCircle, ShieldCheck, CalendarDays } from 'lucide-react';
import { SERVICE_CATEGORIES, DEFAULT_SERVICE_IMAGE, DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils'; // Import cn utility

// Función para calcular la distancia (Haversine) - duplicada aquí por simplicidad o podría importarse
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en km
};


export default function ProviderProfilePage() {
  const params = useParams();
  const providerId = params.id as string;
  
  const [provider, setProvider] = useState<Provider | undefined>(undefined);
  const [distanceFromUser, setDistanceFromUser] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);


  useEffect(() => {
    if (providerId) {
      const foundProvider = mockProviders.find(p => p.id === providerId);
      setProvider(foundProvider);

      if (foundProvider?.location) {
        const dist = calculateDistance(USER_FIXED_LOCATION.lat, USER_FIXED_LOCATION.lng, foundProvider.location.lat, foundProvider.location.lng);
        setDistanceFromUser(dist.toFixed(1));
      }
      // Simular número de reseñas
      setReviewCount(Math.floor(Math.random() * 200) + 10);
    }
  }, [providerId]);

  if (!provider) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Cargando perfil del proveedor...</p>
        <p className="mt-4">Si esto persiste, el proveedor con ID '{providerId}' no fue encontrado.</p>
         <Button asChild variant="outline" className="mt-6">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Mapa
            </Link>
          </Button>
      </div>
    );
  }
  
  const getCategoryName = (categoryId: string) => {
    return SERVICE_CATEGORIES.find(cat => cat.id === categoryId)?.name || 'Categoría Desconocida';
  };
  const GetCategoryIcon = ({ categoryId }: { categoryId: string }) => {
    const CategoryIcon = SERVICE_CATEGORIES.find(cat => cat.id === categoryId)?.icon;
    return CategoryIcon ? <CategoryIcon className="h-4 w-4 text-muted-foreground" /> : <Tag className="h-4 w-4 text-muted-foreground" />;
  };


  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Button asChild variant="outline" className="mb-6">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Mapa
        </Link>
      </Button>

      <Card className="overflow-hidden shadow-xl">
        <CardHeader className="bg-secondary/30 p-0">
            <div className="relative h-48 w-full">
                 <Image
                    src={provider.services[0]?.imageUrl || provider.avatarUrl || DEFAULT_SERVICE_IMAGE} // Usa la imagen del primer servicio o avatar como banner
                    alt={`Banner de ${provider.name}`}
                    layout="fill"
                    objectFit="cover"
                    className="opacity-80"
                    data-ai-hint={provider.dataAiHint || "provider banner"}
                  />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                 <div className="absolute bottom-4 left-4 flex items-end space-x-4">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                      <AvatarImage src={provider.avatarUrl || DEFAULT_USER_AVATAR} alt={provider.name} data-ai-hint={provider.dataAiHint || "provider avatar"} />
                      <AvatarFallback>{provider.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold text-white shadow-sm">{provider.name}</h1>
                        <div className="flex items-center gap-2 text-sm text-yellow-300 mt-1">
                            <Star className="h-5 w-5 fill-current" />
                            <span>{provider.rating.toFixed(1)} ({reviewCount} reseñas)</span>
                        </div>
                    </div>
                 </div>
                 {provider.isAvailable && (
                    <Badge variant="default" className="absolute top-4 right-4 bg-green-500 text-white text-sm py-1 px-3 shadow-md">
                        <CheckCircle className="mr-2 h-4 w-4" /> Disponible Ahora
                    </Badge>
                )}
                {!provider.isAvailable && (
                    <Badge variant="secondary" className="absolute top-4 right-4 text-sm py-1 px-3 shadow-md">
                        No Disponible
                    </Badge>
                )}
            </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2">
              <h2 className="text-xl font-semibold text-primary mb-3">Acerca de {provider.name}</h2>
              <p className="text-muted-foreground mb-4">
                {/* Placeholder para una descripción más detallada del proveedor */}
                Un profesional dedicado con experiencia en {provider.specialties && provider.specialties.length > 0 ? provider.specialties.join(', ') : getCategoryName(provider.services[0]?.category || '')}.
                Comprometido con la calidad y la satisfacción del cliente.
              </p>
              {provider.location && distanceFromUser && (
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <MapPin className="mr-2 h-4 w-4 text-primary" />
                  <span>Aprox. {distanceFromUser} km de tu ubicación simulada en Culiacán.</span>
                </div>
              )}
              <div className="flex items-center text-sm text-muted-foreground mb-4">
                  <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                  <span>Miembro desde: {new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 365).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}</span>
              </div>

              {provider.specialties && provider.specialties.length > 0 && (
                <>
                  <h3 className="text-md font-semibold text-foreground mb-2 mt-4">Especialidades:</h3>
                  <div className="flex flex-wrap gap-2">
                    {provider.specialties.map(specialty => (
                      <Badge key={specialty} variant="secondary">{specialty}</Badge>
                    ))}
                  </div>
                </>
              )}

            </div>
            <div className="md:col-span-1 space-y-4">
                <Button className="w-full bg-primary hover:bg-primary/80" size="lg" asChild>
                    <Link href="/chat">
                        <MessageSquare className="mr-2 h-5 w-5" /> Contactar por Chat
                    </Link>
                </Button>
                <Card className="bg-secondary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-md flex items-center">
                            <ShieldCheck className="mr-2 h-5 w-5 text-green-600"/> Verificado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Este proveedor ha completado verificaciones básicas.</p>
                    </CardContent>
                </Card>
            </div>
          </div>

          <Separator className="my-6" />

          <h2 className="text-xl font-semibold text-primary mb-4">Servicios Ofrecidos</h2>
          {provider.services && provider.services.length > 0 ? (
            <div className="space-y-4">
              {provider.services.map((service: Service) => (
                <Card key={service.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">{service.title}</CardTitle>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                                <GetCategoryIcon categoryId={service.category} />
                                <span className="ml-1">{getCategoryName(service.category)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold text-primary">
                                <DollarSign className="inline h-5 w-5 mr-1" />
                                {service.price.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">Precio base</p>
                        </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                    {service.imageUrl && (
                         <div className="relative h-40 w-full rounded-md overflow-hidden mb-3">
                            <Image src={service.imageUrl || DEFAULT_SERVICE_IMAGE} alt={service.title} layout="fill" objectFit="cover" data-ai-hint="service visual specific" />
                        </div>
                    )}
                    {/* Podríamos añadir un botón específico de "Solicitar este servicio" aquí en el futuro */}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Este proveedor aún no ha listado servicios específicos.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Añadir un componente Loader básico para usar en la página
const Loader2 = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("animate-spin", className)}
    {...props}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);


    