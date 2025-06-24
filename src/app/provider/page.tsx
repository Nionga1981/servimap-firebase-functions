
"use client";

import { useState } from 'react';
import { AvailabilityToggle } from '@/components/provider/AvailabilityToggle';
import { ServiceForm } from '@/components/provider/ServiceForm';
import { ServiceCard } from '@/components/provider/ServiceCard';
import { PastClientsList } from '@/components/provider/PastClientsList';
import type { Service } from '@/types';
import { Separator } from '@/components/ui/separator';
import { ListChecks, Star, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ProviderPage() {
  // Simulación del perfil del proveedor. Cambia `isPremium` a `false` para ver el estado bloqueado.
  const [providerProfile, setProviderProfile] = useState({
    id: 'currentUser',
    isPremium: true,
  });

  const [services, setServices] = useState<Service[]>([
    {
      id: '1',
      title: 'Servicio Inicial de Plomería',
      description: 'Este es un servicio de plomería de ejemplo para que comiences. ¡Describe tus increíbles habilidades aquí!',
      price: 75,
      category: 'plumbing',
      providerId: 'currentUser', 
      imageUrl: 'https://placehold.co/300x200.png?text=Plomero+Pro'
    }
  ]);

  const handleAddService = (newServiceData: Omit<Service, 'id' | 'providerId' | 'imageUrl'>) => {
    const newService: Service = {
      ...newServiceData,
      id: Date.now().toString(),
      providerId: 'currentUser',
      imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(newServiceData.title.substring(0,15))}`
    };
    setServices(prevServices => [newService, ...prevServices]);
  };

  const handleDeleteService = (serviceId: string) => {
    setServices(prevServices => prevServices.filter(service => service.id !== serviceId));
  };

  const handleEditService = (serviceId: string) => {
    alert(`Editar servicio con ID: ${serviceId} (no implementado)`);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-primary">Panel de Proveedor</h1>
      
      <section className="mb-12">
        <AvailabilityToggle />
      </section>

      <Separator className="my-8" />
      
      <section className="mb-12">
        <ServiceForm onAddService={handleAddService} />
      </section>
      
      <Separator className="my-8" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <ListChecks className="text-primary" /> Tus Servicios Publicados
        </h2>
        {services.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Aún no has publicado ningún servicio. ¡Añade uno arriba para empezar!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <ServiceCard 
                key={service.id} 
                service={service} 
                onEdit={handleEditService}
                onDelete={handleDeleteService}
              />
            ))}
          </div>
        )}
      </section>

      <Separator className="my-8" />

      <section>
        {providerProfile.isPremium ? (
          <PastClientsList />
        ) : (
          <Card className="shadow-lg bg-gradient-to-r from-secondary to-background border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                Función Premium: Clientes Anteriores
              </CardTitle>
              <CardDescription>
                Accede al historial de tus clientes y envíales recordatorios para fomentar la recontratación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Esta herramienta te permite mantener una relación cercana con quienes ya confiaron en tu trabajo. ¡Actualiza a Premium para desbloquear esta y otras funciones exclusivas!
              </p>
              <Button asChild>
                <Link href="/membresias"> {/* Enlace a una página de membresías (no creada aún) */}
                  <Zap className="mr-2 h-4 w-4" /> ¡Actualizar a Premium ahora!
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
