"use client";

import { useState } from 'react';
import { AvailabilityToggle } from '@/components/provider/AvailabilityToggle';
import { ServiceForm } from '@/components/provider/ServiceForm';
import { ServiceCard } from '@/components/provider/ServiceCard';
import type { Service } from '@/types';
import { Separator } from '@/components/ui/separator';
import { ListChecks } from 'lucide-react';

export default function ProviderPage() {
  const [services, setServices] = useState<Service[]>([
    // Servicio inicial de ejemplo
    {
      id: '1',
      title: 'Servicio Inicial de Plomería',
      description: 'Este es un servicio de plomería de ejemplo para que comiences. ¡Describe tus increíbles habilidades aquí!',
      price: 75,
      category: 'plumbing', // ID de categoría de src/lib/constants.ts
      providerId: 'currentUser', // Placeholder
      imageUrl: 'https://placehold.co/300x200.png?text=Plomero+Pro'
    }
  ]);

  const handleAddService = (newServiceData: Omit<Service, 'id' | 'providerId' | 'imageUrl'>) => {
    const newService: Service = {
      ...newServiceData,
      id: Date.now().toString(), // Generación simple de ID para la demo
      providerId: 'currentUser', // Placeholder para ID de proveedor real
      imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(newServiceData.title.substring(0,15))}`
    };
    setServices(prevServices => [newService, ...prevServices]);
  };

  const handleDeleteService = (serviceId: string) => {
    setServices(prevServices => prevServices.filter(service => service.id !== serviceId));
  };

  // Placeholder para funcionalidad de editar
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

      <section>
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
    </div>
  );
}
