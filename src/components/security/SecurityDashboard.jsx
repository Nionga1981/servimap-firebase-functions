'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Activity,
  Users,
  Bot,
  Flag,
  MessageSquare,
  Fingerprint,
  Radar,
  Gauge,
  Eye,
  EyeOff,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  LineChart,
  Target,
  Zap,
  Brain,
  Lock,
  Unlock,
  Ban,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Warning,
  Search,
  Filter,
  Settings,
  RefreshCw,
  Download,
  Upload,
  ExternalLink,
  Calendar,
  Globe,
  Smartphone,
  CreditCard,
  Star,
  Award,
  Crown,
  Crosshair,
  Timer,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function SecurityDashboard({ 
  realTimeUpdates = true,
  autoRefresh = 30, // seconds
  className = "" 
}) {
  const { user } = useAuth();
  
  const [securityOverview, setSecurityOverview] = useState({});
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [systemStatus, setSystemStatus] = useState({});
  const [threatLevel, setThreatLevel] = useState('medium');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedSystem, setSelectedSystem] = useState('all');

  // Sistemas de seguridad monitoreados
  const securitySystems = {
    age_verification: {
      name: 'Verificación de Edad',
      icon: Shield,
      status: 'active',
      health: 98.5,
      alertsCount: 23,
      description: 'Validación 18+ con logging de menores'
    },
    document_verification: {
      name: 'Verificación de Documentos',
      icon: Fingerprint,
      status: 'active',
      health: 96.2,
      alertsCount: 12,
      description: 'Validación de identidad con IA'
    },
    chat_moderation: {
      name: 'Moderación de Chats',
      icon: MessageSquare,
      status: 'active',
      health: 94.7,
      alertsCount: 67,
      description: 'Detección de contenido prohibido'
    },
    anti_duplicate: {
      name: 'Anti-Duplicados',
      icon: Users,
      status: 'active',
      health: 97.1,
      alertsCount: 34,
      description: 'Detección de cuentas múltiples'
    },
    suspicious_activity: {
      name: 'Actividad Sospechosa',
      icon: Radar,
      status: 'active',
      health: 95.8,
      alertsCount: 89,
      description: 'Patrones de comportamiento anómalo'
    },
    user_reporting: {
      name: 'Reportes de Usuarios',
      icon: Flag,
      status: 'active',
      health: 99.1,
      alertsCount: 156,
      description: 'Sistema de denuncias y resolución'
    },
    rate_limiter: {
      name: 'Rate Limiting',
      icon: Gauge,
      status: 'active',
      health: 98.9,
      alertsCount: 45,
      description: 'Control inteligente de frecuencia'
    },
    fraud_detection: {
      name: 'Detección de Fraude',
      icon: CreditCard,
      status: 'active',
      health: 93.4,
      alertsCount: 78,
      description: 'Prevención de fraude en pagos'
    }
  };

  // Datos mock para dashboard
  const mockSecurityOverview = {
    totalThreats: 1247,
    threatsBlocked: 1189,
    activeSessions: 15634,
    suspiciousActivities: 234,
    falsePositives: 58,
    systemUptime: 99.7,
    responseTime: 0.3,
    lastUpdate: new Date()
  };

  const mockRecentAlerts = [
    {
      id: 'ALT-001',
      system: 'chat_moderation',
      severity: 'critical',
      type: 'Content Violation',
      message: 'Usuario intentó intercambiar información de contacto',
      userId: 'user123',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      status: 'resolved',
      actionTaken: 'Mensaje bloqueado, usuario advertido'
    },
    {
      id: 'ALT-002',
      system: 'anti_duplicate',
      severity: 'high',
      type: 'Duplicate Account',
      message: 'Posible cuenta duplicada detectada',
      userId: 'user456',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      status: 'investigating',
      actionTaken: 'Cuenta marcada para revisión manual'
    },
    {
      id: 'ALT-003',
      system: 'fraud_detection',
      severity: 'critical',
      type: 'Payment Fraud',
      message: 'Patrón de fraude detectado en transacción',
      userId: 'user789',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      status: 'blocked',
      actionTaken: 'Transacción bloqueada, cuenta suspendida'
    },
    {
      id: 'ALT-004',
      system: 'suspicious_activity',
      severity: 'medium',
      type: 'Unusual Behavior',
      message: 'Actividad inusual: múltiples registros desde misma IP',
      userId: 'user101',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      status: 'monitoring',
      actionTaken: 'Monitoreo intensivo activado'
    },
    {
      id: 'ALT-005',
      system: 'rate_limiter',
      severity: 'medium',
      type: 'Rate Limit Exceeded',
      message: 'Usuario excedió límite de solicitudes de servicio',
      userId: 'user202',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      status: 'limited',
      actionTaken: 'Límites temporales aplicados'
    }
  ];

  const mockSystemStatus = {
    overall_health: 96.8,
    active_threats: 23,
    systems_online: 8,
    systems_total: 8,
    last_incident: new Date(Date.now() - 4 * 60 * 60 * 1000),
    maintenance_scheduled: false
  };

  useEffect(() => {
    loadSecurityData();
    
    if (realTimeUpdates && autoRefresh > 0) {
      const interval = setInterval(() => {
        refreshData();
      }, autoRefresh * 1000);
      
      return () => clearInterval(interval);
    }
  }, [realTimeUpdates, autoRefresh, timeRange]);

  const loadSecurityData = async () => {
    try {
      setSecurityOverview(mockSecurityOverview);
      setRecentAlerts(mockRecentAlerts);
      setSystemStatus(mockSystemStatus);
    } catch (error) {
      console.error('Error loading security data:', error);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await loadSecurityData();
      // Simular actualización de datos en tiempo real
      setSecurityOverview(prev => ({
        ...prev,
        activeSessions: prev.activeSessions + Math.floor(Math.random() * 20 - 10),
        lastUpdate: new Date()
      }));
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleThreatResponse = async (alertId, action) => {
    try {
      // TODO: Implementar respuesta real a amenazas
      console.log('Handling threat response:', alertId, action);
      
      setRecentAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, status: action, actionTaken: `Acción: ${action}` }
            : alert
        )
      );
      
      toast({
        title: "Acción ejecutada",
        description: `La acción "${action}" se ha aplicado correctamente`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo ejecutar la acción",
        variant: "destructive"
      });
    }
  };

  const exportSecurityReport = async () => {
    try {
      // TODO: Implementar exportación real
      const reportData = {
        overview: securityOverview,
        alerts: recentAlerts,
        systemStatus: systemStatus,
        timeRange,
        generatedAt: new Date()
      };
      
      console.log('Exporting security report:', reportData);
      
      toast({
        title: "Reporte exportado",
        description: "El reporte de seguridad se ha generado exitosamente"
      });
    } catch (error) {
      toast({
        title: "Error de exportación",
        description: "No se pudo generar el reporte",
        variant: "destructive"
      });
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'investigating': return 'bg-blue-100 text-blue-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'monitoring': return 'bg-yellow-100 text-yellow-800';
      case 'limited': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthColor = (health) => {
    if (health >= 95) return 'text-green-600';
    if (health >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getThreatLevelColor = (level) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredAlerts = selectedSystem === 'all' 
    ? recentAlerts 
    : recentAlerts.filter(alert => alert.system === selectedSystem);

  const ThreatResponseDialog = ({ alert }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Shield className="h-4 w-4 mr-1" />
          Responder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Respuesta a Amenaza - {alert.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Detalles de la Amenaza</h4>
            <div className="space-y-1 text-sm">
              <div><strong>Sistema:</strong> {securitySystems[alert.system]?.name}</div>
              <div><strong>Tipo:</strong> {alert.type}</div>
              <div><strong>Severidad:</strong> <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge></div>
              <div><strong>Usuario:</strong> {alert.userId}</div>
              <div><strong>Mensaje:</strong> {alert.message}</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Acciones Disponibles:</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                onClick={() => handleThreatResponse(alert.id, 'resolved')}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Resolver
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleThreatResponse(alert.id, 'escalated')}
                className="w-full"
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Escalar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleThreatResponse(alert.id, 'ignored')}
                className="w-full"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Ignorar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleThreatResponse(alert.id, 'investigating')}
                className="w-full"
              >
                <Search className="h-4 w-4 mr-1" />
                Investigar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Shield className="h-6 w-6 text-indigo-600" />
                Centro de Comando de Seguridad
              </CardTitle>
              <p className="text-gray-600 mt-1">
                Monitoreo integral y respuesta a amenazas en tiempo real
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={`text-lg px-4 py-2 ${getThreatLevelColor(threatLevel)}`}>
                Nivel de Amenaza: {threatLevel.toUpperCase()}
              </Badge>
              <Button 
                variant="outline" 
                onClick={refreshData}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {systemStatus.systems_online}/{systemStatus.systems_total}
              </div>
              <div className="text-sm text-gray-600">Sistemas Activos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(systemStatus.overall_health)}%
              </div>
              <div className="text-sm text-gray-600">Salud General</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {systemStatus.active_threats}
              </div>
              <div className="text-sm text-gray-600">Amenazas Activas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {securityOverview.activeSessions?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Sesiones Activas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {securityOverview.totalThreats?.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Amenazas Detectadas</div>
              </div>
              <AlertTriangle className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-2">
              <Progress value={85} className="h-2" />
              <div className="text-xs text-gray-500 mt-1">85% resueltas</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {securityOverview.threatsBlocked?.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Amenazas Bloqueadas</div>
              </div>
              <Ban className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2">
              <Progress value={95} className="h-2" />
              <div className="text-xs text-gray-500 mt-1">95% de efectividad</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {securityOverview.suspiciousActivities}
                </div>
                <div className="text-sm text-gray-600">Actividades Sospechosas</div>
              </div>
              <Radar className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-2">
              <Progress value={12} className="h-2" />
              <div className="text-xs text-gray-500 mt-1">12% del total</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {securityOverview.responseTime}s
                </div>
                <div className="text-sm text-gray-600">Tiempo de Respuesta</div>
              </div>
              <Timer className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="mt-2">
              <Progress value={90} className="h-2" />
              <div className="text-xs text-gray-500 mt-1">Excelente rendimiento</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="systems">Sistemas</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Security Systems Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Estado de Sistemas de Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(securitySystems).map(([key, system]) => {
                  const Icon = system.icon;
                  return (
                    <div key={key} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-blue-600" />
                          <h3 className="font-medium">{system.name}</h3>
                        </div>
                        <Badge className={system.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {system.status}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{system.description}</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Salud del sistema</span>
                          <span className={`font-medium ${getHealthColor(system.health)}`}>
                            {system.health}%
                          </span>
                        </div>
                        <Progress value={system.health} className="h-2" />
                        
                        <div className="flex items-center justify-between text-sm">
                          <span>Alertas pendientes</span>
                          <Badge variant="outline">{system.alertsCount}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">94.8%</div>
                    <div className="text-sm text-gray-600">Tasa de Detección</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">0.3s</div>
                    <div className="text-sm text-gray-600">Tiempo de Respuesta</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">99.7%</div>
                    <div className="text-sm text-gray-600">Uptime del Sistema</div>
                  </div>
                </div>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Última actualización:</strong> {securityOverview.lastUpdate?.toLocaleString()}
                    {realTimeUpdates && ` - Actualizaciones automáticas cada ${autoRefresh}s`}
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          {/* Alert Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Input placeholder="Buscar alertas..." />
                </div>
                <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los sistemas</SelectItem>
                    {Object.entries(securitySystems).map(([key, system]) => (
                      <SelectItem key={key} value={key}>{system.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Última hora</SelectItem>
                    <SelectItem value="24h">Últimas 24h</SelectItem>
                    <SelectItem value="7d">Últimos 7 días</SelectItem>
                    <SelectItem value="30d">Últimos 30 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Alerts List */}
          <div className="space-y-4">
            {filteredAlerts.map((alert) => (
              <Card key={alert.id} className={`border-l-4 ${
                alert.severity === 'critical' ? 'border-l-red-500' :
                alert.severity === 'high' ? 'border-l-orange-500' :
                alert.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="p-2 bg-red-100 rounded-lg">
                        {React.createElement(securitySystems[alert.system]?.icon || AlertTriangle, {
                          className: "h-5 w-5 text-red-600"
                        })}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold">{alert.type}</h3>
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge className={getStatusColor(alert.status)}>
                            {alert.status}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-700 mb-2">{alert.message}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <strong>ID:</strong> {alert.id}
                          </div>
                          <div>
                            <strong>Sistema:</strong> {securitySystems[alert.system]?.name}
                          </div>
                          <div>
                            <strong>Usuario:</strong> {alert.userId}
                          </div>
                          <div>
                            <strong>Tiempo:</strong> {alert.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                        
                        {alert.actionTaken && (
                          <div className="p-2 bg-blue-50 rounded text-sm">
                            <strong>Acción tomada:</strong> {alert.actionTaken}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <ThreatResponseDialog alert={alert} />
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Detalles
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="systems" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(securitySystems).map(([key, system]) => {
              const Icon = system.icon;
              return (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        <span>{system.name}</span>
                      </div>
                      <Badge className={system.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {system.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-gray-600">{system.description}</p>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Salud del sistema</span>
                          <span className={getHealthColor(system.health)}>{system.health}%</span>
                        </div>
                        <Progress value={system.health} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-medium">Alertas pendientes</div>
                          <div className="text-gray-600">{system.alertsCount}</div>
                        </div>
                        <div>
                          <div className="font-medium">Estado</div>
                          <div className={system.status === 'active' ? 'text-green-600' : 'text-red-600'}>
                            {system.status === 'active' ? 'Operativo' : 'Fuera de línea'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Settings className="h-4 w-4 mr-1" />
                          Configurar
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <BarChart3 className="h-4 w-4 mr-1" />
                          Métricas
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tendencias de Amenazas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                    <span>Fraude en pagos</span>
                    <div className="flex items-center text-red-600">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      +23%
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                    <span>Cuentas duplicadas</span>
                    <div className="flex items-center text-green-600">
                      <TrendingDown className="h-4 w-4 mr-1" />
                      -15%
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                    <span>Contenido inapropiado</span>
                    <div className="flex items-center text-yellow-600">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      +8%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rendimiento por Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(securitySystems).slice(0, 5).map(([key, system]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{system.name}</span>
                        <span className={getHealthColor(system.health)}>{system.health}%</span>
                      </div>
                      <Progress value={system.health} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Métricas Clave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">98.5%</div>
                  <div className="text-sm text-gray-600">Precisión General</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded">
                  <div className="text-2xl font-bold text-green-600">0.3s</div>
                  <div className="text-sm text-gray-600">Tiempo de Detección</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded">
                  <div className="text-2xl font-bold text-purple-600">99.7%</div>
                  <div className="text-sm text-gray-600">Disponibilidad</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded">
                  <div className="text-2xl font-bold text-orange-600">2.1%</div>
                  <div className="text-sm text-gray-600">Falsos Positivos</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Dashboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="real-time">Actualizaciones en tiempo real</Label>
                    <Switch
                      id="real-time"
                      checked={realTimeUpdates}
                      onCheckedChange={() => {}}
                    />
                  </div>
                  
                  <div>
                    <Label>Intervalo de actualización</Label>
                    <Select value={autoRefresh.toString()}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 segundos</SelectItem>
                        <SelectItem value="30">30 segundos</SelectItem>
                        <SelectItem value="60">1 minuto</SelectItem>
                        <SelectItem value="300">5 minutos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Nivel de alerta por defecto</Label>
                    <Select value={threatLevel} onValueChange={setThreatLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Bajo</SelectItem>
                        <SelectItem value="medium">Medio</SelectItem>
                        <SelectItem value="high">Alto</SelectItem>
                        <SelectItem value="critical">Crítico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Button onClick={exportSecurityReport} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Reporte de Seguridad
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    <Database className="h-4 w-4 mr-2" />
                    Backup de Configuración
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Configuración Avanzada
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Hook para usar el dashboard de seguridad
export function useSecurityDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      // TODO: Implementar carga real de datos
      const data = {
        overview: {},
        alerts: [],
        systems: {},
        lastUpdate: new Date()
      };
      setDashboardData(data);
      return data;
    } catch (error) {
      console.error('Error loading dashboard:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    dashboardData,
    isLoading,
    loadDashboard
  };
}