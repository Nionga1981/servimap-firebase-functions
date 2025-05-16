"use client";

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPinned, Search } from 'lucide-react';
import { SERVICE_CATEGORIES } from '@/lib/constants';
import type { Provider } from '@/types';
import { ProviderPreviewCard } from './ProviderPreviewCard'; // Assuming this exists
import { useState } from 'react';

// Mock providers for demo
const mockProviders: Provider[] = [
  { 
    id: '1', name: 'Alice Smith', avatarUrl: 'https://placehold.co/100x100.png?text=AS', rating: 4.8, isAvailable: true,
    services: [{ id: 's1', title: 'Expert Plumbing', description: 'Fixing leaks and pipes', price: 60, category: 'plumbing', providerId: '1' }],
    location: { lat: 34.0522, lng: -118.2437 } 
  },
  { 
    id: '2', name: 'Bob Johnson', avatarUrl: 'https://placehold.co/100x100.png?text=BJ', rating: 4.5, isAvailable: true,
    services: [{ id: 's2', title: 'Electrical Wiring', description: 'Safe and certified', price: 80, category: 'electrical', providerId: '2' }],
    location: { lat: 34.0550, lng: -118.2450 }
  },
  { 
    id: '3', name: 'Carol White', avatarUrl: 'https://placehold.co/100x100.png?text=CW', rating: 4.9, isAvailable: false,
    services: [{ id: 's3', title: 'Deep Cleaning Services', description: 'Home and office', price: 120, category: 'cleaning', providerId: '3' }],
    location: { lat: 34.0500, lng: -118.2400 }
  },
];


export function MapDisplay() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(mockProviders[0]);

  const handleSelectProvider = (providerId: string) => {
    const provider = mockProviders.find(p => p.id === providerId);
    setSelectedProvider(provider || null);
    // In a real app, this might also pan the map to the provider
  };
  
  return (
    <Card className="shadow-xl overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <MapPinned className="text-primary" /> Find Providers Near You
        </CardTitle>
        <CardDescription>
          Explore local service providers on the map. Click on a marker for more details.
        </CardDescription>
        <div className="mt-4 flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search by service, name, or category..." className="pl-8 w-full" />
          </div>
          <Button variant="outline">Filters</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:flex">
        <div className="md:w-2/3 h-[400px] md:h-[500px] relative bg-muted">
          {/* Placeholder for the actual map */}
          <Image
            src="https://placehold.co/800x500.png?text=Interactive+Map+Area"
            alt="Interactive Map"
            layout="fill"
            objectFit="cover"
            data-ai-hint="map city providers"
            className="opacity-50"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xl font-semibold text-foreground/70 p-4 bg-background/80 rounded-md">
              Map Integration Coming Soon!
            </p>
          </div>
           {/* Mock markers - in real app these would be on the map */}
           <div className="absolute top-4 left-4 space-y-2">
            {mockProviders.map(p => {
              const CategoryIcon = SERVICE_CATEGORIES.find(sc => sc.id === p.services[0].category)?.icon;
              return (
                <Button key={p.id} variant="outline" size="icon" className="rounded-full bg-background hover:bg-accent" onClick={() => handleSelectProvider(p.id)}>
                  {CategoryIcon ? <CategoryIcon className="h-5 w-5 text-primary" /> : <MapPin className="h-5 w-5 text-primary" />}
                </Button>
              )
            })}
           </div>
        </div>
        <div className="md:w-1/3 p-4 border-t md:border-t-0 md:border-l bg-background/50 md:max-h-[500px] md:overflow-y-auto">
          {selectedProvider ? (
            <ProviderPreviewCard provider={selectedProvider} onSelectProvider={() => alert(`View full profile of ${selectedProvider.name}`)} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Select a provider on the map to see details.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
