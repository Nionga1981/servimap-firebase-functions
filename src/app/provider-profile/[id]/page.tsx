// src/app/provider-profile/[id]/page.tsx
"use client";

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { mockProviders } from '@/lib/mockData'; // USER_FIXED_LOCATION eliminado
import type { Provider, Service } from '@/types';
import { ServiceRequest } from '@/types'; // Ensure ServiceRequest is imported
// ... (todas las demás importaciones quedan igual)

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function ProviderProfilePage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;
  
  const [provider, setProvider] = useState<Provider | undefined>(undefined);
  const [distanceFromUser, setDistanceFromUser] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const { toast } = useToast();

  // ... (todos los states y efectos quedan igual)

  useEffect(() => {
    if (providerId) {
      const foundProvider = mockProviders.find(p => p.id === providerId);
      setProvider(foundProvider);
      console.log('[ProviderProfilePage] Provider data in useEffect:', foundProvider);

      if (foundProvider?.location) {
        // Eliminado: if (foundProvider?.location && USER_FIXED_LOCATION)
        const dist = calculateDistance(24.8093, -107.4255, foundProvider.location.lat, foundProvider.location.lng);
        setDistanceFromUser(dist.toFixed(1));
      }

      setReviewCount(Math.floor(Math.random() * 200) + 10);
    }
  }, [providerId]);

  // handleRequestAppointment y handleRequestHourlyService con location fijo:
  const handleRequestAppointment = async () => {
    if (!provider || !selectedDate || !selectedTime) {
      toast({ title: "Faltan Datos", description: "Por favor, selecciona fecha y hora.", variant: "destructive" });
      return;
    }
    setIsSubmittingAppointment(true);
    
    const requestData: ServiceRequest = {
      serviceType: 'fixed',
      userId: 'currentUserDemoId',
      providerId: provider.id,
      serviceDate: selectedDate.toISOString().split('T')[0],
      serviceTime: selectedTime,
      location: { lat: 24.8093, lng: -107.4255 }, // Reemplazo de USER_FIXED_LOCATION
      notes: serviceNotes,
      status: 'agendado',
      createdAt: Date.now(),
    };

    // ... (resto del código queda igual)
  };

  const handleRequestHourlyService = async () => {
    if (!provider || !hourlyServiceDate || !hourlyServiceStartTime || hourlyServiceDuration <= 0) {
      toast({ title: "Faltan Datos", description: "Por favor, selecciona fecha, hora de inicio y duración válida.", variant: "destructive" });
      return;
    }
    setIsSubmittingHourly(true);

    const requestData: ServiceRequest = {
      serviceType: 'hourly',
      userId: 'currentUserDemoId',
      providerId: provider.id,
      serviceDate: hourlyServiceDate.toISOString().split('T')[0],
      startTime: hourlyServiceStartTime,
      durationHours: hourlyServiceDuration,
      hourlyRate: provider.hourlyRate || 0,
      estimatedTotal: estimatedHourlyTotal,
      location: { lat: 24.8093, lng: -107.4255 }, // Reemplazo de USER_FIXED_LOCATION
      notes: hourlyServiceNotes,
      status: 'agendado',
      createdAt: Date.now(),
    };

    // ... (resto del código queda igual)
  };

  // ... (el resto del componente permanece sin cambios, solo eliminé las referencias a USER_FIXED_LOCATION)

}
