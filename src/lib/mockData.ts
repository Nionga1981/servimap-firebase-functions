// src/lib/mockData.ts
import type { Provider, ProviderGallery, GalleryItem } from '@/types';

export const USER_FIXED_LOCATION = { lat: 24.8093, lng: -107.4255 }; // Culiacán, Sinaloa

export const mockProviders: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'plumber portrait',
    rating: 4.9,
    ratingCount: 120,
    ratingSum: 588,
    isAvailable: true,
    services: [
        {id: 's_p1_1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos, disponible a cualquier hora.', price: 90, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water pipes'},
        {id: 's_p1_2', title: 'Instalación de Calentadores de Agua', description: 'Instalamos y reparamos calentadores de agua de todas las marcas y modelos.', price: 150, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'water heater'},
        {id: 's_p1_3', title: 'Desazolve Profesional de Drenajes', description: 'Servicio profesional para desazolvar tuberías y drenajes obstruidos.', price: 120, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'drain cleaning'}
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.005, lng: USER_FIXED_LOCATION.lng - 0.005 },
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
    ratingSum: 446.5,
    isAvailable: true,
    services: [
        {id: 's_e1_1', title: 'Cortocircuitos y Fallas Eléctricas', description: 'Diagnóstico y reparación de fallas eléctricas de todo tipo.', price: 80, category: 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'electrical panel'},
        {id: 's_e1_2', title: 'Instalación de Lámparas y Contactos', description: 'Moderniza tu iluminación y conexiones eléctricas de forma segura.', price: 60, category: 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'light fixtures'}
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.003, lng: USER_FIXED_LOCATION.lng + 0.004 },
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
    ratingSum: 343,
    isAvailable: true,
    services: [
        // Los servicios por hora no se listan como "servicios fijos" sino que se habilitan a nivel proveedor
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.002, lng: USER_FIXED_LOCATION.lng + 0.002 },
    specialties: ['Cuidado de bebés', 'Actividades lúdicas', 'Apoyo con tareas escolares'],
    allowsHourlyServices: true,
    hourlyRate: 20,
  },
  {
    id: 'gardener1', // Cambiado de _inactive para prueba
    name: 'Jardinería Esmeralda',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'lush garden',
    rating: 4.6,
    ratingCount: 50,
    ratingSum: 230,
    isAvailable: true, // Disponible para prueba de galería
    services: [
        {id: 's_g1_1', title: 'Diseño y Mantenimiento de Jardines Completos', description: 'Transformamos tu espacio exterior en un oasis verde.', price: 100, category: 'gardening', providerId: 'gardener1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'gardening tools'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.008, lng: USER_FIXED_LOCATION.lng - 0.007 },
    specialties: ['Poda de árboles', 'Instalación de pasto', 'Sistemas de riego', 'Paisajismo'],
    allowsHourlyServices: false,
  },
  {
    id: 'doctor1',
    name: 'Dr. House - Médico General',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'doctor smiling',
    rating: 4.8,
    ratingCount: 150,
    ratingSum: 720,
    isAvailable: false, // Inactivo para prueba
    services: [
        {id: 's_d1_1', title: 'Consulta Médica General Integral', description: 'Atención primaria, diagnóstico y seguimiento de padecimientos comunes.', price: 70, category: 'doctors', providerId: 'doctor1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'medical consultation'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.001, lng: USER_FIXED_LOCATION.lng - 0.009 },
    specialties: ['Medicina familiar', 'Diagnóstico general', 'Chequeos de rutina'],
    allowsHourlyServices: true,
    hourlyRate: 50,
  },
  {
    id: 'cleaner1', // Cambiado de _inactive para prueba
    name: 'Limpieza Impecable Hogar',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'sparkling clean home',
    rating: 4.5,
    ratingCount: 80,
    ratingSum: 360,
    isAvailable: true,
    services: [
      {id: 's_c1_1', title: 'Limpieza Profunda de Casas y Apartamentos', description: 'Dejamos tu hogar reluciente de arriba a abajo, cuidando cada detalle.', price: 120, category: 'cleaning', providerId: 'cleaner1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'cleaning supplies'},
      {id: 's_c1_2', title: 'Limpieza Profesional de Oficinas', description: 'Servicio profesional para mantener impecables tus espacios de trabajo.', price: 150, category: 'cleaning', providerId: 'cleaner1', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'office cleaning'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.004, lng: USER_FIXED_LOCATION.lng + 0.006 }, // Cerca
    specialties: ['Limpieza residencial', 'Limpieza de oficinas', 'Desinfección de áreas'],
    allowsHourlyServices: true,
    hourlyRate: 25,
  },
  {
    id: 'tutor1',
    name: 'Profe Carlos - Tutorías Personalizadas',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'teacher explaining',
    rating: 4.9,
    ratingCount: 60,
    ratingSum: 294,
    isAvailable: true,
    services: [
      // Servicios por hora no se listan aquí si solo permite por hora
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.006, lng: USER_FIXED_LOCATION.lng + 0.003 },
    specialties: ['Álgebra', 'Cálculo', 'Física Mecánica', 'Preparación para exámenes de admisión'],
    allowsHourlyServices: true,
    hourlyRate: 35,
  },
  {
    id: 'nurse1', // Cambiado de _inactive para prueba
    name: 'Enfermera Laura Cuidados Profesionales',
    avatarUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'nurse caring',
    rating: 4.7,
    ratingCount: 40,
    ratingSum: 188,
    isAvailable: false, // Inactiva para prueba
    services: [
      // Servicios por hora no se listan aquí si solo permite por hora
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.005, lng: USER_FIXED_LOCATION.lng - 0.002 }, // Cerca
    specialties: ['Cuidado de adultos mayores', 'Administración de medicamentos', 'Curaciones menores'],
    allowsHourlyServices: true,
    hourlyRate: 40,
  },
];


export const mockProviderGalleries: ProviderGallery[] = [
  {
    providerId: 'plumber1',
    items: [
      { id: 'gal_p1_1', url: 'https://placehold.co/600x400.png', type: 'image', description: 'Instalación de tubería de cobre finalizada.', dataAiHint: 'pipe installation' },
      { id: 'gal_p1_2', url: 'https://placehold.co/600x400.png', type: 'image', description: 'Antes y después de reparación de fuga.', dataAiHint: 'leak repair' },
      { id: 'gal_p1_3', url: 'https://placehold.co/600x400.png?text=Video+Trabajo+Plomeria', type: 'video', description: 'Video demostrando desazolve de drenaje.', dataAiHint: 'video plumbing work' },
    ],
  },
  {
    providerId: 'electrician1',
    items: [
      { id: 'gal_e1_1', url: 'https://placehold.co/600x400.png', type: 'image', description: 'Nuevo panel eléctrico instalado.', dataAiHint: 'electrical panel' },
      { id: 'gal_e1_2', url: 'https://placehold.co/600x400.png', type: 'image', description: 'Instalación de luminarias LED en cocina.', dataAiHint: 'kitchen lighting' },
    ],
  },
  {
    providerId: 'nanny1',
    items: [
      { id: 'gal_n1_1', url: 'https://placehold.co/600x400.png', type: 'image', description: 'Actividad de manualidades con los niños.', dataAiHint: 'children crafts' },
      { id: 'gal_n1_2', url: 'https://placehold.co/600x400.png?text=Certificado+Primeros+Auxilios', type: 'image', description: 'Certificado de primeros auxilios pediátricos.', dataAiHint: 'certificate first aid' },
    ],
  },
  {
    providerId: 'gardener1',
    items: [
      { id: 'gal_g1_1', url: 'https://placehold.co/600x400.png', type: 'image', description: 'Jardín transformado, antes y después.', dataAiHint: 'garden makeover' },
      { id: 'gal_g1_2', url: 'https://placehold.co/600x400.png', type: 'image', description: 'Poda artística de arbustos.', dataAiHint: 'bush trimming' },
      { id: 'gal_g1_3', url: 'https://placehold.co/600x400.png?text=Video+Mantenimiento+Cesped', type: 'video', description: 'Video mostrando mantenimiento de césped.', dataAiHint: 'video lawn care' },
    ],
  },
  // Añadir más galerías para otros proveedores si se desea
];
