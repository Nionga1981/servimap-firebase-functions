import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../../lib/firebase';

const CommunityCreator = ({ onCommunityCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    location: {
      lat: 0,
      lng: 0,
      address: '',
      radius: 1000,
      city: '',
      state: '',
      country: 'México'
    },
    settings: {
      isPrivate: false,
      allowRecommendations: true,
      requireApproval: true,
      maxMembers: 500
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [isPremium, setIsPremium] = useState(false);

  const communityTypes = [
    { value: 'condominio', label: '🏢 Condominio/Residencial', desc: 'Comunidad de edificios o fraccionamientos' },
    { value: 'privada', label: '🏡 Comunidad Privada', desc: 'Desarrollo habitacional cerrado' },
    { value: 'colonia', label: '🏘️ Colonia/Barrio', desc: 'Zona residencial tradicional' },
    { value: 'expats', label: '🌍 Comunidad Expats', desc: 'Extranjeros viviendo en México' },
    { value: 'corporativo', label: '🏢 Corporativo', desc: 'Empleados de una empresa' },
    { value: 'educativo', label: '🎓 Educativo', desc: 'Universidad, escuela o instituto' },
    { value: 'otro', label: '📍 Otro', desc: 'Otro tipo de comunidad' }
  ];

  useEffect(() => {
    getCurrentLocation();
    checkPremiumStatus();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setFormData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
          }));
        },
        (error) => {
          console.log('Error obteniendo ubicación:', error);
          setError('No se pudo obtener tu ubicación. Por favor ingresa la dirección manualmente.');
        }
      );
    }
  };

  const checkPremiumStatus = async () => {
    // TODO: Implementar verificación de membresía premium
    // Por ahora simulamos que es premium
    setIsPremium(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const validateForm = () => {
    if (!formData.name.trim() || formData.name.length < 3) {
      setError('El nombre debe tener al menos 3 caracteres');
      return false;
    }
    if (!formData.description.trim() || formData.description.length < 10) {
      setError('La descripción debe tener al menos 10 caracteres');
      return false;
    }
    if (!formData.type) {
      setError('Selecciona un tipo de comunidad');
      return false;
    }
    if (!formData.location.address.trim()) {
      setError('Ingresa la dirección de la comunidad');
      return false;
    }
    if (!formData.location.city.trim()) {
      setError('Ingresa la ciudad');
      return false;
    }
    if (!formData.location.state.trim()) {
      setError('Ingresa el estado');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPremium) {
      setError('Necesitas una membresía premium para crear comunidades');
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    try {
      const createCommunity = httpsCallable(functions, 'createCommunity');
      const result = await createCommunity(formData);

      if (result.data.success) {
        alert('🎉 ¡Comunidad creada exitosamente!');
        onCommunityCreated && onCommunityCreated(result.data.communityId);
        
        // Reset form
        setFormData({
          name: '',
          description: '',
          type: '',
          location: {
            lat: userLocation?.lat || 0,
            lng: userLocation?.lng || 0,
            address: '',
            radius: 1000,
            city: '',
            state: '',
            country: 'México'
          },
          settings: {
            isPrivate: false,
            allowRecommendations: true,
            requireApproval: true,
            maxMembers: 500
          }
        });
      }
    } catch (error) {
      console.error('Error creando comunidad:', error);
      setError(error.message || 'Error creando la comunidad');
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <div style={{ 
        backgroundColor: '#FFD700', 
        padding: '20px', 
        borderRadius: '12px',
        textAlign: 'center',
        color: '#333'
      }}>
        <h3>👑 Membresía Premium Requerida</h3>
        <p>Para crear comunidades necesitas una membresía premium.</p>
        <button 
          style={{
            backgroundColor: '#3ce923',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
          onClick={() => window.location.href = '/premium'}
        >
          Obtener Premium
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
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
          🏘️ Crear Nueva Comunidad
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>
          Conecta a tus vecinos y fomenta el "consume local" en tu área
        </p>

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '24px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Información Básica */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              📝 Información Básica
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Nombre de la Comunidad *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ej: Residencial Los Pinos"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3ce923'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Descripción *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe tu comunidad, servicios disponibles, etc."
                rows="4"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '100px'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3ce923'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                Tipo de Comunidad *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                {communityTypes.map((type) => (
                  <label
                    key={type.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px',
                      border: '2px solid',
                      borderColor: formData.type === type.value ? '#3ce923' : '#e5e7eb',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      backgroundColor: formData.type === type.value ? '#f0fdf4' : 'transparent',
                      transition: 'all 0.3s'
                    }}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type.value}
                      checked={formData.type === type.value}
                      onChange={handleInputChange}
                      style={{ marginRight: '12px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                        {type.label}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        {type.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Ubicación */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              📍 Ubicación
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Ciudad *
                </label>
                <input
                  type="text"
                  name="location.city"
                  value={formData.location.city}
                  onChange={handleInputChange}
                  placeholder="Ciudad"
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
                  Estado *
                </label>
                <input
                  type="text"
                  name="location.state"
                  value={formData.location.state}
                  onChange={handleInputChange}
                  placeholder="Estado"
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
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Dirección/Zona *
              </label>
              <input
                type="text"
                name="location.address"
                value={formData.location.address}
                onChange={handleInputChange}
                placeholder="Ej: Av. Principal 123, Col. Centro"
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
                Radio de Cobertura: {formData.location.radius}m
              </label>
              <input
                type="range"
                name="location.radius"
                min="100"
                max="10000"
                step="100"
                value={formData.location.radius}
                onChange={handleInputChange}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280' }}>
                <span>100m</span>
                <span>10km</span>
              </div>
            </div>
          </div>

          {/* Configuración */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              ⚙️ Configuración
            </h3>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '2px solid #e5e7eb', borderRadius: '12px' }}>
                <input
                  type="checkbox"
                  name="settings.isPrivate"
                  checked={formData.settings.isPrivate}
                  onChange={handleInputChange}
                  style={{ marginRight: '12px' }}
                />
                <div>
                  <div style={{ fontWeight: '600', color: '#374151' }}>🔒 Comunidad Privada</div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Solo miembros invitados pueden unirse</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '2px solid #e5e7eb', borderRadius: '12px' }}>
                <input
                  type="checkbox"
                  name="settings.requireApproval"
                  checked={formData.settings.requireApproval}
                  onChange={handleInputChange}
                  style={{ marginRight: '12px' }}
                />
                <div>
                  <div style={{ fontWeight: '600', color: '#374151' }}>✅ Requerir Aprobación</div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Revisar solicitudes manualmente</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '2px solid #e5e7eb', borderRadius: '12px' }}>
                <input
                  type="checkbox"
                  name="settings.allowRecommendations"
                  checked={formData.settings.allowRecommendations}
                  onChange={handleInputChange}
                  style={{ marginRight: '12px' }}
                />
                <div>
                  <div style={{ fontWeight: '600', color: '#374151' }}>💬 Permitir Recomendaciones</div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Los miembros pueden solicitar recomendaciones</div>
                </div>
              </label>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Máximo de Miembros
                </label>
                <input
                  type="number"
                  name="settings.maxMembers"
                  value={formData.settings.maxMembers}
                  onChange={handleInputChange}
                  min="10"
                  max="10000"
                  style={{
                    width: '200px',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Botón Submit */}
          <button
            type="submit"
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
                Creando...
              </>
            ) : (
              '🏘️ Crear Comunidad'
            )}
          </button>
        </form>
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

export default CommunityCreator;