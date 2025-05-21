import type { LucideIcon } from 'lucide-react';
import { Wrench, Zap, Sparkles, BookOpen, Flower2, Palette, Hammer, Briefcase, Cog, Baby, Stethoscope, HeartPulse } from 'lucide-react';

export interface ServiceCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  keywords: string[]; // Added keywords for better search
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'plumbing', name: 'Plomería', icon: Wrench, keywords: ['plomeria', 'plomero', 'fontanero', 'tuberias', 'fugas'] },
  { id: 'electrical', name: 'Electricidad', icon: Zap, keywords: ['electricidad', 'electrico', 'electricista', 'cables', 'luces'] },
  { id: 'cleaning', name: 'Limpieza', icon: Sparkles, keywords: ['limpieza', 'aseo', 'domestica', 'limpiador'] },
  { id: 'tutoring', name: 'Tutoría', icon: BookOpen, keywords: ['tutoria', 'clases', 'profesor', 'enseñanza', 'regularizacion'] },
  { id: 'gardening', name: 'Jardinería', icon: Flower2, keywords: ['jardineria', 'jardinero', 'plantas', 'pasto', 'poda'] },
  { id: 'design', name: 'Diseño Gráfico', icon: Palette, keywords: ['diseño grafico', 'diseñador', 'logos', 'imagen'] },
  { id: 'handyman', name: 'Manitas', icon: Hammer, keywords: ['manitas', 'reparaciones', 'arreglos', 'mantenimiento general'] },
  { id: 'consulting', name: 'Consultoría', icon: Briefcase, keywords: ['consultoria', 'consultor', 'asesor', 'negocios'] },
  { id: 'it_support', name: 'Soporte TI', icon: Cog, keywords: ['soporte ti', 'computadoras', 'tecnologia', 'sistemas'] },
  { id: 'child_care', name: 'Cuidado de Niños', icon: Baby, keywords: ['cuidado de niños', 'niñera', 'canguro', 'bebes'] },
  { id: 'doctors', name: 'Doctores', icon: Stethoscope, keywords: ['doctores', 'medicos', 'salud', 'consulta'] },
  { id: 'nurses', name: 'Enfermeras', icon: HeartPulse, keywords: ['enfermeras', 'enfermeria', 'cuidados medicos'] },
];

export const DEFAULT_USER_AVATAR = "https://placehold.co/100x100.png";
export const DEFAULT_SERVICE_IMAGE = "https://placehold.co/300x200.png";
