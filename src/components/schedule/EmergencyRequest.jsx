'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Clock, 
  DollarSign, 
  Crown,
  Zap,
  Phone,
  Navigation,
  Timer,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

const EmergencyRequest = ({ 
  serviceType, 
  onRequestComplete, 
  className = "" 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  
  // Configuración de emergencia
  const [urgencyLevel, setUrgencyLevel] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [manualLocation, setManualLocation] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [useAutoLocation, setUseAutoLocation] = useState(true);
  
  // Estado de la solicitud
  const [emergencyRequestId, setEmergencyRequestId] = useState(null);
  const [responseTimer, setResponseTimer] = useState(30 * 60); // 30 minutos en segundos
  const [availableProviders, setAvailableProviders] = useState(0);
  const [estimatedResponse, setEstimatedResponse] = useState(0);
  const [emergencyFee, setEmergencyFee] = useState(0);
  const [requestStatus, setRequestStatus] = useState('pending');

  // Colores ServiMap
  const emergencyColor = '#FFD700';
  const criticalColor = '#ef4444';

  useEffect(() => {
    checkPremiumStatus();
    if (useAutoLocation) {
      getCurrentLocation();
    }
  }, []);

  useEffect(() => {
    let interval;
    if (emergencyRequestId && responseTimer > 0 && requestStatus === 'searching') {
      interval = setInterval(() => {
        setResponseTimer(prev => {
          if (prev <= 1) {
            // Tiempo agotado
            setRequestStatus('timeout');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emergencyRequestId, responseTimer, requestStatus]);

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

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: "Error de Ubicación",
            description: "No se pudo obtener tu ubicación automáticamente",
            variant: "destructive"
          });
          setUseAutoLocation(false);
        }
      );
    } else {
      toast({
        title: "Geolocalización No Disponible",
        description: "Tu navegador no soporta geolocalización",
        variant: "destructive"
      });
      setUseAutoLocation(false);
    }
  };

  const handleEmergencyRequest = async () => {
    if (!isPremium) {
      toast({
        title: "Premium Requerido",
        description: "Los servicios de emergencia están disponibles solo para usuarios Premium",
        variant: "destructive"
      });
      return;
    }

    if (!location && !manualLocation) {
      toast({
        title: "Ubicación Requerida",
        description: "Por favor proporciona tu ubicación para el servicio de emergencia",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const requestData = {
        serviceType,
        urgencyLevel,
        location: location || { lat: 0, lng: 0 }, // Se parsearía la ubicación manual
        description,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined
      };

      const response = await fetch('/api/functions/handleEmergencyService', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) throw new Error('Error creando solicitud de emergencia');
      
      const data = await response.json();
      
      setEmergencyRequestId(data.result.emergencyRequestId);
      setAvailableProviders(data.result.availableProviders);
      setEstimatedResponse(data.result.estimatedResponse);
      setEmergencyFee(data.result.emergencyFee);
      setRequestStatus('searching');
      setCurrentStep(3);
      
      toast({
        title: "Solicitud de Emergencia Enviada",
        description: `Se ha enviado a ${data.result.availableProviders} prestadores cercanos`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud de emergencia",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  };

  const getUrgencyColor = (level) => {
    return level === 'critical' ? criticalColor : emergencyColor;
  };

  const getUrgencyIcon = (level) => {
    return level === 'critical' ? <Zap className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />;
  };

  if (!isPremium) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Crown className="h-16 w-16 mx-auto mb-4" style={{ color: emergencyColor }} />
          <h3 className="text-xl font-semibold mb-2">Función Premium</h3>
          <p className="text-gray-600 mb-4">
            Los servicios de emergencia 24/7 están disponibles solo para usuarios Premium
          </p>
          <Button style={{ backgroundColor: emergencyColor, color: '#000' }}>
            Upgrade a Premium
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header de Emergencia */}
      <Card style={{ borderColor: emergencyColor, borderWidth: 2 }}>
        <CardHeader style={{ backgroundColor: `${emergencyColor}15` }}>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" style={{ color: emergencyColor }} />
            Servicio de Emergencia 24/7
            <Badge style={{ backgroundColor: emergencyColor, color: '#000' }}>Premium</Badge>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Respuesta garantizada en 30 minutos o reembolso parcial
          </p>
        </CardHeader>
      </Card>

      {/* Paso 1: Configuración de emergencia */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" style={{ color: emergencyColor }} />
              Detalles de la Emergencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nivel de urgencia */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Nivel de Urgencia
              </label>
              <Select value={urgencyLevel} onValueChange={setUrgencyLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nivel de urgencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" style={{ color: emergencyColor }} />
                      Alta - Respuesta en 30 min
                    </div>
                  </SelectItem>
                  <SelectItem value="critical">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" style={{ color: criticalColor }} />
                      Crítica - Respuesta en 15 min
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descripción del problema */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Descripción del Problema
              </label>
              <Textarea
                placeholder="Describe detalladamente la emergencia..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24"
              />
            </div>

            {/* Ubicación */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Ubicación del Servicio
              </label>
              {useAutoLocation && location ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-md">
                  <Navigation className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    Ubicación automática: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setUseAutoLocation(false)}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    placeholder="Dirección o descripción de la ubicación"
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={getCurrentLocation}
                    disabled={!navigator.geolocation}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Usar ubicación actual
                  </Button>
                </div>
              )}
            </div>

            {/* Presupuesto máximo */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Presupuesto Máximo (Opcional)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  placeholder="Ej: 2000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Los servicios de emergencia tienen un recargo del 50%
              </p>
            </div>

            <Button
              onClick={() => setCurrentStep(2)}
              disabled={!urgencyLevel || !description || (!location && !manualLocation)}
              className="w-full"
              style={{ backgroundColor: getUrgencyColor(urgencyLevel) }}
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Confirmación */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" style={{ color: emergencyColor }} />
              Confirmación de Emergencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Resumen de la solicitud */}
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Los servicios de emergencia tienen prioridad máxima y 
                  un recargo del 50% sobre el precio regular. Se garantiza respuesta en {urgencyLevel === 'critical' ? '15' : '30'} minutos.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Servicio</label>
                    <p className="capitalize">{serviceType?.replace('_', ' ')}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700">Urgencia</label>
                    <div className="flex items-center gap-2">
                      {getUrgencyIcon(urgencyLevel)}
                      <span className="capitalize" style={{ color: getUrgencyColor(urgencyLevel) }}>
                        {urgencyLevel === 'critical' ? 'Crítica' : 'Alta'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Tiempo de respuesta</label>
                    <p>{urgencyLevel === 'critical' ? '15' : '30'} minutos máximo</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Descripción</label>
                    <p className="text-sm text-gray-600">{description}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700">Ubicación</label>
                    <p className="text-sm text-gray-600">
                      {location ? 
                        `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 
                        manualLocation
                      }
                    </p>
                  </div>

                  {maxPrice && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Presupuesto máximo</label>
                      <p>{formatPrice(parseFloat(maxPrice))}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Costo estimado */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Costo Estimado
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Precio base del servicio:</span>
                  <span>$500 - $1,500</span>
                </div>
                <div className="flex justify-between">
                  <span>Recargo de emergencia (+50%):</span>
                  <span style={{ color: emergencyColor }}>$250 - $750</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Total estimado:</span>
                  <span>$750 - $2,250</span>
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
                onClick={handleEmergencyRequest}
                disabled={loading}
                className="flex-1"
                style={{ backgroundColor: getUrgencyColor(urgencyLevel) }}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Solicitar Emergencia
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 3: Estado de la solicitud */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Timer de respuesta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5" style={{ color: emergencyColor }} />
                  Buscando Prestadores
                </div>
                <div className="text-2xl font-bold" style={{ color: getUrgencyColor(urgencyLevel) }}>
                  {formatTime(responseTimer)}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress 
                  value={(1 - responseTimer / (30 * 60)) * 100} 
                  className="w-full"
                />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{availableProviders}</p>
                    <p className="text-sm text-gray-600">Prestadores notificados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: emergencyColor }}>
                      {estimatedResponse} min
                    </p>
                    <p className="text-sm text-gray-600">Tiempo estimado</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPrice(emergencyFee)}
                    </p>
                    <p className="text-sm text-gray-600">Costo del servicio</p>
                  </div>
                </div>

                {requestStatus === 'searching' && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Tu solicitud de emergencia ha sido enviada a {availableProviders} prestadores cercanos. 
                      Esperando confirmación...
                    </AlertDescription>
                  </Alert>
                )}

                {requestStatus === 'timeout' && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      No se recibió respuesta en el tiempo garantizado. Se procesará un reembolso parcial.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Acciones */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentStep(1);
                    setEmergencyRequestId(null);
                    setRequestStatus('pending');
                  }}
                  className="flex-1"
                >
                  Cancelar Solicitud
                </Button>
                <Button
                  onClick={() => {
                    // Simular contacto de emergencia
                    window.location.href = 'tel:911';
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Llamar a Emergencias
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Información adicional */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Los servicios de emergencia están disponibles 24/7 para usuarios Premium</p>
            <p>• Se garantiza respuesta en 30 minutos o reembolso parcial del 25%</p>
            <p>• El recargo de emergencia es del 50% sobre el precio regular</p>
            <p>• En caso de emergencia médica real, llama primero al 911</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmergencyRequest;