
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
    isAvailable: true, // ACTIVO
    services: [
        {id: 's_p1_1', title: 'Reparaciones Urgentes 24/7', description: 'Solución rápida a fugas y atascos.', price: 90, category: SERVICE_CATEGORIES.find(c=>c.id === 'plumbing')?.id || 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png?text=Fugas', dataAiHint: 'water pipes'},
        {id: 's_p1_2', title: 'Instalación de Calentadores', description: 'Instalamos calentadores de agua de todas las marcas.', price: 150, category: SERVICE_CATEGORIES.find(c=>c.id === 'plumbing')?.id || 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png?text=Boiler', dataAiHint: 'water heater'},
        {id: 's_p1_3', title: 'Desazolve de Drenajes', description: 'Servicio profesional para desazolvar tuberías y drenajes.', price: 120, category: SERVICE_CATEGORIES.find(c=>c.id === 'plumbing')?.id || 'plumbing', providerId: 'plumber1', imageUrl: 'https://placehold.co/300x200.png?text=Drenaje', dataAiHint: 'drain cleaning'}
    ],
    location: { lat: 24.8080, lng: -107.4240 }, // Cerca de USER_FIXED_LOCATION
    specialties: ['Fugas de agua', 'Desazolves', 'Instalación de tuberías', 'Reparación de boilers']
  },
  {
    id: 'plumber2_inactive',
    name: 'Plomería Don Pepe (Solo Citas)',
    avatarUrl: 'https://placehold.co/100x100.png?text=DP',
    dataAiHint: 'tools plumbing',
    rating: 4.6,
    isAvailable: false, // INACTIVO
    services: [
        {id: 's_p2_1', title: 'Mantenimiento Preventivo', description: 'Revisiones y mantenimiento general de plomería.', price: 70, category: SERVICE_CATEGORIES.find(c=>c.id === 'plumbing')?.id || 'plumbing', providerId: 'plumber2_inactive', imageUrl: 'https://placehold.co/300x200.png?text=Revision', dataAiHint: 'pipe wrench'}
    ],
    location: { lat: 24.8150, lng: -107.4350 }, 
    specialties: ['Mantenimiento', 'Revisión de instalaciones']
  },
  {
    id: 'electrician1',
    name: 'ElectroSoluciones Rápidas',
    avatarUrl: 'https://placehold.co/100x100.png?text=ES',
    dataAiHint: 'electrician smile',
    rating: 4.8,
    isAvailable: true, 
    services: [{
      id: 's_e1', title: 'Instalaciones Eléctricas Completas', description: 'Expertos en cableado y cortos circuitos.', price: 80, category: SERVICE_CATEGORIES.find(c=>c.id === 'electrical')?.id || 'electrical', providerId: 'electrician1', imageUrl: 'https://placehold.co/300x200.png?text=Luz', dataAiHint: 'electrical panel'
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
    isAvailable: true, // ACTIVO
    allowsHourlyServices: true,
    hourlyRate: 20,
    services: [{
      id: 's_n1', title: 'Cuidado Infantil Profesional por Horas', description: 'Cuidado amoroso y experto para tus hijos. Tarifa base por hora.', price: 20, category: SERVICE_CATEGORIES.find(c=>c.id === 'child_care')?.id || 'child_care', providerId: 'nanny1', imageUrl: 'https://placehold.co/300x200.png?text=Niños', dataAiHint: 'children playing'
    }],
    location: { lat: 24.8085, lng: -107.4200 }, // Cerca de USER_FIXED_LOCATION
    specialties: ['Cuidado de bebés', 'Actividades lúdicas', 'Apoyo con tareas', 'Primeros auxilios básicos']
  },
   {
    id: 'nanny2_inactive',
    name: 'Cuidado Infantil "Dulces Sueños"',
    avatarUrl: 'https://placehold.co/100x100.png?text=DS',
    dataAiHint: 'moon stars children',
    rating: 4.7,
    isAvailable: false, // INACTIVO
    allowsHourlyServices: true,
    hourlyRate: 22,
    services: [{
      id: 's_n2', title: 'Niñera Nocturna / Fines de Semana (Por Hora)', description: 'Cuidado especializado para horarios extendidos, solo con cita. Tarifa por hora.', price: 22, category: SERVICE_CATEGORIES.find(c=>c.id === 'child_care')?.id || 'child_care', providerId: 'nanny2_inactive', imageUrl: 'https://placehold.co/300x200.png?text=Bebes', dataAiHint: 'sleeping child'
    }],
    location: { lat: 24.8000, lng: -107.4210 }, 
    specialties: ['Cuidado nocturno', 'Fines de semana', 'Experiencia con recién nacidos']
  },
  {
    id: 'tutor1',
    name: 'Profe Carlos - Tutorías',
    avatarUrl: 'https://placehold.co/100x100.png?text=PC',
    dataAiHint: 'teacher study',
    rating: 4.7,
    isAvailable: false, 
    allowsHourlyServices: true,
    hourlyRate: 25,
    services: [{
      id: 's_t1', title: 'Clases de Matemáticas y Física (Por Hora)', description: 'Preparación para exámenes, regularización. Tarifa por hora.', price: 25, category: SERVICE_CATEGORIES.find(c=>c.id === 'tutoring')?.id || 'tutoring', providerId: 'tutor1', imageUrl: 'https://placehold.co/300x200.png?text=Clases', dataAiHint: 'books education'
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
      id: 's_c1', title: 'Limpieza Profunda Residencial', description: 'Dejamos tu casa reluciente. Reserva tu espacio.', price: 100, category: SERVICE_CATEGORIES.find(c=>c.id === 'cleaning')?.id || 'cleaning', providerId: 'cleaner1', imageUrl: 'https://placehold.co/300x200.png?text=Limpio', dataAiHint: 'sparkling clean'
    }],
    location: { lat: 24.7950, lng: -107.4100 }, 
    specialties: ['Limpieza general', 'Limpieza de oficinas', 'Limpieza post-construcción']
  },
  {
    id: 'doctor1',
    name: 'Dr. House - Médico General',
    avatarUrl: 'https://placehold.co/100x100.png?text=DH',
    dataAiHint: 'doctor serious',
    rating: 4.85,
    isAvailable: true, // ACTIVO
    allowsHourlyServices: true, 
    hourlyRate: 50,
    services: [{
      id: 's_d1', title: 'Consulta Médica General (Tarifa por Consulta/Hora)', description: 'Atención médica primaria en la comodidad de tu hogar o en consultorio.', price: 50, category: SERVICE_CATEGORIES.find(c=>c.id === 'doctors')?.id || 'doctors', providerId: 'doctor1', imageUrl: 'https://placehold.co/300x200.png?text=Doctor', dataAiHint: 'medical equipment'
    }],
    location: { lat: 24.8090, lng: -107.4250 }, // Muy cerca de USER_FIXED_LOCATION
    specialties: ['Diagnóstico general', 'Medicina familiar', 'Atención a domicilio']
  },
  {
    id: 'doctor2_inactive',
    name: 'Dr. Nick Riviera (Solo Consultorio)',
    avatarUrl: 'https://placehold.co/100x100.png?text=NR',
    dataAiHint: 'cartoon doctor',
    rating: 3.5,
    isAvailable: false, // INACTIVO
    allowsHourlyServices: false, // Este no ofrece por hora como ejemplo
    services: [{
      id: 's_d2', title: 'Consulta Médica (Previa Cita)', description: 'Atención en consultorio, agendar con anticipación.', price: 60, category: SERVICE_CATEGORIES.find(c=>c.id === 'doctors')?.id || 'doctors', providerId: 'doctor2_inactive', imageUrl: 'https://placehold.co/300x200.png?text=Consulta', dataAiHint: 'clinic office'
    }],
    location: { lat: 24.8005, lng: -107.4205 }, 
    specialties: ['Consultas generales', 'Revisiones']
  },
  {
    id: 'nurse1',
    name: 'Enfermera Laura Cuidados',
    avatarUrl: 'https://placehold.co/100x100.png?text=EL',
    dataAiHint: 'nurse caring',
    rating: 4.92,
    isAvailable: false, // INACTIVO
    allowsHourlyServices: true,
    hourlyRate: 30,
    services: [{
      id: 's_nu1', title: 'Servicios de Enfermería Profesional (Por Hora)', description: 'Inyecciones, curaciones, cuidado de pacientes. Tarifa por hora.', price: 30, category: SERVICE_CATEGORIES.find(c=>c.id === 'nurses')?.id || 'nurses', providerId: 'nurse1', imageUrl: 'https://placehold.co/300x200.png?text=Enfermera', dataAiHint: 'health care professional'
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
      id: 's_g1', title: 'Diseño y Mantenimiento de Jardines', description: 'Transformamos tu espacio exterior en un oasis verde. Agenda tu proyecto.', price: 110, category: SERVICE_CATEGORIES.find(c=>c.id === 'gardening')?.id || 'gardening', providerId: 'gardener1', imageUrl: 'https://placehold.co/300x200.png?text=Jardin', dataAiHint: 'beautiful garden'
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
    services: [{ id: 's_pf1', title: 'Servicios de Plomería General (Área Extendida)', description: 'Atendemos una amplia área.', price: 60, category: SERVICE_CATEGORIES.find(c=>c.id === 'plumbing')?.id || 'plumbing', providerId: 'plumber_far', imageUrl: 'https://placehold.co/300x200.png?text=Lejos', dataAiHint: 'wrench set' }],
    location: { lat: 25.0000, lng: -107.6000 } 
  },
  { 
    id: 'gardener_la',
    name: 'Jardines Verdes LA (Fuera de Rango)',
    avatarUrl: 'https://placehold.co/100x100.png?text=JVLA',
    dataAiHint: 'gardener nature',
    rating: 4.7,
    isAvailable: false,
    services: [{ id: 's_g_la', title: 'Mantenimiento de Jardines (Los Angeles)', description: 'Expertos en jardinería en LA.', price: 65, category: SERVICE_CATEGORIES.find(c=>c.id === 'gardening')?.id || 'gardening', providerId: 'gardener_la', imageUrl: 'https://placehold.co/300x200.png?text=LA', dataAiHint: 'lush garden' }],
    location: { lat: 34.0600, lng: -118.2400 } 
  },
  {
    id: 'designer1_inactive',
    name: 'Diseños Creativos de Alex',
    avatarUrl: 'https://placehold.co/100x100.png?text=DC',
    dataAiHint: 'graphic design portfolio',
    rating: 4.9,
    isAvailable: false, 
    services: [
      {id: 's_des1_1', title: 'Diseño de Logotipos', description: 'Creación de logotipos impactantes y memorables.', price: 250, category: SERVICE_CATEGORIES.find(c=>c.id === 'design')?.id || 'design', providerId: 'designer1_inactive', imageUrl: 'https://placehold.co/300x200.png?text=Logos', dataAiHint: 'logo design concept'},
      {id: 's_des1_2', title: 'Diseño de Branding Completo', description: 'Desarrollo de identidad de marca integral.', price: 800, category: SERVICE_CATEGORIES.find(c=>c.id === 'design')?.id || 'design', providerId: 'designer1_inactive', imageUrl: 'https://placehold.co/300x200.png?text=Marca', dataAiHint: 'brand guidelines'}
    ],
    location: { lat: 24.8130, lng: -107.4300 }, 
    specialties: ['Logotipos', 'Identidad de marca', 'Diseño web UX/UI', 'Ilustración']
  },
  {
    id: 'handyman1_inactive',
    name: 'Manitas "El Solucionador"',
    avatarUrl: 'https://placehold.co/100x100.png?text=MS',
    dataAiHint: 'handyman tools',
    rating: 4.6,
    isAvailable: false, 
    services: [
      {id: 's_hm1_1', title: 'Reparaciones Menores del Hogar', description: 'Arreglos de todo tipo: carpintería, pintura, ensamblaje.', price: 60, category: SERVICE_CATEGORIES.find(c=>c.id === 'handyman')?.id || 'handyman', providerId: 'handyman1_inactive', imageUrl: 'https://placehold.co/300x200.png?text=Repara', dataAiHint: 'home repair tools'},
      {id: 's_hm1_2', title: 'Instalación de Estanterías y Cuadros', description: 'Montaje seguro y preciso.', price: 50, category: SERVICE_CATEGORIES.find(c=>c.id === 'handyman')?.id || 'handyman', providerId: 'handyman1_inactive', imageUrl: 'https://placehold.co/300x200.png?text=Montaje', dataAiHint: 'shelf installation'}
    ],
    location: { lat: 24.7980, lng: -107.4150 },
    specialties: ['Carpintería ligera', 'Pintura', 'Ensamblaje de muebles', 'Colocación de accesorios']
  },
  {
    id: 'consultant1_inactive',
    name: 'Consultoría Estratégica BIZ',
    avatarUrl: 'https://placehold.co/100x100.png?text=CE',
    dataAiHint: 'business meeting',
    rating: 4.8,
    isAvailable: false, 
    services: [
      {id: 's_con1_1', title: 'Asesoría para Emprendedores', description: 'Plan de negocios, estrategias de crecimiento.', price: 150, category: SERVICE_CATEGORIES.find(c=>c.id === 'consulting')?.id || 'consulting', providerId: 'consultant1_inactive', imageUrl: 'https://placehold.co/300x200.png?text=Asesoria', dataAiHint: 'startup planning'},
    ],
    location: { lat: 24.8100, lng: -107.4400 },
    specialties: ['Plan de negocios', 'Marketing digital', 'Optimización de procesos']
  },
  {
    id: 'itsupport1_inactive',
    name: 'Soporte TI Remoto "SOS PC"',
    avatarUrl: 'https://placehold.co/100x100.png?text=TI',
    dataAiHint: 'computer support',
    rating: 4.7,
    isAvailable: false, 
    allowsHourlyServices: true,
    hourlyRate: 35,
    services: [
      {id: 's_its1_1', title: 'Solución de Problemas de PC/Laptop (Por Hora)', description: 'Asistencia remota para software y hardware. Tarifa por hora.', price: 35, category: SERVICE_CATEGORIES.find(c=>c.id === 'it_support')?.id || 'it_support', providerId: 'itsupport1_inactive', imageUrl: 'https://placehold.co/300x200.png?text=SoportePC', dataAiHint: 'laptop repair'},
    ],
    location: { lat: 24.8050, lng: -107.4180 },
    specialties: ['Diagnóstico remoto', 'Eliminación de virus', 'Configuración de software', 'Optimización de PC']
  }
];
