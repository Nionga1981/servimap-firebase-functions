// src/app/provider-profile/[id]/page.tsx
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { mockProviders, USER_FIXED_LOCATION, mockProviderGalleries } from '@/lib/mockData';
import type { Provider, Service, ServiceRequest, FixedServiceRequest, HourlyServiceRequest, GalleryItem, ProviderLocation } from '@/types';
import { SERVICE_CATEGORIES, DEFAULT_USER_AVATAR, SERVICE_HOURS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/hooks/use-toast';
import { Star, MapPin, Briefcase, DollarSign, Clock, CalendarDays, Mail, ChevronLeft, ShoppingBag, Image as ImageIcon, Video, BookOpen, CheckCircle, X, Tag } from 'lucide-react';
import { createServiceRequest, createImmediateRequest } from '@/services/requestService'; 
import { cn } from '@/lib/utils';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function ProviderProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const providerId = params.id as string;

  const [provider, setProvider] = useState<Provider | undefined>(undefined);
  const [distanceFromUser, setDistanceFromUser] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);

  // Estados para Agendar Cita (Servicio Fijo/General)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [locationType, setLocationType] = useState<'current' | 'custom'>('current');
  const [customAddress, setCustomAddress] = useState('');
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);

  // Estados para Contratar por Horas
  const [hourlyServiceDate, setHourlyServiceDate] = useState<Date | undefined>(undefined);
  const [hourlyServiceStartTime, setHourlyServiceStartTime] = useState<string>('');
  const [hourlyServiceDuration, setHourlyServiceDuration] = useState<number>(1);
  const [hourlyServiceNotes, setHourlyServiceNotes] = useState('');
  const [hourlyLocationType, setHourlyLocationType] = useState<'current' | 'custom'>('current');
  const [customHourlyAddress, setCustomHourlyAddress] = useState('');
  const [isSubmittingHourly, setIsSubmittingHourly] = useState(false);

  // Estados para Contratar Ahora (Servicios de Precio Fijo Inmediatos)
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [isSubmittingImmediate, setIsSubmittingImmediate] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'tarjeta' | 'efectivo' | 'transferencia' | 'wallet'>('tarjeta');
  const [promoCode, setPromoCode] = useState('');


  // Estado para la galería
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);


  console.log(`[ProviderProfilePage] Rendering for providerId: ${providerId}`);

  useEffect(() => {
    if (providerId) {
      const foundProvider = mockProviders.find(p => p.id === providerId);
      setProvider(foundProvider);
      console.log('[ProviderProfilePage] Provider data in useEffect:', foundProvider);

      if (foundProvider?.location && USER_FIXED_LOCATION) {
        const dist = calculateDistance(USER_FIXED_LOCATION.lat, USER_FIXED_LOCATION.lng, foundProvider.location.lat, foundProvider.location.lng);
        setDistanceFromUser(dist.toFixed(1));
      }
      setReviewCount(Math.floor(Math.random() * 200) + 10); // Simulación

      // Simular fetch de galería
      const foundGallery = mockProviderGalleries.find(g => g.providerId === providerId);
      if (foundGallery) {
        setGalleryItems(foundGallery.items);
        console.log('[ProviderProfilePage] Gallery items for provider:', foundGallery.items);
      } else {
        setGalleryItems([]);
        console.log('[ProviderProfilePage] No gallery found for provider:', providerId);
      }
    }
  }, [providerId]);

  const handleServiceSelection = (serviceId: string) => {
    setSelectedServices(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
  };

  const selectedImmediateServicesDetails = useMemo(() => {
    if (!provider) return [];
    return provider.services.filter(service => selectedServices[service.id]);
  }, [provider, selectedServices]);

  const immediateServiceSubtotal = useMemo(() => {
    return selectedImmediateServicesDetails.reduce((sum, service) => sum + service.price, 0);
  }, [selectedImmediateServicesDetails]);

  const estimatedHourlyTotal = useMemo(() => {
    if (provider?.hourlyRate && hourlyServiceDuration > 0) {
      return provider.hourlyRate * hourlyServiceDuration;
    }
    return 0;
  }, [provider?.hourlyRate, hourlyServiceDuration]);

  const handleConfirmImmediateServices = async () => {
    if (!provider || selectedImmediateServicesDetails.length === 0) {
      toast({ title: "Ningún servicio seleccionado", description: "Por favor, selecciona al menos un servicio para contratar.", variant: "destructive" });
      return;
    }
    setIsSubmittingImmediate(true);
    toast({ title: "Procesando Solicitud...", description: "Enviando tu solicitud de servicio inmediato..." });
    
    try {
        const payload = {
            providerId: provider.id,
            selectedServices: selectedImmediateServicesDetails.map(s => ({ serviceId: s.id, title: s.title, price: s.price })),
            totalAmount: immediateServiceSubtotal,
            location: USER_FIXED_LOCATION, // Using fixed location for now
            metodoPago: paymentMethod,
            codigoPromocion: promoCode.trim() || undefined,
        };
        const result = await createImmediateRequest(payload);
        
        toast({
            title: "¡Solicitud Exitosa!",
            description: result.message || `Tu servicio ha sido solicitado. ID: ${result.solicitudId}`,
            duration: 7000,
        });

        // Redirect user to a confirmation/tracking page, or just clear the state
        router.push(`/?hiredProviderId=${provider.id}`); // Reusing existing param for en-route view
        setSelectedServices({});
        setPromoCode('');

    } catch (error: any) {
         toast({
            title: "Error en la Solicitud",
            description: error.message || "No se pudo crear la solicitud de servicio.",
            variant: "destructive"
        });
    } finally {
         setIsSubmittingImmediate(false);
    }
  };

  const handleRequestAppointment = async () => {
    if (!provider || !selectedDate || !selectedTime) {
      toast({ title: "Faltan Datos", description: "Por favor, selecciona fecha y hora.", variant: "destructive" });
      return;
    }
    setIsSubmittingAppointment(true);
    
    const locationData = locationType === 'current' ? USER_FIXED_LOCATION : { customAddress: customAddress || "Dirección no especificada" };

    const requestData: FixedServiceRequest = {
      id: `req_${Date.now()}`, // ID simulado
      serviceType: 'fixed', // Asumimos que esta agenda es para servicios generales o de precio fijo no especificados
      userId: 'currentUserDemoId', // Simulado
      providerId: provider.id,
      serviceDate: selectedDate.toISOString().split('T')[0],
      serviceTime: selectedTime,
      location: locationData,
      notes: serviceNotes,
      status: 'agendado', // Estado inicial
      createdAt: Date.now(),
      // No se incluyen selectedFixedServices ni totalAmount ya que es una cita general
    };

    try {
      const result = await createServiceRequest(requestData);
      toast({
        title: "Solicitud de Cita Enviada",
        description: `Tu solicitud para el ${selectedDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })} a las ${selectedTime} ha sido enviada. Está sujeta a la disponibilidad del prestador, quien deberá confirmar la fecha y hora. ID Solicitud: ${result.id}`,
        duration: 7000,
      });
      setSelectedDate(undefined);
      setSelectedTime('');
      setServiceNotes('');
      setLocationType('current');
      setCustomAddress('');
    } catch (error: any) {
      toast({ title: "Error al Enviar Solicitud", description: error.message || "Ocurrió un problema.", variant: "destructive" });
    } finally {
      setIsSubmittingAppointment(false);
    }
  };
  
  const handleRequestHourlyService = async () => {
    if (!provider || !hourlyServiceDate || !hourlyServiceStartTime || hourlyServiceDuration <= 0) {
      toast({ title: "Faltan Datos", description: "Por favor, completa la fecha, hora de inicio y duración.", variant: "destructive" });
      return;
    }
    if (!provider.hourlyRate || provider.hourlyRate <= 0) {
        toast({ title: "Error de Tarifa", description: "Este proveedor no tiene una tarifa por hora válida configurada.", variant: "destructive" });
        return;
    }
    setIsSubmittingHourly(true);

    const locationData = hourlyLocationType === 'current' ? USER_FIXED_LOCATION : { customAddress: customHourlyAddress || "Dirección no especificada" };

    const requestData: HourlyServiceRequest = {
      id: `req_hourly_${Date.now()}`, // ID simulado
      serviceType: 'hourly',
      userId: 'currentUserDemoId', // Simulado
      providerId: provider.id,
      serviceDate: hourlyServiceDate.toISOString().split('T')[0],
      startTime: hourlyServiceStartTime,
      durationHours: hourlyServiceDuration,
      hourlyRate: provider.hourlyRate,
      estimatedTotal: estimatedHourlyTotal,
      location: locationData,
      notes: hourlyServiceNotes,
      status: 'agendado',
      createdAt: Date.now(),
    };

    try {
      const result = await createServiceRequest(requestData);
      toast({
        title: "Solicitud de Servicio por Horas Enviada",
        description: `Tu solicitud para el ${hourlyServiceDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })} a las ${hourlyServiceStartTime} por ${hourlyServiceDuration}h ha sido enviada. Está sujeta a la disponibilidad del prestador. ID: ${result.id}`,
        duration: 7000,
      });
      setHourlyServiceDate(undefined);
      setHourlyServiceStartTime('');
      setHourlyServiceDuration(1);
      setHourlyServiceNotes('');
      setHourlyLocationType('current');
      setCustomHourlyAddress('');
    } catch (error: any) {
      toast({ title: "Error al Enviar Solicitud", description: error.message || "Ocurrió un problema.", variant: "destructive" });
    } finally {
      setIsSubmittingHourly(false);
    }
  };

  if (!provider) {
    return (
      <div className="container mx-auto py-8 text-center">
        <ChevronLeft className="inline-block h-5 w-5 mr-2 cursor-pointer" onClick={() => router.back()} />
        Cargando perfil del proveedor...
      </div>
    );
  }

  console.log(`[ProviderProfilePage] Rendering for ${provider.name}. Allows Hourly: ${provider.allowsHourlyServices}, Hourly Rate: ${provider.hourlyRate}`);
  const showHourlySection = provider.allowsHourlyServices && typeof provider.hourlyRate === 'number' && provider.hourlyRate > 0;
  console.log(`[ProviderProfilePage] Show Hourly Section condition: ${showHourlySection}`);

  return (
    <div className="container mx-auto py-6 md:py-8">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 text-sm">
        <ChevronLeft className="h-4 w-4 mr-1" />
        Volver a resultados
      </Button>

      <Card className="overflow-hidden shadow-xl">
        <CardHeader className="bg-muted/30 p-0">
          <div className="relative h-48 md:h-64 w-full">
            <Image
              src={provider.avatarUrl || DEFAULT_USER_AVATAR} // O una imagen de banner si la tuvieran
              alt={`Banner de ${provider.name}`}
              fill
              style={{ objectFit: "cover" }}
              className="opacity-80"
              data-ai-hint={provider.dataAiHint || "provider banner"}
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6 flex flex-col justify-end">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-background shadow-lg overflow-hidden">
                   <Image
                    src={provider.avatarUrl || DEFAULT_USER_AVATAR}
                    alt={provider.name}
                    fill
                    style={{ objectFit: "cover" }}
                    data-ai-hint={provider.dataAiHint || "provider avatar"}
                  />
                </div>
                <div>
                  <CardTitle className="text-2xl md:text-3xl font-bold text-primary-foreground shadow-black [text-shadow:_0_1px_2px_var(--tw-shadow-color)]">{provider.name}</CardTitle>
                  {provider.specialties && provider.specialties.length > 0 && (
                    <p className="text-sm text-primary-foreground/90 [text-shadow:_0_1px_1px_var(--tw-shadow-color)]">{provider.specialties.join(', ')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              <div>
                <span className="font-semibold">{provider.rating.toFixed(1)}</span>
                <span className="text-muted-foreground"> ({reviewCount} reseñas)</span>
              </div>
            </div>
            {distanceFromUser && (
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-muted-foreground">Aprox. {distanceFromUser} km</span>
              </div>
            )}
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg font-semibold",
              provider.isAvailable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}>
              {provider.isAvailable ? <CheckCircle className="h-5 w-5" /> : <X className="h-5 w-5" />}
              {provider.isAvailable ? 'Disponible Ahora' : 'No Disponible Ahora'}
            </div>
          </div>

          {/* --- START: Portafolio de Trabajos --- */}
          {galleryItems.length > 0 && (
            <section className="space-y-3 pt-4 border-t">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <BookOpen className="text-primary h-5 w-5" />
                Portafolio de Trabajos
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {galleryItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden group">
                    <div className="relative aspect-square w-full bg-muted">
                      {item.type === 'image' ? (
                        <Image
                          src={item.url}
                          alt={item.description || 'Imagen de galería'}
                          fill
                          style={{ objectFit: 'cover' }}
                          className="group-hover:scale-105 transition-transform duration-300"
                          data-ai-hint={item.dataAiHint || "gallery image"}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-secondary/30">
                          <Video className="h-12 w-12 mb-2" />
                          <span className="text-xs text-center px-1">{item.description || "Video"}</span>
                        </div>
                      )}
                    </div>
                    {item.description && item.type === 'image' && (
                       <p className="text-xs text-muted-foreground p-2 truncate" title={item.description}>{item.description}</p>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}
          {/* --- END: Portafolio de Trabajos --- */}


          {/* --- START: Servicios Ofrecidos (Precio Fijo) --- */}
          {provider.services && provider.services.length > 0 && (
            <section className="space-y-3 pt-4 border-t">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Briefcase className="text-primary h-5 w-5" />
                Servicios de Precio Fijo
              </h3>
              <div className="space-y-3">
                {provider.services.map(service => (
                  <Card key={service.id} className="p-3 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{service.title}</h4>
                        <p className="text-xs text-muted-foreground">{service.description}</p>
                      </div>
                      <p className="text-lg font-semibold text-primary whitespace-nowrap pl-3">${service.price.toFixed(2)}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
          {/* --- END: Servicios Ofrecidos (Precio Fijo) --- */}
          

          {/* --- START: Botón Contratar Ahora (para servicios de precio fijo si está disponible) --- */}
          {provider.isAvailable && provider.services && provider.services.length > 0 && (
            <section className="pt-4 border-t">
               <Popover>
                <PopoverTrigger asChild>
                  <Button size="lg" className="w-full md:w-auto bg-accent hover:bg-accent/90">
                    <ShoppingBag className="mr-2 h-5 w-5" /> Contratar Ahora (Servicio Inmediato)
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 md:w-96 p-4 space-y-4">
                  <h4 className="font-medium text-center">Selecciona Servicios</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                    {provider.services.map((service) => (
                      <Label
                        key={service.id}
                        htmlFor={`service-${service.id}`}
                        className="flex items-center gap-3 p-2 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={!!selectedServices[service.id]}
                          onCheckedChange={() => handleServiceSelection(service.id)}
                        />
                        <span className="flex-grow text-sm">{service.title}</span>
                        <span className="text-sm font-semibold text-primary">${service.price.toFixed(2)}</span>
                      </Label>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                      <Label htmlFor="promo-code" className="text-sm font-medium flex items-center gap-1"><Tag className="h-4 w-4"/>Código de Promoción</Label>
                      <Input id="promo-code" placeholder="Ej: BIENVENIDO10" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
                  </div>

                  <div className="pt-2 border-t">
                    <Label className="text-sm font-medium">Método de Pago</Label>
                    <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as any)} className="mt-2 grid grid-cols-2 gap-2">
                        <Label htmlFor="pay-card" className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="tarjeta" id="pay-card" />
                            <span>Tarjeta</span>
                        </Label>
                         <Label htmlFor="pay-cash" className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="efectivo" id="pay-cash" />
                            <span>Efectivo</span>
                        </Label>
                         <Label htmlFor="pay-wallet" className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="wallet" id="pay-wallet" />
                            <span>Wallet</span>
                        </Label>
                         <Label htmlFor="pay-transfer" className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="transferencia" id="pay-transfer" />
                            <span>Transferencia</span>
                        </Label>
                    </RadioGroup>
                  </div>

                  {selectedImmediateServicesDetails.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-lg font-semibold text-right">Total: <span className="text-primary">${immediateServiceSubtotal.toFixed(2)}</span></p>
                    </div>
                  )}
                  <Button
                    onClick={handleConfirmImmediateServices}
                    disabled={isSubmittingImmediate || selectedImmediateServicesDetails.length === 0}
                    className="w-full"
                  >
                    {isSubmittingImmediate ? "Procesando..." : "Confirmar y Solicitar Servicios"}
                  </Button>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1 text-center md:text-left">Para servicios que necesitas ahora mismo.</p>
            </section>
          )}
          {/* --- END: Botón Contratar Ahora --- */}


          {/* --- START: Sección Contratar por Horas --- */}
          {showHourlySection && (
            <section className="space-y-4 pt-4 border-t">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="text-primary h-5 w-5" />
                Contratar por Horas
              </h3>
              <p className="text-sm text-muted-foreground">Tarifa: <span className="font-semibold text-primary">${provider.hourlyRate?.toFixed(2)} / hora</span></p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div>
                  <Label htmlFor="hourly-date">Fecha del Servicio</Label>
                  <Calendar
                    mode="single"
                    selected={hourlyServiceDate}
                    onSelect={setHourlyServiceDate}
                    className="rounded-md border p-0"
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} // Deshabilitar días pasados
                  />
                </div>
                <div className="space-y-4 mt-4 md:mt-0">
                    <div>
                        <Label htmlFor="hourly-start-time">Hora de Inicio</Label>
                        <Select value={hourlyServiceStartTime} onValueChange={setHourlyServiceStartTime}>
                            <SelectTrigger id="hourly-start-time">
                                <SelectValue placeholder="Selecciona hora" />
                            </SelectTrigger>
                            <SelectContent>
                                {SERVICE_HOURS.map(hour => (
                                <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                      <Label htmlFor="hourly-duration">Duración (horas)</Label>
                      <Input 
                        id="hourly-duration" 
                        type="number" 
                        value={hourlyServiceDuration} 
                        onChange={(e) => setHourlyServiceDuration(Math.max(0.5, parseFloat(e.target.value)))} 
                        min="0.5" 
                        step="0.5"
                        placeholder="Ej: 2.5"
                      />
                    </div>
                </div>
              </div>

              {estimatedHourlyTotal > 0 && (
                <p className="text-md font-semibold">Total Estimado: <span className="text-primary">${estimatedHourlyTotal.toFixed(2)}</span></p>
              )}
              
              <div>
                <Label>Ubicación del Servicio</Label>
                <RadioGroup value={hourlyLocationType} onValueChange={(value) => setHourlyLocationType(value as 'current' | 'custom')} className="mt-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="current" id="hourly-loc-current" />
                    <Label htmlFor="hourly-loc-current" className="font-normal">Mi ubicación actual (simulada)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="hourly-loc-custom" />
                    <Label htmlFor="hourly-loc-custom" className="font-normal">Ingresar otra ubicación</Label>
                  </div>
                </RadioGroup>
                {hourlyLocationType === 'custom' && (
                  <Input 
                    value={customHourlyAddress} 
                    onChange={(e) => setCustomHourlyAddress(e.target.value)} 
                    placeholder="Escribe la dirección completa" 
                    className="mt-2" 
                  />
                )}
              </div>

              <div>
                <Label htmlFor="hourly-notes">Notas Adicionales (opcional)</Label>
                <Textarea id="hourly-notes" value={hourlyServiceNotes} onChange={(e) => setHourlyServiceNotes(e.target.value)} placeholder="Instrucciones especiales, detalles del problema, etc." />
              </div>
              <Button onClick={handleRequestHourlyService} disabled={!hourlyServiceDate || !hourlyServiceStartTime || hourlyServiceDuration <= 0 || isSubmittingHourly} className="w-full md:w-auto">
                {isSubmittingHourly ? "Enviando Solicitud..." : "Solicitar Servicio por Horas"}
              </Button>
            </section>
          )}
          {/* --- END: Sección Contratar por Horas --- */}


          {/* --- START: Sección Agendar Cita General (si no permite por horas o como alternativa) --- */}
          {(!showHourlySection || (provider.services && provider.services.length > 0)) && ( // Mostrar si no hay opción por horas O si hay servicios de precio fijo listados (como alternativa)
            <section className="space-y-4 pt-4 border-t">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <CalendarDays className="text-primary h-5 w-5" />
                Agendar Cita Futura
              </h3>
              <p className="text-sm text-muted-foreground">
                {provider.isAvailable 
                  ? "Si prefieres otra fecha/hora, o para servicios no listados para contratación inmediata." 
                  : "Este prestador no está disponible ahora, pero puedes intentar agendar una cita."}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div>
                  <Label htmlFor="appointment-date">Fecha de la Cita</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border p-0"
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  />
                </div>
                <div className="space-y-4 mt-4 md:mt-0">
                    <div>
                        <Label htmlFor="appointment-time">Hora de la Cita</Label>
                        <Select value={selectedTime} onValueChange={setSelectedTime}>
                            <SelectTrigger id="appointment-time">
                                <SelectValue placeholder="Selecciona hora" />
                            </SelectTrigger>
                            <SelectContent>
                                {SERVICE_HOURS.map(hour => (
                                <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label>Ubicación del Servicio</Label>
                        <RadioGroup value={locationType} onValueChange={(value) => setLocationType(value as 'current' | 'custom')} className="mt-1">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="current" id="appt-loc-current" />
                            <Label htmlFor="appt-loc-current" className="font-normal">Mi ubicación actual (simulada)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="custom" id="appt-loc-custom" />
                            <Label htmlFor="appt-loc-custom" className="font-normal">Ingresar otra ubicación</Label>
                          </div>
                        </RadioGroup>
                        {locationType === 'custom' && (
                          <Input 
                            value={customAddress} 
                            onChange={(e) => setCustomAddress(e.target.value)} 
                            placeholder="Escribe la dirección completa" 
                            className="mt-2" 
                          />
                        )}
                      </div>
                </div>
              </div>
              <div>
                <Label htmlFor="appointment-notes">Notas Adicionales (opcional)</Label>
                <Textarea id="appointment-notes" value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)} placeholder="Describe brevemente el servicio que necesitas o cualquier detalle importante." />
              </div>
              <Button onClick={handleRequestAppointment} disabled={!selectedDate || !selectedTime || isSubmittingAppointment} className="w-full md:w-auto">
                {isSubmittingAppointment ? "Enviando Solicitud..." : "Solicitar Cita para esta Fecha"}
              </Button>
            </section>
          )}
          {/* --- END: Sección Agendar Cita General --- */}


          <CardFooter className="pt-6 border-t flex-col items-start gap-2">
            <p className="text-sm font-semibold">Contactar al Prestador:</p>
            <Button variant="outline" asChild>
              <Link href={`/chat?providerId=${provider.id}`}>
                <Mail className="mr-2 h-4 w-4" /> Enviar Mensaje (Demo Chat)
              </Link>
            </Button>
          </CardFooter>
        </CardContent>
      </Card>
    </div>
  );
}
