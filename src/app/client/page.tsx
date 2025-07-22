// src/app/client/page.tsx

import { MapDisplay } from '@/components/map/MapDisplay';
import { RehireRecommendations } from '@/components/client/RehireRecommendations';
import { Separator } from '@/components/ui/separator';

export default function ClientPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-primary">Encuentra Servicios Locales</h1>
        <p className="text-muted-foreground mb-4">Usa el mapa para encontrar profesionales disponibles cerca de ti.</p>
        <div className="h-[60vh] min-h-[500px] w-full rounded-lg overflow-hidden shadow-xl border">
          <MapDisplay />
        </div>
      </div>
      
      <Separator />

      <RehireRecommendations />
    </div>
  );
}
