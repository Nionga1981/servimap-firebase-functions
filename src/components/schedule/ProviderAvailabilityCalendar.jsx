import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

const ProviderAvailabilityCalendar = ({ providerId, onAvailabilitySet }) => {
  const [weeklySchedule, setWeeklySchedule] = useState({
    monday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00', maxBookings: 8 }] },
    tuesday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00', maxBookings: 8 }] },
    wednesday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00', maxBookings: 8 }] },
    thursday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00', maxBookings: 8 }] },
    friday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00', maxBookings: 8 }] },
    saturday: { available: false, timeSlots: [] },
    sunday: { available: false, timeSlots: [] }
  });

  const [dateOverrides, setDateOverrides] = useState([]);
  const [settings, setSettings] = useState({
    advanceBookingDays: 30,
    minimumNoticeHours: 2,
    slotDurationMinutes: 60,
    allowEmergencyBookings: false,
    timeZone: 'America/Mexico_City'
  });

  const [loading, setLoading] = useState(false);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [newOverride, setNewOverride] = useState({
    date: '',
    available: false,
    reason: '',
    timeSlots: []
  });

  const daysOfWeek = [
    { key: 'monday', label: 'Lunes', icon: '📅' },
    { key: 'tuesday', label: 'Martes', icon: '📅' },
    { key: 'wednesday', label: 'Miércoles', icon: '📅' },
    { key: 'thursday', label: 'Jueves', icon: '📅' },
    { key: 'friday', label: 'Viernes', icon: '📅' },
    { key: 'saturday', label: 'Sábado', icon: '🎉' },
    { key: 'sunday', label: 'Domingo', icon: '🎉' }
  ];

  useEffect(() => {
    if (providerId) {
      loadExistingAvailability();
    }
  }, [providerId]);

  const loadExistingAvailability = async () => {
    try {
      // En una implementación real, cargaría la disponibilidad existente
      console.log('Cargando disponibilidad existente...');
    } catch (error) {
      console.error('Error cargando disponibilidad:', error);
    }
  };

  const handleDayAvailabilityChange = (day, available) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        available,
        timeSlots: available ? prev[day].timeSlots : []
      }
    }));
  };

  const handleTimeSlotChange = (day, slotIndex, field, value) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeSlots: prev[day].timeSlots.map((slot, index) =>
          index === slotIndex ? { ...slot, [field]: value } : slot
        )
      }
    }));
  };

  const addTimeSlot = (day) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeSlots: [
          ...prev[day].timeSlots,
          { startTime: '09:00', endTime: '17:00', maxBookings: 8 }
        ]
      }
    }));
  };

  const removeTimeSlot = (day, slotIndex) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeSlots: prev[day].timeSlots.filter((_, index) => index !== slotIndex)
      }
    }));
  };

  const handleAddOverride = () => {
    if (newOverride.date && newOverride.reason) {
      setDateOverrides(prev => [...prev, {
        ...newOverride,
        date: new Date(newOverride.date)
      }]);
      setNewOverride({
        date: '',
        available: false,
        reason: '',
        timeSlots: []
      });
      setShowAddOverride(false);
    }
  };

  const removeOverride = (index) => {
    setDateOverrides(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAvailability = async () => {
    setLoading(true);
    
    try {
      const setProviderAvailability = httpsCallable(functions, 'setProviderAvailability');
      
      const result = await setProviderAvailability({
        weeklySchedule,
        dateOverrides: dateOverrides.map(override => ({
          ...override,
          date: override.date
        })),
        settings
      });

      if (result.data.success) {
        alert('✅ Disponibilidad configurada exitosamente');
        onAvailabilitySet && onAvailabilitySet(result.data.availabilityId);
      }
    } catch (error) {
      console.error('Error guardando disponibilidad:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const DayScheduleCard = ({ day, dayData }) => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>{day.icon}</span>
          <h3 style={{ color: '#1f2937', fontWeight: '600', margin: 0 }}>
            {day.label}
          </h3>
        </div>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={dayData.available}
            onChange={(e) => handleDayAvailabilityChange(day.key, e.target.checked)}
            style={{ transform: 'scale(1.2)' }}
          />
          <span style={{ color: dayData.available ? '#059669' : '#6b7280', fontWeight: '500' }}>
            {dayData.available ? 'Disponible' : 'No disponible'}
          </span>
        </label>
      </div>

      {dayData.available && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#374151', fontWeight: '500' }}>Horarios</span>
            <button
              onClick={() => addTimeSlot(day.key)}
              style={{
                backgroundColor: '#3ce923',
                color: 'white',
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              + Agregar Horario
            </button>
          </div>

          {dayData.timeSlots.map((slot, index) => (
            <div key={index} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 100px 40px',
              gap: '8px',
              marginBottom: '8px',
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              alignItems: 'center'
            }}>
              <input
                type="time"
                value={slot.startTime}
                onChange={(e) => handleTimeSlotChange(day.key, index, 'startTime', e.target.value)}
                style={{
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <input
                type="time"
                value={slot.endTime}
                onChange={(e) => handleTimeSlotChange(day.key, index, 'endTime', e.target.value)}
                style={{
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <input
                type="number"
                value={slot.maxBookings}
                onChange={(e) => handleTimeSlotChange(day.key, index, 'maxBookings', parseInt(e.target.value))}
                min="1"
                max="20"
                style={{
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  textAlign: 'center'
                }}
              />
              <button
                onClick={() => removeTimeSlot(day.key, index)}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ 
          color: '#1f2937', 
          marginBottom: '8px',
          fontSize: '28px',
          fontWeight: 'bold'
        }}>
          📅 Configurar Disponibilidad
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>
          Define tus horarios de trabajo y disponibilidad para recibir reservas
        </p>

        {/* Configuración General */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
            ⚙️ Configuración General
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Días por adelantado
              </label>
              <input
                type="number"
                value={settings.advanceBookingDays}
                onChange={(e) => setSettings(prev => ({ ...prev, advanceBookingDays: parseInt(e.target.value) }))}
                min="1"
                max="90"
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
                Aviso mínimo (horas)
              </label>
              <input
                type="number"
                value={settings.minimumNoticeHours}
                onChange={(e) => setSettings(prev => ({ ...prev, minimumNoticeHours: parseInt(e.target.value) }))}
                min="0"
                max="48"
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
                Duración de slots (min)
              </label>
              <select
                value={settings.slotDurationMinutes}
                onChange={(e) => setSettings(prev => ({ ...prev, slotDurationMinutes: parseInt(e.target.value) }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={120}>2 horas</option>
              </select>
            </div>
          </div>

          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '12px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={settings.allowEmergencyBookings}
              onChange={(e) => setSettings(prev => ({ ...prev, allowEmergencyBookings: e.target.checked }))}
              style={{ transform: 'scale(1.2)' }}
            />
            <div>
              <div style={{ fontWeight: '600', color: '#92400e' }}>
                🚨 Permitir Servicios de Emergencia
              </div>
              <div style={{ fontSize: '14px', color: '#92400e' }}>
                Recibe notificaciones de emergencias 24/7 (función Premium)
              </div>
            </div>
          </label>
        </div>

        {/* Horario Semanal */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
            📅 Horario Semanal
          </h3>
          
          {daysOfWeek.map((day) => (
            <DayScheduleCard
              key={day.key}
              day={day}
              dayData={weeklySchedule[day.key]}
            />
          ))}
        </div>

        {/* Excepciones de Fechas */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#374151', fontSize: '18px', margin: 0 }}>
              📝 Excepciones y Días Especiales
            </h3>
            <button
              onClick={() => setShowAddOverride(true)}
              style={{
                backgroundColor: '#3ce923',
                color: 'white',
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              + Agregar Excepción
            </button>
          </div>

          {dateOverrides.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '2px dashed #d1d5db'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
              <p style={{ color: '#6b7280' }}>
                No hay excepciones configuradas
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {dateOverrides.map((override, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: override.available ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${override.available ? '#3ce923' : '#ef4444'}`,
                  borderRadius: '12px'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                      {override.date.toLocaleDateString('es-MX')}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      {override.available ? '✅ Disponible' : '❌ No disponible'} - {override.reason}
                    </div>
                  </div>
                  <button
                    onClick={() => removeOverride(index)}
                    style={{
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal para Agregar Excepción */}
        {showAddOverride && (
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
              width: '90%'
            }}>
              <h3 style={{ color: '#1f2937', marginBottom: '20px' }}>
                Agregar Excepción
              </h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Fecha
                </label>
                <input
                  type="date"
                  value={newOverride.date}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, date: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Estado
                </label>
                <select
                  value={newOverride.available ? 'available' : 'unavailable'}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, available: e.target.value === 'available' }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                >
                  <option value="unavailable">No disponible</option>
                  <option value="available">Disponible</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Razón
                </label>
                <input
                  type="text"
                  value={newOverride.reason}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ej: Vacaciones, Día festivo, Evento especial"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowAddOverride(false)}
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
                  onClick={handleAddOverride}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#3ce923',
                    color: 'white',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guardar Disponibilidad */}
        <button
          onClick={handleSaveAvailability}
          disabled={loading}
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
              Guardando...
            </>
          ) : (
            '💾 Guardar Disponibilidad'
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

export default ProviderAvailabilityCalendar;