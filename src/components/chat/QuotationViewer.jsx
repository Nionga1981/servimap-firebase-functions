import React, { useState } from 'react';
import { 
  CheckCircle, 
  X, 
  MessageSquare, 
  Clock, 
  Calendar,
  DollarSign,
  Package,
  AlertTriangle,
  Zap,
  FileText,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';

const QuotationViewer = ({ 
  quotation,
  userType, // 'user' | 'provider'
  onAccept,
  onReject,
  onNegotiate,
  compact = false // Vista compacta para usar dentro del chat
}) => {
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [counterOffer, setCounterOffer] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Iconos por categoría
  const categoryIcons = {
    'labor': '🔧',
    'materials': '📦',
    'transport': '🚚',
    'other': '📋'
  };

  // Estados de cotización con colores
  const statusConfig = {
    'pending': { 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
      label: 'Pendiente de respuesta',
      icon: <Clock className="w-4 h-4" />
    },
    'accepted': { 
      color: 'bg-green-100 text-green-800 border-green-200', 
      label: 'Aceptada',
      icon: <CheckCircle className="w-4 h-4" />
    },
    'rejected': { 
      color: 'bg-red-100 text-red-800 border-red-200', 
      label: 'Rechazada',
      icon: <X className="w-4 h-4" />
    },
    'negotiating': { 
      color: 'bg-blue-100 text-blue-800 border-blue-200', 
      label: 'En negociación',
      icon: <MessageSquare className="w-4 h-4" />
    },
    'expired': { 
      color: 'bg-gray-100 text-gray-800 border-gray-200', 
      label: 'Expirada',
      icon: <AlertTriangle className="w-4 h-4" />
    }
  };

  // Calcular tiempo restante
  const getTimeRemaining = () => {
    const now = new Date();
    const expiry = new Date(quotation.validUntil);
    const diffMs = expiry.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    if (diffHours <= 0) return 'Expirada';
    if (diffHours < 24) return `${diffHours}h restantes`;
    const diffDays = Math.ceil(diffHours / 24);
    return `${diffDays} días restantes`;
  };

  // Manejar negociación
  const handleNegotiate = async () => {
    if (!counterOffer || parseFloat(counterOffer) <= 0) {
      return;
    }

    setLoading(true);
    try {
      await onNegotiate(parseFloat(counterOffer), negotiationMessage);
      setShowNegotiation(false);
      setCounterOffer('');
      setNegotiationMessage('');
    } catch (err) {
      console.error('Error negociando:', err);
    } finally {
      setLoading(false);
    }
  };

  // Vista compacta para dentro del chat
  if (compact) {
    return (
      <Card className="border-[#FFD700] bg-gradient-to-r from-yellow-50 to-amber-50 mb-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FFD700]" />
              <span className="font-semibold text-gray-900">Cotización</span>
            </div>
            <Badge className={`${statusConfig[quotation.status]?.color} border`}>
              {statusConfig[quotation.status]?.icon}
              <span className="ml-1">{statusConfig[quotation.status]?.label}</span>
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-xl font-bold text-[#FFD700]">${quotation.totalAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tiempo</p>
              <p className="text-sm font-medium text-gray-900">{quotation.estimatedTime}</p>
            </div>
          </div>

          {/* Mostrar botones solo si está pendiente y es usuario */}
          {quotation.status === 'pending' && userType === 'user' && (
            <div className="flex gap-2">
              <Button 
                size="sm"
                onClick={onAccept}
                className="flex-1 bg-[#3ce923] hover:bg-green-600"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Aceptar
              </Button>
              <Button 
                size="sm"
                variant="outline"
                onClick={onReject}
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              >
                <X className="w-3 h-3 mr-1" />
                Rechazar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Vista completa
  return (
    <div className="space-y-6">
      {/* Header de la cotización */}
      <Card className="border-[#FFD700]">
        <CardHeader className="bg-gradient-to-r from-[#FFD700] to-yellow-400">
          <div className="flex items-center justify-between">
            <CardTitle className="text-black flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Cotización Detallada
            </CardTitle>
            <Badge className={`${statusConfig[quotation.status]?.color} border bg-white`}>
              {statusConfig[quotation.status]?.icon}
              <span className="ml-1">{statusConfig[quotation.status]?.label}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total prominente */}
            <div className="md:col-span-1">
              <div className="bg-gradient-to-br from-[#FFD700] to-yellow-500 rounded-lg p-6 text-center">
                <p className="text-sm font-medium text-black opacity-80">Total de la cotización</p>
                <p className="text-3xl font-bold text-black">${quotation.totalAmount.toFixed(2)}</p>
                <p className="text-sm text-black opacity-70 mt-1">USD</p>
              </div>
            </div>

            {/* Detalles clave */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#60cdff]" />
                <div>
                  <p className="font-medium text-gray-900">Tiempo estimado</p>
                  <p className="text-sm text-gray-600">{quotation.estimatedTime}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#ac7afc]" />
                <div>
                  <p className="font-medium text-gray-900">Válida hasta</p>
                  <p className="text-sm text-gray-600">
                    {new Date(quotation.validUntil).toLocaleDateString()} 
                    <span className="ml-2 text-orange-600 font-medium">
                      ({getTimeRemaining()})
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-[#3ce923]" />
                <div>
                  <p className="font-medium text-gray-900">Items incluidos</p>
                  <p className="text-sm text-gray-600">{quotation.items.length} servicios/materiales</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown de items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#ac7afc]" />
            Desglose Detallado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {quotation.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{categoryIcons[item.category] || '📋'}</span>
                    <h4 className="font-medium text-gray-900">{item.description}</h4>
                  </div>
                  <p className="text-sm text-gray-600 capitalize">{item.category.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-500">
                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">${item.total.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen por categorías */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
            <h4 className="font-semibold mb-3 text-gray-900">Resumen por Categoría</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(quotation.items.reduce((acc, item) => {
                acc[item.category] = (acc[item.category] || 0) + item.total;
                return acc;
              }, {})).map(([category, total]) => (
                <div key={category} className="text-center">
                  <p className="text-2xl mb-1">{categoryIcons[category] || '📋'}</p>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {category.replace('_', ' ')}
                  </p>
                  <p className="text-lg font-bold text-[#ac7afc]">${total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notas adicionales */}
      {quotation.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-[#60cdff]" />
              Notas del Prestador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-gray-800">{quotation.notes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial de negociación */}
      {quotation.counterOffers && quotation.counterOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ac7afc]" />
              Historial de Negociación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quotation.counterOffers.map((offer, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">${offer.amount.toFixed(2)}</p>
                    {offer.message && (
                      <p className="text-sm text-gray-600">{offer.message}</p>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {new Date(offer.timestamp.toMillis()).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acciones (solo para usuarios y si está pendiente/negociando) */}
      {userType === 'user' && ['pending', 'negotiating'].includes(quotation.status) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">¿Qué quieres hacer?</CardTitle>
          </CardHeader>
          <CardContent>
            {!showNegotiation ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Aceptar */}
                <Button 
                  onClick={onAccept}
                  className="bg-[#3ce923] hover:bg-green-600 h-16 flex flex-col gap-1"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Aceptar</span>
                  <span className="text-xs opacity-90">Proceder al pago</span>
                </Button>

                {/* Negociar */}
                <Button 
                  onClick={() => setShowNegotiation(true)}
                  variant="outline"
                  className="h-16 flex flex-col gap-1 border-[#ac7afc] text-[#ac7afc] hover:bg-purple-50"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="font-semibold">Negociar</span>
                  <span className="text-xs">Hacer contraoferta</span>
                </Button>

                {/* Rechazar */}
                <Button 
                  onClick={onReject}
                  variant="outline"
                  className="h-16 flex flex-col gap-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X className="w-5 h-5" />
                  <span className="font-semibold">Rechazar</span>
                  <span className="text-xs">No acepto</span>
                </Button>
              </div>
            ) : (
              /* Panel de negociación */
              <div className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Negociar precio:</strong> Propón un monto diferente al prestador.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="counterOffer">Tu contraoferta (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                      <Input
                        id="counterOffer"
                        type="number"
                        step="0.01"
                        min="1"
                        placeholder="150.00"
                        value={counterOffer}
                        onChange={(e) => setCounterOffer(e.target.value)}
                        className="pl-10 text-lg font-semibold"
                      />
                    </div>
                    {counterOffer && (
                      <p className="text-sm text-gray-600 mt-1">
                        Diferencia: ${(parseFloat(counterOffer) - quotation.totalAmount).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="negotiationMessage">Mensaje opcional</Label>
                    <Textarea
                      id="negotiationMessage"
                      placeholder="Explica por qué propones este precio..."
                      value={negotiationMessage}
                      onChange={(e) => setNegotiationMessage(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setShowNegotiation(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleNegotiate}
                    disabled={!counterOffer || parseFloat(counterOffer) <= 0 || loading}
                    className="flex-1 bg-[#ac7afc] hover:bg-purple-600"
                  >
                    <ArrowRight className={`w-4 h-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
                    {loading ? 'Enviando...' : 'Enviar Contraoferta'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Información adicional */}
      <Card className="bg-gradient-to-r from-gray-50 to-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-[#FFD700] mt-1" />
            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Importante:</strong> Esta cotización es válida hasta la fecha indicada.</p>
              <p>• Los precios mostrados son estimados y pueden variar según condiciones del trabajo</p>
              <p>• Al aceptar, se creará una solicitud de servicio y procederás al pago</p>
              <p>• Puedes negociar el precio o solicitar modificaciones antes de aceptar</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuotationViewer;