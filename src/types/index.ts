
export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string; // Category ID
  imageUrl?: string;
  dataAiHint?: string; // Para imágenes de servicio también
  providerId: string;
}

export interface Provider {
  id: string;
  name: string;
  avatarUrl: string;
  dataAiHint?: string; // Para avatares de proveedor
  rating: number;
  services: Service[];
  isAvailable: boolean;
  location?: { lat: number; lng: number }; // Base/Registered location for map display
  specialties?: string[]; // e.g., ['Residential Plumbing', 'Emergency Repairs']
  currentLocation?: { // For real-time tracking
    lat: number;
    lng: number;
    timestamp: number; 
  } | null;
  lastConnection?: number; // Timestamp of the last connection or status update
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'provider' | 'system';
  text: string;
  timestamp: number;
  isSafe?: boolean;
  safetyReason?: string;
}
