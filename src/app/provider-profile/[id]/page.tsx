
// src/app/provider-profile/[id]/page.tsx
"use client";

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData'; 
import type { Provider, Service, ServiceRequest } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Star, MapPin, MessageSquare, DollarSign, Tag, ArrowLeft, CheckCircle, ShieldCheck, CalendarDays, Loader2 as LoaderIcon, ShoppingBag, Clock, Info } from 'lucide-react';
import { SERVICE_CATEGORIES, DEFAULT_SERVICE_IMAGE, DEFAULT_USER_AVATAR, SERVICE_HOURS } from '@/lib/constants';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createServiceRequest } from '@/services/requestService'; // Importar el servicio

// Función para calcular la distancia (Haversine)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en km
};


export default function ProviderProfilePage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;
  
  const [provider, setProvider] = useState<Provider | undefined>(undefined);
  const [distanceFromUser, setDistanceFromUser] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const { toast } = useToast();

  // State for "Contratar Ahora" Popover
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [subtotal, setSubtotal] = useState(0);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // State for "Agendar Cita" (General)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [locationType, setLocationType] = useState<'current' | 'custom'>('current');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [serviceNotes, setServiceNotes] = useState<string>('');
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);

  // State for "Contratar por Horas"
  const [hourlyServiceDate, setHourlyServiceDate] = useState<Date | undefined>(undefined);
  const [hourlyServiceStartTime, setHourlyServiceStartTime] = useState<string>("");
  const [hourlyServiceDuration, setHourlyServiceDuration] = useState<number>(1);
  const [hourlyLocationType, setHourlyLocationType] = useState<'current' | 'custom'>('current');
  const [hourlyCustomLocation, setHourlyCustomLocation] = useState<string>('');
  const [hourlyServiceNotes, setHourlyServiceNotes] = useState<string>('');
  const [isSubmittingHourly, setIsSubmittingHourly] = useState(false);
  const [estimatedHourlyTotal, setEstimatedHourlyTotal] = useState<number>(0);


  useEffect(() => {
    if (providerId) {
      const foundProvider = mockProviders.find(p => p.id === providerId);
      setProvider(foundProvider);
      console.log('[ProviderProfilePage] Provider data in useEffect:', foundProvider);

      if (foundProvider?.location && USER_FIXED_LOCATION) {
        const dist = calculateDistance(USER_FIXED_LOCATION.lat, USER_FIXED_LOCATION.lng, foundProvider.location.lat, foundProvider.location.lng);
        setDistanceFromUser(dist.toFixed(1));
      }
      setReviewCount(Math.floor(Math.random() * 200) + 10);
    }
  }, [providerId]);

  // Calculate subtotal for "Contratar Ahora"
  useEffect(() => {
    if (provider) {
      const currentSubtotal = provider.services.reduce((acc, service) => {
        if (selectedServices[service.id]) {
          return acc + service.price;
        }
        return acc;
      }, 0);
      setSubtotal(currentSubtotal);
    }
  }, [selectedServices, provider]);

  // Calculate estimated total for hourly services
  useEffect(() => {
    if (provider?.hourlyRate && hourlyServiceDuration > 0) {
      setEstimatedHourlyTotal(provider.hourlyRate * hourlyServiceDuration);
    } else {
      setEstimatedHourlyTotal(0);
    }
  }, [provider?.hourlyRate, hourlyServiceDuration]);


  const handleDateSelect = (date: Date | undefined, type: 'general' | 'hourly') => {
    if (date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); 
      if (date < today) {
        toast({
          title: "Fecha Inválida",
          description: "No puedes seleccionar una fecha pasada.",
          variant: "destructive",
        });
        if (type === 'general') setSelectedDate(undefined);
        if (type === 'hourly') setHourlyServiceDate(undefined);
      } else {
        if (type === 'general') setSelectedDate(date);
        if (type === 'hourly') setHourlyServiceDate(date);
      }
    } else {
      if (type === 'general') setSelectedDate(undefined);
      if (type === 'hourly') setHourlyServiceDate(undefined);
    }
  };

  const handleRequestAppointment = async () => {
    if (!provider || !selectedDate || !selectedTime) {
      toast({ title: "Faltan Datos", description: "Por favor, selecciona fecha y hora.", variant: "destructive" });
      return;
    }
    setIsSubmittingAppointment(true);
    
    const requestData: ServiceRequest = {
      serviceType: 'fixed', // Asumiendo que esta sección es para servicios de precio fijo o generales
      userId: 'currentUserDemoId', 
      providerId: provider.id,
      serviceDate: selectedDate.toISOString().split('T')[0], // YYYY-MM-DD
      serviceTime: selectedTime, // HH:mm
      location: locationType === 'current' ? USER_FIXED_LOCATION : { custom: customLocation },
      notes: serviceNotes,
      status: 'agendado',
      createdAt: Date.now(),
    };

    try {
      await createServiceRequest(requestData); // Llama al servicio simulado
      toast({
        title: "Solicitud de Cita Enviada",
        description: `Tu solicitud para ${provider.name} el ${selectedDate.toLocaleDateString('es-ES')} a las ${selectedTime} ha sido enviada. Está sujeta a la disponibilidad del prestador, quien deberá confirmar la fecha y hora.`,
      });
      // Reset form fields
      setSelectedDate(undefined);
      setSelectedTime("");
      setLocationType('current');
      setCustomLocation('');
      setServiceNotes('');
    } catch (error) {
      toast({ title: "Error al Enviar Solicitud", description: "Hubo un problema. Intenta de nuevo.", variant: "destructive"});
      console.error("Error creating service request:", error);
    } finally {
      setIsSubmittingAppointment(false);
    }
  };

  const handleRequestHourlyService = async () => {
    if (!provider || !hourlyServiceDate || !hourlyServiceStartTime || hourlyServiceDuration <= 0) {
       toast({ title: "Faltan Datos", description: "Por favor, selecciona fecha, hora de inicio y duración válida.", variant: "destructive" });
      return;
    }
    setIsSubmittingHourly(true);

    const requestData: ServiceRequest = {
      serviceType: 'hourly',
      userId: 'currentUserDemoId',
      providerId: provider.id,
      serviceDate: hourlyServiceDate.toISOString().split('T')[0],
      startTime: hourlyServiceStartTime,
      durationHours: hourlyServiceDuration,
      hourlyRate: provider.hourlyRate || 0,
      estimatedTotal: estimatedHourlyTotal,
      location: hourlyLocationType === 'current' ? USER_FIXED_LOCATION : { custom: hourlyCustomLocation },
      notes: hourlyServiceNotes,
      status: 'agendado',
      createdAt: Date.now(),
    };
    
    try {
      await createServiceRequest(requestData);
      toast({
        title: "Solicitud de Servicio por Horas Enviada",
        description: `Tu solicitud para ${provider.name} el ${hourlyServiceDate.toLocaleDateString('es-ES')} a las ${hourlyServiceStartTime} por ${hourlyServiceDuration}hr(s) ha sido enviada. Total Estimado: $${estimatedHourlyTotal.toFixed(2)}. Está sujeta a la disponibilidad del prestador, quien deberá confirmar.`,
      });
      // Reset form fields
      setHourlyServiceDate(undefined);
      setHourlyServiceStartTime("");
      setHourlyServiceDuration(1);
      setHourlyLocationType('current');
      setHourlyCustomLocation('');
      setHourlyServiceNotes('');
    } catch (error) {
      toast({ title: "Error al Enviar Solicitud", description: "Hubo un problema. Intenta de nuevo.", variant: "destructive"});
      console.error("Error creating hourly service request:", error);
    } finally {
        setIsSubmittingHourly(false);
    }
  };


  const handleServiceSelection = (serviceId: string, checked: boolean) => {
    setSelectedServices(prev => ({ ...prev, [serviceId]: checked }));
  };

  const handleConfirmImmediateServices = () => {
    const chosenServices = provider?.services.filter(s => selectedServices[s.id]).map(s => s.title).join(', ');
    if (!chosenServices || subtotal === 0) {
      toast({
        title: "Ningún servicio seleccionado",
        description: "Por favor, selecciona al menos un servicio para contratar.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Procesando Solicitud Inmediata...",
      description: `Servicios: ${chosenServices}. Subtotal: $${subtotal.toFixed(2)}. (Simulación: el pago no se procesará).`,
    });
    setPopoverOpen(false); 
    setSelectedServices({}); 

    if (provider) {
      router.push(`/?hiredProviderId=${provider.id}`);
    }
  };


  if (!provider) {
    return (
      <div className="container mx-auto py-8 text-center">
        <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Cargando perfil del proveedor...</p>
        <p className="mt-4">Si esto persiste, el proveedor con ID '{providerId}' no fue encontrado.</p>
         <Button asChild variant="outline" className="mt-6">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Mapa
            </Link>
          </Button>
      </div>
    );
  }
  
  const getCategoryName = (categoryId: string) => {
    return SERVICE_CATEGORIES.find(cat => cat.id === categoryId)?.name || 'Categoría Desconocida';
  };
  const GetCategoryIcon = ({ categoryId }: { categoryId: string }) => {
    const CategoryIcon = SERVICE_CATEGORIES.find(cat => cat.id === categoryId)?.icon;
    return CategoryIcon ? <CategoryIcon className="h-4 w-4 text-muted-foreground" /> : <Tag className="h-4 w-4 text-muted-foreground" />;
  };

  console.log(`[ProviderProfilePage] Rendering for ${provider.name}. Allows Hourly: ${provider.allowsHourlyServices}, Hourly Rate: ${provider.hourlyRate}`);
  const showHourlySection = provider.allowsHourlyServices && typeof provider.hourlyRate === 'number' && provider.hourlyRate > 0;
  console.log(`[ProviderProfilePage] Show Hourly Section condition: ${showHourlySection}`);

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Button asChild variant="outline" className="mb-6">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Mapa
        </Link>
      </Button>

      <Card className="overflow-hidden shadow-xl">
        <CardHeader className="bg-secondary/30 p-0">
            <div className="relative h-48 w-full">
                 <Image
                    src={provider.services[0]?.imageUrl || provider.avatarUrl || DEFAULT_SERVICE_IMAGE}
                    alt={`Banner de ${provider.name}`}
                    fill
                    style={{ objectFit: "cover" }}
                    className="opacity-80"
                    data-ai-hint={provider.dataAiHint || "provider banner"}
                  />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                 <div className="absolute bottom-4 left-4 flex items-end space-x-4">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                      <AvatarImage src={provider.avatarUrl || DEFAULT_USER_AVATAR} alt={provider.name} style={{objectFit: 'cover'}} data-ai-hint={provider.dataAiHint || "provider avatar"} />
                      <AvatarFallback>{provider.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold text-white shadow-sm">{provider.name}</h1>
                        <div className="flex items-center gap-2 text-sm text-yellow-300 mt-1">
                            <Star className="h-5 w-5 fill-current" />
                            <span>{provider.rating.toFixed(1)} ({reviewCount} reseñas)</span>
                        </div>
                    </div>
                 </div>
                 {provider.isAvailable && (
                    <Badge variant="default" className="absolute top-4 right-4 bg-green-500 text-white text-sm py-1 px-3 shadow-md">
                        <CheckCircle className="mr-2 h-4 w-4" /> Disponible Ahora
                    </Badge>
                )}
                {!provider.isAvailable && (
                    <Badge variant="secondary" className="absolute top-4 right-4 text-sm py-1 px-3 shadow-md">
                        No Disponible
                    </Badge>
                )}
            </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2">
              <h2 className="text-xl font-semibold text-primary mb-3">Acerca de {provider.name}</h2>
              <p className="text-muted-foreground mb-4">
                Un profesional dedicado con experiencia en {provider.specialties && provider.specialties.length > 0 ? provider.specialties.join(', ') : getCategoryName(provider.services[0]?.category || '')}.
                Comprometido con la calidad y la satisfacción del cliente.
              </p>
              {provider.location && distanceFromUser && USER_FIXED_LOCATION && (
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <MapPin className="mr-2 h-4 w-4 text-primary" />
                  <span>Aprox. {distanceFromUser} km de tu ubicación simulada en Culiacán.</span>
                </div>
              )}
              <div className="flex items-center text-sm text-muted-foreground mb-4">
                  <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                  <span>Miembro desde: {new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 365).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}</span>
              </div>

              {provider.specialties && provider.specialties.length > 0 && (
                <>
                  <h3 className="text-md font-semibold text-foreground mb-2 mt-4">Especialidades:</h3>
                  <div className="flex flex-wrap gap-2">
                    {provider.specialties.map(specialty => (
                      <Badge key={specialty} variant="secondary">{specialty}</Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="md:col-span-1 space-y-4">
                <Button className="w-full bg-primary hover:bg-primary/80" size="lg" asChild>
                    <Link href="/chat">
                        <MessageSquare className="mr-2 h-5 w-5" /> Contactar por Chat
                    </Link>
                </Button>

                {provider.isAvailable && (
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        className="w-full bg-accent hover:bg-accent/80 text-accent-foreground" 
                        size="lg"
                      >
                        <ShoppingBag className="mr-2 h-5 w-5" /> Contratar Ahora
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4" align="end">
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium leading-none text-primary">Seleccionar Servicios</h4>
                          <p className="text-sm text-muted-foreground">
                            Elige los servicios que necesitas ahora.
                          </p>
                        </div>
                        <div className="grid gap-2 max-h-60 overflow-y-auto">
                          {provider.services.length > 0 ? (
                            provider.services.map((service) => (
                              !service.hourlyRate && // Solo mostrar servicios no por hora aquí
                              <div key={service.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-secondary/50">
                                <Checkbox
                                  id={`service-${service.id}`}
                                  checked={selectedServices[service.id] || false}
                                  onCheckedChange={(checked) => handleServiceSelection(service.id, !!checked)}
                                />
                                <Label
                                  htmlFor={`service-${service.id}`}
                                  className="flex-grow text-sm font-normal cursor-pointer"
                                >
                                  {service.title}
                                </Label>
                                <span className="text-sm font-semibold text-primary">${service.price.toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">Este proveedor no tiene servicios detallados para contratación inmediata.</p>
                          )}
                        </div>
                        {provider.services.filter(s => !s.hourlyRate).length > 0 && (
                          <>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-md font-semibold">Subtotal:</span>
                              <span className="text-md font-bold text-primary">${subtotal.toFixed(2)}</span>
                            </div>
                            <Button onClick={handleConfirmImmediateServices} disabled={subtotal === 0}>
                              Confirmar y Pagar Servicios
                            </Button>
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <Card className="bg-secondary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-md flex items-center">
                            <ShieldCheck className="mr-2 h-5 w-5 text-green-600"/> Verificado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Este proveedor ha completado verificaciones básicas.</p>
                    </CardContent>
                </Card>
            </div>
          </div>

          <Separator className="my-8" />

          {/* --- START: Sección Contratar por Horas --- */}
          {showHourlySection && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-primary mb-4 flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Contratar por Horas
              </h2>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-6 items-start">
                <Card className="shadow-md w-full p-0">
                    <CardContent className="p-2 sm:p-4 flex justify-center">
                    <Calendar
                        mode="single"
                        selected={hourlyServiceDate}
                        onSelect={(date) => handleDateSelect(date, 'hourly')}
                        className="rounded-md border"
                        disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))}
                        footer={hourlyServiceDate ? <p className="text-sm p-2 text-center">Fecha seleccionada: {hourlyServiceDate.toLocaleDateString('es-ES')}.</p> : <p className="text-sm p-2 text-center">Elige una fecha.</p>}
                    />
                    </CardContent>
                </Card>
                <div className="space-y-4 mt-4 md:mt-0">
                    <div className="grid grid-cols-2 gap-4">
                        <FormItem>
                            <Label htmlFor="hourly-start-time">Hora de Inicio</Label>
                            <Select value={hourlyServiceStartTime} onValueChange={setHourlyServiceStartTime}>
                                <SelectTrigger id="hourly-start-time">
                                <SelectValue placeholder="HH:MM" />
                                </SelectTrigger>
                                <SelectContent>
                                {SERVICE_HOURS.map(hour => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </FormItem>
                        <FormItem>
                            <Label htmlFor="hourly-duration">Duración (Horas)</Label>
                            <Input 
                                id="hourly-duration" 
                                type="number" 
                                value={hourlyServiceDuration} 
                                onChange={(e) => setHourlyServiceDuration(parseFloat(e.target.value) || 0)}
                                min="0.5"
                                step="0.5"
                                placeholder="Ej: 2.5"
                            />
                        </FormItem>
                    </div>

                    <Card className="bg-secondary/30 p-3 rounded-md">
                        <p className="text-sm text-muted-foreground">Tarifa por Hora: <span className="font-semibold text-foreground">${provider.hourlyRate?.toFixed(2)}</span></p>
                        <p className="text-md font-semibold text-primary">Total Estimado: <span className="font-bold">${estimatedHourlyTotal.toFixed(2)}</span></p>
                    </Card>
                  
                    <RadioGroup value={hourlyLocationType} onValueChange={(value: 'current' | 'custom') => setHourlyLocationType(value)} className="space-y-2">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="current" id="hourly-loc-current" />
                            <Label htmlFor="hourly-loc-current" className="font-normal">Usar mi ubicación actual (simulada)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="custom" id="hourly-loc-custom" />
                            <Label htmlFor="hourly-loc-custom" className="font-normal">Ingresar otra ubicación</Label>
                        </div>
                    </RadioGroup>
                    {hourlyLocationType === 'custom' && (
                        <Input 
                            type="text" 
                            placeholder="Escribe la dirección o coordenadas" 
                            value={hourlyCustomLocation}
                            onChange={(e) => setHourlyCustomLocation(e.target.value)}
                        />
                    )}
                    <Textarea 
                        placeholder="Notas adicionales para el proveedor (opcional)..."
                        value={hourlyServiceNotes}
                        onChange={(e) => setHourlyServiceNotes(e.target.value)}
                        rows={2}
                    />
                    <Button
                        onClick={handleRequestHourlyService}
                        disabled={!hourlyServiceDate || !hourlyServiceStartTime || hourlyServiceDuration <= 0 || isSubmittingHourly}
                        className="w-full"
                        size="lg"
                    >
                        {isSubmittingHourly ? <LoaderIcon className="mr-2 h-5 w-5 animate-spin" /> : <Clock className="mr-2 h-5 w-5" />}
                        Solicitar Servicio por Horas
                    </Button>
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <Info size={14} className="shrink-0 mt-0.5"/>
                      <span>La solicitud está sujeta a la disponibilidad y confirmación del prestador para la fecha y hora indicadas.</span>
                    </p>
                </div>
              </div>
            </div>
          )}
          {/* --- END: Sección Contratar por Horas --- */}


          <Separator className="my-8" />
          
          {/* --- START: Sección Agendar Cita (General / Precio Fijo) --- */}
          {/* Esta sección se mantiene por ahora, considerar si se fusiona o se especializa para servicios NO por hora */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-primary mb-4 flex items-center">
              <CalendarDays className="mr-2 h-5 w-5" />
              Agendar un Servicio (Precio Fijo/General)
            </h2>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-6 items-start">
              <Card className="shadow-md w-full">
                <CardContent className="p-2 sm:p-4 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => handleDateSelect(date, 'general')}
                    className="rounded-md border"
                    disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))}
                    footer={selectedDate ? <p className="text-sm p-2 text-center">Fecha seleccionada: {selectedDate.toLocaleDateString('es-ES')}.</p> : <p className="text-sm p-2 text-center">Elige una fecha.</p>}
                  />
                </CardContent>
              </Card>
              <div className="space-y-4 mt-4 md:mt-0">
                 <FormItem>
                    <Label htmlFor="general-time">Hora del Servicio</Label>
                    <Select value={selectedTime} onValueChange={setSelectedTime}>
                        <SelectTrigger id="general-time">
                        <SelectValue placeholder="HH:MM" />
                        </SelectTrigger>
                        <SelectContent>
                        {SERVICE_HOURS.map(hour => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}
                        </SelectContent>
                    </Select>
                 </FormItem>

                <RadioGroup value={locationType} onValueChange={(value: 'current' | 'custom') => setLocationType(value)} className="space-y-2">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="current" id="general-loc-current" />
                        <Label htmlFor="general-loc-current" className="font-normal">Usar mi ubicación actual (simulada)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom" id="general-loc-custom" />
                        <Label htmlFor="general-loc-custom" className="font-normal">Ingresar otra ubicación</Label>
                    </div>
                </RadioGroup>
                {locationType === 'custom' && (
                    <Input 
                        type="text" 
                        placeholder="Escribe la dirección o coordenadas" 
                        value={customLocation}
                        onChange={(e) => setCustomLocation(e.target.value)}
                    />
                )}
                <Textarea 
                    placeholder="Notas adicionales para el proveedor (opcional)..."
                    value={serviceNotes}
                    onChange={(e) => setServiceNotes(e.target.value)}
                    rows={2}
                />
                <Button
                  onClick={handleRequestAppointment}
                  disabled={!selectedDate || !selectedTime || isSubmittingAppointment}
                  className="w-full"
                  size="lg"
                >
                  {isSubmittingAppointment ? <LoaderIcon className="mr-2 h-5 w-5 animate-spin" /> : <CalendarDays className="mr-2 h-5 w-5" />}
                  Confirmar Solicitud de Cita
                </Button>
                 <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <Info size={14} className="shrink-0 mt-0.5"/>
                      <span>Para servicios con precio definido o consultas generales. La cita está sujeta a la disponibilidad del prestador, quien deberá confirmar la fecha y hora.</span>
                  </p>
              </div>
            </div>
          </div>
          {/* --- END: Sección Agendar Cita (General / Precio Fijo) --- */}

          <Separator className="my-8" />

          <h2 className="text-xl font-semibold text-primary mb-4">Servicios Específicos Ofrecidos (Precio Fijo)</h2>
          {provider.services && provider.services.filter(s => !s.hourlyRate).length > 0 ? (
            <div className="space-y-4">
              {provider.services.filter(s => !s.hourlyRate).map((service: Service) => (
                <Card key={service.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">{service.title}</CardTitle>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                                <GetCategoryIcon categoryId={service.category} />
                                <span className="ml-1">{getCategoryName(service.category)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold text-primary">
                                <DollarSign className="inline h-5 w-5 mr-1" />
                                {service.price.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">Precio base</p>
                        </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                    {service.imageUrl && (
                         <div className="relative h-40 w-full rounded-md overflow-hidden mb-3">
                            <Image src={service.imageUrl || DEFAULT_SERVICE_IMAGE} alt={service.title} fill style={{objectFit: "cover"}} data-ai-hint="service visual specific" />
                        </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Este proveedor no ha listado servicios específicos de precio fijo.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// El componente Loader2 se mantiene igual, no necesita cambios.
const Loader2 = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("animate-spin", className)}
    {...props}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
