import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

const CommunityModerationPanel = ({ communityId, userRole = 'moderator' }) => {
  const [reports, setReports] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reports');
  const [processingAction, setProcessingAction] = useState(null);

  const canModerate = ['owner', 'admin', 'moderator'].includes(userRole);

  useEffect(() => {
    if (communityId && canModerate) {
      loadModerationData();
    }
  }, [communityId, canModerate]);

  const loadModerationData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadReports(),
        loadPendingApprovals()
      ]);
    } catch (error) {
      console.error('Error cargando datos de moderación:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      // En una implementación real, cargarías reportes de la base de datos
      // Por ahora usamos datos simulados
      setReports([
        {
          id: 'report1',
          contentType: 'recommendation',
          contentId: 'rec123',
          reporterId: 'user1',
          reporterName: 'Ana López',
          reportedUserId: 'user2',
          reportedUserName: 'Carlos Ruiz',
          reason: 'spam',
          description: 'Está enviando mensajes repetitivos sobre su negocio',
          content: {
            title: 'Necesito carpintero urgente!!!',
            description: 'Contacten a mi primo que es carpintero, muy bueno y barato!!!',
            category: 'Carpintería'
          },
          status: 'pending',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          reportCount: 3
        },
        {
          id: 'report2',
          contentType: 'message',
          contentId: 'msg456',
          reporterId: 'user3',
          reporterName: 'María García',
          reportedUserId: 'user4',
          reportedUserName: 'Pedro Sánchez',
          reason: 'inappropriate',
          description: 'Lenguaje inapropiado en los mensajes',
          content: {
            message: 'No seas tonto, ese precio está muy caro...'
          },
          status: 'pending',
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          reportCount: 1
        }
      ]);
    } catch (error) {
      console.error('Error cargando reportes:', error);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      // En una implementación real, cargarías solicitudes pendientes
      setPendingApprovals([
        {
          id: 'req1',
          type: 'membership',
          userId: 'user5',
          userName: 'Sandra Torres',
          userEmail: 'sandra@email.com',
          joinReason: 'Vivo en el edificio B, departamento 203',
          verificationData: {
            hasLocation: true,
            distance: 0.1 // km
          },
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
        },
        {
          id: 'req2',
          type: 'membership',
          userId: 'user6',
          userName: 'Roberto Díaz',
          userEmail: 'roberto@email.com',
          joinReason: 'Trabajo en la zona y me interesa los servicios locales',
          verificationData: {
            hasLocation: false,
            distance: 5.2 // km
          },
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
        }
      ]);
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    }
  };

  const handleModerationAction = async (reportId, action, reason = '') => {
    setProcessingAction(reportId);
    
    try {
      const moderateContent = httpsCallable(functions, 'moderateContent');
      const result = await moderateContent({
        reportId,
        action,
        reason
      });

      if (result.data.success) {
        // Actualizar el reporte en la lista
        setReports(prev => prev.map(report => 
          report.id === reportId 
            ? { ...report, status: 'resolved', action, resolvedAt: new Date() }
            : report
        ));
        
        alert(`✅ Acción "${action}" aplicada exitosamente`);
      }
    } catch (error) {
      console.error('Error aplicando acción:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleMembershipAction = async (requestId, action) => {
    setProcessingAction(requestId);
    
    try {
      const approveMembershipRequest = httpsCallable(functions, 'approveMembershipRequest');
      const result = await approveMembershipRequest({
        requestId,
        action,
        communityId
      });

      if (result.data.success) {
        // Remover de la lista de pendientes
        setPendingApprovals(prev => prev.filter(req => req.id !== requestId));
        alert(`✅ Solicitud ${action === 'approve' ? 'aprobada' : 'rechazada'} exitosamente`);
      }
    } catch (error) {
      console.error('Error procesando solicitud:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setProcessingAction(null);
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
    return `hace ${diffDays}d`;
  };

  const getReasonIcon = (reason) => {
    switch (reason) {
      case 'spam': return '📧';
      case 'inappropriate': return '🚫';
      case 'harassment': return '⚠️';
      case 'false_info': return '❌';
      case 'off_topic': return '📍';
      default: return '🚨';
    }
  };

  const getReasonText = (reason) => {
    switch (reason) {
      case 'spam': return 'Spam/Publicidad';
      case 'inappropriate': return 'Contenido Inapropiado';
      case 'harassment': return 'Acoso/Bullying';
      case 'false_info': return 'Información Falsa';
      case 'off_topic': return 'Fuera de Tema';
      default: return 'Otro';
    }
  };

  const ReportCard = ({ report }) => {
    const isProcessing = processingAction === report.id;

    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: report.reportCount >= 3 ? '2px solid #f97316' : '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>{getReasonIcon(report.reason)}</span>
              <span style={{ fontWeight: '600', color: '#1f2937' }}>
                {getReasonText(report.reason)}
              </span>
              {report.reportCount > 1 && (
                <span style={{
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {report.reportCount} reportes
                </span>
              )}
            </div>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>
              Reportado por: <strong>{report.reporterName}</strong>
            </p>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Usuario reportado: <strong>{report.reportedUserName}</strong>
            </p>
          </div>
          <span style={{ color: '#9ca3af', fontSize: '12px' }}>
            {formatTimeAgo(report.createdAt)}
          </span>
        </div>

        <div style={{ 
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px'
        }}>
          <p style={{ color: '#374151', fontSize: '14px', marginBottom: '8px' }}>
            <strong>Descripción del reporte:</strong>
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            {report.description}
          </p>
        </div>

        <div style={{ 
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px'
        }}>
          <p style={{ color: '#374151', fontSize: '14px', marginBottom: '8px' }}>
            <strong>Contenido reportado:</strong>
          </p>
          {report.contentType === 'recommendation' && report.content.title && (
            <div>
              <p style={{ color: '#1f2937', fontWeight: '600', fontSize: '14px' }}>
                {report.content.title}
              </p>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                {report.content.description}
              </p>
            </div>
          )}
          {report.contentType === 'message' && (
            <p style={{ color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
              &quot;{report.content.message}&quot;
            </p>
          )}
        </div>

        {report.status === 'pending' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleModerationAction(report.id, 'approve')}
              disabled={isProcessing}
              style={{
                backgroundColor: '#10b981',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.6 : 1
              }}
            >
              ✅ Aprobar
            </button>
            
            <button
              onClick={() => handleModerationAction(report.id, 'warn', 'Advertencia por contenido inapropiado')}
              disabled={isProcessing}
              style={{
                backgroundColor: '#f59e0b',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.6 : 1
              }}
            >
              ⚠️ Advertir
            </button>
            
            <button
              onClick={() => handleModerationAction(report.id, 'remove', 'Contenido removido por violación de reglas')}
              disabled={isProcessing}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.6 : 1
              }}
            >
              🗑️ Remover
            </button>
            
            <button
              onClick={() => handleModerationAction(report.id, 'suspend', 'Usuario suspendido temporalmente')}
              disabled={isProcessing}
              style={{
                backgroundColor: '#7c2d12',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.6 : 1
              }}
            >
              🔒 Suspender
            </button>
          </div>
        )}

        {report.status === 'resolved' && (
          <div style={{
            backgroundColor: '#dcfce7',
            color: '#166534',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            ✅ Resuelto - Acción: {report.action}
          </div>
        )}
      </div>
    );
  };

  const MembershipRequestCard = ({ request }) => {
    const isProcessing = processingAction === request.id;
    const isLocalResident = request.verificationData?.distance < 1;

    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: isLocalResident ? '2px solid #3ce923' : '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h4 style={{ color: '#1f2937', fontWeight: '600', marginBottom: '4px' }}>
              {request.userName}
            </h4>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
              {request.userEmail}
            </p>
            {isLocalResident && (
              <span style={{
                backgroundColor: '#dcfce7',
                color: '#166534',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                🏘️ Residente Local ({request.verificationData.distance.toFixed(1)}km)
              </span>
            )}
          </div>
          <span style={{ color: '#9ca3af', fontSize: '12px' }}>
            {formatTimeAgo(request.createdAt)}
          </span>
        </div>

        <div style={{ 
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px'
        }}>
          <p style={{ color: '#374151', fontSize: '14px', marginBottom: '4px' }}>
            <strong>Razón para unirse:</strong>
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            {request.joinReason}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleMembershipAction(request.id, 'approve')}
            disabled={isProcessing}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            ✅ Aprobar
          </button>
          
          <button
            onClick={() => handleMembershipAction(request.id, 'reject')}
            disabled={isProcessing}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            ❌ Rechazar
          </button>
        </div>
      </div>
    );
  };

  if (!canModerate) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '60px',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
        <h3 style={{ color: '#374151', marginBottom: '8px' }}>
          Sin permisos de moderación
        </h3>
        <p style={{ color: '#6b7280' }}>
          Solo moderadores, administradores y propietarios pueden acceder a este panel
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
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
          🛡️ Panel de Moderación
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          Gestiona reportes y solicitudes de membresía de la comunidad
        </p>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <button
              onClick={() => setActiveTab('reports')}
              style={{
                padding: '12px 0',
                border: 'none',
                background: 'none',
                color: activeTab === 'reports' ? '#ef4444' : '#6b7280',
                fontWeight: activeTab === 'reports' ? '600' : '500',
                borderBottom: activeTab === 'reports' ? '2px solid #ef4444' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🚨 Reportes ({reports.filter(r => r.status === 'pending').length})
            </button>
            
            <button
              onClick={() => setActiveTab('approvals')}
              style={{
                padding: '12px 0',
                border: 'none',
                background: 'none',
                color: activeTab === 'approvals' ? '#f59e0b' : '#6b7280',
                fontWeight: activeTab === 'approvals' ? '600' : '500',
                borderBottom: activeTab === 'approvals' ? '2px solid #f59e0b' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ⏳ Solicitudes ({pendingApprovals.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
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
            borderTop: '4px solid #ef4444',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      ) : (
        <div>
          {activeTab === 'reports' && (
            <div>
              {reports.filter(r => r.status === 'pending').length === 0 ? (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '60px',
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                  <h3 style={{ color: '#374151', marginBottom: '8px' }}>
                    No hay reportes pendientes
                  </h3>
                  <p style={{ color: '#6b7280' }}>
                    ¡Excelente! Tu comunidad está funcionando sin problemas
                  </p>
                </div>
              ) : (
                reports
                  .filter(r => r.status === 'pending')
                  .map((report) => (
                    <ReportCard key={report.id} report={report} />
                  ))
              )}
            </div>
          )}

          {activeTab === 'approvals' && (
            <div>
              {pendingApprovals.length === 0 ? (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '60px',
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                  <h3 style={{ color: '#374151', marginBottom: '8px' }}>
                    No hay solicitudes pendientes
                  </h3>
                  <p style={{ color: '#6b7280' }}>
                    Todas las solicitudes de membresía han sido procesadas
                  </p>
                </div>
              ) : (
                pendingApprovals.map((request) => (
                  <MembershipRequestCard key={request.id} request={request} />
                ))
              )}
            </div>
          )}
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

export default CommunityModerationPanel;