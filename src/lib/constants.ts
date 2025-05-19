import type { LucideIcon } from 'lucide-react';
import { Wrench, Zap, Sparkles, BookOpen, Flower2, Palette, Hammer, Briefcase, Cog, Baby, Stethoscope, HeartPulse } from 'lucide-react';

export interface ServiceCategory {
  id: string;
  name: string;
  icon: LucideIcon;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'plumbing', name: 'Plomería', icon: Wrench },
  { id: 'electrical', name: 'Electricidad', icon: Zap },
  { id: 'cleaning', name: 'Limpieza', icon: Sparkles },
  { id: 'tutoring', name: 'Tutoría', icon: BookOpen },
  { id: 'gardening', name: 'Jardinería', icon: Flower2 },
  { id: 'design', name: 'Diseño Gráfico', icon: Palette },
  { id: 'handyman', name: 'Manitas', icon: Hammer },
  { id: 'consulting', name: 'Consultoría', icon: Briefcase },
  { id: 'it_support', name: 'Soporte TI', icon: Cog },
  { id: 'child_care', name: 'Cuidado de Niños', icon: Baby },
  { id: 'doctors', name: 'Doctores', icon: Stethoscope },
  { id: 'nurses', name: 'Enfermeras', icon: HeartPulse },
];

export const DEFAULT_USER_AVATAR = "https://placehold.co/100x100.png";
export const DEFAULT_SERVICE_IMAGE = "https://placehold.co/300x200.png";
