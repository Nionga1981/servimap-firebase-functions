import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, MapPin, Star, Phone, DollarSign, Check } from 'lucide-react';

const EmergencyProviderSearch = ({ serviceType, userLocation, urgencyLevel = 'high' }) => {
  const [emergencyProviders, setEmergencyProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState({});
  const [confirmationRequired, setConfirmationRequired] = useState(false);

  useEffect(() => {
    loadEmergencyProviders();
  }, [serviceType, userLocation, urgencyLevel]);

  const loadEmergencyProviders = async () => {
    setLoading(true);
    try {
      // Llama a la nueva función que solo obtiene prestadores voluntarios
      const response = await fetch('/api/emergency/getEmergencyProviders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          userLocation,
          urgencyLevel
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEmergencyProviders(data.emergencyProviders || []);
      } else {
        console.error('Error loading emergency providers');
        setEmergencyProviders([]);
      }
    } catch (error) {
      console.error('Error:', error);
      setEmergencyProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const togglePriceBreakdown = (providerId) => {
    setShowPriceBreakdown(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const handleProviderSelect = (provider) => {
    setSelectedProvider(provider);
    setConfirmationRequired(true);
  };

  const confirmEmergencyRequest = async () => {
    if (!selectedProvider) return;

    try {
      const response = await fetch('/api/emergency/requestEmergencyService', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProvider.providerId,
          serviceType,
          urgencyLevel,
          userLocation,
          acknowledgedSurcharge: true,
          totalPrice: selectedProvider.totalPrice
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Show success message
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50';
        toast.innerHTML = `
          <div class="flex items-center space-x-2">
            <div class="w-2 h-2 bg-white rounded-full animate-ping"></div>
            <span>Solicitud de emergencia enviada - Respuesta estimada: ${selectedProvider.estimatedResponseTime}</span>
          </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);

        setConfirmationRequired(false);
        setSelectedProvider(null);
      }
    } catch (error) {
      console.error('Error requesting emergency service:', error);
    }
  };

  const EmergencyProviderCard = ({ provider }) => {
    const basePrice = 500; // This would come from the actual service price
    const surchargeAmount = Math.round(basePrice * provider.customSurcharge / 100);
    const totalPrice = basePrice + surchargeAmount;
    
    return (
      <div className="bg-white border-2 border-red-200 rounded-lg p-6 hover:border-red-300 transition-colors">
        {/* Header with Badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <div>
              <span className="bg-red-500 text-white px-3 py-1 text-xs font-bold rounded-full">
                EMERGENCIA 24/7
              </span>
              {provider.isAvailableNow && (
                <span className="ml-2 bg-green-500 text-white px-2 py-1 text-xs font-bold rounded-full">
                  DISPONIBLE AHORA
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-red-600 font-bold text-lg">+{provider.customSurcharge}%</div>
            <div className="text-xs text-gray-500">sobrecargo</div>
          </div>
        </div>

        {/* Provider Info */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-1">{provider.name}</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>Respuesta: {provider.estimatedResponseTime}</span>
            </div>
            <div className="flex items-center space-x-1">
              <MapPin className="w-4 h-4" />
              <span>{provider.distance?.toFixed(1)} km</span>
            </div>
            {provider.rating && (
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                <span>{provider.rating} ({provider.reviewCount} reseñas)</span>
              </div>
            )}
          </div>
        </div>

        {/* Emergency Types */}
        {provider.emergencyTypes && provider.emergencyTypes.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Especialidades de emergencia:</p>
            <div className="flex flex-wrap gap-2">
              {provider.emergencyTypes.slice(0, 3).map(type => (
                <span key={type} className="bg-gray-100 text-gray-700 px-2 py-1 text-xs rounded">
                  {type}
                </span>
              ))}
              {provider.emergencyTypes.length > 3 && (
                <span className="text-gray-500 text-xs">+{provider.emergencyTypes.length - 3} más</span>
              )}
            </div>
          </div>
        )}

        {/* Price Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">Desglose de precio</h4>
            <button
              onClick={() => togglePriceBreakdown(provider.providerId)}
              className="text-blue-600 text-sm hover:underline"
            >
              {showPriceBreakdown[provider.providerId] ? 'Ocultar' : 'Ver detalles'}
            </button>
          </div>
          
          {showPriceBreakdown[provider.providerId] ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Servicio base:</span>
                <span>${basePrice}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Sobrecargo emergencia (+{provider.customSurcharge}%):</span>
                <span>+${surchargeAmount}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span className="text-red-600">${totalPrice}</span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-2xl font-bold text-red-600">${totalPrice}</span>
              <span className="text-sm text-gray-500 ml-2">(incluye sobrecargo)</span>
            </div>
          )}
        </div>

        {/* Additional Info */}
        {provider.description && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">{provider.description}</p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => handleProviderSelect({
            ...provider,
            basePrice,
            surchargeAmount,
            totalPrice
          })}
          className="w-full bg-red-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center justify-center space-x-2"
        >
          <AlertTriangle className="w-5 h-5" />
          <span>Solicitar Emergencia</span>
        </button>
      </div>
    );
  };

  const ConfirmationModal = () => {
    if (!selectedProvider) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirmar Emergencia</h3>
                <p className="text-sm text-gray-600">Revisa los detalles antes de confirmar</p>
              </div>
            </div>

            {/* Provider Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">{selectedProvider.name}</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Tiempo de respuesta:</span>
                  <span className="font-medium">{selectedProvider.estimatedResponseTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Distancia:</span>
                  <span className="font-medium">{selectedProvider.distance?.toFixed(1)} km</span>
                </div>
              </div>
            </div>

            {/* Price Confirmation */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-red-800 mb-3 flex items-center">
                <DollarSign className="w-4 h-4 mr-1" />
                Costo de Emergencia
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Servicio base:</span>
                  <span>${selectedProvider.basePrice}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Sobrecargo emergencia:</span>
                  <span>+${selectedProvider.surchargeAmount}</span>
                </div>
                <div className="border-t border-red-200 pt-2 flex justify-between font-bold text-lg">
                  <span>Total a pagar:</span>
                  <span className="text-red-600">${selectedProvider.totalPrice}</span>
                </div>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="mb-6">
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  required
                  className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  <strong>Confirmo que:</strong> Esta es realmente una emergencia y acepto el sobrecargo 
                  del {selectedProvider.customSurcharge}% sobre el precio base del servicio.
                </span>
              </label>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Este servicio tendrá sobrecargo de emergencia</p>
                  <p>Solo solicita si realmente necesitas atención urgente. El prestador responderá en {selectedProvider.estimatedResponseTime}.</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={() => setConfirmationRequired(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmEmergencyRequest}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Emergencia</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Buscando prestadores de emergencia...</p>
        </div>
      </div>
    );
  }

  if (emergencyProviders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No hay prestadores de emergencia disponibles
        </h3>
        <p className="text-gray-600 mb-4">
          No encontramos prestadores que voluntariamente ofrezcan servicios de emergencia 24/7 
          para {serviceType} en tu área.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-blue-800">
            <strong>Sugerencia:</strong> Intenta ampliar tu área de búsqueda o busca prestadores 
            regulares que puedan estar disponibles durante el día.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <h2 className="text-xl font-bold text-red-800">
            Prestadores de Emergencia Disponibles
          </h2>
        </div>
        <p className="text-red-700 text-sm">
          Estos prestadores se han registrado <strong>voluntariamente</strong> para ofrecer servicios 
          de emergencia 24/7. Los precios incluyen sobrecargo por urgencia.
        </p>
        <div className="mt-3 flex items-center space-x-4 text-sm text-red-600">
          <span>• {emergencyProviders.length} prestadores disponibles</span>
          <span>• Nivel de urgencia: {urgencyLevel === 'critical' ? 'Crítico' : 'Alto'}</span>
          <span>• Área de búsqueda: {urgencyLevel === 'critical' ? '10' : '20'} km</span>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {emergencyProviders.map(provider => (
          <EmergencyProviderCard key={provider.providerId} provider={provider} />
        ))}
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-3">Información Importante</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Los precios mostrados son finales e incluyen el sobrecargo de emergencia</li>
          <li>• Los prestadores han elegido voluntariamente ofrecer servicios de emergencia</li>
          <li>• El tiempo de respuesta es estimado y puede variar según las condiciones</li>
          <li>• Solo solicita emergencias cuando realmente las necesites</li>
          <li>• Recibirás actualizaciones en tiempo real del estado de tu solicitud</li>
        </ul>
      </div>

      {/* Confirmation Modal */}
      {confirmationRequired && <ConfirmationModal />}
    </div>
  );
};

export default EmergencyProviderSearch;