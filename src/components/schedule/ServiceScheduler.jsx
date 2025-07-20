import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../../lib/firebase';

const ServiceScheduler = ({ providerId, serviceCategory, onBookingComplete }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [serviceDetails, setServiceDetails] = useState({
    title: '',
    description: '',
    duration: 60,
    serviceType: 'scheduled'
  });
  const [loading, setLoading] = useState(false);
  const [userLimits, setUserLimits] = useState({ isPremium: false, remainingBookings: 15 });
  const [showPremiumUpgrade, setShowPremiumUpgrade] = useState(false);

  useEffect(() => {
    if (providerId) {
      loadAvailability();
      checkUserStatus();
    }
  }, [providerId, selectedDate]);

  const checkUserStatus = async () => {
    try {
      // Simular verificación de estado del usuario
      const user = auth.currentUser;
      if (user) {
        // En una implementación real, obtendría esto del perfil del usuario
        setUserLimits({
          isPremium: false, // Cambiar según el usuario real
          remainingBookings: 12,
          maxAdvanceDays: 30
        });
      }
    } catch (error) {
      console.error('Error verificando estado del usuario:', error);
    }
  };

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const getProviderAvailability = httpsCallable(functions, 'getProviderAvailability');
      
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 7); // Una semana
      
      const result = await getProviderAvailability({
        providerId,
        startDate: selectedDate.toISOString(),
        endDate: endDate.toISOString()
      });

      if (result.data.success) {
        setAvailableSlots(result.data.availableSlots || []);
      }
    } catch (error) {
      console.error('Error cargando disponibilidad:', error);
      // Datos simulados para demo
      setAvailableSlots([
        { date: selectedDate.toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', available: true },
        { date: selectedDate.toISOString().split('T')[0], startTime: '10:00', endTime: '11:00', available: true },
        { date: selectedDate.toISOString().split('T')[0], startTime: '14:00', endTime: '15:00', available: true },
        { date: selectedDate.toISOString().split('T')[0], startTime: '15:00', endTime: '16:00', available: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceTypeChange = (type) => {
    if ((type === 'recurring' || type === 'emergency') && !userLimits.isPremium) {
      setShowPremiumUpgrade(true);
      return;
    }
    setServiceDetails(prev => ({ ...prev, serviceType: type }));
  };

  const handleScheduleService = async () => {
    if (!selectedSlot || !serviceDetails.title.trim()) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      const scheduleService = httpsCallable(functions, 'scheduleService');
      
      const scheduledDateTime = new Date(`${selectedSlot.date}T${selectedSlot.startTime}`);
      
      const result = await scheduleService({
        providerId,
        serviceDetails: {
          ...serviceDetails,
          categoryId: serviceCategory,
          basePrice: 150,
          location: {
            type: 'address',
            address: '' // El usuario puede especificar
          }
        },
        scheduledFor: scheduledDateTime.toISOString(),
        timeSlot: {
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime
        },
        serviceType: serviceDetails.serviceType
      });

      if (result.data.success) {
        alert('🎉 ¡Servicio programado exitosamente!');
        onBookingComplete && onBookingComplete(result.data.bookingId);
        
        // Reset form
        setSelectedSlot(null);
        setServiceDetails({
          title: '',
          description: '',
          duration: 60,
          serviceType: 'scheduled'
        });
        
        // Recargar disponibilidad
        loadAvailability();
      }
    } catch (error) {
      console.error('Error programando servicio:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTodaysSlots = () => {
    const today = selectedDate.toISOString().split('T')[0];
    return availableSlots.filter(slot => slot.date === today && slot.available);
  };

  const getServiceTypeInfo = (type) => {
    switch (type) {
      case 'immediate':
        return { icon: '⚡', label: 'Inmediato', desc: 'Disponible ahora', color: '#f59e0b' };
      case 'scheduled':
        return { icon: '📅', label: 'Programado', desc: 'Fecha específica', color: '#3ce923' };
      case 'recurring':
        return { icon: '🔄', label: 'Recurrente', desc: 'Automático (Premium)', color: '#ac7afc' };
      case 'emergency':
        return { icon: '🚨', label: 'Emergencia', desc: '24/7 (Premium)', color: '#ef4444' };
      default:
        return { icon: '📝', label: 'Servicio', desc: '', color: '#6b7280' };
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* Premium Upgrade Modal */}
      {showPremiumUpgrade && (
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
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👑</div>
            <h3 style={{ color: '#1f2937', marginBottom: '16px' }}>
              Función Premium Requerida
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>
              Los servicios recurrentes y de emergencia están disponibles solo para usuarios Premium.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowPremiumUpgrade(false)}
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
                onClick={() => window.location.href = '/premium'}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#FFD700',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Obtener Premium
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
          📅 Programar Servicio
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>
          Selecciona fecha, hora y detalles de tu servicio
        </p>

        {/* User Status */}
        <div style={{
          backgroundColor: userLimits.isPremium ? '#f0fdf4' : '#fef3c7',
          border: `1px solid ${userLimits.isPremium ? '#3ce923' : '#f59e0b'}`,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontWeight: '600', color: '#1f2937' }}>
              {userLimits.isPremium ? '👑 Premium' : '🆓 Gratuito'}
            </span>
            <span style={{ marginLeft: '12px', color: '#6b7280' }}>
              {userLimits.remainingBookings} servicios restantes este mes
            </span>
          </div>
          {!userLimits.isPremium && (
            <button
              onClick={() => window.location.href = '/premium'}
              style={{
                backgroundColor: '#FFD700',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Actualizar
            </button>
          )}
        </div>

        {/* Service Type Selection */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
            🎯 Tipo de Servicio
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '12px' 
          }}>
            {['immediate', 'scheduled', 'recurring', 'emergency'].map((type) => {
              const info = getServiceTypeInfo(type);
              const isSelected = serviceDetails.serviceType === type;
              const isPremiumFeature = type === 'recurring' || type === 'emergency';
              const isDisabled = isPremiumFeature && !userLimits.isPremium;

              return (
                <button
                  key={type}
                  onClick={() => handleServiceTypeChange(type)}
                  disabled={isDisabled}
                  style={{
                    padding: '16px',
                    border: '2px solid',
                    borderColor: isSelected ? info.color : '#e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? `${info.color}10` : isDisabled ? '#f9fafb' : 'transparent',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: isDisabled ? 0.6 : 1,
                    transition: 'all 0.3s',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px', marginRight: '8px' }}>{info.icon}</span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>{info.label}</span>
                    {isPremiumFeature && (
                      <span style={{
                        marginLeft: '8px',
                        backgroundColor: '#FFD700',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        PREMIUM
                      </span>
                    )}
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                    {info.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Service Details */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
            📝 Detalles del Servicio
          </h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Título del Servicio *
              </label>
              <input
                type="text"
                value={serviceDetails.title}
                onChange={(e) => setServiceDetails(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Reparación de fuga en cocina"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Descripción Detallada
              </label>
              <textarea
                value={serviceDetails.description}
                onChange={(e) => setServiceDetails(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe el problema o servicio que necesitas..."
                rows="3"
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
                Duración Estimada
              </label>
              <select
                value={serviceDetails.duration}
                onChange={(e) => setServiceDetails(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                style={{
                  width: '200px',
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
                <option value={240}>4 horas</option>
              </select>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        {serviceDetails.serviceType === 'scheduled' && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              📅 Seleccionar Fecha
            </h3>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <button
                onClick={() => {
                  const yesterday = new Date(selectedDate);
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSelectedDate(yesterday);
                }}
                style={{
                  padding: '8px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                ← Anterior
              </button>
              
              <div style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                {formatDate(selectedDate)}
              </div>
              
              <button
                onClick={() => {
                  const tomorrow = new Date(selectedDate);
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setSelectedDate(tomorrow);
                }}
                style={{
                  padding: '8px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Siguiente →
              </button>
            </div>

            {/* Available Time Slots */}
            <div>
              <h4 style={{ color: '#374151', marginBottom: '12px' }}>
                ⏰ Horarios Disponibles
              </h4>
              
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #e5e7eb',
                    borderTop: '3px solid #3ce923',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }}></div>
                  <p style={{ color: '#6b7280', marginTop: '12px' }}>Cargando disponibilidad...</p>
                </div>
              ) : getTodaysSlots().length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  border: '2px dashed #d1d5db'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
                  <p style={{ color: '#6b7280' }}>
                    No hay horarios disponibles para esta fecha
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '8px'
                }}>
                  {getTodaysSlots().map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '12px 8px',
                        border: '2px solid',
                        borderColor: selectedSlot === slot ? '#3ce923' : '#e5e7eb',
                        borderRadius: '8px',
                        backgroundColor: selectedSlot === slot ? '#f0fdf4' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.3s'
                      }}
                    >
                      {slot.startTime} - {slot.endTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule Button */}
        <button
          onClick={handleScheduleService}
          disabled={loading || !serviceDetails.title.trim() || (serviceDetails.serviceType === 'scheduled' && !selectedSlot)}
          style={{
            width: '100%',
            backgroundColor: loading ? '#9ca3af' : '#3ce923',
            color: 'white',
            padding: '16px',
            border: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #ffffff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Programando...
            </>
          ) : (
            `📅 Programar ${getServiceTypeInfo(serviceDetails.serviceType).label}`
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ServiceScheduler;