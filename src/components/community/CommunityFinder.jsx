import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

const CommunityFinder = ({ onCommunityJoined }) => {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useState({
    searchTerm: '',
    type: '',
    city: '',
    state: '',
    radius: 10000,
    lat: 0,
    lng: 0
  });
  const [userLocation, setUserLocation] = useState(null);
  const [joiningCommunity, setJoiningCommunity] = useState(null);

  const communityTypes = [
    { value: '', label: 'Todos los tipos' },
    { value: 'condominio', label: '🏢 Condominio/Residencial' },
    { value: 'privada', label: '🏡 Comunidad Privada' },
    { value: 'colonia', label: '🏘️ Colonia/Barrio' },
    { value: 'expats', label: '🌍 Comunidad Expats' },
    { value: 'corporativo', label: '🏢 Corporativo' },
    { value: 'educativo', label: '🎓 Educativo' },
    { value: 'otro', label: '📍 Otro' }
  ];

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      searchCommunities();
    }
  }, [userLocation]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setSearchParams(prev => ({
            ...prev,
            lat: location.lat,
            lng: location.lng
          }));
        },
        (error) => {
          console.log('Error obteniendo ubicación:', error);
          // Continuar sin ubicación
          searchCommunities();
        }
      );
    }
  };

  const searchCommunities = async () => {
    setLoading(true);
    try {
      const searchCommunitiesFunc = httpsCallable(functions, 'searchCommunities');
      const result = await searchCommunitiesFunc(searchParams);
      
      if (result.data.success) {
        setCommunities(result.data.communities || []);
      }
    } catch (error) {
      console.error('Error buscando comunidades:', error);
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    searchCommunities();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const joinCommunity = async (communityId, communityName) => {
    setJoiningCommunity(communityId);
    
    try {
      const joinCommunityFunc = httpsCallable(functions, 'joinCommunity');
      const result = await joinCommunityFunc({
        communityId,
        joinReason: `Quiero unirme a ${communityName}`,
        userLocation: userLocation
      });

      if (result.data.success) {
        alert(`✅ ¡Solicitud enviada! ${result.data.message}`);
        onCommunityJoined && onCommunityJoined(communityId);
        // Actualizar la comunidad en la lista
        setCommunities(prev => prev.map(community => 
          community.id === communityId 
            ? { ...community, userStatus: result.data.requiresApproval ? 'pending' : 'approved' }
            : community
        ));
      }
    } catch (error) {
      console.error('Error uniéndose a comunidad:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setJoiningCommunity(null);
    }
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const formatDistance = (community) => {
    if (!userLocation) return '';
    
    const distance = calculateDistance(
      userLocation.lat, userLocation.lng,
      community.location.lat, community.location.lng
    );
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const CommunityCard = ({ community }) => {
    const distance = formatDistance(community);
    const isJoining = joiningCommunity === community.id;
    
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ 
              color: '#1f2937', 
              marginBottom: '8px',
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              {community.name}
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{
                backgroundColor: '#f3f4f6',
                color: '#374151',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {communityTypes.find(t => t.value === community.type)?.label || community.type}
              </span>
              
              {distance && (
                <span style={{
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  📍 {distance}
                </span>
              )}
            </div>
          </div>
          
          {community.userStatus && (
            <div style={{
              backgroundColor: community.userStatus === 'approved' ? '#dcfce7' : '#fef3c7',
              color: community.userStatus === 'approved' ? '#166534' : '#92400e',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {community.userStatus === 'approved' ? '✅ Miembro' : '⏳ Pendiente'}
            </div>
          )}
        </div>

        <p style={{ 
          color: '#6b7280', 
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          {community.description}
        </p>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingTop: '16px',
          borderTop: '1px solid #f3f4f6'
        }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                {community.stats?.totalMembers || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Miembros</div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                {community.stats?.totalProviders || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Prestadores</div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                {community.stats?.recommendationsThisMonth || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Este mes</div>
            </div>
          </div>

          {!community.userStatus && (
            <button
              onClick={() => joinCommunity(community.id, community.name)}
              disabled={isJoining}
              style={{
                backgroundColor: isJoining ? '#9ca3af' : '#3ce923',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isJoining ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isJoining ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #ffffff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Enviando...
                </>
              ) : (
                '🤝 Unirse'
              )}
            </button>
          )}
        </div>

        <div style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
          📍 {community.location?.city}, {community.location?.state}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '32px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ 
          color: '#1f2937', 
          marginBottom: '8px',
          fontSize: '28px',
          fontWeight: 'bold'
        }}>
          🔍 Buscar Comunidades
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          Encuentra y únete a comunidades cerca de ti
        </p>

        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Buscar por nombre
              </label>
              <input
                type="text"
                name="searchTerm"
                value={searchParams.searchTerm}
                onChange={handleInputChange}
                placeholder="Nombre de comunidad..."
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
                Tipo
              </label>
              <select
                name="type"
                value={searchParams.type}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              >
                {communityTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                Ciudad
              </label>
              <input
                type="text"
                name="city"
                value={searchParams.city}
                onChange={handleInputChange}
                placeholder="Ciudad..."
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
                Estado
              </label>
              <input
                type="text"
                name="state"
                value={searchParams.state}
                onChange={handleInputChange}
                placeholder="Estado..."
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

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
              Radio de búsqueda: {searchParams.radius/1000}km
            </label>
            <input
              type="range"
              name="radius"
              min="1000"
              max="50000"
              step="1000"
              value={searchParams.radius}
              onChange={handleInputChange}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280' }}>
              <span>1km</span>
              <span>50km</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: loading ? '#9ca3af' : '#3ce923',
              color: 'white',
              padding: '14px 32px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
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
                Buscando...
              </>
            ) : (
              '🔍 Buscar Comunidades'
            )}
          </button>
        </form>
      </div>

      {/* Resultados */}
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px' 
        }}>
          <h3 style={{ color: '#1f2937', fontSize: '24px', fontWeight: 'bold' }}>
            Comunidades Encontradas
          </h3>
          <span style={{ 
            backgroundColor: '#f3f4f6',
            color: '#374151',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {communities.length} resultado{communities.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px',
            color: '#6b7280' 
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #3ce923',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
            Buscando comunidades...
          </div>
        ) : communities.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '60px',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏘️</div>
            <h3 style={{ color: '#374151', marginBottom: '8px' }}>
              No se encontraron comunidades
            </h3>
            <p style={{ color: '#6b7280' }}>
              Intenta ampliar tu búsqueda o crear una nueva comunidad
            </p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
            gap: '24px' 
          }}>
            {communities.map((community) => (
              <CommunityCard key={community.id} community={community} />
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

export default CommunityFinder;