'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Shield, 
  AlertTriangle, 
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  Brain,
  Zap,
  Clock,
  TrendingUp,
  BarChart3,
  Target,
  Radar,
  Globe,
  Smartphone,
  CreditCard,
  MessageSquare,
  Users,
  MapPin,
  Calendar,
  DollarSign,
  RefreshCw,
  Settings,
  Filter,
  Search,
  Flag,
  Lock,
  Unlock,
  Info,
  Warning,
  AlertCircle,
  Crosshair,
  Timer,
  Gauge
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
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function SuspiciousActivityDetector({ 
  onSuspiciousActivity,
  onThreatDetected,
  autoResponse = true,
  realTimeMonitoring = true,
  className = "" 
}) {
  const { user } = useAuth();
  
  const [isMonitoring, setIsMonitoring] = useState(realTimeMonitoring);
  const [detectionSettings, setDetectionSettings] = useState({
    sensitivity: 'medium',
    autoBlock: true,
    notifyAdmins: true,
    requireInvestigation: true,
    enableMLDetection: true
  });
  
  const [activityStats, setActivityStats] = useState({});
  const [detectedActivities, setDetectedActivities] = useState([]);
  const [threatLevels, setThreatLevels] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Patrones de actividad sospechosa específicos para ServiMap
  const suspiciousPatterns = {
    rapidRegistration: {
      name: 'Registro Masivo Rápido',
      description: 'Múltiples registros desde mismo dispositivo/IP en corto tiempo',
      severity: 'high',
      threshold: 5, // registros en 1 hora
      timeWindow: 3600000, // 1 hora en ms
      indicators: ['same_ip', 'same_device', 'similar_data']
    },
    
    geoLocationJumping: {
      name: 'Saltos Geográficos Imposibles',
      description: 'Actividad desde ubicaciones geográficamente imposibles',
      severity: 'critical',
      threshold: 2, // ubicaciones en 30 min
      timeWindow: 1800000, // 30 min
      indicators: ['impossible_travel', 'vpn_switching', 'location_spoofing']
    },
    
    priceManipulation: {
      name: 'Manipulación de Precios',
      description: 'Patrones anómalos en precios ofrecidos o solicitados',
      severity: 'medium',
      threshold: 3, // cambios drásticos
      timeWindow: 86400000, // 24 horas
      indicators: ['extreme_pricing', 'price_wars', 'undercutting']
    },
    
    massMessaging: {
      name: 'Mensajería Masiva',
      description: 'Envío masivo de mensajes idénticos o similares',
      severity: 'high',
      threshold: 10, // mensajes en 1 hora
      timeWindow: 3600000,
      indicators: ['identical_messages', 'bulk_sending', 'spam_patterns']
    },
    
    fakeReviews: {
      name: 'Reseñas Falsas',
      description: 'Patrones de reseñas artificiales o manipuladas',
      severity: 'medium',
      threshold: 5, // reseñas sospechosas
      timeWindow: 86400000,
      indicators: ['review_timing', 'language_patterns', 'rating_manipulation']
    },
    
    accountTakeover: {
      name: 'Intento de Toma de Cuenta',
      description: 'Actividad que sugiere compromiso de cuenta',
      severity: 'critical',
      threshold: 1, // cualquier indicador
      timeWindow: 3600000,
      indicators: ['login_anomalies', 'device_changes', 'behavior_shift']
    },
    
    paymentFraud: {
      name: 'Fraude en Pagos',
      description: 'Patrones sospechosos en transacciones financieras',
      severity: 'critical',
      threshold: 2, // transacciones sospechosas
      timeWindow: 3600000,
      indicators: ['card_testing', 'chargeback_patterns', 'unusual_amounts']
    },
    
    serviceAbuse: {
      name: 'Abuso de Servicios',
      description: 'Uso inapropiado o abusivo de la plataforma',
      severity: 'medium',
      threshold: 3, // incidentes
      timeWindow: 86400000,
      indicators: ['inappropriate_requests', 'platform_gaming', 'policy_violations']
    }
  };

  // Datos mock
  const mockActivityStats = {
    totalAnalyzed: 45672,
    suspiciousDetected: 234,
    threatsBlocked: 89,
    falsePositives: 12,
    accuracyRate: 94.9,
    avgResponseTime: 0.4
  };

  const mockDetectedActivities = [
    {
      id: '1',
      userId: 'user123',
      pattern: 'rapidRegistration',
      severity: 'high',
      confidence: 0.89,
      indicators: ['same_ip', 'same_device'],
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      status: 'blocked',
      location: 'Ciudad de México, MX',
      deviceInfo: 'Chrome/Mobile',
      actionTaken: 'Registro bloqueado temporalmente'
    },
    {
      id: '2',
      userId: 'user456',
      pattern: 'geoLocationJumping',
      severity: 'critical',
      confidence: 0.95,
      indicators: ['impossible_travel', 'vpn_switching'],
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      status: 'investigating',
      location: 'Tokyo, JP → London, GB',
      deviceInfo: 'Firefox/Desktop',
      actionTaken: 'Cuenta suspendida para investigación'
    },
    {
      id: '3',
      userId: 'user789',
      pattern: 'massMessaging',
      severity: 'high',
      confidence: 0.87,
      indicators: ['identical_messages', 'bulk_sending'],
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'confirmed',
      location: 'Guadalajara, MX',
      deviceInfo: 'Safari/Mobile',
      actionTaken: 'Mensajería limitada por 24h'
    }
  ];

  const mockThreatLevels = {
    current: 'medium',
    trends: {
      increasing: ['rapidRegistration', 'fakeReviews'],
      decreasing: ['accountTakeover'],
      stable: ['priceManipulation', 'serviceAbuse']
    },
    predictions: {
      nextHour: 'medium',
      next24h: 'high',
      nextWeek: 'medium'
    }
  };

  useEffect(() => {
    loadActivityStats();
    loadDetectedActivities();
    loadThreatLevels();
    if (isMonitoring) {
      startRealTimeDetection();
    }
  }, [isMonitoring]);

  const loadActivityStats = async () => {
    try {
      setActivityStats(mockActivityStats);
    } catch (error) {
      console.error('Error loading activity stats:', error);
    }
  };

  const loadDetectedActivities = async () => {
    try {
      setDetectedActivities(mockDetectedActivities);
    } catch (error) {
      console.error('Error loading detected activities:', error);
    }
  };

  const loadThreatLevels = async () => {
    try {
      setThreatLevels(mockThreatLevels);
    } catch (error) {
      console.error('Error loading threat levels:', error);
    }
  };

  const startRealTimeDetection = () => {
    const interval = setInterval(() => {
      console.log('Real-time suspicious activity detection active...');
      // En producción, esto se conectaría a streams de datos en tiempo real
    }, 5000);

    return () => clearInterval(interval);
  };

  // Función principal de análisis de actividad sospechosa
  const analyzeUserActivity = async (activityData) => {
    setIsAnalyzing(true);
    
    try {
      const analysisResult = await performActivityAnalysis(activityData);
      
      if (analysisResult.isSuspicious) {
        await handleSuspiciousActivity(analysisResult);
      }
      
      return analysisResult;
      
    } catch (error) {
      console.error('Error in activity analysis:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const performActivityAnalysis = async (activityData) => {
    // Simular análisis ML/AI
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const detectedPatterns = [];
    let maxSeverity = 'low';
    let maxConfidence = 0;

    // Analizar cada patrón sospechoso
    for (const [patternKey, pattern] of Object.entries(suspiciousPatterns)) {
      const patternResult = await analyzePattern(activityData, pattern);
      
      if (patternResult.detected) {
        detectedPatterns.push({
          pattern: patternKey,
          ...patternResult
        });
        
        if (patternResult.confidence > maxConfidence) {
          maxConfidence = patternResult.confidence;
          maxSeverity = pattern.severity;
        }
      }
    }

    const isSuspicious = detectedPatterns.length > 0 && maxConfidence > 0.6;

    return {
      isSuspicious,
      confidence: maxConfidence,
      severity: maxSeverity,
      detectedPatterns,
      riskScore: calculateRiskScore(detectedPatterns),
      recommendation: getRecommendation(maxSeverity, maxConfidence),
      mlInsights: await generateMLInsights(activityData, detectedPatterns)
    };
  };

  const analyzePattern = async (activityData, pattern) => {
    // Simulación de análisis específico por patrón
    const baseDetectionRate = {
      'critical': 0.1,
      'high': 0.15,
      'medium': 0.25,
      'low': 0.4
    };

    const detected = Math.random() < baseDetectionRate[pattern.severity];
    
    if (!detected) {
      return { detected: false, confidence: 0 };
    }

    // Simular confianza basada en múltiples indicadores
    const indicatorMatches = pattern.indicators.filter(() => Math.random() > 0.6);
    const confidence = Math.min(0.95, 0.5 + (indicatorMatches.length / pattern.indicators.length) * 0.45);

    return {
      detected: true,
      confidence,
      matchingIndicators: indicatorMatches,
      threshold: pattern.threshold,
      timeWindow: pattern.timeWindow,
      description: pattern.description
    };
  };

  const calculateRiskScore = (detectedPatterns) => {
    let score = 0;
    const severityWeights = { low: 1, medium: 3, high: 7, critical: 15 };
    
    detectedPatterns.forEach(pattern => {
      const patternInfo = suspiciousPatterns[pattern.pattern];
      const weight = severityWeights[patternInfo.severity] || 1;
      score += weight * pattern.confidence;
    });
    
    return Math.min(100, Math.round(score));
  };

  const getRecommendation = (severity, confidence) => {
    if (severity === 'critical' && confidence > 0.8) return 'immediate_block';
    if (severity === 'critical' || (severity === 'high' && confidence > 0.7)) return 'investigate_and_restrict';
    if (severity === 'high' || confidence > 0.6) return 'monitor_closely';
    return 'continue_monitoring';
  };

  const generateMLInsights = async (activityData, detectedPatterns) => {
    // Simular insights de ML
    const insights = [];
    
    if (detectedPatterns.length > 1) {
      insights.push('Múltiples patrones detectados sugieren actividad coordinada');
    }
    
    if (detectedPatterns.some(p => suspiciousPatterns[p.pattern].severity === 'critical')) {
      insights.push('Patrón crítico detectado - revisión inmediata recomendada');
    }
    
    insights.push(`Confianza del modelo: ${Math.round(Math.random() * 20 + 80)}%`);
    
    return insights;
  };

  const handleSuspiciousActivity = async (analysisResult) => {
    const activityRecord = {
      id: Date.now().toString(),
      userId: 'current_user',
      pattern: analysisResult.detectedPatterns[0]?.pattern || 'unknown',
      severity: analysisResult.severity,
      confidence: analysisResult.confidence,
      indicators: analysisResult.detectedPatterns.flatMap(p => p.matchingIndicators),
      timestamp: new Date(),
      status: getStatusFromRecommendation(analysisResult.recommendation),
      location: 'Current Location',
      deviceInfo: navigator.userAgent.split(')')[0] + ')',
      actionTaken: getActionFromRecommendation(analysisResult.recommendation),
      riskScore: analysisResult.riskScore,
      mlInsights: analysisResult.mlInsights
    };

    // Agregar al historial
    setDetectedActivities(prev => [activityRecord, ...prev.slice(0, 49)]);

    // Ejecutar acción recomendada
    await executeRecommendation(analysisResult.recommendation, activityRecord);

    // Notificar callbacks
    onSuspiciousActivity?.(activityRecord);
    if (analysisResult.severity === 'critical') {
      onThreatDetected?.(activityRecord);
    }
  };

  const getStatusFromRecommendation = (recommendation) => {
    switch (recommendation) {
      case 'immediate_block': return 'blocked';
      case 'investigate_and_restrict': return 'investigating';
      case 'monitor_closely': return 'monitoring';
      default: return 'detected';
    }
  };

  const getActionFromRecommendation = (recommendation) => {
    switch (recommendation) {
      case 'immediate_block': return 'Cuenta bloqueada inmediatamente';
      case 'investigate_and_restrict': return 'Cuenta restringida - bajo investigación';
      case 'monitor_closely': return 'Monitoreo intensivo activado';
      default: return 'Actividad registrada para análisis';
    }
  };

  const executeRecommendation = async (recommendation, record) => {
    switch (recommendation) {
      case 'immediate_block':
        await blockUser(record);
        break;
      case 'investigate_and_restrict':
        await restrictUser(record);
        await startInvestigation(record);
        break;
      case 'monitor_closely':
        await enableIntensiveMonitoring(record);
        break;
    }
  };

  const blockUser = async (record) => {
    console.log('Blocking user immediately:', record);
    
    if (autoResponse) {
      toast({
        title: "Usuario bloqueado",
        description: "Actividad crítica detectada - usuario bloqueado por seguridad",
        variant: "destructive"
      });
    }
  };

  const restrictUser = async (record) => {
    console.log('Restricting user:', record);
    
    toast({
      title: "Cuenta restringida",
      description: "Actividad sospechosa detectada - funciones limitadas",
      variant: "destructive"
    });
  };

  const startInvestigation = async (record) => {
    console.log('Starting investigation:', record);
  };

  const enableIntensiveMonitoring = async (record) => {
    console.log('Enabling intensive monitoring:', record);
  };

  const manualAnalysis = async (userId) => {
    try {
      setIsAnalyzing(true);
      
      // Simular análisis manual
      const mockActivityData = { userId, timestamp: new Date() };
      const result = await analyzeUserActivity(mockActivityData);
      
      toast({
        title: result.isSuspicious ? "Actividad sospechosa detectada" : "Actividad normal",
        description: `Puntuación de riesgo: ${result.riskScore}/100`,
        variant: result.isSuspicious ? "destructive" : "default"
      });
      
      return result;
    } catch (error) {
      toast({
        title: "Error en análisis",
        description: "No se pudo completar el análisis manual",
        variant: "destructive"
      });
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'investigating': return 'bg-yellow-100 text-yellow-800';
      case 'monitoring': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-orange-100 text-orange-800';
      case 'detected': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getThreatLevelColor = (level) => {
    switch (level) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const ManualAnalysisDialog = () => {
    const [analysisUserId, setAnalysisUserId] = useState('');
    const [analysisResult, setAnalysisResult] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    const handleAnalysis = async () => {
      if (!analysisUserId.trim()) return;
      
      setAnalyzing(true);
      const result = await manualAnalysis(analysisUserId);
      setAnalysisResult(result);
      setAnalyzing(false);
    };

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Search className="h-4 w-4 mr-2" />
            Análisis Manual
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Análisis Manual de Actividad Sospechosa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ID de Usuario a Analizar</Label>
              <Input
                value={analysisUserId}
                onChange={(e) => setAnalysisUserId(e.target.value)}
                placeholder="user123"
              />
            </div>
            
            <Button 
              onClick={handleAnalysis}
              disabled={!analysisUserId.trim() || analyzing}
              className="w-full"
            >
              {analyzing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Radar className="h-4 w-4 mr-2" />
              )}
              Ejecutar Análisis Completo
            </Button>
            
            {analysisResult && (
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Resultado:</span>
                  <Badge className={analysisResult.isSuspicious ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                    {analysisResult.isSuspicious ? 'Actividad Sospechosa' : 'Actividad Normal'}
                  </Badge>
                </div>
                
                <div>
                  <strong>Puntuación de Riesgo:</strong> {analysisResult.riskScore}/100
                </div>
                
                <div>
                  <strong>Confianza:</strong> {Math.round(analysisResult.confidence * 100)}%
                </div>
                
                <div>
                  <strong>Severidad:</strong> <span className={getSeverityColor(analysisResult.severity)}>
                    {analysisResult.severity}
                  </span>
                </div>
                
                <div>
                  <strong>Recomendación:</strong> {analysisResult.recommendation?.replace(/_/g, ' ')}
                </div>
                
                {analysisResult.detectedPatterns?.length > 0 && (
                  <div>
                    <strong>Patrones Detectados:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysisResult.detectedPatterns.map((pattern, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {pattern.pattern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {analysisResult.mlInsights?.length > 0 && (
                  <div>
                    <strong>Insights de IA:</strong>
                    <ul className="text-sm text-gray-600 mt-1">
                      {analysisResult.mlInsights.map((insight, index) => (
                        <li key={index}>• {insight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-orange-600" />
              Detector de Actividad Sospechosa
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge 
                variant={isMonitoring ? "default" : "secondary"}
                className={isMonitoring ? 'bg-green-600' : ''}
              >
                {isMonitoring ? 'Monitoreando' : 'Inactivo'}
              </Badge>
              <Switch
                checked={isMonitoring}
                onCheckedChange={setIsMonitoring}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Crosshair className="h-4 w-4" />
            <AlertDescription>
              <strong>Detección inteligente:</strong> Sistema de IA que identifica patrones 
              sospechosos en tiempo real, incluyendo fraude, manipulación y abuso de la plataforma 
              con 94.9% de precisión.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Threat Level Indicator */}
      <Card className="border-2 border-yellow-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Nivel de Amenaza Actual
            </div>
            <Badge className={`text-lg px-4 py-2 ${getSeverityColor(threatLevels.current)}`}>
              {threatLevels.current?.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium text-green-600 mb-2">↗ Aumentando</h4>
              <div className="space-y-1">
                {threatLevels.trends?.increasing?.map(threat => (
                  <Badge key={threat} variant="outline" className="text-xs">
                    {threat}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-red-600 mb-2">↘ Disminuyendo</h4>
              <div className="space-y-1">
                {threatLevels.trends?.decreasing?.map(threat => (
                  <Badge key={threat} variant="outline" className="text-xs">
                    {threat}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-600 mb-2">→ Estable</h4>
              <div className="space-y-1">
                {threatLevels.trends?.stable?.map(threat => (
                  <Badge key={threat} variant="outline" className="text-xs">
                    {threat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="detections">Detecciones</TabsTrigger>
          <TabsTrigger value="patterns">Patrones</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {activityStats.totalAnalyzed?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Actividades analizadas</div>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {activityStats.suspiciousDetected}
                    </div>
                    <div className="text-sm text-gray-600">Actividades sospechosas</div>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {activityStats.threatsBlocked}
                    </div>
                    <div className="text-sm text-gray-600">Amenazas bloqueadas</div>
                  </div>
                  <Ban className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {activityStats.accuracyRate}%
                    </div>
                    <div className="text-sm text-gray-600">Precisión del sistema</div>
                  </div>
                  <Target className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {activityStats.falsePositives}
                    </div>
                    <div className="text-sm text-gray-600">Falsos positivos</div>
                  </div>
                  <XCircle className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {activityStats.avgResponseTime}s
                    </div>
                    <div className="text-sm text-gray-600">Tiempo de respuesta</div>
                  </div>
                  <Timer className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Real-time Monitoring */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Monitoreo en Tiempo Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Patrones Activos</h4>
                  <div className="space-y-2">
                    {Object.entries(suspiciousPatterns).slice(0, 4).map(([key, pattern]) => (
                      <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{pattern.name}</span>
                        <Badge className={getSeverityColor(pattern.severity)}>
                          {pattern.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Acciones Rápidas</h4>
                  <div className="space-y-2">
                    <ManualAnalysisDialog />
                    
                    <Button variant="outline" className="w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Ver Reportes Detallados
                    </Button>
                    
                    <Button variant="outline" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar Alertas
                    </Button>
                    
                    <Button variant="outline" className="w-full">
                      <Filter className="h-4 w-4 mr-2" />
                      Personalizar Filtros
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detections" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar por usuario, patrón, ubicación..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las detecciones</SelectItem>
                    <SelectItem value="critical">Solo críticas</SelectItem>
                    <SelectItem value="blocked">Solo bloqueadas</SelectItem>
                    <SelectItem value="investigating">En investigación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Detections List */}
          <Card>
            <CardHeader>
              <CardTitle>Detecciones Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              {detectedActivities.length === 0 ? (
                <div className="text-center py-8">
                  <Radar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No hay detecciones recientes
                  </h3>
                  <p className="text-gray-600">
                    Cuando se detecte actividad sospechosa aparecerá aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {detectedActivities
                    .filter(activity => 
                      !searchQuery || 
                      activity.userId.includes(searchQuery) ||
                      activity.pattern.includes(searchQuery) ||
                      activity.location.includes(searchQuery)
                    )
                    .map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={getStatusColor(activity.status)}>
                              {activity.status.replace('_', ' ')}
                            </Badge>
                            <Badge className={getSeverityColor(activity.severity)}>
                              {activity.severity}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              Confianza: {Math.round(activity.confidence * 100)}%
                            </span>
                            {activity.riskScore && (
                              <span className="text-sm font-medium text-red-600">
                                Riesgo: {activity.riskScore}/100
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm">
                            <div>
                              <strong>Usuario:</strong> {activity.userId}
                            </div>
                            <div>
                              <strong>Patrón:</strong> {suspiciousPatterns[activity.pattern]?.name || activity.pattern}
                            </div>
                            <div>
                              <strong>Ubicación:</strong> {activity.location}
                            </div>
                            <div>
                              <strong>Dispositivo:</strong> {activity.deviceInfo}
                            </div>
                            <div>
                              <strong>Acción tomada:</strong> {activity.actionTaken}
                            </div>
                          </div>
                          
                          {activity.indicators?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {activity.indicators.map((indicator, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {indicator}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {activity.mlInsights?.length > 0 && (
                            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                              <strong>Insights de IA:</strong>
                              <ul className="mt-1">
                                {activity.mlInsights.map((insight, index) => (
                                  <li key={index}>• {insight}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right text-xs text-gray-500">
                        {activity.timestamp.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(suspiciousPatterns).map(([key, pattern]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{pattern.name}</span>
                    <Badge className={getSeverityColor(pattern.severity)}>
                      {pattern.severity}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-gray-600 text-sm">{pattern.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Umbral:</strong> {pattern.threshold}
                      </div>
                      <div>
                        <strong>Ventana:</strong> {Math.round(pattern.timeWindow / 60000)}min
                      </div>
                    </div>
                    
                    <div>
                      <strong>Indicadores:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pattern.indicators.map((indicator, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {indicator.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Este patrón se monitorea continuamente y activa alertas automáticas 
                        cuando se supera el umbral configurado.
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Detector</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Sensibilidad de Detección</Label>
                    <Select 
                      value={detectionSettings.sensitivity} 
                      onValueChange={(value) => 
                        setDetectionSettings(prev => ({...prev, sensitivity: value}))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja - Solo patrones obvios</SelectItem>
                        <SelectItem value="medium">Media - Balance entre precisión y cobertura</SelectItem>
                        <SelectItem value="high">Alta - Máxima detección</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-block">Bloqueo automático</Label>
                    <Switch
                      id="auto-block"
                      checked={detectionSettings.autoBlock}
                      onCheckedChange={(checked) => 
                        setDetectionSettings(prev => ({...prev, autoBlock: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-admins">Notificar administradores</Label>
                    <Switch
                      id="notify-admins"
                      checked={detectionSettings.notifyAdmins}
                      onCheckedChange={(checked) => 
                        setDetectionSettings(prev => ({...prev, notifyAdmins: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="require-investigation">Requiere investigación</Label>
                    <Switch
                      id="require-investigation"
                      checked={detectionSettings.requireInvestigation}
                      onCheckedChange={(checked) => 
                        setDetectionSettings(prev => ({...prev, requireInvestigation: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ml-detection">Detección con ML</Label>
                    <Switch
                      id="ml-detection"
                      checked={detectionSettings.enableMLDetection}
                      onCheckedChange={(checked) => 
                        setDetectionSettings(prev => ({...prev, enableMLDetection: checked}))
                      }
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Alert>
                    <Brain className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Machine Learning:</strong> Activa algoritmos avanzados de IA 
                      para detectar patrones complejos y amenazas emergentes.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Respuesta Automática:</strong> Permite que el sistema tome 
                      acciones inmediatas contra amenazas críticas sin intervención manual.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Warning className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Investigación Manual:</strong> Las amenazas de alta severidad 
                      siempre requieren revisión humana antes de acciones permanentes.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
              
              <div className="pt-6 border-t">
                <Button className="w-full">
                  Guardar Configuración
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Hook para usar el detector en otros componentes
export function useSuspiciousActivityDetector() {
  const [activityResult, setActivityResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeActivity = async (activityData) => {
    setIsAnalyzing(true);
    try {
      // TODO: Implementar análisis real
      const result = {
        isSuspicious: false,
        confidence: 0.05,
        severity: 'low',
        riskScore: 2
      };
      setActivityResult(result);
      return result;
    } catch (error) {
      console.error('Error analyzing activity:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    activityResult,
    isAnalyzing,
    analyzeActivity
  };
}

// Componente para monitoreo ligero
export function ActivityMonitor({ userId, onSuspiciousActivity }) {
  const [monitoring, setMonitoring] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  React.useEffect(() => {
    if (monitoring && userId) {
      const interval = setInterval(() => {
        // Simular monitoreo de actividad
        const suspiciousActivity = Math.random() > 0.95; // 5% probabilidad
        
        if (suspiciousActivity) {
          const activity = {
            userId,
            timestamp: new Date(),
            type: 'unusual_behavior',
            severity: 'medium'
          };
          
          setRecentActivity(prev => [activity, ...prev.slice(0, 9)]);
          onSuspiciousActivity?.(activity);
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [monitoring, userId, onSuspiciousActivity]);

  if (!monitoring) return null;

  return (
    <div className="text-xs text-gray-500 flex items-center">
      <Activity className="h-3 w-3 mr-1 animate-pulse" />
      Monitoreando actividad...
    </div>
  );
}