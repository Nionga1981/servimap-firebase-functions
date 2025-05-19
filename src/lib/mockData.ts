
// src/lib/mockData.ts
import type { Provider } from '@/types';
import { SERVICE_CATEGORIES } from './constants';

// Ubicación fija del usuario para la demostración
export const USER_FIXED_LOCATION = {
  lat: 24.8093, // Galileo 772, Villa Universidad, Culiacán
  lng: -107.4255
};

// Mock providers para demostración
export const mockProviders: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100.png?text=MF',
    dataAiHint: 'plumber portrait',
    rating: 4.9,
    isAvailable: true,
    services: [{
      id: 's_p1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos en Villa Universidad y alrededores.', price: 90, category: SERVICE_CATEGORIES.find(c=>c.name === 'Plomería')?.id || 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water pipes'
    }, {
      id: 's_p2', title: 'Instalación de Calentadores', description: 'Instalamos calentadores de agua de todas las marcas.', price: 150, category: SERVICE_CATEGORIES.find(c=>c.name === 'Plomería')?.id || 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water heater'
    }],
    location: { lat: 24.8050, lng: -107.4200 }, // Cerca de Culiacán (Villa Universidad)
    specialties: ['Fugas de agua', 'Desazolves', 'Instalación de tuberías', 'Reparación de boilers']
  },
  {
    id: 'electrician1',
    name: 'ElectroSoluciones Rápidas',
    avatarUrl: 'https://placehold.co/100x100.png?text=ES',
    dataAiHint: 'electrician smile',
    rating: 4.8,
    isAvailable: true,
    services: [{
      id: 's_e1', title: 'Instalaciones Eléctricas Completas', description: 'Expertos en cableado y cortos circuitos en la zona centro.', price: 80, category: SERVICE_CATEGORIES.find(c=>c.name === 'Electricidad')?.id || 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'electrical panel'
    }],
    location: { lat: 24.8150, lng: -107.4300 }, // Cerca de Culiacán (Villa Universidad)
    specialties: ['Cortocircuitos', 'Instalaciones nuevas', 'Mantenimiento de tableros', 'Cambio de voltaje']
  },
  {
    id: 'nanny1',
    name: 'Super Niñeras Ana',
    avatarUrl: 'https://placehold.co/100x100.png?text=SN',
    dataAiHint: 'friendly nanny',
    rating: 4.95,
    isAvailable: true,
    services: [{
      id: 's_n1', title: 'Cuidado Infantil Profesional por Horas', description: 'Cuidado amoroso y experto para tus hijos en tu domicilio (Chapultepec).', price: 75, category: SERVICE_CATEGORIES.find(c=>c.name === 'Cuidado de Niños')?.id || 'child_care', providerId: 'nanny1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'children playing'
    }],
    location: { lat: 24.8000, lng: -107.4150 }, // Cerca de Culiacán (Villa Universidad)
    specialties: ['Cuidado de bebés', 'Actividades lúdicas', 'Apoyo con tareas', 'Primeros auxilios básicos']
  },
  {
    id: 'tutor1',
    name: 'Profe Carlos - Tutorías',
    avatarUrl: 'https://placehold.co/100x100.png?text=PC',
    dataAiHint: 'teacher study',
    rating: 4.7,
    isAvailable: true,
    services: [{
      id: 's_t1', title: 'Clases de Matemáticas y Física', description: 'Preparación para exámenes, regularización. Niveles secundaria y preparatoria.', price: 50, category: SERVICE_CATEGORIES.find(c=>c.name === 'Tutoría')?.id || 'tutoring', providerId: 'tutor1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'books education'
    }],
    location: { lat: 24.8120, lng: -107.4280 }, // Cerca de Culiacán
    specialties: ['Matemáticas', 'Física', 'Preparación exámenes', 'Álgebra']
  },
  {
    id: 'cleaner1',
    name: 'Limpieza Impecable Hogar',
    avatarUrl: 'https://placehold.co/100x100.png?text=LI',
    dataAiHint: 'cleaning professional',
    rating: 4.9,
    isAvailable: true,
    services: [{
      id: 's_c1', title: 'Limpieza Profunda Residencial', description: 'Dejamos tu casa reluciente, servicio en Tres Ríos.', price: 100, category: SERVICE_CATEGORIES.find(c=>c.name === 'Limpieza')?.id || 'cleaning', providerId: 'cleaner1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'sparkling clean'
    }],
    location: { lat: 24.7950, lng: -107.4100 } // Cerca de Culiacán
  },
  { 
    id: 'plumber_far',
    name: 'Fontanería Distante',
    avatarUrl: 'https://placehold.co/100x100.png?text=FD',
    dataAiHint: 'worker tools',
    rating: 4.5,
    isAvailable: true,
    services: [{ id: 's_pf1', title: 'Servicios de Plomería General (Área Extendida)', description: 'Atendemos una amplia área, incluyendo zonas rurales.', price: 60, category: SERVICE_CATEGORIES.find(c=>c.name === 'Plomería')?.id || 'plumbing', providerId: 'plumber_far', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'wrench set' }],
    location: { lat: 25.0000, lng: -107.6000 } // Más de 20km de Culiacán
  },
  { 
    id: 'gardener_la',
    name: 'Jardines Verdes LA',
    avatarUrl: 'https://placehold.co/100x100.png?text=JVLA',
    dataAiHint: 'gardener nature',
    rating: 4.7,
    isAvailable: false, // Para probar que no disponibles no aparecen
    services: [{ id: 's_g_la', title: 'Mantenimiento de Jardines (Los Angeles)', description: 'Expertos en jardinería en Los Ángeles, California.', price: 65, category: SERVICE_CATEGORIES.find(c=>c.name === 'Jardinería')?.id || 'gardening', providerId: 'gardener_la', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'lush garden' }],
    location: { lat: 34.0600, lng: -118.2400 } // Los Angeles
  },
];
