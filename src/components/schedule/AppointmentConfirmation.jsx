'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  MessageSquare,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

const AppointmentConfirmation = ({ 
  scheduledServiceId, 
  onActionComplete, 
  className = "" 
}) => {
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [alternativeDate, setAlternativeDate] = useState(new Date());
  const [alternativeTime, setAlternativeTime] = useState('');
  const [showAlternativeDialog, setShowAlternativeDialog] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);

  useEffect(() => {
    if (scheduledServiceId) {
      fetchAppointmentDetails();
    }
  }, [scheduledServiceId]);

  const fetchAppointmentDetails = async () => {
    setLoading(true);
    try {
      // Simular llamada a la API para obtener detalles del servicio
      const response = await fetch(`/api/scheduledServices/${scheduledServiceId}`);
      if (!response.ok) throw new Error('Error obteniendo detalles');
      
      const data = await response.json();
      setAppointment(data);
      
      // Obtener información del cliente
      if (data.userId) {
        const userResponse = await fetch(`/api/users/${data.userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCustomerInfo(userData);
        }
      }
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles de la cita",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAppointment = async () => {
    setActionType('confirm');
    setLoading(true);
    
    try {
      const response = await fetch('/api/functions/confirmAppointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceRequestId: scheduledServiceId,
          action: 'confirm'
        })
      });

      if (!response.ok) throw new Error('Error confirmando cita');
      
      toast({
        title: "Cita Confirmada",
        description: "La cita ha sido confirmada exitosamente",
        variant: "default"
      });
      
      onActionComplete && onActionComplete('confirmed');
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo confirmar la cita",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleRejectAppointment = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Razón requerida",
        description: "Por favor proporciona una razón para rechazar la cita",
        variant: "destructive"
      });
      return;
    }

    setActionType('reject');
    setLoading(true);
    
    try {
      const response = await fetch('/api/functions/confirmAppointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceRequestId: scheduledServiceId,
          action: 'reject',
          rejectionReason
        })
      });

      if (!response.ok) throw new Error('Error rechazando cita');
      
      toast({
        title: "Cita Rechazada",
        description: "La cita ha sido rechazada y el cliente será notificado",
        variant: "default"
      });
      
      onActionComplete && onActionComplete('rejected');
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo rechazar la cita",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleProposeAlternative = async () => {
    if (!alternativeTime) {
      toast({
        title: "Hora requerida",
        description: "Por favor selecciona una hora para la fecha alternativa",
        variant: "destructive"
      });
      return;
    }

    const [hours, minutes] = alternativeTime.split(':').map(Number);
    const alternativeDateTime = new Date(alternativeDate);
    alternativeDateTime.setHours(hours, minutes, 0, 0);

    setActionType('propose_alternative');
    setLoading(true);
    
    try {
      const response = await fetch('/api/functions/confirmAppointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceRequestId: scheduledServiceId,
          action: 'propose_alternative',
          alternativeDateTime: {
            seconds: Math.floor(alternativeDateTime.getTime() / 1000),
            nanoseconds: 0
          }
        })
      });

      if (!response.ok) throw new Error('Error proponiendo alternativa');
      
      toast({
        title: "Alternativa Propuesta",
        description: "Se ha enviado la propuesta de horario alternativo al cliente",
        variant: "default"
      });
      
      setShowAlternativeDialog(false);
      onActionComplete && onActionComplete('alternative_proposed');
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar la propuesta alternativa",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  };

  if (loading && !appointment) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!appointment) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No se encontraron detalles de la cita
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header de la cita */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" />
              Confirmación de Cita
            </CardTitle>
            <Badge 
              variant={appointment.isEmergency ? "destructive" : "secondary"}
              className={appointment.isEmergency ? "bg-red-100 text-red-800" : ""}
            >
              {appointment.isEmergency ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Servicio de Emergencia
                </>
              ) : (
                'Servicio Regular'
              )}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información del servicio */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo de Servicio</label>
                <p className="text-lg font-semibold capitalize">
                  {appointment.serviceType?.replace('_', ' ')}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Fecha y Hora Solicitada</label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <p className="text-base font-medium">
                    {formatDateTime(appointment.scheduledDateTime)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Duración Estimada</label>
                <p className="text-base">
                  {appointment.estimatedDuration} minutos
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Precio del Servicio</label>
                <p className="text-2xl font-bold text-green-600">
                  {formatPrice(appointment.price || 500)}
                </p>
              </div>

              {appointment.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Notas del Cliente</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm">{appointment.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Información del cliente */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Cliente</label>
                <div className="flex items-center gap-3 mt-1">
                  <User className="h-8 w-8 text-gray-400" />
                  <div>
                    <p className="font-medium">
                      {customerInfo?.displayName || 'Cliente ServiMap'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {customerInfo?.email || 'Email no disponible'}
                    </p>
                  </div>
                </div>
              </div>

              {customerInfo?.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Teléfono</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-green-500" />
                    <p className="text-base">{customerInfo.phone}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Ubicación del Servicio</label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-sm">
                      {appointment.location ? 
                        `${appointment.location._latitude}, ${appointment.location._longitude}` : 
                        'Ubicación por confirmar'
                      }
                    </p>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="p-0 h-auto text-blue-600"
                      onClick={() => {
                        if (appointment.location) {
                          window.open(
                            `https://maps.google.com?q=${appointment.location._latitude},${appointment.location._longitude}`,
                            '_blank'
                          );
                        }
                      }}
                    >
                      Ver en mapa
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones de confirmación */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Botones de acción */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleConfirmAppointment}
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 flex-1 min-w-48"
                size="lg"
              >
                {actionType === 'confirm' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Confirmar Cita
              </Button>

              <Dialog open={showAlternativeDialog} onOpenChange={setShowAlternativeDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={loading}
                    className="flex-1 min-w-48"
                    size="lg"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Proponer Alternativa
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Proponer Horario Alternativo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Fecha Alternativa</label>
                      <CalendarPicker
                        mode="single"
                        selected={alternativeDate}
                        onSelect={setAlternativeDate}
                        disabled={(date) => date < new Date()}
                        className="rounded-md border"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Hora</label>
                      <Select value={alternativeTime} onValueChange={setAlternativeTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar hora" />
                        </SelectTrigger>
                        <SelectContent>
                          {generateTimeSlots().map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleProposeAlternative}
                      disabled={!alternativeTime || loading}
                      className="w-full"
                    >
                      {actionType === 'propose_alternative' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : null}
                      Enviar Propuesta
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Campo para rechazar */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Rechazar cita (opcional)
              </label>
              <Textarea
                placeholder="Razón para rechazar la cita..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-20"
              />
              <Button
                onClick={handleRejectAppointment}
                disabled={loading || !rejectionReason.trim()}
                variant="destructive"
                className="w-full"
              >
                {actionType === 'reject' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Rechazar Cita
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Al confirmar, el pago del cliente se procesará automáticamente</p>
            <p>• Al rechazar, el pago se reembolsará completamente al cliente</p>
            <p>• Las propuestas alternativas requieren nueva confirmación del cliente</p>
            <p>• Los recordatorios se envían automáticamente una vez confirmada la cita</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentConfirmation;