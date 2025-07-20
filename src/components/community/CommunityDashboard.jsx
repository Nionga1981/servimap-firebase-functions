import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

const CommunityDashboard = ({ communityId, userRole = 'member' }) => {
  const [community, setCommunity] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (communityId) {
      loadCommunityData();
      loadCommunityStats();
      loadRecentActivity();
    }
  }, [communityId]);

  const loadCommunityData = async () => {
    try {
      // En una implementación real, cargarías los datos de la comunidad
      // Por ahora simulamos datos
      setCommunity({
        id: communityId,
        name: 'Residencial Los Pinos',
        description: 'Comunidad familiar con servicios locales de calidad',
        type: 'condominio',
        location: {
          city: 'Guadalajara',
          state: 'Jalisco',
          address: 'Av. Principal 123'
        },
        settings: {
          isPrivate: false,
          allowRecommendations: true,
          maxMembers: 500
        }
      });
    } catch (error) {
      console.error('Error cargando comunidad:', error);
    }
  };

  const loadCommunityStats = async () => {
    try {
      const getCommunityStats = httpsCallable(functions, 'getCommunityStats');
      const result = await getCommunityStats({ communityId });
      
      if (result.data.success) {
        setStats(result.data.stats);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      // Datos simulados
      setStats({
        totalMembers: 142,
        activeMembers: 89,
        totalProviders: 23,
        localBusinesses: 8,
        recommendationsThisMonth: 45,
        averageRating: 4.7,
        growth: {
          membersThisMonth: 12,
          providersThisMonth: 3,
          activitiesThisWeek: 28
        }
      });
    }
  };

  const loadRecentActivity = async () => {
    try {
      const getCommunityFeed = httpsCallable(functions, 'getCommunityFeed');
      const result = await getCommunityFeed({ 
        communityId, 
        limit: 10,
        activityTypes: ['recommendation_posted', 'member_joined', 'provider_featured']
      });
      
      if (result.data.success) {
        setRecentActivity(result.data.activities || []);
      }
    } catch (error) {
      console.error('Error cargando actividad:', error);
      // Datos simulados
      setRecentActivity([
        {
          id: '1',
          type: 'recommendation_posted',
          actor: 'María García',
          content: 'Solicita recomendaciones de plomero',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          category: 'Hogar'
        },
        {
          id: '2',
          type: 'member_joined',
          actor: 'Carlos López',
          content: 'Se unió a la comunidad',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000)
        },
        {
          id: '3',
          type: 'provider_featured',
          actor: 'Electricista Profesional',
          content: 'Nuevo prestador verificado',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          category: 'Servicios'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color = '#3ce923', trend }) => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      border: '1px solid #e5e7eb',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '4px',
        height: '100%',
        backgroundColor: color
      }}></div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            color: '#6b7280', 
            fontSize: '14px', 
            fontWeight: '500',
            marginBottom: '8px'
          }}>
            {title}
          </h3>
          <div style={{ 
            color: '#1f2937', 
            fontSize: '32px', 
            fontWeight: 'bold',
            marginBottom: '4px'
          }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              {subtitle}
            </div>
          )}
          {trend && (
            <div style={{ 
              color: trend > 0 ? '#059669' : '#dc2626',
              fontSize: '14px',
              fontWeight: '500',
              marginTop: '8px'
            }}>
              {trend > 0 ? '↗️' : '↘️'} {Math.abs(trend)} este mes
            </div>
          )}
        </div>
        <div style={{ fontSize: '32px', opacity: 0.7 }}>
          {icon}
        </div>
      </div>
    </div>
  );

  const ActivityItem = ({ activity }) => {
    const getActivityIcon = (type) => {
      switch (type) {
        case 'recommendation_posted': return '💬';
        case 'member_joined': return '👋';
        case 'provider_featured': return '⭐';
        case 'business_verified': return '✅';
        default: return '📝';
      }
    };

    const formatTime = (timestamp) => {
      const now = new Date();
      const time = new Date(timestamp);
      const diffMs = now - time;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) return `hace ${diffMins}m`;
      if (diffHours < 24) return `hace ${diffHours}h`;
      return `hace ${diffDays}d`;
    };

    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '16px',
        borderBottom: '1px solid #f3f4f6',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
        
        <div style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '12px',
          fontSize: '18px'
        }}>
          {getActivityIcon(activity.type)}
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ 
            color: '#1f2937', 
            fontWeight: '500',
            marginBottom: '4px'
          }}>
            {activity.actor}
          </div>
          <div style={{ 
            color: '#6b7280', 
            fontSize: '14px',
            marginBottom: '4px'
          }}>
            {activity.content}
          </div>
          <div style={{ 
            color: '#9ca3af', 
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {formatTime(activity.timestamp)}
            {activity.category && (
              <span style={{
                backgroundColor: '#f3f4f6',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px'
              }}>
                {activity.category}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '400px' 
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
    );
  }

  if (!community) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '60px',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
        <h3 style={{ color: '#374151', marginBottom: '8px' }}>
          Comunidad no encontrada
        </h3>
        <p style={{ color: '#6b7280' }}>
          No se pudo cargar la información de la comunidad
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '32px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ 
              color: '#1f2937', 
              fontSize: '32px', 
              fontWeight: 'bold',
              marginBottom: '8px'
            }}>
              🏘️ {community.name}
            </h1>
            <p style={{ color: '#6b7280', fontSize: '16px', marginBottom: '16px' }}>
              {community.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{
                backgroundColor: '#f3f4f6',
                color: '#374151',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                📍 {community.location.city}, {community.location.state}
              </span>
              <span style={{
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {userRole === 'owner' ? '👑 Propietario' : 
                 userRole === 'admin' ? '⚙️ Administrador' :
                 userRole === 'moderator' ? '🛡️ Moderador' : '👤 Miembro'}
              </span>
            </div>
          </div>
          
          {(userRole === 'owner' || userRole === 'admin') && (
            <button style={{
              backgroundColor: '#3ce923',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              ⚙️ Configurar
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            {[
              { id: 'overview', label: '📊 Resumen', icon: '📊' },
              { id: 'members', label: '👥 Miembros', icon: '👥' },
              { id: 'providers', label: '🔧 Prestadores', icon: '🔧' },
              { id: 'activity', label: '📈 Actividad', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 0',
                  border: 'none',
                  background: 'none',
                  color: activeTab === tab.id ? '#3ce923' : '#6b7280',
                  fontWeight: activeTab === tab.id ? '600' : '500',
                  borderBottom: activeTab === tab.id ? '2px solid #3ce923' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.3s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '24px',
            marginBottom: '32px'
          }}>
            <StatCard
              title="Total Miembros"
              value={stats?.totalMembers || 0}
              icon="👥"
              color="#3ce923"
              trend={stats?.growth?.membersThisMonth}
            />
            <StatCard
              title="Miembros Activos"
              value={stats?.activeMembers || 0}
              subtitle="Últimos 30 días"
              icon="🔥"
              color="#60cdff"
            />
            <StatCard
              title="Prestadores Locales"
              value={stats?.totalProviders || 0}
              icon="🔧"
              color="#ac7afc"
              trend={stats?.growth?.providersThisMonth}
            />
            <StatCard
              title="Recomendaciones"
              value={stats?.recommendationsThisMonth || 0}
              subtitle="Este mes"
              icon="💬"
              color="#FFD700"
              trend={stats?.growth?.activitiesThisWeek}
            />
          </div>

          {/* Recent Activity */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            <div style={{ 
              padding: '24px 24px 0',
              borderBottom: '1px solid #f3f4f6'
            }}>
              <h3 style={{ 
                color: '#1f2937', 
                fontSize: '20px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                📈 Actividad Reciente
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                Últimas actividades en tu comunidad
              </p>
            </div>
            
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))
              ) : (
                <div style={{ 
                  padding: '40px',
                  textAlign: 'center',
                  color: '#6b7280'
                }}>
                  No hay actividad reciente
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ color: '#1f2937', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
            👥 Gestión de Miembros
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Administra los miembros de tu comunidad
          </p>
          {/* Aquí iría el componente de gestión de miembros */}
          <div style={{ 
            padding: '60px',
            textAlign: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #d1d5db'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <p style={{ color: '#6b7280' }}>
              Componente de gestión de miembros en desarrollo
            </p>
          </div>
        </div>
      )}

      {activeTab === 'providers' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ color: '#1f2937', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
            🔧 Prestadores Locales
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Prestadores de servicios activos en tu comunidad
          </p>
          {/* Aquí iría el componente LocalProvidersList */}
          <div style={{ 
            padding: '60px',
            textAlign: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #d1d5db'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔧</div>
            <p style={{ color: '#6b7280' }}>
              Lista de prestadores locales (siguiente componente)
            </p>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ color: '#1f2937', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
            📈 Análisis de Actividad
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Métricas detalladas de actividad comunitaria
          </p>
          {/* Aquí irían gráficos y análisis más detallados */}
          <div style={{ 
            padding: '60px',
            textAlign: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #d1d5db'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
            <p style={{ color: '#6b7280' }}>
              Gráficos y análisis avanzados en desarrollo
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CommunityDashboard;