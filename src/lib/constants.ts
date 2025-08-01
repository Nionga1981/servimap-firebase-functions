import type { LucideIcon } from 'lucide-react';
import { Wrench, Zap, Sparkles, BookOpen, Flower2, Palette, Hammer, Briefcase, Cog, Baby, Stethoscope, HeartPulse } from 'lucide-react';

export interface ServiceCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  keywords: string[]; // Added for better search
  isPeriodic?: boolean;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'plumbing', name: 'Plomería', icon: Wrench, keywords: ['plomeria', 'plomero', 'fontaneria', 'fontanero', 'tuberias', 'fugas'] },
  { id: 'electrical', name: 'Electricidad', icon: Zap, keywords: ['electricidad', 'electrico', 'electricista', 'cables', 'cortos'] },
  { id: 'cleaning', name: 'Limpieza', icon: Sparkles, keywords: ['limpieza', 'aseo', 'domestico', 'limpiar'], isPeriodic: true },
  { id: 'tutoring', name: 'Tutoría', icon: BookOpen, keywords: ['tutoria', 'clases', 'profesor', 'regularizacion', 'matematicas', 'fisica'] },
  { id: 'gardening', name: 'Jardinería', icon: Flower2, keywords: ['jardineria', 'jardinero', 'plantas', 'pasto', 'poda'], isPeriodic: true },
  { id: 'design', name: 'Diseño Gráfico', icon: Palette, keywords: ['diseño grafico', 'diseñador', 'logos', 'branding'] },
  { id: 'handyman', name: 'Manitas', icon: Hammer, keywords: ['manitas', 'reparaciones', 'arreglos', 'multiusos'] },
  { id: 'consulting', name: 'Consultoría', icon: Briefcase, keywords: ['consultoria', 'asesoria', 'negocios', 'empresas'] },
  { id: 'it_support', name: 'Soporte TI', icon: Cog, keywords: ['soporte ti', 'computadoras', 'tecnologia', 'software', 'hardware'] },
  { id: 'child_care', name: 'Cuidado de Niños', icon: Baby, keywords: ['cuidado de niños', 'niñera', 'bebes', 'infantil'], isPeriodic: true },
  { id: 'doctors', name: 'Doctores', icon: Stethoscope, keywords: ['doctores', 'medicos', 'salud', 'consulta'] },
  { id: 'nurses', name: 'Enfermeras', icon: HeartPulse, keywords: ['enfermeras', 'enfermeria', 'cuidados', 'salud'] },
];

export const DEFAULT_USER_AVATAR = "https://placehold.co/100x100.png";
export const DEFAULT_SERVICE_IMAGE = "https://placehold.co/300x200.png";

export const SERVICE_HOURS: string[] = Array.from({ length: 12 }, (_, i) => `${i + 8}:00`); // 8 AM to 7 PM
