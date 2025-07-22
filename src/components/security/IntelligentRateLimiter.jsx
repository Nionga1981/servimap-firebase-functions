'use client';

import React, { useState, useEffect } from 'react';
import { 
  Gauge, 
  Shield, 
  AlertTriangle, 
  Activity,
  Clock,
  Users,
  Bot,
  Zap,
  Target,
  Brain,
  Radar,
  Globe,
  Smartphone,
  MessageSquare,
  CreditCard,
  Calendar,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Settings,
  Filter,
  Search,
  Ban,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Star,
  Award,
  Flag,
  Lock,
  Unlock,
  Info,
  Warning,
  AlertCircle,
  Timer,
  Crosshair
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
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function IntelligentRateLimiter({ 
  onRateLimitExceeded,
  onSuspiciousPattern,
  allowAmbassadorExceptions = true,
  adaptiveLimits = true,
  className = "" 
}) {
  const { user } = useAuth();
  
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [limiterSettings, setLimiterSettings] = useState({
    strictness: 'medium',
    ambassadorMode: true,
    adaptiveAI: true,
    autoAdjust: true,
    enableWhitelist: true
  });
  
  const [rateLimitStats, setRateLimitStats] = useState({});
  const [limitedUsers, setLimitedUsers] = useState([]);
  const [ambassadorExceptions, setAmbassadorExceptions] = useState([]);
  const [currentLimits, setCurrentLimits] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Límites inteligentes por tipo de usuario y acción
  const intelligentLimits = {
    // Usuarios regulares
    regular_user: {
      registrations: { limit: 1, window: 3600000, description: '1 registro por hora' }, // 1 hora
      service_requests: { limit: 10, window: 3600000, description: '10 solicitudes por hora' },
      messages: { limit: 50, window: 3600000, description: '50 mensajes por hora' },
      profile_updates: { limit: 5, window: 86400000, description: '5 actualizaciones por día' },
      reviews: { limit: 10, window: 86400000, description: '10 reseñas por día' },
      payments: { limit: 20, window: 86400000, description: '20 pagos por día' }
    },
    
    // Usuarios verificados (mayor confianza)
    verified_user: {
      registrations: { limit: 2, window: 3600000, description: '2 registros por hora' },
      service_requests: { limit: 25, window: 3600000, description: '25 solicitudes por hora' },
      messages: { limit: 100, window: 3600000, description: '100 mensajes por hora' },
      profile_updates: { limit: 10, window: 86400000, description: '10 actualizaciones por día' },
      reviews: { limit: 20, window: 86400000, description: '20 reseñas por día' },
      payments: { limit: 50, window: 86400000, description: '50 pagos por día' }
    },
    
    // Embajadores (límites muy permisivos para registros de referidos)
    ambassador: {
      registrations: { limit: 100, window: 3600000, description: '100 registros por hora (referidos)' },
      service_requests: { limit: 50, window: 3600000, description: '50 solicitudes por hora' },
      messages: { limit: 200, window: 3600000, description: '200 mensajes por hora' },
      profile_updates: { limit: 20, window: 86400000, description: '20 actualizaciones por día' },
      reviews: { limit: 30, window: 86400000, description: '30 reseñas por día' },
      payments: { limit: 100, window: 86400000, description: '100 pagos por día' },
      referrals: { limit: 50, window: 3600000, description: '50 referidos por hora' }
    },
    
    // Negocios/Empresas
    business: {
      registrations: { limit: 20, window: 3600000, description: '20 registros por hora (empleados)' },
      service_requests: { limit: 100, window: 3600000, description: '100 solicitudes por hora' },
      messages: { limit: 300, window: 3600000, description: '300 mensajes por hora' },
      profile_updates: { limit: 30, window: 86400000, description: '30 actualizaciones por día' },
      reviews: { limit: 50, window: 86400000, description: '50 reseñas por día' },
      payments: { limit: 200, window: 86400000, description: '200 pagos por día' }
    }
  };

  // Factores de detección de comportamiento legítimo vs bot
  const behaviorAnalysis = {
    human_indicators: [
      'Tiempo variable entre acciones',
      'Patrones de mouse naturales',
      'Velocidad de escritura humana',
      'Errores tipográficos normales',
      'Pausas para leer contenido',
      'Navegación exploratoria',
      'Respuestas contextuales'
    ],
    
    bot_indicators: [
      'Tiempo exacto entre acciones',
      'Movimientos de cursor perfectos',
      'Velocidad de escritura constante',
      'Sin errores tipográficos',
      'Sin pausas para leer',
      'Navegación lineal/predecible',
      'Respuestas genéricas'
    ],
    
    ambassador_patterns: [
      'Registros de referidos espaciados',
      'Comunicación personalizada',
      'Seguimiento post-registro',
      'Variación en datos de referidos',
      'Interacción social genuina'
    ]
  };

  // Datos mock
  const mockRateLimitStats = {
    totalRequests: 156789,
    blockedRequests: 2341,
    allowedRequests: 154448,
    ambassadorExceptions: 456,
    adaptiveAdjustments: 89,
    accuracy: 98.5
  };

  const mockLimitedUsers = [
    {
      id: 'user123',
      userType: 'regular_user',
      action: 'service_requests',
      currentCount: 15,
      limit: 10,
      windowStart: new Date(Date.now() - 30 * 60 * 1000),
      windowEnd: new Date(Date.now() + 30 * 60 * 1000),
      status: 'rate_limited',
      suspiciousScore: 0.7,
      isBot: false,
      exceptions: [],
      lastActivity: new Date(Date.now() - 5 * 60 * 1000)
    },
    {
      id: 'amb456',
      userType: 'ambassador',
      action: 'registrations',
      currentCount: 25,
      limit: 100,
      windowStart: new Date(Date.now() - 45 * 60 * 1000),
      windowEnd: new Date(Date.now() + 15 * 60 * 1000),
      status: 'allowed',
      suspiciousScore: 0.1,
      isBot: false,
      exceptions: ['ambassador_verified', 'human_behavior_confirmed'],
      lastActivity: new Date(Date.now() - 1 * 60 * 1000)
    },
    {
      id: 'bot789',
      userType: 'regular_user',
      action: 'messages',
      currentCount: 75,
      limit: 50,
      windowStart: new Date(Date.now() - 20 * 60 * 1000),
      windowEnd: new Date(Date.now() + 40 * 60 * 1000),
      status: 'blocked',
      suspiciousScore: 0.95,
      isBot: true,
      exceptions: [],
      lastActivity: new Date(Date.now() - 30 * 1000)
    }
  ];

  const mockAmbassadorExceptions = [
    {
      id: 'amb123',
      name: 'María González',
      totalReferrals: 234,
      successfulReferrals: 189,
      conversionRate: 80.8,
      trustScore: 9.2,
      verificationLevel: 'gold',
      allowedRegistrationsPerHour: 50,
      personalizedLimits: true
    },
    {
      id: 'amb456',
      name: 'Carlos Hernández',
      totalReferrals: 156,
      successfulReferrals: 134,
      conversionRate: 85.9,
      trustScore: 9.7,
      verificationLevel: 'platinum',
      allowedRegistrationsPerHour: 75,
      personalizedLimits: true
    }
  ];

  useEffect(() => {
    loadRateLimitStats();
    loadLimitedUsers();
    loadAmbassadorExceptions();
    if (isMonitoring) {
      startRealTimeMonitoring();
    }
  }, [isMonitoring]);

  const loadRateLimitStats = async () => {
    try {
      setRateLimitStats(mockRateLimitStats);
    } catch (error) {
      console.error('Error loading rate limit stats:', error);
    }
  };

  const loadLimitedUsers = async () => {
    try {
      setLimitedUsers(mockLimitedUsers);
    } catch (error) {
      console.error('Error loading limited users:', error);
    }
  };

  const loadAmbassadorExceptions = async () => {
    try {
      setAmbassadorExceptions(mockAmbassadorExceptions);
    } catch (error) {
      console.error('Error loading ambassador exceptions:', error);
    }
  };

  const startRealTimeMonitoring = () => {
    const interval = setInterval(() => {
      console.log('Real-time intelligent rate limiting active...');
      // En producción, esto monitorearía requests en tiempo real
    }, 3000);

    return () => clearInterval(interval);
  };

  // Función principal de análisis de rate limiting
  const analyzeRateLimit = async (requestData) => {
    setIsAnalyzing(true);
    
    try {
      const analysisResult = await performRateLimitAnalysis(requestData);
      
      if (analysisResult.shouldLimit) {
        await handleRateLimitExceeded(analysisResult);
      }
      
      return analysisResult;
      
    } catch (error) {
      console.error('Error in rate limit analysis:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const performRateLimitAnalysis = async (requestData) => {
    // Simular análisis inteligente
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const { userId, action, userType = 'regular_user' } = requestData;
    
    // Obtener límites para el tipo de usuario
    const limits = intelligentLimits[userType] || intelligentLimits.regular_user;
    const actionLimit = limits[action];
    
    if (!actionLimit) {
      return { shouldLimit: false, reason: 'Action not monitored' };
    }
    
    // Simular conteo actual de requests
    const currentCount = Math.floor(Math.random() * (actionLimit.limit * 1.5));
    
    // Análisis de comportamiento (bot vs humano)
    const behaviorAnalysis = await analyzeBehaviorPatterns(requestData);
    
    // Verificar si es embajador con excepciones
    const ambassadorAnalysis = await analyzeAmbassadorStatus(userId);
    
    // Aplicar lógica inteligente
    let shouldLimit = currentCount > actionLimit.limit;
    let confidence = 0.8;
    
    // Excepciones para embajadores verificados
    if (ambassadorAnalysis.isVerifiedAmbassador && action === 'registrations') {
      const ambassadorLimit = ambassadorAnalysis.personalizedLimit || actionLimit.limit * 2;
      shouldLimit = currentCount > ambassadorLimit;
      confidence = 0.9;
    }
    
    // Reducir límites si se detecta comportamiento de bot
    if (behaviorAnalysis.isBotLikely && behaviorAnalysis.confidence > 0.8) {
      const botLimit = Math.floor(actionLimit.limit * 0.3); // 30% del límite normal
      shouldLimit = currentCount > botLimit;
      confidence = 0.95;
    }
    
    // Aumentar límites para usuarios verificados con buen comportamiento
    if (behaviorAnalysis.isHumanLikely && behaviorAnalysis.confidence > 0.9) {
      const verifiedLimit = Math.floor(actionLimit.limit * 1.5); // 150% del límite normal
      shouldLimit = currentCount > verifiedLimit;
      confidence = 0.85;
    }
    
    return {
      shouldLimit,
      confidence,
      currentCount,
      limit: actionLimit.limit,
      userType,
      action,
      behaviorAnalysis,
      ambassadorAnalysis,
      recommendation: getRecommendation(shouldLimit, behaviorAnalysis, ambassadorAnalysis),
      adaptiveLimit: calculateAdaptiveLimit(actionLimit.limit, behaviorAnalysis, ambassadorAnalysis)
    };
  };

  const analyzeBehaviorPatterns = async (requestData) => {
    // Simular análisis de patrones de comportamiento
    const humanScore = Math.random() * 0.5 + 0.3; // 0.3-0.8
    const botScore = 1 - humanScore;
    
    const isHumanLikely = humanScore > 0.6;
    const isBotLikely = botScore > 0.7;
    
    return {
      humanScore,
      botScore,
      isHumanLikely,
      isBotLikely,
      confidence: Math.max(humanScore, botScore),
      factors: {
        timingVariation: Math.random() > 0.5,
        mouseMovementNatural: Math.random() > 0.4,
        typingRhythmHuman: Math.random() > 0.6,
        errorPatternsNormal: Math.random() > 0.7,
        navigationOrganic: Math.random() > 0.5
      }
    };
  };

  const analyzeAmbassadorStatus = async (userId) => {
    // Verificar si el usuario es embajador verificado
    const ambassador = mockAmbassadorExceptions.find(amb => amb.id === userId);
    
    if (ambassador) {
      return {
        isVerifiedAmbassador: true,
        trustScore: ambassador.trustScore,
        conversionRate: ambassador.conversionRate,
        verificationLevel: ambassador.verificationLevel,
        personalizedLimit: ambassador.allowedRegistrationsPerHour,
        totalReferrals: ambassador.totalReferrals
      };
    }
    
    return {
      isVerifiedAmbassador: false,
      trustScore: 0,
      conversionRate: 0,
      verificationLevel: 'none',
      personalizedLimit: null,
      totalReferrals: 0
    };
  };

  const getRecommendation = (shouldLimit, behaviorAnalysis, ambassadorAnalysis) => {
    if (ambassadorAnalysis.isVerifiedAmbassador) {
      return shouldLimit ? 'limit_with_ambassador_review' : 'allow_ambassador_activity';
    }
    
    if (behaviorAnalysis.isBotLikely) {
      return 'strict_limit_bot_detected';
    }
    
    if (behaviorAnalysis.isHumanLikely) {
      return shouldLimit ? 'soft_limit_human_verified' : 'allow_human_activity';
    }
    
    return shouldLimit ? 'standard_limit_exceeded' : 'allow_standard_activity';
  };

  const calculateAdaptiveLimit = (baseLimit, behaviorAnalysis, ambassadorAnalysis) => {
    let adaptiveLimit = baseLimit;
    
    // Incremento para embajadores verificados
    if (ambassadorAnalysis.isVerifiedAmbassador) {
      adaptiveLimit *= (1 + ambassadorAnalysis.trustScore / 10); // +10-100% basado en trust score
    }
    
    // Reducción para comportamiento sospechoso
    if (behaviorAnalysis.isBotLikely) {
      adaptiveLimit *= 0.2; // Reducir a 20% del límite
    }
    
    // Incremento para usuarios verificados
    if (behaviorAnalysis.isHumanLikely && behaviorAnalysis.confidence > 0.8) {
      adaptiveLimit *= 1.3; // Incrementar 30%
    }
    
    return Math.round(adaptiveLimit);
  };

  const handleRateLimitExceeded = async (analysisResult) => {
    const limitRecord = {
      id: Date.now().toString(),
      userId: 'current_user',
      userType: analysisResult.userType,
      action: analysisResult.action,
      currentCount: analysisResult.currentCount,
      limit: analysisResult.limit,
      adaptiveLimit: analysisResult.adaptiveLimit,
      timestamp: new Date(),
      status: getStatusFromRecommendation(analysisResult.recommendation),
      behaviorAnalysis: analysisResult.behaviorAnalysis,
      ambassadorAnalysis: analysisResult.ambassadorAnalysis
    };

    // Agregar al historial
    setLimitedUsers(prev => [limitRecord, ...prev.slice(0, 49)]);

    // Ejecutar acción recomendada
    await executeRecommendation(analysisResult.recommendation, limitRecord);

    // Notificar callbacks
    onRateLimitExceeded?.(limitRecord);
    if (analysisResult.behaviorAnalysis.isBotLikely) {
      onSuspiciousPattern?.(limitRecord);
    }
  };

  const getStatusFromRecommendation = (recommendation) => {
    switch (recommendation) {
      case 'strict_limit_bot_detected': return 'blocked';
      case 'limit_with_ambassador_review': return 'limited_pending_review';
      case 'soft_limit_human_verified': return 'limited_soft';
      case 'standard_limit_exceeded': return 'rate_limited';
      default: return 'allowed';
    }
  };

  const executeRecommendation = async (recommendation, record) => {
    switch (recommendation) {
      case 'strict_limit_bot_detected':
        await blockBotActivity(record);
        break;
      case 'limit_with_ambassador_review':
        await limitWithAmbassadorReview(record);
        break;
      case 'soft_limit_human_verified':
        await applySoftLimit(record);
        break;
      case 'standard_limit_exceeded':
        await applyStandardLimit(record);
        break;
    }
  };

  const blockBotActivity = async (record) => {
    console.log('Blocking bot activity:', record);
    
    toast({
      title: "Bot detectado y bloqueado",
      description: "Comportamiento automatizado detectado y limitado estrictamente",
      variant: "destructive"
    });
  };

  const limitWithAmbassadorReview = async (record) => {
    console.log('Limiting ambassador activity for review:', record);
    
    toast({
      title: "Límite de embajador alcanzado",
      description: "Actividad de embajador en revisión - límites temporalmente reducidos"
    });
  };

  const applySoftLimit = async (record) => {
    console.log('Applying soft limit:', record);
    
    toast({
      title: "Límite suave aplicado",
      description: "Usuario verificado - límite aplicado con mayor flexibilidad"
    });
  };

  const applyStandardLimit = async (record) => {
    console.log('Applying standard limit:', record);
    
    toast({
      title: "Límite estándar alcanzado",
      description: "Has alcanzado el límite para esta acción. Intenta de nuevo más tarde."
    });
  };

  const adjustLimitsForUser = async (userId, newLimits) => {
    try {
      // TODO: Implementar ajuste real de límites
      console.log('Adjusting limits for user:', userId, newLimits);
      
      toast({
        title: "Límites ajustados",
        description: "Los límites del usuario han sido actualizados exitosamente"
      });
    } catch (error) {
      toast({
        title: "Error al ajustar límites",
        description: "No se pudieron actualizar los límites del usuario",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'rate_limited': return 'bg-orange-100 text-orange-800';
      case 'limited_soft': return 'bg-yellow-100 text-yellow-800';
      case 'limited_pending_review': return 'bg-blue-100 text-blue-800';
      case 'allowed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserTypeColor = (userType) => {
    switch (userType) {
      case 'ambassador': return 'bg-purple-100 text-purple-800';
      case 'business': return 'bg-blue-100 text-blue-800';
      case 'verified_user': return 'bg-green-100 text-green-800';
      case 'regular_user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVerificationIcon = (level) => {
    switch (level) {
      case 'platinum': return <Award className="h-4 w-4 text-purple-600" />;
      case 'gold': return <Star className="h-4 w-4 text-yellow-600" />;
      case 'silver': return <CheckCircle className="h-4 w-4 text-gray-600" />;
      default: return <Users className="h-4 w-4 text-gray-600" />;
    }
  };

  const LimitAdjustmentDialog = ({ user }) => {
    const [adjustments, setAdjustments] = useState({});

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1" />
            Ajustar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Límites - {user?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Ajusta los límites específicos para este usuario basado en su comportamiento y confiabilidad.
              </AlertDescription>
            </Alert>
            
            {/* Aquí irían los controles para ajustar límites específicos */}
            <div className="space-y-3">
              <div>
                <Label>Multiplicador de límites</Label>
                <Slider
                  value={[1]}
                  onValueChange={(value) => setAdjustments(prev => ({...prev, multiplier: value[0]}))}
                  max={3}
                  min={0.1}
                  step={0.1}
                  className="mt-2"
                />
                <div className="text-sm text-gray-600 mt-1">
                  Factor: 1.0x (límites estándar)
                </div>
              </div>
            </div>
            
            <Button 
              onClick={() => adjustLimitsForUser(user?.id, adjustments)}
              className="w-full"
            >
              Aplicar Ajustes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const filteredUsers = limitedUsers.filter(user => 
    !searchQuery || 
    user.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.userType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-purple-600" />
              Rate Limiting Inteligente
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant={isMonitoring ? "default" : "secondary"}>
                {isMonitoring ? 'Activo' : 'Inactivo'}
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
            <Brain className="h-4 w-4" />
            <AlertDescription>
              <strong>IA Adaptativa:</strong> Sistema que distingue automáticamente entre embajadores 
              legítimos y bots, ajustando límites dinámicamente para maximizar conversiones 
              mientras previene abuso.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="users">Usuarios Limitados</TabsTrigger>
          <TabsTrigger value="ambassadors">Embajadores</TabsTrigger>
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
                      {rateLimitStats.totalRequests?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Requests analizados</div>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {rateLimitStats.blockedRequests?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Requests bloqueados</div>
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
                      {rateLimitStats.allowedRequests?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Requests permitidos</div>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {rateLimitStats.ambassadorExceptions}
                    </div>
                    <div className="text-sm text-gray-600">Excepciones embajador</div>
                  </div>
                  <Award className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {rateLimitStats.adaptiveAdjustments}
                    </div>
                    <div className="text-sm text-gray-600">Ajustes adaptativos</div>
                  </div>
                  <Brain className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {rateLimitStats.accuracy}%
                    </div>
                    <div className="text-sm text-gray-600">Precisión del sistema</div>
                  </div>
                  <Target className="h-8 w-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Limits Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Límites Actuales por Tipo de Usuario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(intelligentLimits).map(([userType, limits]) => (
                  <div key={userType} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className={getUserTypeColor(userType)}>
                        {userType.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(limits).slice(0, 4).map(([action, limit]) => (
                        <div key={action} className="flex items-center justify-between text-sm">
                          <span className="capitalize">{action.replace('_', ' ')}</span>
                          <span className="font-medium">{limit.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Behavior Analysis Indicators */}
          <Card>
            <CardHeader>
              <CardTitle>Indicadores de Análisis de Comportamiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium text-green-600 mb-3">Indicadores Humanos</h4>
                  <div className="space-y-1">
                    {behaviorAnalysis.human_indicators.map((indicator, index) => (
                      <div key={index} className="flex items-center text-sm">
                        <CheckCircle className="h-3 w-3 text-green-600 mr-2" />
                        {indicator}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-red-600 mb-3">Indicadores de Bot</h4>
                  <div className="space-y-1">
                    {behaviorAnalysis.bot_indicators.map((indicator, index) => (
                      <div key={index} className="flex items-center text-sm">
                        <Bot className="h-3 w-3 text-red-600 mr-2" />
                        {indicator}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-purple-600 mb-3">Patrones de Embajador</h4>
                  <div className="space-y-1">
                    {behaviorAnalysis.ambassador_patterns.map((pattern, index) => (
                      <div key={index} className="flex items-center text-sm">
                        <Award className="h-3 w-3 text-purple-600 mr-2" />
                        {pattern}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <Input
                placeholder="Buscar por ID de usuario, tipo o acción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Limited Users List */}
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Gauge className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No hay usuarios limitados
                  </h3>
                  <p className="text-gray-600">
                    Cuando se apliquen límites de rate aparecerán aquí
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredUsers.map((limitedUser) => (
                <Card key={limitedUser.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Gauge className="h-6 w-6 text-orange-600" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold">{limitedUser.id}</h3>
                            <Badge className={getStatusColor(limitedUser.status)}>
                              {limitedUser.status.replace('_', ' ')}
                            </Badge>
                            <Badge className={getUserTypeColor(limitedUser.userType)}>
                              {limitedUser.userType.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <strong>Acción:</strong> {limitedUser.action}
                            </div>
                            <div>
                              <strong>Uso:</strong> {limitedUser.currentCount}/{limitedUser.limit}
                            </div>
                            <div>
                              <strong>Ventana:</strong> {Math.round((limitedUser.windowEnd - limitedUser.windowStart) / 60000)}min
                            </div>
                            <div>
                              <strong>Última actividad:</strong> {limitedUser.lastActivity.toLocaleTimeString()}
                            </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mb-3">
                            <Progress 
                              value={(limitedUser.currentCount / limitedUser.limit) * 100} 
                              className="h-2"
                            />
                          </div>
                          
                          {/* Behavior Analysis */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Puntuación sospechosa:</strong> 
                              <span className={`ml-1 font-medium ${
                                limitedUser.suspiciousScore > 0.7 ? 'text-red-600' : 
                                limitedUser.suspiciousScore > 0.4 ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                {Math.round(limitedUser.suspiciousScore * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center">
                              <strong>Tipo de usuario:</strong>
                              <span className="ml-1 flex items-center">
                                {limitedUser.isBot ? (
                                  <>
                                    <Bot className="h-4 w-4 text-red-600 mr-1" />
                                    <span className="text-red-600">Bot detectado</span>
                                  </>
                                ) : (
                                  <>
                                    <Users className="h-4 w-4 text-green-600 mr-1" />
                                    <span className="text-green-600">Humano verificado</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                          
                          {limitedUser.exceptions?.length > 0 && (
                            <div className="mt-3">
                              <strong className="text-sm">Excepciones:</strong>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {limitedUser.exceptions.map((exception, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {exception.replace('_', ' ')}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                        <LimitAdjustmentDialog user={limitedUser} />
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Detalles
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="ambassadors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Embajadores Verificados con Límites Especiales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ambassadorExceptions.map((ambassador) => (
                  <Card key={ambassador.id} className="border-purple-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            {getVerificationIcon(ambassador.verificationLevel)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-semibold">{ambassador.name}</h3>
                              <Badge className="bg-purple-100 text-purple-800">
                                {ambassador.verificationLevel}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                              <div>
                                <strong>ID:</strong> {ambassador.id}
                              </div>
                              <div>
                                <strong>Referidos totales:</strong> {ambassador.totalReferrals}
                              </div>
                              <div>
                                <strong>Tasa de conversión:</strong> {ambassador.conversionRate}%
                              </div>
                              <div>
                                <strong>Puntuación de confianza:</strong> {ambassador.trustScore}/10
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm">
                              <div>
                                <strong>Límite personalizado:</strong> {ambassador.allowedRegistrationsPerHour} registros/hora
                              </div>
                              <div>
                                <strong>Referidos exitosos:</strong> {ambassador.successfulReferrals}
                              </div>
                            </div>
                            
                            <div className="mt-3">
                              <div className="text-sm text-gray-600 mb-1">Progreso de confianza</div>
                              <Progress value={ambassador.trustScore * 10} className="h-2" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-1" />
                            Ajustar Límites
                          </Button>
                          <Button variant="outline" size="sm">
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Ver Métricas
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Rate Limiting Inteligente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Nivel de Estrictez</Label>
                    <Select 
                      value={limiterSettings.strictness} 
                      onValueChange={(value) => 
                        setLimiterSettings(prev => ({...prev, strictness: value}))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Bajo - Límites permisivos</SelectItem>
                        <SelectItem value="medium">Medio - Balance entre seguridad y usabilidad</SelectItem>
                        <SelectItem value="high">Alto - Máxima protección</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ambassador-mode">Modo Embajador Especial</Label>
                    <Switch
                      id="ambassador-mode"
                      checked={limiterSettings.ambassadorMode}
                      onCheckedChange={(checked) => 
                        setLimiterSettings(prev => ({...prev, ambassadorMode: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="adaptive-ai">IA Adaptativa</Label>
                    <Switch
                      id="adaptive-ai"
                      checked={limiterSettings.adaptiveAI}
                      onCheckedChange={(checked) => 
                        setLimiterSettings(prev => ({...prev, adaptiveAI: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-adjust">Ajuste Automático</Label>
                    <Switch
                      id="auto-adjust"
                      checked={limiterSettings.autoAdjust}
                      onCheckedChange={(checked) => 
                        setLimiterSettings(prev => ({...prev, autoAdjust: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="whitelist">Lista Blanca Habilitada</Label>
                    <Switch
                      id="whitelist"
                      checked={limiterSettings.enableWhitelist}
                      onCheckedChange={(checked) => 
                        setLimiterSettings(prev => ({...prev, enableWhitelist: checked}))
                      }
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Alert>
                    <Award className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Modo Embajador:</strong> Permite límites especiales para embajadores 
                      verificados, incrementando conversiones sin comprometer la seguridad.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Brain className="h-4 w-4" />
                    <AlertDescription>
                      <strong>IA Adaptativa:</strong> Utiliza machine learning para ajustar 
                      límites en tiempo real basándose en patrones de comportamiento.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Ajuste Automático:</strong> El sistema modifica límites 
                      dinámicamente para optimizar la experiencia del usuario.
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

// Hook para usar el rate limiter
export function useIntelligentRateLimiter() {
  const [limitResult, setLimitResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkRateLimit = async (requestData) => {
    setIsChecking(true);
    try {
      // TODO: Implementar verificación real
      const result = {
        allowed: true,
        remaining: 45,
        resetTime: new Date(Date.now() + 3600000),
        adaptiveLimit: 50
      };
      setLimitResult(result);
      return result;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      throw error;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    limitResult,
    isChecking,
    checkRateLimit
  };
}

// Componente para mostrar estado de límite en línea
export function RateLimitIndicator({ userId, action, userType = 'regular_user' }) {
  const [limitStatus, setLimitStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  React.useEffect(() => {
    const checkLimit = async () => {
      setChecking(true);
      try {
        // Simular verificación de límite
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const usage = Math.floor(Math.random() * 100);
        const limit = userType === 'ambassador' ? 100 : 50;
        
        setLimitStatus({
          current: usage,
          limit,
          percentage: (usage / limit) * 100,
          canProceed: usage < limit
        });
      } catch (error) {
        console.error('Error checking limit:', error);
      } finally {
        setChecking(false);
      }
    };

    if (userId && action) {
      checkLimit();
    }
  }, [userId, action, userType]);

  if (checking) {
    return (
      <div className="text-xs text-gray-500 flex items-center">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Verificando límites...
      </div>
    );
  }

  if (!limitStatus) return null;

  return (
    <div className={`text-xs p-2 rounded ${
      limitStatus.canProceed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span>Uso: {limitStatus.current}/{limitStatus.limit}</span>
        <span>{Math.round(limitStatus.percentage)}%</span>
      </div>
      <Progress value={limitStatus.percentage} className="h-1" />
    </div>
  );
}