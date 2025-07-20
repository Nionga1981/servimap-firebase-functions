import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

const LocalProvidersList = ({ communityId, showHeader = true }) => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchCategory, setSearchCategory] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const [userLocation, setUserLocation] = useState(null);

  const serviceCategories = [
    { value: '', label: 'Todas las categorías' },
    { value: 'plomeria', label: '🔧 Plomería' },
    { value: 'electricidad', label: '⚡ Electricidad' },
    { value: 'carpinteria', label: '🪚 Carpintería' },
    { value: 'pintura', label: '🎨 Pintura' },
    { value: 'jardineria', label: '🌱 Jardinería' },
    { value: 'limpieza', label: '🧽 Limpieza' },
    { value: 'seguridad', label: '🔒 Seguridad' },
    { value: 'delivery', label: '🚚 Delivery' },
    { value: 'belleza', label: '💄 Belleza' },
    { value: 'mascotas', label: '🐕 Mascotas' },
    { value: 'tecnologia', label: '💻 Tecnología' },
    { value: 'automovil', label: '🚗 Automóvil' },
    { value: 'salud', label: '🏥 Salud' },
    { value: 'educacion', label: '📚 Educación' }
  ];

  const sortOptions = [
    { value: 'priority', label: '🎯 Prioridad Local' },
    { value: 'rating', label: '⭐ Mejor Calificados' },
    { value: 'distance', label: '📍 Más Cercanos' },
    { value: 'experience', label: '👨‍💼 Más Experiencia' }
  ];

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (communityId) {
      searchProviders();
    }
  }, [communityId, searchCategory, sortBy, userLocation]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Error obteniendo ubicación:', error);
        }
      );
    }
  };

  const searchProviders = async () => {
    setLoading(true);
    try {
      const searchLocalProviders = httpsCallable(functions, 'searchLocalProviders');
      const result = await searchLocalProviders({
        communityId,
        category: searchCategory,
        location: userLocation,
        prioritizeLocal: sortBy === 'priority',
        limit: 20
      });

      if (result.data.success) {
        let providersList = result.data.providers || [];
        
        // Aplicar ordenamiento local si no es por prioridad
        if (sortBy !== 'priority') {
          providersList = sortProviders(providersList, sortBy);
        }
        
        setProviders(providersList);
      }
    } catch (error) {
      console.error('Error buscando prestadores:', error);
      // Datos simulados para demo
      setProviders([
        {
          id: '1',
          providerInfo: {
            name: 'Juan Pérez',
            profession: 'Plomero Profesional',
            description: 'Especialista en reparaciones residenciales con 15 años de experiencia',
            rating: 4.9,
            totalReviews: 127,
            phone: '+52 33 1234 5678',
            categories: ['plomeria'],
            profileImage: '👨‍🔧'
          },
          localVerification: {
            isLocalResident: true,
            localExperience: 8,
            communityRecommendations: 23
          },
          priority: 95,
          distance: 0.3,
          responseTime: '< 2 horas',
          availability: 'available',
          specialOffers: [{
            type: 'first_time_discount',
            description: '20% descuento primera vez',
            value: 20
          }]
        },
        {
          id: '2',
          providerInfo: {
            name: 'María García',
            profession: 'Electricista Certificada',
            description: 'Instalaciones eléctricas y reparaciones de emergencia',
            rating: 4.8,
            totalReviews: 89,
            phone: '+52 33 9876 5432',
            categories: ['electricidad'],
            profileImage: '👩‍🔧'
          },
          localVerification: {
            isLocalResident: true,
            localExperience: 5,
            communityRecommendations: 18
          },
          priority: 88,
          distance: 0.8,
          responseTime: '< 1 hora',
          availability: 'busy',
          specialOffers: []
        },
        {
          id: '3',
          providerInfo: {
            name: 'Carlos López',
            profession: 'Pintor y Decorador',
            description: 'Pintura interior y exterior, acabados especializados',
            rating: 4.7,
            totalReviews: 156,
            phone: '+52 33 5555 1234',
            categories: ['pintura'],
            profileImage: '👨‍🎨'
          },
          localVerification: {
            isLocalResident: false,
            localExperience: 3,
            communityRecommendations: 12
          },
          priority: 75,
          distance: 2.1,
          responseTime: '< 4 horas',
          availability: 'available',
          specialOffers: [{
            type: 'community_discount',
            description: '15% descuento miembros',
            value: 15
          }]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sortProviders = (providersList, sortType) => {
    return [...providersList].sort((a, b) => {
      switch (sortType) {
        case 'rating':
          return (b.providerInfo?.rating || 0) - (a.providerInfo?.rating || 0);
        case 'distance':
          return (a.distance || 0) - (b.distance || 0);
        case 'experience':
          return (b.localVerification?.localExperience || 0) - (a.localVerification?.localExperience || 0);
        default:
          return b.priority - a.priority;
      }
    });
  };

  const getAvailabilityColor = (availability) => {
    switch (availability) {
      case 'available': return '#10b981';
      case 'busy': return '#f59e0b';
      case 'unavailable': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getAvailabilityText = (availability) => {
    switch (availability) {
      case 'available': return '🟢 Disponible';
      case 'busy': return '🟡 Ocupado';
      case 'unavailable': return '🔴 No disponible';
      default: return '⚪ Sin estado';
    }
  };

  const contactProvider = (provider) => {
    // En una implementación real, abriría el chat o iniciaría contacto
    alert(`Contactando a ${provider.providerInfo.name}...`);
  };

  const ProviderCard = ({ provider }) => {
    const isLocal = provider.localVerification?.isLocalResident;
    const hasOffers = provider.specialOffers?.length > 0;

    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        border: isLocal ? '2px solid #3ce923' : '1px solid #e5e7eb',
        position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
      }}>
        
        {/* Local Badge */}
        {isLocal && (
          <div style={{
            position: 'absolute',
            top: '-8px',
            right: '16px',
            backgroundColor: '#3ce923',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            🏘️ LOCAL
          </div>
        )}

        {/* Special Offers Badge */}
        {hasOffers && (
          <div style={{
            position: 'absolute',
            top: '-8px',
            left: '16px',
            backgroundColor: '#f59e0b',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            🎁 OFERTA
          </div>
        )}

        <div style={{ display: 'flex', gap: '20px' }}>
          {/* Avatar */}
          <div style={{
            backgroundColor: '#f3f4f6',
            borderRadius: '50%',
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            flexShrink: 0
          }}>
            {provider.providerInfo?.profileImage || '👤'}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <h3 style={{ 
                  color: '#1f2937', 
                  fontSize: '20px', 
                  fontWeight: 'bold',
                  marginBottom: '4px'
                }}>
                  {provider.providerInfo?.name}
                </h3>
                <p style={{ 
                  color: '#6b7280', 
                  fontSize: '16px',
                  marginBottom: '8px'
                }}>
                  {provider.providerInfo?.profession}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  color: getAvailabilityColor(provider.availability),
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '4px'
                }}>
                  {getAvailabilityText(provider.availability)}
                </div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>
                  Responde en {provider.responseTime}
                </div>
              </div>
            </div>

            <p style={{ 
              color: '#374151', 
              lineHeight: '1.5',
              marginBottom: '16px'
            }}>
              {provider.providerInfo?.description}
            </p>

            {/* Stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#f59e0b', fontSize: '16px' }}>⭐</span>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>
                  {provider.providerInfo?.rating || 'N/A'}
                </span>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                  ({provider.providerInfo?.totalReviews || 0} reseñas)
                </span>
              </div>

              {provider.distance !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#60cdff', fontSize: '16px' }}>📍</span>
                  <span style={{ color: '#374151', fontSize: '14px' }}>
                    {provider.distance < 1 
                      ? `${Math.round(provider.distance * 1000)}m`
                      : `${provider.distance.toFixed(1)}km`
                    }
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#ac7afc', fontSize: '16px' }}>🏘️</span>
                <span style={{ color: '#374151', fontSize: '14px' }}>
                  {provider.localVerification?.communityRecommendations || 0} recomendaciones
                </span>
              </div>
            </div>

            {/* Special Offers */}
            {hasOffers && (
              <div style={{ marginBottom: '16px' }}>
                {provider.specialOffers.map((offer, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#fef3c7',
                      border: '1px solid #f59e0b',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      fontSize: '14px',
                      color: '#92400e'
                    }}
                  >
                    🎁 {offer.description}
                  </div>
                ))}
              </div>
            )}

            {/* Local Info */}
            {isLocal && (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #3ce923',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ color: '#166534', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                  🏘️ Prestador Local Verificado
                </div>
                <div style={{ color: '#15803d', fontSize: '12px' }}>
                  {provider.localVerification.localExperience} años de experiencia en la comunidad
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => contactProvider(provider)}
                style={{
                  backgroundColor: '#3ce923',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3ce923'}
              >
                💬 Contactar
              </button>

              <button
                onClick={() => window.open(`tel:${provider.providerInfo?.phone}`)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#3ce923',
                  padding: '12px 24px',
                  border: '2px solid #3ce923',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#3ce923';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#3ce923';
                }}
              >
                📞 Llamar
              </button>

              <button
                style={{
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                👤 Ver Perfil
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {showHeader && (
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
            fontSize: '28px', 
            fontWeight: 'bold',
            marginBottom: '8px'
          }}>
            🔧 Prestadores Locales
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Encuentra prestadores de servicios priorizando a los que viven en tu comunidad
          </p>

          {/* Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Categoría de Servicio
              </label>
              <select
                value={searchCategory}
                onChange={(e) => setSearchCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              >
                {serviceCategories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Ordenar por
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div>
        {loading ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #3ce923',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
        ) : providers.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '60px',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔧</div>
            <h3 style={{ color: '#374151', marginBottom: '8px' }}>
              No se encontraron prestadores
            </h3>
            <p style={{ color: '#6b7280' }}>
              Intenta cambiar los filtros o invita prestadores a tu comunidad
            </p>
          </div>
        ) : (
          <>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px' 
            }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>
                {providers.length} prestador{providers.length !== 1 ? 'es' : ''} encontrado{providers.length !== 1 ? 's' : ''}
              </span>
              <span style={{ 
                backgroundColor: '#f0fdf4',
                color: '#166534',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                🏘️ {providers.filter(p => p.localVerification?.isLocalResident).length} locales
              </span>
            </div>

            {providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
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
};

export default LocalProvidersList;