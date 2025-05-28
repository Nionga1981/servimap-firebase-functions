// src/lib/mockData.ts
import type { Provider, ProviderGallery, GalleryItem, BannerAd } from '@/types';

export const USER_FIXED_LOCATION = { lat: 24.8093, lng: -107.4255 }; // Culiacán, Sinaloa (Galileo 772, Villa Universidad)

export const mockProviders: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100/3F51B5/FFFFFF.png?text=MF',
    dataAiHint: 'plumber portrait',
    rating: 4.9,
    ratingCount: 120,
    ratingSum: 588, // 4.9 * 120
    isAvailable: true,
    services: [
        {id: 's_p1_1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos, disponible a cualquier hora.', price: 90, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200/3F51B5/FFFFFF.png?text=Fuga', dataAiHint: 'water pipes'},
        {id: 's_p1_2', title: 'Instalación de Calentadores', description: 'Instalamos y reparamos calentadores de agua de todas las marcas.', price: 150, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200/3F51B5/FFFFFF.png?text=Boiler', dataAiHint: 'water heater'},
        {id: 's_p1_3', title: 'Desazolve Profesional', description: 'Servicio profesional para desazolvar tuberías y drenajes obstruidos.', price: 120, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200/3F51B5/FFFFFF.png?text=Drenaje', dataAiHint: 'drain cleaning'}
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.002, lng: USER_FIXED_LOCATION.lng - 0.002 }, // Cerca de Culiacán
    specialties: ['Fugas de agua', 'Desazolves', 'Instalación de tuberías', 'Reparación de boilers'],
    allowsHourlyServices: false,
    idiomasHablados: ['es'],
  },
  {
    id: 'electrician1',
    name: 'ElectroSoluciones Rápidas',
    avatarUrl: 'https://placehold.co/100x100/008080/FFFFFF.png?text=EL',
    dataAiHint: 'electrician working',
    rating: 4.7,
    ratingCount: 95,
    ratingSum: 446.5, // 4.7 * 95
    isAvailable: true,
    services: [
        {id: 's_e1_1', title: 'Cortocircuitos y Fallas Eléctricas', description: 'Diagnóstico y reparación de fallas eléctricas de todo tipo.', price: 80, category: 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200/008080/FFFFFF.png?text=Falla', dataAiHint: 'electrical panel'},
        {id: 's_e1_2', title: 'Instalación de Lámparas', description: 'Moderniza tu iluminación y conexiones eléctricas de forma segura.', price: 60, category: 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200/008080/FFFFFF.png?text=Luz', dataAiHint: 'light fixtures'}
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.003, lng: USER_FIXED_LOCATION.lng + 0.001 }, // Cerca de Culiacán
    specialties: ['Cortocircuitos', 'Instalaciones nuevas', 'Mantenimiento eléctrico'],
    allowsHourlyServices: true,
    hourlyRate: 30,
    idiomasHablados: ['es', 'en'],
  },
  {
    id: 'nanny1',
    name: 'Super Niñeras Ana',
    avatarUrl: 'https://placehold.co/100x100/7E57C2/FFFFFF.png?text=SN',
    dataAiHint: 'friendly nanny',
    rating: 4.9,
    ratingCount: 70,
    ratingSum: 343, // 4.9 * 70
    isAvailable: true,
    services: [], // Primarily hourly
    location: { lat: USER_FIXED_LOCATION.lat + 0.0015, lng: USER_FIXED_LOCATION.lng + 0.0015 }, // Cerca de Culiacán
    specialties: ['Cuidado de bebés', 'Actividades lúdicas', 'Apoyo con tareas escolares'],
    allowsHourlyServices: true,
    hourlyRate: 20,
    idiomasHablados: ['es'],
  },
  {
    id: 'gardener1',
    name: 'Jardinería Esmeralda',
    avatarUrl: 'https://placehold.co/100x100/4CAF50/FFFFFF.png?text=JE',
    dataAiHint: 'lush garden',
    rating: 4.6,
    ratingCount: 50,
    ratingSum: 230, // 4.6 * 50
    isAvailable: true,
    services: [
        {id: 's_g1_1', title: 'Diseño y Mantenimiento de Jardines', description: 'Transformamos tu espacio exterior en un oasis verde.', price: 100, category: 'gardening', providerId: 'gardener1', imageUrl: 'https://placehold.co/300x200/4CAF50/FFFFFF.png?text=Jardin', dataAiHint: 'gardening tools'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.0025, lng: USER_FIXED_LOCATION.lng - 0.003 }, // Cerca de Culiacán
    specialties: ['Poda de árboles', 'Instalación de pasto', 'Sistemas de riego', 'Paisajismo'],
    allowsHourlyServices: false,
    idiomasHablados: ['es'],
  },
  {
    id: 'doctor1',
    name: 'Dr. House - Médico General',
    avatarUrl: 'https://placehold.co/100x100/F44336/FFFFFF.png?text=DH',
    dataAiHint: 'doctor smiling',
    rating: 4.8,
    ratingCount: 150,
    ratingSum: 720, // 4.8 * 150
    isAvailable: false, // Inactivo para prueba
    services: [
        {id: 's_d1_1', title: 'Consulta Médica General Integral', description: 'Atención primaria, diagnóstico y seguimiento de padecimientos comunes.', price: 70, category: 'doctors', providerId: 'doctor1', imageUrl: 'https://placehold.co/300x200/F44336/FFFFFF.png?text=Consulta', dataAiHint: 'medical consultation'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.0005, lng: USER_FIXED_LOCATION.lng - 0.004 }, // Cerca de Culiacán
    specialties: ['Medicina familiar', 'Diagnóstico general', 'Chequeos de rutina'],
    allowsHourlyServices: true,
    hourlyRate: 50,
    idiomasHablados: ['es', 'en'],
  },
  {
    id: 'cleaner1',
    name: 'Limpieza Impecable Hogar',
    avatarUrl: 'https://placehold.co/100x100/2196F3/FFFFFF.png?text=LI',
    dataAiHint: 'sparkling clean home',
    rating: 4.5,
    ratingCount: 80,
    ratingSum: 360, // 4.5 * 80
    isAvailable: true,
    services: [
      {id: 's_c1_1', title: 'Limpieza Profunda de Casas', description: 'Dejamos tu hogar reluciente de arriba a abajo.', price: 120, category: 'cleaning', providerId: 'cleaner1', imageUrl: 'https://placehold.co/300x200/2196F3/FFFFFF.png?text=CasaLimpia', dataAiHint: 'cleaning supplies'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.01, lng: USER_FIXED_LOCATION.lng + 0.01 }, // Un poco más lejos
    specialties: ['Limpieza residencial', 'Limpieza de oficinas', 'Desinfección de áreas'],
    allowsHourlyServices: true,
    hourlyRate: 25,
    idiomasHablados: ['es'],
  },
  {
    id: 'tutor1',
    name: 'Profe Carlos - Tutorías',
    avatarUrl: 'https://placehold.co/100x100/FFC107/000000.png?text=PC',
    dataAiHint: 'teacher explaining',
    rating: 4.9,
    ratingCount: 60,
    ratingSum: 294, // 4.9 * 60
    isAvailable: false, // Inactivo para prueba
    services: [
      {id: 's_t1_1', title: 'Tutoría de Matemáticas (Álgebra)', description: 'Clases personalizadas para mejorar en Álgebra.', price: 40, category: 'tutoring', providerId: 'tutor1', imageUrl: 'https://placehold.co/300x200/FFC107/000000.png?text=Mate', dataAiHint: 'math textbook'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.005, lng: USER_FIXED_LOCATION.lng + 0.005 }, // Cerca
    specialties: ['Álgebra', 'Cálculo', 'Física Mecánica', 'Preparación para exámenes'],
    allowsHourlyServices: true,
    hourlyRate: 35,
    idiomasHablados: ['es'],
  },
  {
    id: 'nurse1_inactive',
    name: 'Enfermera Laura (No Disponible)',
    avatarUrl: 'https://placehold.co/100x100/9E9E9E/FFFFFF.png?text=EL',
    dataAiHint: 'nurse caring',
    rating: 4.7,
    ratingCount: 40,
    ratingSum: 188, // 4.7 * 40
    isAvailable: false,
    services: [],
    location: { lat: USER_FIXED_LOCATION.lat - 0.012, lng: USER_FIXED_LOCATION.lng - 0.008 }, // Más lejos
    specialties: ['Cuidado de adultos mayores', 'Administración de medicamentos', 'Curaciones menores'],
    allowsHourlyServices: true,
    hourlyRate: 40,
    idiomasHablados: ['es'],
  },
   {
    id: 'designer1',
    name: 'Diseños Creativos Alex',
    avatarUrl: 'https://placehold.co/100x100/673AB7/FFFFFF.png?text=DC',
    dataAiHint: 'graphic design portfolio',
    rating: 4.8,
    ratingCount: 75,
    ratingSum: 360, // 4.8 * 75
    isAvailable: true,
    services: [
      {id: 's_ds1_1', title: 'Diseño de Logotipo Profesional', description: 'Creación de logotipos únicos y memorables para tu marca.', price: 200, category: 'design', providerId: 'designer1', imageUrl: 'https://placehold.co/300x200/673AB7/FFFFFF.png?text=Logo', dataAiHint: 'logo design' },
    ],
    location: { lat: USER_FIXED_LOCATION.lat + 0.015, lng: USER_FIXED_LOCATION.lng - 0.01 }, // Lejos
    specialties: ['Identidad de marca', 'Diseño web UI/UX', 'Ilustración digital'],
    allowsHourlyServices: true,
    hourlyRate: 50,
    idiomasHablados: ['es', 'en'],
  },
  {
    id: 'handyman1_inactive',
    name: 'Manitas Rápidos (No Disponible)',
    avatarUrl: 'https://placehold.co/100x100/795548/FFFFFF.png?text=MR',
    dataAiHint: 'handyman tools',
    rating: 4.4,
    ratingCount: 65,
    ratingSum: 286, // 4.4 * 65
    isAvailable: false,
    services: [
      {id: 's_hm1_1', title: 'Reparaciones Generales del Hogar', description: 'Pequeños arreglos, montaje de muebles, y más.', price: 50, category: 'handyman', providerId: 'handyman1_inactive', imageUrl: 'https://placehold.co/300x200/795548/FFFFFF.png?text=Arreglos', dataAiHint: 'home repairs'},
    ],
    location: { lat: USER_FIXED_LOCATION.lat - 0.008, lng: USER_FIXED_LOCATION.lng + 0.012 }, // Lejos
    specialties: ['Plomería básica', 'Electricidad básica', 'Pintura', 'Montaje de muebles'],
    allowsHourlyServices: true,
    hourlyRate: 28,
    idiomasHablados: ['es'],
  }
];


export const mockProviderGalleries: ProviderGallery[] = [
  {
    providerId: 'plumber1',
    items: [
      { id: 'gal_p1_1', url: 'https://placehold.co/600x400/3F51B5/FFFFFF.png?text=Instalacion', type: 'image', description: 'Instalación de tubería de cobre finalizada.', dataAiHint: 'pipe installation' },
      { id: 'gal_p1_2', url: 'https://placehold.co/600x400/3F51B5/FFFFFF.png?text=Reparacion', type: 'image', description: 'Antes y después de reparación de fuga.', dataAiHint: 'leak repair' },
      { id: 'gal_p1_3', url: 'https://placehold.co/600x400/3F51B5/FFFFFF.png?text=Video+Plomeria', type: 'video', description: 'Video demostrando desazolve de drenaje.', dataAiHint: 'video plumbing work' },
    ],
  },
  {
    providerId: 'electrician1',
    items: [
      { id: 'gal_e1_1', url: 'https://placehold.co/600x400/008080/FFFFFF.png?text=Panel', type: 'image', description: 'Nuevo panel eléctrico instalado.', dataAiHint: 'electrical panel' },
      { id: 'gal_e1_2', url: 'https://placehold.co/600x400/008080/FFFFFF.png?text=Luminarias', type: 'image', description: 'Instalación de luminarias LED en cocina.', dataAiHint: 'kitchen lighting' },
    ],
  },
  {
    providerId: 'nanny1',
    items: [
      { id: 'gal_n1_1', url: 'https://placehold.co/600x400/7E57C2/FFFFFF.png?text=Manualidades', type: 'image', description: 'Actividad de manualidades con los niños.', dataAiHint: 'children crafts' },
      { id: 'gal_n1_2', url: 'https://placehold.co/600x400/7E57C2/FFFFFF.png?text=Certificado', type: 'image', description: 'Certificado de primeros auxilios pediátricos.', dataAiHint: 'certificate first aid' },
    ],
  },
  {
    providerId: 'gardener1',
    items: [
      { id: 'gal_g1_1', url: 'https://placehold.co/600x400/4CAF50/FFFFFF.png?text=Jardin+AntesDespues', type: 'image', description: 'Jardín transformado, antes y después.', dataAiHint: 'garden makeover' },
      { id: 'gal_g1_2', url: 'https://placehold.co/600x400/4CAF50/FFFFFF.png?text=Poda+Arbol', type: 'image', description: 'Poda artística de arbustos.', dataAiHint: 'bush trimming' },
      { id: 'gal_g1_3', url: 'https://placehold.co/600x400/4CAF50/FFFFFF.png?text=Video+Cesped', type: 'video', description: 'Video mostrando mantenimiento de césped.', dataAiHint: 'video lawn care' },
    ],
  },
];

export const mockDemoUsers: DemoUser[] = [
  { id: 'currentUserDemoId', isPremium: true, name: 'Usuario Premium Demo', idiomaPreferido: 'es' },
  { id: 'standardUserDemoId', isPremium: false, name: 'Usuario Estándar Demo', idiomaPreferido: 'en' },
];

export const mockBanners: BannerAd[] = [
  {
    id: 'banner1',
    nombre: 'Promo Limpieza Profunda',
    imageUrl: 'https://placehold.co/400x150/008080/FFFFFF.png?text=Limpieza+20%25+OFF',
    enlaceUrl: '/promociones/limpieza',
    prioridad: 10,
    activo: true,
    dataAiHint: 'cleaning supplies promo'
  },
  {
    id: 'banner2',
    nombre: 'ServiCard Sin Anualidad',
    imageUrl: 'https://placehold.co/400x150/3F51B5/FFFFFF.png?text=ServiCard+Gratis',
    enlaceUrl: '/servicios/servi-card',
    prioridad: 8,
    activo: true,
    dataAiHint: 'credit card offer'
  },
  {
    id: 'banner3',
    nombre: 'Descuento Plomería',
    imageUrl: 'https://placehold.co/400x150/FF9800/FFFFFF.png?text=Plomeria+Descuento',
    enlaceUrl: '/servicios/plomeria',
    prioridad: 9,
    activo: true,
    dataAiHint: 'plumbing tools discount'
  },
  {
    id: 'banner4_inactive',
    nombre: 'Promo Jardinería (Inactiva)',
    imageUrl: 'https://placehold.co/400x150/4CAF50/FFFFFF.png?text=Jardineria+Oferta',
    enlaceUrl: '/promociones/jardineria',
    prioridad: 7,
    activo: false, // Inactivo
    dataAiHint: 'gardening offer'
  },
];
