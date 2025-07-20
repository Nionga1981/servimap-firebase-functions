import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../../lib/firebase';

const RecurringServiceManager = ({ onServiceCreated }) => {
  const [recurringServices, setRecurringServices] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newService, setNewService] = useState({
    title: '',
    description: '',
    providerId: '',
    categoryId: '',
    frequency: 'weekly',
    dayOfWeek: 1,
    startTime: '09:00',
    duration: 60,
    basePrice: 150,
    location: {
      type: 'address',
      address: ''
    },
    endDate: '',
    isActive: true
  });

  const frequencyOptions = [
    { value: 'weekly', label: 'Semanal', icon: '📅' },
    { value: 'biweekly', label: 'Quincenal', icon: '📆' },
    { value: 'monthly', label: 'Mensual', icon: '🗓️' },
    { value: 'bimonthly', label: 'Bimestral', icon: '📊' }
  ];

  const daysOfWeek = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
  ];

  useEffect(() => {
    loadRecurringServices();
  }, []);

  const loadRecurringServices = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      // En una implementación real, obtendría los servicios del usuario
      // Datos simulados para demo
      setRecurringServices([
        {
          id: '1',
          title: 'Limpieza semanal',
          description: 'Limpieza completa del hogar',
          frequency: 'weekly',
          dayOfWeek: 1,
          startTime: '10:00',
          duration: 120,
          basePrice: 200,
          isActive: true,
          nextExecution: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
          id: '2',
          title: 'Mantenimiento de jardín',
          description: 'Poda y riego de plantas',
          frequency: 'biweekly',
          dayOfWeek: 6,
          startTime: '08:00',
          duration: 180,
          basePrice: 300,
          isActive: false,
          nextExecution: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        }
      ]);
    } catch (error) {
      console.error('Error cargando servicios recurrentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecurringService = async () => {
    if (!newService.title.trim() || !newService.providerId || !newService.endDate) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      const manageRecurringServices = httpsCallable(functions, 'manageRecurringServices');
      
      const result = await manageRecurringServices({
        action: 'create',
        serviceData: {
          ...newService,
          endDate: new Date(newService.endDate).toISOString()
        }
      });

      if (result.data.success) {
        alert('🎉 ¡Servicio recurrente creado exitosamente!');
        setShowCreateForm(false);
        setNewService({
          title: '',
          description: '',
          providerId: '',
          categoryId: '',
          frequency: 'weekly',
          dayOfWeek: 1,
          startTime: '09:00',
          duration: 60,
          basePrice: 150,
          location: { type: 'address', address: '' },
          endDate: '',
          isActive: true
        });
        loadRecurringServices();
        onServiceCreated && onServiceCreated(result.data.serviceId);
      }
    } catch (error) {
      console.error('Error creando servicio recurrente:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = async (serviceId, isActive) => {
    try {
      const manageRecurringServices = httpsCallable(functions, 'manageRecurringServices');
      
      const result = await manageRecurringServices({
        action: isActive ? 'pause' : 'resume',
        serviceId
      });

      if (result.data.success) {
        setRecurringServices(prev => 
          prev.map(service => 
            service.id === serviceId 
              ? { ...service, isActive: !isActive }
              : service
          )
        );
        alert(`✅ Servicio ${isActive ? 'pausado' : 'reactivado'} exitosamente`);
      }
    } catch (error) {
      console.error('Error actualizando servicio:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este servicio recurrente?')) {
      return;
    }

    try {
      const manageRecurringServices = httpsCallable(functions, 'manageRecurringServices');
      
      const result = await manageRecurringServices({
        action: 'delete',
        serviceId
      });

      if (result.data.success) {
        setRecurringServices(prev => prev.filter(service => service.id !== serviceId));
        alert('✅ Servicio eliminado exitosamente');
      }
    } catch (error) {
      console.error('Error eliminando servicio:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  const getFrequencyLabel = (frequency) => {
    const option = frequencyOptions.find(opt => opt.value === frequency);
    return option ? `${option.icon} ${option.label}` : frequency;
  };

  const getDayName = (dayOfWeek) => {
    const day = daysOfWeek.find(d => d.value === dayOfWeek);
    return day ? day.label : 'Desconocido';
  };

  const formatNextExecution = (date) => {
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      {/* Premium Badge */}
      <div style={{
        backgroundColor: '#ac7afc',
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
        <span style={{ fontSize: '20px' }}>👑</span>
        Función Premium - Servicios Recurrentes
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ 
              color: '#1f2937', 
              marginBottom: '8px',
              fontSize: '28px',
              fontWeight: 'bold'
            }}>
              🔄 Servicios Recurrentes
            </h2>
            <p style={{ color: '#6b7280', margin: 0 }}>
              Automatiza tus servicios regulares con programación inteligente
            </p>
          </div>
          
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              backgroundColor: '#ac7afc',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '20px' }}>+</span>
            Crear Servicio
          </button>
        </div>

        {/* Create Form Modal */}
        {showCreateForm && (
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
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <h3 style={{ color: '#1f2937', marginBottom: '24px', fontSize: '20px' }}>
                Crear Servicio Recurrente
              </h3>

              <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                    Título del Servicio *
                  </label>
                  <input
                    type="text"
                    value={newService.title}
                    onChange={(e) => setNewService(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ej: Limpieza semanal"
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
                    Descripción
                  </label>
                  <textarea
                    value={newService.description}
                    onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe el servicio..."
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                      Frecuencia *
                    </label>
                    <select
                      value={newService.frequency}
                      onChange={(e) => setNewService(prev => ({ ...prev, frequency: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    >
                      {frequencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                      Día de la Semana *
                    </label>
                    <select
                      value={newService.dayOfWeek}
                      onChange={(e) => setNewService(prev => ({ ...prev, dayOfWeek: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    >
                      {daysOfWeek.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                      Hora de Inicio *
                    </label>
                    <input
                      type="time"
                      value={newService.startTime}
                      onChange={(e) => setNewService(prev => ({ ...prev, startTime: e.target.value }))}
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
                      Duración (min)
                    </label>
                    <select
                      value={newService.duration}
                      onChange={(e) => setNewService(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    >
                      <option value={60}>1 hora</option>
                      <option value={120}>2 horas</option>
                      <option value={180}>3 horas</option>
                      <option value={240}>4 horas</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                      Precio Base ($)
                    </label>
                    <input
                      type="number"
                      value={newService.basePrice}
                      onChange={(e) => setNewService(prev => ({ ...prev, basePrice: parseInt(e.target.value) }))}
                      min="50"
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

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                    Fecha de Finalización *
                  </label>
                  <input
                    type="date"
                    value={newService.endDate}
                    onChange={(e) => setNewService(prev => ({ ...prev, endDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
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
                    Dirección del Servicio *
                  </label>
                  <input
                    type="text"
                    value={newService.location.address}
                    onChange={(e) => setNewService(prev => ({ 
                      ...prev, 
                      location: { ...prev.location, address: e.target.value }
                    }))}
                    placeholder="Dirección completa donde se realizará el servicio"
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

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowCreateForm(false)}
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
                  onClick={handleCreateRecurringService}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: loading ? '#9ca3af' : '#ac7afc',
                    color: 'white',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Creando...' : 'Crear Servicio'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Services List */}
        {loading && !showCreateForm ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #ac7afc',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}></div>
            <p style={{ color: '#6b7280', marginTop: '12px' }}>Cargando servicios...</p>
          </div>
        ) : recurringServices.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #d1d5db'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔄</div>
            <h3 style={{ color: '#1f2937', marginBottom: '8px' }}>
              No tienes servicios recurrentes
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>
              Crea tu primer servicio recurrente para automatizar tus necesidades regulares
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                backgroundColor: '#ac7afc',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Crear Primer Servicio
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {recurringServices.map((service) => (
              <div key={service.id} style={{
                backgroundColor: service.isActive ? '#f0fdf4' : '#f9fafb',
                border: `2px solid ${service.isActive ? '#3ce923' : '#d1d5db'}`,
                borderRadius: '12px',
                padding: '24px',
                transition: 'all 0.3s'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ color: '#1f2937', margin: 0, fontSize: '18px' }}>
                        {service.title}
                      </h3>
                      <span style={{
                        backgroundColor: service.isActive ? '#3ce923' : '#6b7280',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {service.isActive ? 'ACTIVO' : 'PAUSADO'}
                      </span>
                    </div>
                    <p style={{ color: '#6b7280', margin: '0 0 12px 0' }}>
                      {service.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleToggleService(service.id, service.isActive)}
                      style={{
                        backgroundColor: service.isActive ? '#f59e0b' : '#3ce923',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {service.isActive ? 'Pausar' : 'Reactivar'}
                    </button>
                    <button
                      onClick={() => handleDeleteService(service.id)}
                      style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  backgroundColor: 'white',
                  padding: '16px',
                  borderRadius: '8px'
                }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      FRECUENCIA
                    </span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>
                      {getFrequencyLabel(service.frequency)}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      DÍA Y HORA
                    </span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>
                      {getDayName(service.dayOfWeek)} a las {service.startTime}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      DURACIÓN
                    </span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>
                      {service.duration} minutos
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      PRECIO
                    </span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>
                      ${service.basePrice}
                    </span>
                  </div>
                </div>

                {service.isActive && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '14px', color: '#92400e', fontWeight: '600' }}>
                      ⏰ Próxima ejecución:
                    </div>
                    <div style={{ fontSize: '14px', color: '#92400e' }}>
                      {formatNextExecution(service.nextExecution)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
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
};

export default RecurringServiceManager;