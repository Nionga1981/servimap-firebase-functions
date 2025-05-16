import type { LucideIcon } from 'lucide-react';
import { Wrench, Zap, Sparkles, BookOpen, Flower2, Palette, Hammer, Briefcase, Cog } from 'lucide-react';

export interface ServiceCategory {
  id: string;
  name: string;
  icon: LucideIcon;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'plumbing', name: 'Plumbing', icon: Wrench },
  { id: 'electrical', name: 'Electrical', icon: Zap },
  { id: 'cleaning', name: 'Cleaning', icon: Sparkles },
  { id: 'tutoring', name: 'Tutoring', icon: BookOpen },
  { id: 'gardening', name: 'Gardening', icon: Flower2 },
  { id: 'design', name: 'Graphic Design', icon: Palette },
  { id: 'handyman', name: 'Handyman', icon: Hammer },
  { id: 'consulting', name: 'Consulting', icon: Briefcase },
  { id: 'it_support', name: 'IT Support', icon: Cog },
];

export const DEFAULT_USER_AVATAR = "https://placehold.co/100x100.png";
export const DEFAULT_SERVICE_IMAGE = "https://placehold.co/300x200.png";
