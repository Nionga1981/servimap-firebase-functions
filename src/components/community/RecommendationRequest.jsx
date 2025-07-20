import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

const RecommendationRequest = ({ communityId, onRequestPosted }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    urgency: 'medium',
    budget: {
      min: '',
      max: '',
      currency: 'MXN'
    },
    location: {
      lat: 0,
      lng: 0,
      address: ''
    },
    preferredTime: '',
    mediaUrls: []
  });

  const [tags, setTags] = useState({
    providerIds: [],
    businessIds: [],
    serviceCategories: [],
    keywords: []
  });

  const [availableProviders, setAvailableProviders] = useState([]);
  const [availableBusinesses, setAvailableBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const serviceCategories = [
    'Plomería', 'Electricidad', 'Carpintería', 'Pintura', 'Jardinería',
    'Limpieza', 'Seguridad', 'Delivery', 'Belleza', 'Mascotas',
    'Tecnología', 'Hogar', 'Automóvil', 'Salud', 'Educación',
    'Alimentación', 'Entretenimiento', 'Transporte', 'Construcción'
  ];

  const urgencyLevels = [
    { value: 'low', label: '🟢 Baja - Cuando tengas tiempo', color: '#10b981' },
    { value: 'medium', label: '🟡 Media - Esta semana', color: '#f59e0b' },
    { value: 'high', label: '🟠 Alta - En 1-2 días', color: '#f97316' },
    { value: 'emergency', label: '🔴 Urgente - Hoy mismo', color: '#ef4444' }
  ];

  useEffect(() => {
    if (communityId) {
      loadAvailableProviders();
      loadAvailableBusinesses();
      getCurrentLocation();
    }
  }, [communityId]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
          }));
        },
        (error) => console.log('Error obteniendo ubicación:', error)
      );
    }
  };

  const loadAvailableProviders = async () => {
    try {
      const searchLocalProviders = httpsCallable(functions, 'searchLocalProviders');
      const result = await searchLocalProviders({
        communityId,
        category: '', // Obtener todos
        prioritizeLocal: true,
        limit: 50
      });

      if (result.data.success) {
        setAvailableProviders(result.data.providers || []);
      }
    } catch (error) {
      console.error('Error cargando prestadores:', error);
      // Datos simulados para demo
      setAvailableProviders([
        { id: '1', providerInfo: { name: 'Juan Pérez - Plomero', rating: 4.8 } },
        { id: '2', providerInfo: { name: 'María García - Electricista', rating: 4.9 } },
        { id: '3', providerInfo: { name: 'Carlos López - Pintor', rating: 4.7 } }
      ]);
    }
  };

  const loadAvailableBusinesses = async () => {
    try {
      // En una implementación real, cargarías negocios de la comunidad
      setAvailableBusinesses([
        { id: '1', name: 'Ferretería Los Pinos', rating: 4.6 },
        { id: '2', name: 'Taller Mecánico Express', rating: 4.8 },
        { id: '3', name: 'Panadería Doña Rosa', rating: 4.9 }
      ]);
    } catch (error) {
      console.error('Error cargando negocios:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleProviderToggle = (providerId) => {
    setTags(prev => ({
      ...prev,
      providerIds: prev.providerIds.includes(providerId)
        ? prev.providerIds.filter(id => id !== providerId)
        : [...prev.providerIds, providerId]
    }));
  };

  const handleBusinessToggle = (businessId) => {
    setTags(prev => ({
      ...prev,
      businessIds: prev.businessIds.includes(businessId)
        ? prev.businessIds.filter(id => id !== businessId)
        : [...prev.businessIds, businessId]
    }));
  };

  const handleCategoryToggle = (category) => {
    setTags(prev => ({
      ...prev,
      serviceCategories: prev.serviceCategories.includes(category)
        ? prev.serviceCategories.filter(c => c !== category)
        : [...prev.serviceCategories, category]
    }));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !tags.keywords.includes(newKeyword.trim())) {
      setTags(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()]
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword) => {
    setTags(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('El título es requerido');
      return false;
    }
    if (!formData.description.trim()) {
      setError('La descripción es requerida');
      return false;
    }
    if (!formData.category) {
      setError('Selecciona una categoría');
      return false;
    }
    if (formData.budget.min && formData.budget.max && 
        parseFloat(formData.budget.min) > parseFloat(formData.budget.max)) {
      setError('El presupuesto mínimo no puede ser mayor al máximo');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      const postRecommendationRequest = httpsCallable(functions, 'postRecommendationRequest');
      
      const requestData = {
        communityId,
        content: {
          ...formData,
          budget: formData.budget.min || formData.budget.max ? {
            min: parseFloat(formData.budget.min) || 0,
            max: parseFloat(formData.budget.max) || 0,
            currency: formData.budget.currency
          } : undefined,
          preferredTime: formData.preferredTime ? new Date(formData.preferredTime) : undefined
        },
        tags
      };

      const result = await postRecommendationRequest(requestData);

      if (result.data.success) {
        alert('🎉 ¡Solicitud de recomendación publicada exitosamente!');
        onRequestPosted && onRequestPosted(result.data.recommendationId);
        
        // Reset form
        setFormData({
          title: '',
          description: '',
          category: '',
          urgency: 'medium',
          budget: { min: '', max: '', currency: 'MXN' },
          location: { lat: 0, lng: 0, address: '' },
          preferredTime: '',
          mediaUrls: []
        });
        setTags({
          providerIds: [],
          businessIds: [],
          serviceCategories: [],
          keywords: []
        });
      }
    } catch (error) {
      console.error('Error enviando solicitud:', error);
      setError(error.message || 'Error enviando la solicitud');
    } finally {
      setLoading(false);
    }
  };

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
          💬 Solicitar Recomendación
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>
          Pide recomendaciones a tu comunidad y obtén respuestas de prestadores locales
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
              📝 ¿Qué necesitas?
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Título de tu solicitud *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Ej: Necesito plomero para reparar fuga"
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

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Descripción detallada *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe tu problema o necesidad con el mayor detalle posible..."
                rows="4"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px',
                  resize: 'vertical'
                }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Categoría *
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  {serviceCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Urgencia
                </label>
                <select
                  name="urgency"
                  value={formData.urgency}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                >
                  {urgencyLevels.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Presupuesto */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              💰 Presupuesto (Opcional)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Mínimo
                </label>
                <input
                  type="number"
                  name="budget.min"
                  value={formData.budget.min}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
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
                  Máximo
                </label>
                <input
                  type="number"
                  name="budget.max"
                  value={formData.budget.max}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
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
                  Moneda
                </label>
                <select
                  name="budget.currency"
                  value={formData.budget.currency}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                >
                  <option value="MXN">🇲🇽 Pesos MXN</option>
                  <option value="USD">🇺🇸 Dólares USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tags - Prestadores */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              🏷️ Etiquetar Prestadores
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '14px' }}>
              Etiqueta prestadores específicos para que reciban notificación
            </p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
              gap: '12px',
              marginBottom: '20px'
            }}>
              {availableProviders.map((provider) => (
                <label
                  key={provider.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    border: '2px solid',
                    borderColor: tags.providerIds.includes(provider.id) ? '#3ce923' : '#e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: tags.providerIds.includes(provider.id) ? '#f0fdf4' : 'transparent',
                    transition: 'all 0.3s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={tags.providerIds.includes(provider.id)}
                    onChange={() => handleProviderToggle(provider.id)}
                    style={{ marginRight: '8px' }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>
                      {provider.providerInfo?.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      ⭐ {provider.providerInfo?.rating || 'N/A'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Tags - Categorías */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              🔧 Categorías de Servicio
            </h3>
            
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px'
            }}>
              {serviceCategories.slice(0, 10).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryToggle(category)}
                  style={{
                    padding: '8px 16px',
                    border: '2px solid',
                    borderColor: tags.serviceCategories.includes(category) ? '#3ce923' : '#e5e7eb',
                    borderRadius: '20px',
                    backgroundColor: tags.serviceCategories.includes(category) ? '#3ce923' : 'transparent',
                    color: tags.serviceCategories.includes(category) ? 'white' : '#374151',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              🔍 Palabras Clave
            </h3>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Agregar palabra clave..."
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              />
              <button
                type="button"
                onClick={addKeyword}
                style={{
                  backgroundColor: '#3ce923',
                  color: 'white',
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Agregar
              </button>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {tags.keywords.map((keyword) => (
                <span
                  key={keyword}
                  style={{
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => removeKeyword(keyword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '0',
                      width: '16px',
                      height: '16px'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Ubicación y Tiempo */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#374151', marginBottom: '16px', fontSize: '18px' }}>
              📍 Detalles Adicionales
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Dirección específica (opcional)
                </label>
                <input
                  type="text"
                  name="location.address"
                  value={formData.location.address}
                  onChange={handleInputChange}
                  placeholder="Dirección donde se necesita el servicio"
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
                  Fecha/hora preferida (opcional)
                </label>
                <input
                  type="datetime-local"
                  name="preferredTime"
                  value={formData.preferredTime}
                  onChange={handleInputChange}
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

          {/* Submit */}
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
                Enviando...
              </>
            ) : (
              '💬 Publicar Solicitud'
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

export default RecommendationRequest;