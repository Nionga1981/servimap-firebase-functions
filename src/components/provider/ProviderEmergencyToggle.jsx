import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, DollarSign, Settings as SettingsIcon } from 'lucide-react';

const ProviderEmergencyToggle = ({ providerId, onConfigChange }) => {
  const [emergencyConfig, setEmergencyConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showFullConfig, setShowFullConfig] = useState(false);

  useEffect(() => {
    loadEmergencyConfig();
  }, [providerId]);

  const loadEmergencyConfig = async () => {
    try {
      const response = await fetch(`/api/providers/${providerId}/emergency-config`);
      if (response.ok) {
        const config = await response.json();
        setEmergencyConfig(config);
      } else {
        // Si no tiene configuración, usar valores por defecto
        setEmergencyConfig({
          enabled: false,
          customSurcharge: 50,
          availableNow: false,
          emergencyTypes: [],
          responseTime: '30',
          maxDistance: 15,
          description: ''
        });
      }
    } catch (error) {
      console.error('Error loading emergency config:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (availableNow) => {
    if (!emergencyConfig?.enabled) {
      setShowFullConfig(true);
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`/api/providers/${providerId}/emergency-availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableNow })
      });

      if (response.ok) {
        setEmergencyConfig(prev => ({ ...prev, availableNow }));
        onConfigChange?.({ ...emergencyConfig, availableNow });
        
        // Show success toast
        const message = availableNow ? 
          'Ahora apareces disponible para emergencias' : 
          'Ya no apareces disponible para emergencias';
        showToast(message, 'success');
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
      showToast('Error al actualizar disponibilidad', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const showToast = (message, type) => {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 bg-gray-300 rounded"></div>
          <div className="h-4 bg-gray-300 rounded flex-1"></div>
        </div>
      </div>
    );
  }

  if (!emergencyConfig?.enabled) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                Servicios de Emergencia 24/7
              </h3>
              <p className="text-blue-700 text-sm">
                Configura tu disponibilidad para atender emergencias y aumenta tus ingresos
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFullConfig(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Configurar</span>
          </button>
        </div>
        
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-lg p-3">
            <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <p className="text-sm font-medium text-gray-900">Sobrecargo</p>
            <p className="text-xs text-gray-600">Personalizado</p>
          </div>
          <div className="bg-white rounded-lg p-3">
            <Clock className="w-6 h-6 text-blue-500 mx-auto mb-1" />
            <p className="text-sm font-medium text-gray-900">24/7</p>
            <p className="text-xs text-gray-600">Cuando quieras</p>
          </div>
          <div className="bg-white rounded-lg p-3">
            <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1" />
            <p className="text-sm font-medium text-gray-900">Urgentes</p>
            <p className="text-xs text-gray-600">Prioridad alta</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border-l-4 border-red-500">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${emergencyConfig.availableNow ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span>Emergencias 24/7</span>
                <span className="bg-red-500 text-white px-2 py-1 text-xs font-bold rounded">
                  +{emergencyConfig.customSurcharge}%
                </span>
              </h3>
              <p className="text-sm text-gray-600">
                {emergencyConfig.availableNow ? 
                  'Disponible para emergencias ahora' : 
                  'No disponible para emergencias'
                }
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowFullConfig(true)}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick Toggle */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">
              Disponible para emergencias AHORA
            </h4>
            <p className="text-sm text-gray-600">
              Activa solo cuando puedas atender emergencias inmediatamente
            </p>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={emergencyConfig.availableNow}
              onChange={(e) => toggleAvailability(e.target.checked)}
              disabled={updating}
              className="sr-only peer"
            />
            <div className={`w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500 ${updating ? 'opacity-50' : ''}`}></div>
          </label>
        </div>

        {/* Status Info */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Sobrecargo:</span>
              <p className="font-medium text-red-600">+{emergencyConfig.customSurcharge}%</p>
            </div>
            <div>
              <span className="text-gray-600">Respuesta:</span>
              <p className="font-medium">{emergencyConfig.responseTime} min</p>
            </div>
            <div>
              <span className="text-gray-600">Distancia:</span>
              <p className="font-medium">{emergencyConfig.maxDistance} km</p>
            </div>
            <div>
              <span className="text-gray-600">Tipos:</span>
              <p className="font-medium">{emergencyConfig.emergencyTypes?.length || 0} configurados</p>
            </div>
          </div>
        </div>

        {/* Warning when available */}
        {emergencyConfig.availableNow && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Estás disponible para emergencias</p>
                <p>Mantente alerta para solicitudes urgentes. Respuesta requerida en {emergencyConfig.responseTime} minutos.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full Configuration Modal */}
      {showFullConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Configuración de Emergencias</h2>
                <button
                  onClick={() => setShowFullConfig(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Aquí iría el componente EmergencyServiceConfig completo */}
              <div className="text-center py-8">
                <p className="text-gray-600">
                  Configuración completa de emergencias se abrirá aquí
                </p>
                <button
                  onClick={() => setShowFullConfig(false)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderEmergencyToggle;