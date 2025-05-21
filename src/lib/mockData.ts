
// src/lib/mockData.ts
import type { Provider } from '@/types';
import { SERVICE_CATEGORIES } from './constants';

// Ubicación fija del usuario para la demostración
export const USER_FIXED_LOCATION = {
  lat: 24.8093, // Galileo 772, Villa Universidad, Culiacán
  lng: -107.4255
};

export const mockProviders: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100.png?text=MF',
    dataAiHint: 'plumber portrait',
    rating: 4.9,
    isAvailable: true,
    services: [
        {id: 's_p1_1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos.', price: 90, category: SERVICE_CATEGORIES.find(c=>c.name === 'Plomería')?.id || 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water pipes'},
        {id: 's_p1_2', title: 'Instalación de Calentadores', description: 'Instalamos calentadores de agua de todas las marcas.', price: 150, category: SERVICE_CATEGORIES.find(c=>c.name === 'Plomería')?.id || 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water heater'},
        {id: 's_p1_3', title: 'Desazolve de Drenajes', description: 'Servicio profesional para desazolvar tuberías y drenajes.', price: 120, category: SERVICE_CATEGORIES.find(c=>c.name === 'Plomería')?.id || 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'drain cleaning'}
    ],
    location: { lat: 24.8080, lng: -107.4240 }, // Cerca de USER_FIXED_LOCATION
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
      id: 's_e1', title: 'Instalaciones Eléctricas Completas', description: 'Expertos en cableado y cortos circuitos.', price: 80, category: SERVICE_CATEGORIES.find(c=>c.name === 'Electricidad')?.id || 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'electrical panel'
    }],
    location: { lat: 24.8100, lng: -107.4280 }, // Cerca de USER_FIXED_LOCATION
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
      id: 's_n1', title: 'Cuidado Infantil Profesional por Horas', description: 'Cuidado amoroso y experto para tus hijos.', price: 75, category: SERVICE_CATEGORIES.find(c=>c.name === 'Cuidado de Niños')?.id || 'child_care', providerId: 'nanny1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'children playing'
    }],
    location: { lat: 24.8085, lng: -107.4200 }, // Cerca de USER_FIXED_LOCATION
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
      id: 's_t1', title: 'Clases de Matemáticas y Física', description: 'Preparación para exámenes, regularización.', price: 50, category: SERVICE_CATEGORIES.find(c=>c.name === 'Tutoría')?.id || 'tutoring', providerId: 'tutor1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'books education'
    }],
    location: { lat: 24.8120, lng: -107.4285 }, // Cerca de USER_FIXED_LOCATION
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
      id: 's_c1', title: 'Limpieza Profunda Residencial', description: 'Dejamos tu casa reluciente.', price: 100, category: SERVICE_CATEGORIES.find(c=>c.name === 'Limpieza')?.id || 'cleaning', providerId: 'cleaner1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'sparkling clean'
    }],
    location: { lat: 24.7950, lng: -107.4100 }, // Un poco más lejos pero aún < 20km
    specialties: ['Limpieza general', 'Limpieza de oficinas', 'Limpieza post-construcción']
  },
  {
    id: 'doctor1',
    name: 'Dr. House - Médico General',
    avatarUrl: 'https://placehold.co/100x100.png?text=DH',
    dataAiHint: 'doctor serious',
    rating: 4.85,
    isAvailable: true,
    services: [{
      id: 's_d1', title: 'Consulta Médica General a Domicilio', description: 'Atención médica primaria en la comodidad de tu hogar.', price: 120, category: SERVICE_CATEGORIES.find(c=>c.name === 'Doctores')?.id || 'doctors', providerId: 'doctor1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'medical equipment'
    }],
    location: { lat: 24.8090, lng: -107.4250 }, // Muy cerca de USER_FIXED_LOCATION
    specialties: ['Diagnóstico general', 'Medicina familiar', 'Atención a domicilio']
  },
  {
    id: 'nurse1',
    name: 'Enfermera Laura Cuidados',
    avatarUrl: 'https://placehold.co/100x100.png?text=EL',
    dataAiHint: 'nurse caring',
    rating: 4.92,
    isAvailable: true,
    services: [{
      id: 's_nu1', title: 'Servicios de Enfermería Profesional', description: 'Inyecciones, curaciones, cuidado de pacientes.', price: 85, category: SERVICE_CATEGORIES.find(c=>c.name === 'Enfermeras')?.id || 'nurses', providerId: 'nurse1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'health care professional'
    }],
    location: { lat: 24.8115, lng: -107.4265 }, // Cerca de USER_FIXED_LOCATION
    specialties: ['Inyecciones', 'Curaciones', 'Cuidado de adultos mayores', 'Toma de signos vitales']
  },
  {
    id: 'gardener1',
    name: 'Jardinería Esmeralda',
    avatarUrl: 'https://placehold.co/100x100.png?text=JE',
    dataAiHint: 'gardener flowers',
    rating: 4.75,
    isAvailable: true,
    services: [{
      id: 's_g1', title: 'Diseño y Mantenimiento de Jardines', description: 'Transformamos tu espacio exterior en un oasis verde.', price: 110, category: SERVICE_CATEGORIES.find(c=>c.name === 'Jardinería')?.id || 'gardening', providerId: 'gardener1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'beautiful garden'
    }],
    location: { lat: 24.8075, lng: -107.4220 }, // Cerca de USER_FIXED_LOCATION
    specialties: ['Diseño de paisajes', 'Poda de árboles', 'Instalación de pasto', 'Control de plagas']
  },
  { 
    id: 'plumber_far',
    name: 'Fontanería Distante',
    avatarUrl: 'https://placehold.co/100x100.png?text=FD',
    dataAiHint: 'worker tools',
    rating: 4.5,
    isAvailable: true,
    services: [{ id: 's_pf1', title: 'Servicios de Plomería General (Área Extendida)', description: 'Atendemos una amplia área.', price: 60, category: SERVICE_CATEGORIES.find(c=>c.name === 'Plomería')?.id || 'plumbing', providerId: 'plumber_far', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'wrench set' }],
    location: { lat: 25.0000, lng: -107.6000 } // Más de 20km de Culiacán
  },
  { 
    id: 'gardener_la',
    name: 'Jardines Verdes LA',
    avatarUrl: 'https://placehold.co/100x100.png?text=JVLA',
    dataAiHint: 'gardener nature',
    rating: 4.7,
    isAvailable: false,
    services: [{ id: 's_g_la', title: 'Mantenimiento de Jardines (Los Angeles)', description: 'Expertos en jardinería en LA.', price: 65, category: SERVICE_CATEGORIES.find(c=>c.name === 'Jardinería')?.id || 'gardening', providerId: 'gardener_la', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'lush garden' }],
    location: { lat: 34.0600, lng: -118.2400 } // Los Angeles
  },
];

    