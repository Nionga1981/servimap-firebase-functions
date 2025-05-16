export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string; // Category ID
  imageUrl?: string;
  providerId: string;
}

export interface Provider {
  id: string;
  name: string;
  avatarUrl: string;
  rating: number;
  services: Service[];
  isAvailable: boolean;
  location?: { lat: number; lng: number }; // For map display
  specialties?: string[]; // e.g., ['Residential Plumbing', 'Emergency Repairs']
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'provider' | 'system';
  text: string;
  timestamp: number;
  isSafe?: boolean;
  safetyReason?: string;
}
