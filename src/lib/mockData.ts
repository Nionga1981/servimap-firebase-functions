// src/lib/mockData.ts
import type { Provider } from '@/types';
import { SERVICE_CATEGORIES } from './constants';

export const USER_FIXED_LOCATION = { lat: 24.8093, lng: -107.4255 }; // Culiacán, Sinaloa

export const mockProviders: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'plumber portrait',
    rating: 4.9,
    ratingCount: 120,
    ratingSum: 588, // 4.9 * 120
    isAvailable: true,
    services: [
        {id: 's_p1_1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos.', price: 90, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water pipes'},
        {id: 's_p1_2', title: 'Instalación de Calentadores', description: 'Instalamos calentadores de agua de todas las marcas.', price: 150, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water heater'},
        {id: 's_p1_3', title: 'Desazolve de Drenajes', description: 'Servicio profesional para desazolvar tuberías y drenajes.', price: 120, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'drain cleaning'}
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.005, lng: USER_FIXED_LOCATION.lng - 0.005 }, // Cerca de Culiacán
    specialties: ['Fugas de agua', 'Desazolves', 'Instalación de tuberías', 'Reparación de boilers'],
    allowsHourlyServices: false,
  },
  {
    id: 'electrician1',
    name: 'ElectroSoluciones Rápidas',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'electrician working',
    rating: 4.7,
    ratingCount: 95,
    ratingSum: 446.5, // 4.7 * 95
    isAvailable: true,
    services: [
        {id: 's_e1_1', title: 'Cortocircuitos y Fallas Eléctricas', description: 'Diagnóstico y reparación de fallas eléctricas.', price: 80, category: 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'electrical panel'},
        {id: 's_e1_2', title: 'Instalación de Lámparas y Contactos', description: 'Moderniza tu iluminación y conexiones.', price: 60, category: 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'light fixtures'}
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.003, lng: USER_FIXED_LOCATION.lng + 0.004 }, // Cerca de Culiacán
    specialties: ['Cortocircuitos', 'Instalaciones nuevas', 'Mantenimiento eléctrico'],
    allowsHourlyServices: true,
    hourlyRate: 30,
  },
  {
    id: 'nanny1',
    name: 'Super Niñeras Ana',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'friendly nanny',
    rating: 4.9,
    ratingCount: 70,
    ratingSum: 343, // 4.9 * 70
    isAvailable: true,
    services: [
        {id: 's_n1_1', title: 'Cuidado Infantil por Horas', description: 'Cuidado profesional y divertido para tus pequeños.', price: 0, category: 'child_care', providerId: 'nanny1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'children playing'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.002, lng: USER_FIXED_LOCATION.lng + 0.002 }, // Cerca de Culiacán
    specialties: ['Cuidado de bebés', 'Actividades lúdicas', 'Apoyo con tareas'],
    allowsHourlyServices: true,
    hourlyRate: 20,
  },
  {
    id: 'gardener1_inactive',
    name: 'Jardinería Esmeralda',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'lush garden',
    rating: 4.6,
    ratingCount: 50,
    ratingSum: 230, // 4.6 * 50
    isAvailable: false, // Inactivo
    services: [
        {id: 's_g1_1', title: 'Diseño y Mantenimiento de Jardines', description: 'Transformamos tu espacio exterior.', price: 100, category: 'gardening', providerId: 'gardener1_inactive', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'gardening tools'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.008, lng: USER_FIXED_LOCATION.lng - 0.007 }, // Cerca de Culiacán
    specialties: ['Poda de árboles', 'Instalación de pasto', 'Sistemas de riego'],
    allowsHourlyServices: false,
  },
  {
    id: 'doctor1',
    name: 'Dr. House - Médico General',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'doctor smiling',
    rating: 4.8,
    ratingCount: 150,
    ratingSum: 720, // 4.8 * 150
    isAvailable: true,
    services: [
        {id: 's_d1_1', title: 'Consulta Médica General', description: 'Atención primaria y diagnóstico.', price: 70, category: 'doctors', providerId: 'doctor1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'medical consultation'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.001, lng: USER_FIXED_LOCATION.lng - 0.009 }, // Cerca de Culiacán
    specialties: ['Medicina familiar', 'Diagnóstico general', 'Chequeos de rutina'],
    allowsHourlyServices: true,
    hourlyRate: 50,
  },
  {
    id: 'cleaner1_inactive',
    name: 'Limpieza Impecable Hogar',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'sparkling clean home',
    rating: 4.5,
    ratingCount: 80,
    ratingSum: 360, // 4.5 * 80
    isAvailable: false, // Inactivo
    services: [
      {id: 's_c1_1', title: 'Limpieza Profunda de Casas', description: 'Dejamos tu hogar reluciente de arriba a abajo.', price: 120, category: 'cleaning', providerId: 'cleaner1_inactive', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'cleaning supplies'},
      {id: 's_c1_2', title: 'Limpieza de Oficinas', description: 'Servicio profesional para espacios de trabajo.', price: 150, category: 'cleaning', providerId: 'cleaner1_inactive', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'office cleaning'},
    ],
    location: { lat: 34.0522, lng: -118.2437 }, // Los Angeles (Lejos)
    specialties: ['Limpieza residencial', 'Limpieza de oficinas', 'Desinfección'],
    allowsHourlyServices: true,
    hourlyRate: 25,
  },
  {
    id: 'tutor1',
    name: 'Profe Carlos - Tutorías',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'teacher explaining',
    rating: 4.9,
    ratingCount: 60,
    ratingSum: 294, // 4.9 * 60
    isAvailable: true,
    services: [
      {id: 's_t1_1', title: 'Tutorías de Matemáticas y Física', description: 'Ayuda personalizada para todos los niveles.', price: 0, category: 'tutoring', providerId: 'tutor1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'math equations'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.006, lng: USER_FIXED_LOCATION.lng + 0.003 }, // Cerca de Culiacán
    specialties: ['Álgebra', 'Cálculo', 'Física Mecánica', 'Preparación para exámenes'],
    allowsHourlyServices: true,
    hourlyRate: 35,
  },
  {
    id: 'nurse1_inactive',
    name: 'Enfermera Laura Cuidados',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'nurse caring',
    rating: 4.7,
    ratingCount: 40,
    ratingSum: 188, // 4.7 * 40
    isAvailable: false, // Inactivo
    services: [
      {id: 's_nu1_1', title: 'Cuidados de Enfermería a Domicilio', description: 'Atención profesional en la comodidad de tu hogar.', price: 0, category: 'nurses', providerId: 'nurse1_inactive', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'home healthcare'},
    ],
    location: { lat: 34.0580, lng: -118.2490 }, // Los Angeles (Lejos)
    specialties: ['Cuidado de adultos mayores', 'Administración de medicamentos', 'Curaciones'],
    allowsHourlyServices: true,
    hourlyRate: 40,
  },
    {
    id: 'plumber2_inactive',
    name: 'Fontanería Total (No Disponible)',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'tools plumbing',
    rating: 4.3,
    ratingCount: 30,
    ratingSum: 129, // 4.3 * 30
    isAvailable: false, // Inactivo
    services: [
        {id: 's_p2_1', title: 'Mantenimiento Preventivo de Tuberías', description: 'Evita problemas futuros con nuestro mantenimiento.', price: 70, category: 'plumbing', providerId: 'plumber2_inactive', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'pipe inspection'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.001, lng: USER_FIXED_LOCATION.lng + 0.012 }, // Cerca de Culiacán
    specialties: ['Mantenimiento', 'Revisiones generales'],
    allowsHourlyServices: false,
  },
];
