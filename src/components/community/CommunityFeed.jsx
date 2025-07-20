import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

const CommunityFeed = ({ communityId, showFullFeed = true }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState('all');
  const [lastActivity, setLastActivity] = useState(null);

  const activityFilters = [
    { value: 'all', label: '📋 Todas', icon: '📋' },
    { value: 'recommendation_posted', label: '💬 Recomendaciones', icon: '💬' },
    { value: 'member_joined', label: '👋 Nuevos miembros', icon: '👋' },
    { value: 'provider_featured', label: '⭐ Prestadores', icon: '⭐' },
    { value: 'business_verified', label: '✅ Negocios', icon: '✅' }
  ];

  useEffect(() => {
    loadFeed();
  }, [communityId, filter]);

  const loadFeed = async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setActivities([]);
    }

    try {
      const getCommunityFeed = httpsCallable(functions, 'getCommunityFeed');
      const result = await getCommunityFeed({
        communityId,
        limit: showFullFeed ? 20 : 5,
        before: loadMore ? lastActivity?.createdAt : undefined,
        activityTypes: filter === 'all' ? undefined : [filter]
      });

      if (result.data.success) {
        const newActivities = result.data.activities || [];
        
        if (loadMore) {
          setActivities(prev => [...prev, ...newActivities]);
        } else {
          setActivities(newActivities);
        }
        
        setHasMore(result.data.hasMore);
        if (newActivities.length > 0) {
          setLastActivity(newActivities[newActivities.length - 1]);
        }
      }
    } catch (error) {
      console.error('Error cargando feed:', error);
      // Datos simulados para demo
      if (!loadMore) {
        setActivities([
          {
            id: '1',
            activityType: 'recommendation_posted',
            actorInfo: { name: 'María García', avatar: '👩‍💼' },
            content: {
              title: 'Necesito plomero urgente',
              description: 'Se rompió una tubería en mi cocina',
              category: 'Plomería',
              urgency: 'high'
            },
            createdAt: new Date(Date.now() - 30 * 60 * 1000),
            metadata: { responseCount: 3, helpfulVotes: 5 }
          },
          {
            id: '2',
            activityType: 'member_joined',
            actorInfo: { name: 'Carlos López', avatar: '👨‍💻' },
            content: {
              message: 'Se unió a la comunidad'
            },
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
          },
          {
            id: '3',
            activityType: 'provider_featured',
            actorInfo: { name: 'Electricista Profesional', avatar: '⚡' },
            content: {
              title: 'Nuevo prestador verificado',
              description: 'Especialista en instalaciones eléctricas residenciales',
              category: 'Electricidad',
              rating: 4.9
            },
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000)
          }
        ]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    if (diffDays === 1) return 'ayer';
    if (diffDays < 7) return `hace ${diffDays}d`;
    return time.toLocaleDateString();
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'recommendation_posted': return '💬';
      case 'member_joined': return '👋';
      case 'provider_featured': return '⭐';
      case 'business_verified': return '✅';
      case 'community_update': return '📢';
      default: return '📝';
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'emergency': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const ActivityCard = ({ activity }) => {
    const isRecommendation = activity.activityType === 'recommendation_posted';
    const isProvider = activity.activityType === 'provider_featured';
    const isMember = activity.activityType === 'member_joined';

    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #f3f4f6',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      }}>
        
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          {/* Avatar */}
          <div style={{
            backgroundColor: '#f3f4f6',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            flexShrink: 0
          }}>
            {activity.actorInfo?.avatar || getActivityIcon(activity.activityType)}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>
                  {activity.actorInfo?.name}
                </span>
                {isRecommendation && (
                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                    solicita recomendaciones
                  </span>
                )}
                {isMember && (
                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                    se unió a la comunidad
                  </span>
                )}
                {isProvider && (
                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                    nuevo prestador verificado
                  </span>
                )}
              </div>
              <span style={{ color: '#9ca3af', fontSize: '14px', flexShrink: 0 }}>
                {formatTimeAgo(activity.createdAt)}
              </span>
            </div>

            {/* Recommendation Content */}
            {isRecommendation && activity.content && (
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ 
                  color: '#1f2937', 
                  fontWeight: '600', 
                  marginBottom: '6px',
                  fontSize: '16px'
                }}>
                  {activity.content.title}
                </h4>
                <p style={{ 
                  color: '#6b7280', 
                  lineHeight: '1.5',
                  marginBottom: '8px'
                }}>
                  {activity.content.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {activity.content.category}
                  </span>
                  {activity.content.urgency && (
                    <span style={{
                      backgroundColor: getUrgencyColor(activity.content.urgency),
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {activity.content.urgency === 'emergency' ? '🚨 Urgente' :
                       activity.content.urgency === 'high' ? '🔴 Alta' :
                       activity.content.urgency === 'medium' ? '🟡 Media' : '🟢 Baja'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Provider Content */}
            {isProvider && activity.content && (
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ 
                  color: '#1f2937', 
                  fontWeight: '600', 
                  marginBottom: '6px',
                  fontSize: '16px'
                }}>
                  {activity.content.title}
                </h4>
                <p style={{ 
                  color: '#6b7280', 
                  lineHeight: '1.5',
                  marginBottom: '8px'
                }}>
                  {activity.content.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {activity.content.category}
                  </span>
                  {activity.content.rating && (
                    <span style={{
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      ⭐ {activity.content.rating}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Member Content */}
            {isMember && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                  ¡Bienvenido a la comunidad! 🎉
                </p>
              </div>
            )}

            {/* Interaction Stats */}
            {activity.metadata && (isRecommendation || isProvider) && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #f3f4f6'
              }}>
                {activity.metadata.responseCount !== undefined && (
                  <button style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    💬 {activity.metadata.responseCount} respuesta{activity.metadata.responseCount !== 1 ? 's' : ''}
                  </button>
                )}
                
                {activity.metadata.helpfulVotes !== undefined && (
                  <button style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    👍 {activity.metadata.helpfulVotes} útil{activity.metadata.helpfulVotes !== 1 ? 'es' : ''}
                  </button>
                )}
                
                <button style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  🔗 Compartir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: showFullFeed ? '800px' : '100%', margin: '0 auto' }}>
      {showFullFeed && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #f3f4f6'
        }}>
          <h2 style={{ 
            color: '#1f2937', 
            fontSize: '24px', 
            fontWeight: 'bold',
            marginBottom: '16px'
          }}>
            📈 Feed de la Comunidad
          </h2>
          
          {/* Filters */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '8px'
          }}>
            {activityFilters.map((filterOption) => (
              <button
                key={filterOption.value}
                onClick={() => setFilter(filterOption.value)}
                style={{
                  padding: '8px 16px',
                  border: '2px solid',
                  borderColor: filter === filterOption.value ? '#3ce923' : '#e5e7eb',
                  borderRadius: '20px',
                  backgroundColor: filter === filterOption.value ? '#3ce923' : 'transparent',
                  color: filter === filterOption.value ? 'white' : '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {filterOption.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
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
      ) : activities.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '60px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #f3f4f6'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <h3 style={{ color: '#374151', marginBottom: '8px' }}>
            No hay actividad reciente
          </h3>
          <p style={{ color: '#6b7280' }}>
            {filter === 'all' 
              ? 'Sé el primero en crear actividad en tu comunidad'
              : `No hay actividades del tipo "${activityFilters.find(f => f.value === filter)?.label}"`
            }
          </p>
        </div>
      ) : (
        <>
          {/* Activities */}
          <div>
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>

          {/* Load More */}
          {showFullFeed && hasMore && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                onClick={() => loadFeed(true)}
                disabled={loadingMore}
                style={{
                  backgroundColor: loadingMore ? '#9ca3af' : '#3ce923',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto'
                }}
              >
                {loadingMore ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Cargando...
                  </>
                ) : (
                  '📄 Cargar más actividades'
                )}
              </button>
            </div>
          )}
        </>
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

export default CommunityFeed;