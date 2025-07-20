import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../../lib/firebase';

const EmergencyServiceRequest = ({ onRequestSubmitted }) => {
  const [emergencyRequest, setEmergencyRequest] = useState({
    title: '',
    description: '',
    urgencyLevel: 'high',
    categoryId: '',
    location: {
      type: 'address',
      address: '',
      coordinates: null
    },
    estimatedDuration: 60,
    maxBudget: 500,
    contactPhone: '',
    preferredResponse: 'call'
  });

  const [nearbyProviders, setNearbyProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const urgencyLevels = [
    {
      value: 'critical',
      label: 'Crítica',
      icon: '🆘',
      color: '#dc2626',
      description: 'Peligro inmediato, respuesta en 5-15 min',
      responseTime: '5-15 min'
    },
    {
      value: 'high',
      label: 'Alta',
      icon: '🚨',
      color: '#ea580c',
      description: 'Urgente, respuesta en 15-30 min',
      responseTime: '15-30 min'
    },
    {
      value: 'medium',
      label: 'Media',
      icon: '⚠️',
      color: '#d97706',
      description: 'Importante, respuesta en 30-60 min',
      responseTime: '30-60 min'
    }
  ];

  const emergencyCategories = [
    { id: 'plumbing', label: 'Plomería', icon: '🔧' },
    { id: 'electrical', label: 'Electricidad', icon: '⚡' },
    { id: 'security', label: 'Seguridad', icon: '🔒' },
    { id: 'medical', label: 'Médico', icon: '🏥' },
    { id: 'automotive', label: 'Automotriz', icon: '🚗' },
    { id: 'locksmith', label: 'Cerrajería', icon: '🔑' },
    { id: 'pest', label: 'Control de Plagas', icon: '🐛' },
    { id: 'cleaning', label: 'Limpieza Urgente', icon: '🧽' }
  ];

  useEffect(() => {
    // Obtener ubicación del usuario para servicios cercanos
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setEmergencyRequest(prev => ({
            ...prev,
            location: {
              ...prev.location,
              coordinates: { latitude, longitude }
            }
          }));
          loadNearbyProviders(latitude, longitude);
        },
        (error) => {
          console.error('Error obteniendo ubicación:', error);
        }
      );
    }
  }, []);

  const loadNearbyProviders = async (lat, lng) => {
    try {
      // En una implementación real, buscaría proveedores cercanos
      // Datos simulados para demo
      setNearbyProviders([
        {
          id: '1',
          name: 'Juan Pérez - Plomero de Emergencia',
          category: 'plumbing',
          rating: 4.9,
          responseTime: '10 min',
          distance: '0.5 km',
          available: true,
          emergencyRate: 150
        },
        {
          id: '2',
          name: 'Electricistas 24/7',
          category: 'electrical',
          rating: 4.8,
          responseTime: '15 min',
          distance: '1.2 km',
          available: true,
          emergencyRate: 200
        },
        {
          id: '3',
          name: 'Seguridad Total',
          category: 'security',
          rating: 4.7,
          responseTime: '8 min',
          distance: '0.8 km',
          available: true,
          emergencyRate: 180
        }
      ]);
    } catch (error) {
      console.error('Error cargando proveedores:', error);
    }
  };

  const handleSubmitEmergencyRequest = async () => {
    if (!emergencyRequest.title.trim() || !emergencyRequest.categoryId || !emergencyRequest.location.address) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setShowConfirmation(true);
  };

  const confirmEmergencyRequest = async () => {
    setLoading(true);
    setShowConfirmation(false);

    try {
      const requestEmergencyService = httpsCallable(functions, 'requestEmergencyService');
      
      const result = await requestEmergencyService({
        emergencyDetails: emergencyRequest,
        estimatedProviders: nearbyProviders.length
      });

      if (result.data.success) {
        setRequestStatus({
          id: result.data.emergencyId,
          status: 'notifying_providers',
          estimatedResponse: result.data.estimatedResponseTime,
          notifiedProviders: result.data.notifiedProviders
        });

        // Simular actualización de estado
        setTimeout(() => {
          setRequestStatus(prev => ({
            ...prev,
            status: 'provider_found',
            assignedProvider: {
              name: 'Juan Pérez - Plomero',
              phone: '+52 55 1234 5678',
              eta: '12 minutos'
            }
          }));
        }, 3000);

        onRequestSubmitted && onRequestSubmitted(result.data.emergencyId);
      }
    } catch (error) {
      console.error('Error enviando solicitud de emergencia:', error);
      alert(`❌ Error: ${error.message}`);
      setLoading(false);
    }
  };

  const getUrgencyInfo = (level) => {
    return urgencyLevels.find(u => u.value === level) || urgencyLevels[1];
  };

  const getCategoryInfo = (categoryId) => {
    return emergencyCategories.find(c => c.id === categoryId) || emergencyCategories[0];
  };

  if (requestStatus) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          {requestStatus.status === 'notifying_providers' && (
            <>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🚨</div>
              <h2 style={{ color: '#1f2937', marginBottom: '16px' }}>
                Notificando Proveedores
              </h2>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                Enviando alertas a {requestStatus.notifiedProviders} proveedores cercanos...
              </p>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #ef4444',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
              <p style={{ color: '#6b7280', marginTop: '16px', fontSize: '14px' }}>
                Tiempo estimado de respuesta: {requestStatus.estimatedResponse}
              </p>
            </>
          )}

          {requestStatus.status === 'provider_found' && (
            <>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
              <h2 style={{ color: '#059669', marginBottom: '16px' }}>
                ¡Proveedor Asignado!
              </h2>
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #3ce923',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h3 style={{ color: '#1f2937', marginBottom: '8px' }}>
                  {requestStatus.assignedProvider.name}
                </h3>
                <p style={{ color: '#6b7280', marginBottom: '12px' }}>
                  📞 {requestStatus.assignedProvider.phone}
                </p>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#059669'
                }}>
                  🕐 Llegada estimada: {requestStatus.assignedProvider.eta}
                </div>
              </div>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                El proveedor se pondrá en contacto contigo inmediatamente
              </p>
            </>
          )}
        </div>

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* Premium Badge */}
      <div style={{
        backgroundColor: '#ef4444',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '12px',
        marginBottom: '24px',
        textAlign: 'center',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '20px' }}>🚨</span>
        Servicio Premium - Emergencias 24/7
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ color: '#1f2937', marginBottom: '16px' }}>
              Confirmar Solicitud de Emergencia
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>
              Se notificará inmediatamente a proveedores cercanos. Este servicio tiene un costo adicional por emergencia.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowConfirmation(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmEmergencyRequest}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Confirmar Emergencia
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ 
          color: '#1f2937', 
          marginBottom: '8px',
          fontSize: '28px',
          fontWeight: 'bold'
        }}>
          🚨 Solicitar Servicio de Emergencia
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>
          Atención inmediata 24/7 para situaciones urgentes
        </p>

        {/* Urgency Level */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
            🎯 Nivel de Urgencia
          </h3>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {urgencyLevels.map((level) => {
              const isSelected = emergencyRequest.urgencyLevel === level.value;
              return (
                <button
                  key={level.value}
                  onClick={() => setEmergencyRequest(prev => ({ ...prev, urgencyLevel: level.value }))}
                  style={{
                    padding: '16px',
                    border: '2px solid',
                    borderColor: isSelected ? level.color : '#e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? `${level.color}10` : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.3s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>{level.icon}</span>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                          {level.label}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          {level.description}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: level.color,
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {level.responseTime}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Selection */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
            🔧 Categoría del Problema
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            {emergencyCategories.map((category) => {
              const isSelected = emergencyRequest.categoryId === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setEmergencyRequest(prev => ({ ...prev, categoryId: category.id }))}
                  style={{
                    padding: '16px',
                    border: '2px solid',
                    borderColor: isSelected ? '#ef4444' : '#e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? '#fef2f2' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.3s'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{category.icon}</div>
                  <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '14px' }}>
                    {category.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Emergency Details */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
            📝 Detalles de la Emergencia
          </h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Título de la Emergencia *
              </label>
              <input
                type="text"
                value={emergencyRequest.title}
                onChange={(e) => setEmergencyRequest(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Fuga de agua grave en cocina"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Descripción Detallada *
              </label>
              <textarea
                value={emergencyRequest.description}
                onChange={(e) => setEmergencyRequest(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe la situación urgente con el mayor detalle posible..."
                rows="4"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Dirección Exacta *
              </label>
              <input
                type="text"
                value={emergencyRequest.location.address}
                onChange={(e) => setEmergencyRequest(prev => ({
                  ...prev,
                  location: { ...prev.location, address: e.target.value }
                }))}
                placeholder="Dirección completa para localización rápida"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Duración Estimada
                </label>
                <select
                  value={emergencyRequest.estimatedDuration}
                  onChange={(e) => setEmergencyRequest(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                >
                  <option value={30}>30 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={120}>2 horas</option>
                  <option value={180}>3 horas</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Presupuesto Máximo
                </label>
                <input
                  type="number"
                  value={emergencyRequest.maxBudget}
                  onChange={(e) => setEmergencyRequest(prev => ({ ...prev, maxBudget: parseInt(e.target.value) }))}
                  min="100"
                  step="50"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Teléfono de Contacto *
                </label>
                <input
                  type="tel"
                  value={emergencyRequest.contactPhone}
                  onChange={(e) => setEmergencyRequest(prev => ({ ...prev, contactPhone: e.target.value }))}
                  placeholder="+52 55 1234 5678"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Nearby Providers */}
        {nearbyProviders.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              📍 Proveedores Cercanos Disponibles
            </h3>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              {nearbyProviders.slice(0, 3).map((provider) => (
                <div key={provider.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      {provider.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      ⭐ {provider.rating} • 📍 {provider.distance} • ⏱️ {provider.responseTime}
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: '#3ce923',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    DISPONIBLE
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Submit Button */}
        <button
          onClick={handleSubmitEmergencyRequest}
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: loading ? '#9ca3af' : '#ef4444',
            color: 'white',
            padding: '20px',
            border: 'none',
            borderRadius: '12px',
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
        >
          <span style={{ fontSize: '24px' }}>🚨</span>
          {loading ? 'Enviando Alerta...' : `SOLICITAR EMERGENCIA - ${getUrgencyInfo(emergencyRequest.urgencyLevel).responseTime}`}
        </button>

        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#92400e', fontWeight: '600', marginBottom: '4px' }}>
            ⚠️ Importante
          </div>
          <div style={{ fontSize: '14px', color: '#92400e' }}>
            Los servicios de emergencia tienen un costo adicional por urgencia y disponibilidad 24/7
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyServiceRequest;