
// src/lib/mockData.ts
import type { Provider, ProviderGallery, GalleryItem, DemoUser, BannerPublicitario, CategoriaServicio, ProviderLocation } from '@/types';
import { SERVICE_CATEGORIES as LUCIDE_SERVICE_CATEGORIES } from './constants'; // Keep for fallbacks or other uses

// --- Helper para generar ubicación aproximada ---
const getApproximateLocation = (exactLoc: ProviderLocation, factor = 0.01): ProviderLocation => {
  // Truncate to 2 decimal places for a noticeable but not too drastic shift
  // Add a small random offset to make it less predictable if needed
  const latApprox = parseFloat((exactLoc.lat + (Math.random() - 0.5) * factor).toFixed(3));
  const lngApprox = parseFloat((exactLoc.lng + (Math.random() - 0.5) * factor).toFixed(3));
  return { lat: latApprox, lng: lngApprox };
};


export const USER_FIXED_LOCATION: ProviderLocation = { lat: 24.8093, lng: -107.4255 }; // Culiacán, Sinaloa (Galileo 772, Villa Universidad)

const plumber1ExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat + 0.002, lng: USER_FIXED_LOCATION.lng - 0.002 };
const electrician1ExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat - 0.003, lng: USER_FIXED_LOCATION.lng + 0.001 };
const nanny1ExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat + 0.0015, lng: USER_FIXED_LOCATION.lng + 0.0015 };
const gardener1ExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat - 0.0025, lng: USER_FIXED_LOCATION.lng - 0.003 };
const doctor1ExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat + 0.0005, lng: USER_FIXED_LOCATION.lng - 0.004 };
const cleaner1ExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat + 0.01, lng: USER_FIXED_LOCATION.lng + 0.01 };
const tutor1ExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat - 0.005, lng: USER_FIXED_LOCATION.lng + 0.005 };
const nurse1InactiveExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat - 0.012, lng: USER_FIXED_LOCATION.lng - 0.008 };
const designer1ExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat + 0.015, lng: USER_FIXED_LOCATION.lng - 0.01 };
const handyman1InactiveExactLocation: ProviderLocation = { lat: USER_FIXED_LOCATION.lat - 0.008, lng: USER_FIXED_LOCATION.lng + 0.012 };


export const mockProviders: Provider[] = [
  {
    id: 'plumber1',
    name: 'Mario Fontanería Express',
    avatarUrl: 'https://placehold.co/100x100/3F51B5/FFFFFF.png?text=MF',
    dataAiHint: 'plumber portrait',
    rating: 4.9,
    ratingCount: 120,
    ratingSum: 588,
    isAvailable: true, // Availability toggle by provider
    estadoOnline: true, // Real-time presence
    services: [
        {id: 's_p1_1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos, disponible a cualquier hora.', price: 90, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200/3F51B5/FFFFFF.png?text=Fuga', dataAiHint: 'water pipes'},
        {id: 's_p1_2', title: 'Instalación de Calentadores', description: 'Instalamos y reparamos calentadores de agua de todas las marcas.', price: 150, category: 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200/3F51B5/FFFFFF.png?text=Boiler', dataAiHint: 'water heater'},
    ],
    ubicacionExacta: plumber1ExactLocation,
    ubicacionAproximada: getApproximateLocation(plumber1ExactLocation),
    currentLocation: plumber1ExactLocation, // Assume exact for current if online
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
    ratingSum: 446.5,
    isAvailable: true,
    estadoOnline: true,
    services: [
        {id: 's_e1_1', title: 'Cortocircuitos y Fallas Eléctricas', description: 'Diagnóstico y reparación de fallas eléctricas de todo tipo.', price: 80, category: 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200/008080/FFFFFF.png?text=Falla', dataAiHint: 'electrical panel'},
    ],
    ubicacionExacta: electrician1ExactLocation,
    ubicacionAproximada: getApproximateLocation(electrician1ExactLocation),
    currentLocation: electrician1ExactLocation,
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
    ratingSum: 343,
    isAvailable: true,
    estadoOnline: true,
    services: [], // Primarily hourly
    ubicacionExacta: nanny1ExactLocation,
    ubicacionAproximada: getApproximateLocation(nanny1ExactLocation),
    currentLocation: nanny1ExactLocation,
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
    ratingSum: 230,
    isAvailable: true,
    estadoOnline: true,
    services: [
        {id: 's_g1_1', title: 'Diseño y Mantenimiento de Jardines', description: 'Transformamos tu espacio exterior en un oasis verde.', price: 100, category: 'gardening', providerId: 'gardener1', imageUrl: 'https://placehold.co/300x200/4CAF50/FFFFFF.png?text=Jardin', dataAiHint: 'gardening tools'},
    ],
    ubicacionExacta: gardener1ExactLocation,
    ubicacionAproximada: getApproximateLocation(gardener1ExactLocation),
    currentLocation: gardener1ExactLocation,
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
    ratingSum: 720,
    isAvailable: false,
    estadoOnline: false,
    services: [
        {id: 's_d1_1', title: 'Consulta Médica General Integral', description: 'Atención primaria, diagnóstico y seguimiento de padecimientos comunes.', price: 70, category: 'doctors', providerId: 'doctor1', imageUrl: 'https://placehold.co/300x200/F44336/FFFFFF.png?text=Consulta', dataAiHint: 'medical consultation'},
    ],
    ubicacionExacta: doctor1ExactLocation,
    ubicacionAproximada: getApproximateLocation(doctor1ExactLocation),
    currentLocation: null,
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
    ratingSum: 360,
    isAvailable: true,
    estadoOnline: false, // Online but not available for immediate hire via map browsing perhaps
    services: [
      {id: 's_c1_1', title: 'Limpieza Profunda de Casas', description: 'Dejamos tu hogar reluciente de arriba a abajo.', price: 120, category: 'cleaning', providerId: 'cleaner1', imageUrl: 'https://placehold.co/300x200/2196F3/FFFFFF.png?text=CasaLimpia', dataAiHint: 'cleaning supplies'},
    ],
    ubicacionExacta: cleaner1ExactLocation,
    ubicacionAproximada: getApproximateLocation(cleaner1ExactLocation),
    currentLocation: cleaner1ExactLocation, // They might be online but not "isAvailable" via toggle
    specialties: ['Limpieza residencial', 'Limpieza de oficinas', 'Desinfección de áreas'],
    allowsHourlyServices: true,
    hourlyRate: 25,
    idiomasHablados: ['es'],
  },
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
];

export const mockDemoUsers: DemoUser[] = [
  { id: 'currentUserDemoId', isPremium: true, name: 'Usuario Premium Demo', idiomaPreferido: 'es', ubicacionExacta: USER_FIXED_LOCATION },
  { id: 'standardUserDemoId', isPremium: false, name: 'Usuario Estándar Demo', idiomaPreferido: 'en' },
];

export const mockBannersPublicitarios: BannerPublicitario[] = [
  {
    id: 'bp1',
    nombre: 'Promo Verano Limpieza',
    imagenUrl: 'https://placehold.co/400x150/2196F3/FFFFFF.png?text=Limpieza+Verano+25%25+OFF',
    linkDestino: '/promociones/verano-limpieza',
    orden: 1, // Más importante
    activo: true,
    dataAiHint: "cleaning summer promo"
  },
  {
    id: 'bp2',
    nombre: 'Reparaciones Eléctricas Urgentes',
    imagenUrl: 'https://placehold.co/400x150/008080/FFFFFF.png?text=Electricista+Urgente',
    linkDestino: '/servicios/electricidad?urgente=true',
    orden: 2,
    activo: true,
    dataAiHint: "urgent electrician service"
  },
  {
    id: 'bp3',
    nombre: 'Descuento Plomería Primera Vez',
    imagenUrl: 'https://placehold.co/400x150/3F51B5/FFFFFF.png?text=Plomeria+10%25+OFF',
    linkDestino: '/ofertas/plomeria-novatos',
    orden: 3,
    activo: true,
    dataAiHint: "plumbing first time discount"
  },
  {
    id: 'bp4_inactive',
    nombre: 'Jardinería Otoño (Inactiva)',
    imagenUrl: 'https://placehold.co/400x150/4CAF50/FFFFFF.png?text=Jardin+Otono',
    linkDestino: '/blog/jardineria-otono',
    orden: 4,
    activo: false,
    dataAiHint: "autumn gardening"
  },
];

// Match IDs with LUCIDE_SERVICE_CATEGORIES for consistency if needed
export const mockCategoriasServicio: CategoriaServicio[] = [
  { id: 'plumbing', nombre: 'Plomería', iconoUrl: 'https://placehold.co/80x80/3F51B5/FFFFFF.png?text=PLM', keywords: ['plomeria', 'fontaneria'], icon: LUCIDE_SERVICE_CATEGORIES.find(c => c.id === 'plumbing')?.icon },
  { id: 'electrical', nombre: 'Electricidad', iconoUrl: 'https://placehold.co/80x80/008080/FFFFFF.png?text=ELC', keywords: ['electricidad', 'electricista'], icon: LUCIDE_SERVICE_CATEGORIES.find(c => c.id === 'electrical')?.icon },
  { id: 'cleaning', nombre: 'Limpieza', iconoUrl: 'https://placehold.co/80x80/2196F3/FFFFFF.png?text=LMP', keywords: ['limpieza', 'aseo'], icon: LUCIDE_SERVICE_CATEGORIES.find(c => c.id === 'cleaning')?.icon },
  { id: 'doctors', nombre: 'Doctores', iconoUrl: 'https://placehold.co/80x80/F44336/FFFFFF.png?text=DOC', keywords: ['doctores', 'medicos', 'salud'], icon: LUCIDE_SERVICE_CATEGORIES.find(c => c.id === 'doctors')?.icon },
  { id: 'gardening', nombre: 'Jardinería', iconoUrl: 'https://placehold.co/80x80/4CAF50/FFFFFF.png?text=JAR', keywords: ['jardineria', 'plantas'], icon: LUCIDE_SERVICE_CATEGORIES.find(c => c.id === 'gardening')?.icon },
  { id: 'child_care', nombre: 'Niñeras', iconoUrl: 'https://placehold.co/80x80/7E57C2/FFFFFF.png?text=NIN', keywords: ['cuidado de niños', 'niñera'], icon: LUCIDE_SERVICE_CATEGORIES.find(c => c.id === 'child_care')?.icon },
];
