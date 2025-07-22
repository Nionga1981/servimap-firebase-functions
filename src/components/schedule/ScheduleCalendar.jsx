'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, DollarSign, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const ScheduleCalendar = ({ 
  providerId, 
  serviceType, 
  onSlotSelect, 
  userLocation,
  userTimezone = 'America/Mexico_City'
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('week'); // week, month

  // Colores ServiMap
  const colors = {
    available: '#3ce923',
    emergency: '#FFD700', 
    occupied: '#e5e7eb',
    selected: '#60cdff',
    premium: '#ac7afc'
  };

  useEffect(() => {
    if (providerId && serviceType) {
      fetchProviderSchedule();
    }
  }, [providerId, serviceType, currentDate]);

  const fetchProviderSchedule = async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (viewMode === 'week' ? 7 : 30));

      const response = await fetch('/api/functions/getProviderSchedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          serviceType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          userTimezone
        })
      });

      if (!response.ok) throw new Error('Error obteniendo horarios');
      
      const data = await response.json();
      setAvailableSlots(data.result.availableSlots || []);
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los horarios disponibles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const getSlotForDateTime = (date, time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const slotDateTime = new Date(date);
    slotDateTime.setHours(hours, minutes, 0, 0);
    
    return availableSlots.find(slot => {
      const slotDate = new Date(slot.datetime.seconds * 1000);
      return Math.abs(slotDate.getTime() - slotDateTime.getTime()) < 60000; // 1 minuto de tolerancia
    });
  };

  const getSlotStyle = (slot, isSelected) => {
    if (isSelected) {
      return {
        backgroundColor: colors.selected,
        color: 'white',
        border: `2px solid ${colors.selected}`
      };
    }
    
    if (!slot) {
      return {
        backgroundColor: colors.occupied,
        color: '#9ca3af',
        cursor: 'not-allowed'
      };
    }

    return {
      backgroundColor: slot.isEmergency ? colors.emergency : colors.available,
      color: slot.isEmergency ? '#000' : 'white',
      cursor: 'pointer',
      border: '1px solid #d1d5db'
    };
  };

  const handleSlotClick = (date, time, slot) => {
    if (!slot) return;
    
    const [hours, minutes] = time.split(':').map(Number);
    const selectedDateTime = new Date(date);
    selectedDateTime.setHours(hours, minutes, 0, 0);
    
    const slotData = {
      ...slot,
      selectedDateTime,
      dateString: selectedDateTime.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      timeString: time
    };
    
    setSelectedSlot(slotData);
    onSlotSelect && onSlotSelect(slotData);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header con controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" />
              Agenda Disponible
            </CardTitle>
            
            <div className="flex items-center gap-4">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                >
                  ←
                </Button>
                <span className="text-sm font-medium px-4">
                  {currentDate.toLocaleDateString('es-MX', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                >
                  →
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Leyenda */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: colors.available }}
              ></div>
              <span className="text-sm">Disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: colors.emergency }}
              ></div>
              <span className="text-sm">Horario nocturno (+50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: colors.occupied }}
              ></div>
              <span className="text-sm">No disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: colors.selected }}
              ></div>
              <span className="text-sm">Seleccionado</span>
            </div>
          </div>

          {/* Calendario semanal */}
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Header de días */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div className="p-2 text-sm font-medium text-gray-500">Hora</div>
                {generateWeekDays().map((day, index) => (
                  <div key={index} className="p-2 text-center">
                    <div className="text-sm font-medium">
                      {day.toLocaleDateString('es-MX', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-bold">
                      {day.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid de horarios */}
              <div className="space-y-1">
                {generateTimeSlots().map((time) => (
                  <div key={time} className="grid grid-cols-8 gap-1">
                    <div className="p-2 text-sm text-gray-500 font-medium">
                      {time}
                    </div>
                    {generateWeekDays().map((day, dayIndex) => {
                      const slot = getSlotForDateTime(day, time);
                      const isSelected = selectedSlot && 
                        selectedSlot.timeString === time &&
                        selectedSlot.selectedDateTime.toDateString() === day.toDateString();
                      
                      return (
                        <div
                          key={`${dayIndex}-${time}`}
                          className="p-2 text-xs rounded-md transition-all duration-200 hover:scale-105"
                          style={getSlotStyle(slot, isSelected)}
                          onClick={() => handleSlotClick(day, time, slot)}
                        >
                          {slot && (
                            <div className="text-center">
                              <div className="font-medium">
                                {formatPrice(slot.price)}
                              </div>
                              {slot.isEmergency && (
                                <AlertTriangle className="h-3 w-3 mx-auto mt-1" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel de detalles del slot seleccionado */}
      {selectedSlot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Detalles de la Cita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Fecha y Hora</label>
                  <p className="text-lg font-semibold">
                    {selectedSlot.dateString}
                  </p>
                  <p className="text-lg font-semibold text-blue-600">
                    {selectedSlot.timeString}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Duración</label>
                  <p className="text-base">
                    {selectedSlot.duration} minutos
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Precio</label>
                  <p className="text-2xl font-bold text-green-600">
                    {formatPrice(selectedSlot.price)}
                  </p>
                  {selectedSlot.isEmergency && (
                    <Badge variant="secondary" className="mt-1">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Horario nocturno (+50%)
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Tipo de Servicio</label>
                  <p className="text-base capitalize">
                    {serviceType.replace('_', ' ')}
                  </p>
                </div>

                {userLocation && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Ubicación</label>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {userLocation.address || `${userLocation.lat}, ${userLocation.lng}`}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    className="w-full bg-green-500 hover:bg-green-600"
                    size="lg"
                    onClick={() => onSlotSelect && onSlotSelect(selectedSlot)}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Reservar Cita - {formatPrice(selectedSlot.price)}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información adicional */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Los precios pueden variar según el horario seleccionado</p>
            <p>• Horarios nocturnos (10 PM - 6 AM) tienen un recargo del 50%</p>
            <p>• El pago se retiene automáticamente hasta confirmación del prestador</p>
            <p>• Recibirás recordatorios 24h, 2h y 30min antes de tu cita</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleCalendar;