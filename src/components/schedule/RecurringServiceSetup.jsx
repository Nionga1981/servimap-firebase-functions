'use client';

import React, { useState, useEffect } from 'react';
import { 
  Repeat, 
  Calendar, 
  Clock, 
  CreditCard, 
  User, 
  MapPin,
  DollarSign,
  Crown,
  CheckCircle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';

const RecurringServiceSetup = ({ 
  providerId, 
  serviceType, 
  onSetupComplete, 
  className = "" 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  
  // Configuración del servicio
  const [frequency, setFrequency] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [contractDuration, setContractDuration] = useState(3);
  const [preferredTime, setPreferredTime] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [autoRenewal, setAutoRenewal] = useState(false);
  
  // Datos del prestador y precios
  const [providerInfo, setProviderInfo] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [recurringPreview, setRecurringPreview] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [monthlySavings, setMonthlySavings] = useState(0);

  // Colores ServiMap
  const premiumColor = '#ac7afc';

  useEffect(() => {
    checkPremiumStatus();
    fetchProviderInfo();
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    if (frequency && startDate && contractDuration && preferredTime) {
      generateRecurringPreview();
    }
  }, [frequency, startDate, contractDuration, preferredTime, dayOfWeek]);

  const checkPremiumStatus = async () => {
    try {
      const response = await fetch('/api/user/premium-status');
      if (response.ok) {
        const data = await response.json();
        setIsPremium(data.isPremium);
      }
    } catch (error) {
      console.error('Error checking premium status:', error);
    }
  };

  const fetchProviderInfo = async () => {
    try {
      const response = await fetch(`/api/providers/${providerId}`);
      if (response.ok) {
        const data = await response.json();
        setProviderInfo(data);
      }
    } catch (error) {
      console.error('Error fetching provider info:', error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/user/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const generateRecurringPreview = () => {
    if (!providerInfo) return;

    const basePrice = providerInfo.services?.find(s => s.type === serviceType)?.price || 500;
    const discountedPrice = basePrice * 0.9; // 10% de descuento por recurrencia
    
    const preview = [];
    let currentDate = new Date(startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + contractDuration);

    while (currentDate <= endDate) {
      // Ajustar día de la semana si está especificado
      if (frequency === 'weekly' && dayOfWeek) {
        const targetDay = parseInt(dayOfWeek);
        const currentDay = currentDate.getDay();
        const daysToAdd = (targetDay - currentDay + 7) % 7;
        if (daysToAdd > 0 || preview.length === 0) {
          currentDate.setDate(currentDate.getDate() + daysToAdd);
        }
      }

      if (currentDate <= endDate) {
        const serviceDate = new Date(currentDate);
        if (preferredTime) {
          const [hours, minutes] = preferredTime.split(':').map(Number);
          serviceDate.setHours(hours, minutes, 0, 0);
        }

        preview.push({
          date: serviceDate,
          price: discountedPrice,
          savings: basePrice - discountedPrice
        });

        // Calcular próxima fecha
        switch (frequency) {
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'biweekly':
            currentDate.setDate(currentDate.getDate() + 14);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
          default:
            currentDate.setDate(currentDate.getDate() + 30);
        }
      }
    }

    setRecurringPreview(preview);
    
    const total = preview.reduce((sum, service) => sum + service.price, 0);
    const totalSavings = preview.reduce((sum, service) => sum + service.savings, 0);
    
    setTotalCost(total);
    setMonthlySavings(totalSavings);
  };

  const handleSetupRecurring = async () => {
    if (!isPremium) {
      toast({
        title: "Premium Requerido",
        description: "Los servicios recurrentes están disponibles solo para usuarios Premium",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/functions/setupRecurringService', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          serviceType,
          startDate: {
            seconds: Math.floor(startDate.getTime() / 1000),
            nanoseconds: 0
          },
          pattern: {
            frequency,
            duration: contractDuration,
            time: preferredTime,
            dayOfWeek: dayOfWeek ? parseInt(dayOfWeek) : undefined
          },
          paymentMethodId,
          specialInstructions,
          autoRenewal
        })
      });

      if (!response.ok) throw new Error('Error configurando servicio recurrente');
      
      const data = await response.json();
      
      toast({
        title: "Servicio Recurrente Configurado",
        description: `Se han programado ${data.result.scheduledCount} servicios`,
        variant: "default"
      });
      
      onSetupComplete && onSetupComplete(data.result);
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo configurar el servicio recurrente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  };

  const getFrequencyDisplay = (freq) => {
    const displays = {
      weekly: 'Semanal',
      biweekly: 'Quincenal', 
      monthly: 'Mensual'
    };
    return displays[freq] || freq;
  };

  const getDayName = (dayNumber) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayNumber] || '';
  };

  if (!isPremium) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Crown className="h-16 w-16 mx-auto mb-4" style={{ color: premiumColor }} />
          <h3 className="text-xl font-semibold mb-2">Función Premium</h3>
          <p className="text-gray-600 mb-4">
            Los servicios recurrentes están disponibles solo para usuarios Premium
          </p>
          <Button style={{ backgroundColor: premiumColor }}>
            Upgrade a Premium
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Premium */}
      <Card style={{ borderColor: premiumColor }}>
        <CardHeader style={{ backgroundColor: `${premiumColor}15` }}>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" style={{ color: premiumColor }} />
            Configurar Servicio Recurrente
            <Badge style={{ backgroundColor: premiumColor }}>Premium</Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Pasos de configuración */}
      <div className="flex items-center justify-center space-x-4 mb-6">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {currentStep > step ? <CheckCircle className="h-4 w-4" /> : step}
            </div>
            {step < 3 && <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />}
          </div>
        ))}
      </div>

      {/* Paso 1: Configuración de frecuencia */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-purple-500" />
              Configuración de Frecuencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Frecuencia del Servicio
                </label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar frecuencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quincenal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Duración del Contrato (meses)
                </label>
                <Select 
                  value={contractDuration.toString()} 
                  onValueChange={(value) => setContractDuration(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 meses</SelectItem>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Hora Preferida
                </label>
                <Select value={preferredTime} onValueChange={setPreferredTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar hora" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 17 }, (_, i) => i + 6).map(hour => (
                      <SelectItem key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                        {hour.toString().padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {frequency === 'weekly' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Día de la Semana
                  </label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar día" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 0].map(day => (
                        <SelectItem key={day} value={day.toString()}>
                          {getDayName(day)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Fecha de Inicio
              </label>
              <CalendarPicker
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>

            <Button
              onClick={() => setCurrentStep(2)}
              disabled={!frequency || !preferredTime}
              className="w-full"
              style={{ backgroundColor: premiumColor }}
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Preview del calendario */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Preview del Calendario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Resumen de la configuración */}
            <div className="bg-purple-50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold">Resumen de Configuración:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Frecuencia:</span>
                  <span className="ml-2 font-medium">{getFrequencyDisplay(frequency)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Duración:</span>
                  <span className="ml-2 font-medium">{contractDuration} meses</span>
                </div>
                <div>
                  <span className="text-gray-600">Hora:</span>
                  <span className="ml-2 font-medium">{preferredTime}</span>
                </div>
                {dayOfWeek && (
                  <div>
                    <span className="text-gray-600">Día:</span>
                    <span className="ml-2 font-medium">{getDayName(parseInt(dayOfWeek))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de servicios programados */}
            <div>
              <h4 className="font-semibold mb-3">Servicios Programados ({recurringPreview.length})</h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {recurringPreview.slice(0, 10).map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div>
                      <p className="font-medium">
                        {service.date.toLocaleDateString('es-MX', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {service.date.toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {formatPrice(service.price)}
                      </p>
                      <p className="text-xs text-purple-600">
                        Ahorro: {formatPrice(service.savings)}
                      </p>
                    </div>
                  </div>
                ))}
                {recurringPreview.length > 10 && (
                  <p className="text-sm text-gray-500 text-center">
                    ... y {recurringPreview.length - 10} servicios más
                  </p>
                )}
              </div>
            </div>

            {/* Resumen de costos */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Resumen de Costos</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total del contrato:</span>
                  <span className="font-bold text-green-600">{formatPrice(totalCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ahorro total:</span>
                  <span className="font-bold text-purple-600">{formatPrice(monthlySavings)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Precio por servicio:</span>
                  <span>{formatPrice(totalCost / recurringPreview.length)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                className="flex-1"
                style={{ backgroundColor: premiumColor }}
              >
                Continuar
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 3: Método de pago y confirmación */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-500" />
              Método de Pago y Confirmación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Método de Pago Preferido
              </label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método de pago" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.type === 'card' ? 
                        `**** ${method.last4} (${method.brand})` : 
                        method.type
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Instrucciones Especiales (Opcional)
              </label>
              <Textarea
                placeholder="Instrucciones especiales para el prestador..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="min-h-20"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Renovación Automática</p>
                <p className="text-sm text-gray-600">
                  El contrato se renovará automáticamente al vencer
                </p>
              </div>
              <Switch
                checked={autoRenewal}
                onCheckedChange={setAutoRenewal}
              />
            </div>

            {/* Confirmación final */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Confirmación Final</h4>
              <div className="space-y-2 text-sm">
                <p>✓ {recurringPreview.length} servicios programados</p>
                <p>✓ Ahorro total de {formatPrice(monthlySavings)}</p>
                <p>✓ Pagos automáticos configurados</p>
                <p>✓ Recordatorios automáticos activados</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                onClick={handleSetupRecurring}
                disabled={!paymentMethodId || loading}
                className="flex-1"
                style={{ backgroundColor: premiumColor }}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Confirmar y Activar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RecurringServiceSetup;