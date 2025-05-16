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
    // Sample initial service
    {
      id: '1',
      title: 'Initial Plumbing Service',
      description: 'This is a sample plumbing service to get you started. Describe your awesome skills here!',
      price: 75,
      category: 'plumbing',
      providerId: 'currentUser', // Placeholder
      imageUrl: 'https://placehold.co/300x200.png?text=Plumbing+Pro'
    }
  ]);

  const handleAddService = (newServiceData: Omit<Service, 'id' | 'providerId' | 'imageUrl'>) => {
    const newService: Service = {
      ...newServiceData,
      id: Date.now().toString(), // Simple ID generation for demo
      providerId: 'currentUser', // Placeholder for actual provider ID
      imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(newServiceData.title.substring(0,15))}`
    };
    setServices(prevServices => [newService, ...prevServices]);
  };

  const handleDeleteService = (serviceId: string) => {
    setServices(prevServices => prevServices.filter(service => service.id !== serviceId));
  };

  // Placeholder for edit functionality
  const handleEditService = (serviceId: string) => {
    alert(`Edit service with ID: ${serviceId} (not implemented)`);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-primary">Provider Dashboard</h1>
      
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
          <ListChecks className="text-primary" /> Your Listed Services
        </h2>
        {services.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">You haven't listed any services yet. Add one above to get started!</p>
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
