import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, DollarSign, Save, Eye, Users, Zap } from 'lucide-react';

const EmergencyServiceConfig = ({ providerId, onUpdate }) => {
  const [emergencyConfig, setEmergencyConfig] = useState({
    enabled: false,
    customSurcharge: 50,
    availableNow: false,
    emergencyTypes: [],
    responseTime: '30',
    maxDistance: 15,
    description: ''
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const emergencyTypeOptions = [
    { id: 'plumbing', label: 'Plomería (fugas, inundaciones)', icon: '🚿' },
    { id: 'electrical', label: 'Electricidad (cortes de luz, cortocircuitos)', icon: '⚡' },
    { id: 'locksmith', label: 'Cerrajería (llaves perdidas, puertas rotas)', icon: '🔒' },
    { id: 'appliance', label: 'Electrodomésticos (refrigerador, lavadora)', icon: '🔧' },
    { id: 'hvac', label: 'Clima (aire acondicionado, calefacción)', icon: '❄️' },
    { id: 'cleaning', label: 'Limpieza (inundaciones, derrames)', icon: '🧹' },
    { id: 'security', label: 'Seguridad (alarmas, cámaras)', icon: '🔒' },
    { id: 'glass', label: 'Cristales (ventanas rotas)', icon: '🪟' }
  ];

  useEffect(() => {
    loadEmergencyConfig();
  }, [providerId]);

  const loadEmergencyConfig = async () => {
    try {
      const response = await fetch(`/api/providers/${providerId}/emergency-config`);
      if (response.ok) {
        const config = await response.json();
        setEmergencyConfig(config);
      }
    } catch (error) {
      console.error('Error loading emergency config:', error);
    }
  };

  const handleToggleEmergency = (enabled) => {
    setEmergencyConfig(prev => ({
      ...prev,
      enabled,
      availableNow: enabled ? prev.availableNow : false
    }));
  };

  const handleSurchargeChange = (value) => {
    setEmergencyConfig(prev => ({
      ...prev,
      customSurcharge: Math.max(20, Math.min(200, value))
    }));
  };

  const handleEmergencyTypeToggle = (typeId) => {
    setEmergencyConfig(prev => ({
      ...prev,
      emergencyTypes: prev.emergencyTypes.includes(typeId)
        ? prev.emergencyTypes.filter(id => id !== typeId)
        : [...prev.emergencyTypes, typeId]
    }));
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/providers/${providerId}/emergency-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emergencyConfig)
      });

      if (response.ok) {
        onUpdate?.(emergencyConfig);
        
        // Show success message
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg z-50';
        toast.textContent = 'Configuración de emergencias guardada exitosamente';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    } catch (error) {
      console.error('Error saving emergency config:', error);
      
      // Show error message
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50';
      toast.textContent = 'Error al guardar configuración';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setSaving(false);
    }
  };

  const PreviewCard = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="bg-red-500 text-white px-2 py-1 text-xs font-bold rounded">
            EMERGENCIA 24/7
          </span>
        </div>
        <span className="text-red-600 font-bold">+{emergencyConfig.customSurcharge}%</span>
      </div>
      
      <h3 className="font-semibold text-gray-900 mb-1">Tu Nombre - Prestador</h3>
      <p className="text-sm text-gray-600 mb-2">
        Respuesta estimada: {emergencyConfig.responseTime} minutos
      </p>
      
      <div className="text-sm text-gray-700 mb-3">
        <div className="flex justify-between">
          <span>Servicio base:</span>
          <span>$500</span>
        </div>
        <div className="flex justify-between text-red-600 font-medium">
          <span>Sobrecargo emergencia (+{emergencyConfig.customSurcharge}%):</span>
          <span>$${Math.round(500 * emergencyConfig.customSurcharge / 100)}</span>
        </div>
        <div className="border-t pt-1 flex justify-between font-bold">
          <span>Total:</span>
          <span>$${500 + Math.round(500 * emergencyConfig.customSurcharge / 100)}</span>
        </div>
      </div>
      
      <button className="w-full bg-red-500 text-white py-2 rounded font-medium hover:bg-red-600 transition-colors">
        Solicitar Emergencia
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Servicios de Emergencia 24/7</h2>
            <p className="text-gray-600">Configura tu disponibilidad para emergencias</p>
          </div>
        </div>

        {/* Toggle Principal */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Zap className="w-8 h-8 text-blue-500" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Ofrecer servicios de emergencia 24/7
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Aparecerás en búsquedas de emergencia y podrás recibir solicitudes urgentes
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emergencyConfig.enabled}
                onChange={(e) => handleToggleEmergency(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-16 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-8 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {emergencyConfig.enabled && (
          <div className="space-y-6">
            {/* Sobrecargo Personalizado */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <DollarSign className="w-6 h-6 text-green-500" />
                <h3 className="text-lg font-semibold">Sobrecargo por Emergencia</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700 w-20">Sobrecargo:</span>
                  <div className="flex-1">
                    <input
                      type="range"
                      min="20"
                      max="200"
                      step="5"
                      value={emergencyConfig.customSurcharge}
                      onChange={(e) => handleSurchargeChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>20%</span>
                      <span>50%</span>
                      <span>100%</span>
                      <span>200%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-green-600">
                      +{emergencyConfig.customSurcharge}%
                    </span>
                    <p className="text-xs text-gray-500">sobre precio base</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Ejemplo de precio:</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Servicio base:</span>
                      <span>$500</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Sobrecargo emergencia:</span>
                      <span>+$${Math.round(500 * emergencyConfig.customSurcharge / 100)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-bold">
                      <span>Total emergencia:</span>
                      <span>$${500 + Math.round(500 * emergencyConfig.customSurcharge / 100)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tipos de Emergencia */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Users className="w-6 h-6 text-purple-500" />
                <h3 className="text-lg font-semibold">Tipos de Emergencia que Atiendes</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {emergencyTypeOptions.map(type => (
                  <label key={type.id} className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={emergencyConfig.emergencyTypes.includes(type.id)}
                      onChange={() => handleEmergencyTypeToggle(type.id)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-lg">{type.icon}</span>
                    <span className="text-sm text-gray-700">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Configuración Adicional */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Clock className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-semibold">Configuración de Respuesta</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiempo estimado de respuesta (minutos)
                  </label>
                  <select
                    value={emergencyConfig.responseTime}
                    onChange={(e) => setEmergencyConfig(prev => ({ ...prev, responseTime: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="45">45 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="90">1.5 horas</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Distancia máxima (km)
                  </label>
                  <select
                    value={emergencyConfig.maxDistance}
                    onChange={(e) => setEmergencyConfig(prev => ({ ...prev, maxDistance: parseInt(e.target.value) }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="5">5 km</option>
                    <option value="10">10 km</option>
                    <option value="15">15 km</option>
                    <option value="20">20 km</option>
                    <option value="25">25 km</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Toggle de Disponibilidad Inmediata */}
            <div className="border rounded-lg p-6 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-4 h-4 rounded-full ${emergencyConfig.availableNow ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Disponible para emergencias AHORA
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Activa esto solo cuando estés realmente disponible para atender emergencias
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emergencyConfig.availableNow}
                    onChange={(e) => setEmergencyConfig(prev => ({ ...prev, availableNow: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                </label>
              </div>
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Eye className="w-6 h-6 text-gray-500" />
                  <h3 className="text-lg font-semibold">Vista Previa</h3>
                </div>
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {previewMode ? 'Ocultar' : 'Ver'} cómo apareces
                </button>
              </div>
              
              {previewMode && (
                <div className="max-w-sm">
                  <p className="text-sm text-gray-600 mb-3">
                    Así aparecerás en las búsquedas de emergencia:
                  </p>
                  <PreviewCard />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span>Vista Previa</span>
          </button>
          
          <button
            onClick={saveConfiguration}
            disabled={saving || (!emergencyConfig.enabled)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
          </button>
        </div>
      </div>

      {/* Información Importante */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-800 mb-2">Información Importante</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Solo aparecerás en búsquedas de emergencia cuando tengas esta función activada</li>
              <li>• Los usuarios verán claramente tu sobrecargo antes de solicitar el servicio</li>
              <li>• Puedes pausar temporalmente sin perder tu configuración</li>
              <li>• Las emergencias requieren respuesta rápida - asegúrate de estar disponible</li>
              <li>• El sobrecargo se aplica sobre el precio base de cada servicio</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyServiceConfig;