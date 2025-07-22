'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Shield, 
  AlertTriangle, 
  Eye,
  EyeOff,
  Ban,
  Clock,
  CheckCircle,
  XCircle,
  Brain,
  Zap,
  Settings,
  Filter,
  Activity,
  BarChart3,
  History,
  RefreshCw,
  Flag,
  Users,
  Lock,
  Unlock,
  Info,
  Warning,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export default function ChatModerator({ 
  onModerationAction,
  onSuspiciousActivity,
  autoModerationEnabled = true,
  realTimeMonitoring = true,
  className = "" 
}) {
  const { user } = useAuth();
  
  const [isMonitoring, setIsMonitoring] = useState(realTimeMonitoring);
  const [moderationSettings, setModerationSettings] = useState({
    strictness: 'medium',
    autoBlock: true,
    notifyUsers: true,
    logAll: true
  });
  
  const [moderationStats, setModerationStats] = useState({});
  const [recentModerations, setRecentModerations] = useState([]);
  const [blockedPatterns, setBlockedPatterns] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Patrones prohibidos detallados para ServiMap
  const prohibitedPatterns = {
    contactInfo: {
      patterns: [
        // Teléfonos
        /(?:\+?52\s?)?(?:\d{2,3}[-.\s]?)?\d{3,4}[-.\s]?\d{4}/g,
        /(?:tel|telefono|celular|cel|whats|whatsapp|phone)[:=\s]*\d+/gi,
        // Emails
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        // Redes sociales
        /@[A-Za-z0-9_]+/g,
        /(?:facebook|instagram|twitter|tiktok|snapchat)\.com\/[A-Za-z0-9_]+/gi,
        /(?:fb|ig|tw)[:=\s]*[A-Za-z0-9_]+/gi
      ],
      severity: 'high',
      action: 'block',
      message: 'No se permite intercambiar información de contacto personal'
    },
    
    addresses: {
      patterns: [
        // Direcciones específicas
        /(?:calle|av|avenida|col|colonia|#|num|numero)[\s:]*[A-Za-z0-9\s,#-]+/gi,
        /(?:entre|esquina|cerca de|junto a)[\s:]*[A-Za-z\s]+/gi,
        // Códigos postales
        /\b\d{5}\b/g,
        // Referencias específicas de ubicación
        /(?:mi casa|tu casa|en casa|venir a|ir a|llegar a)[\s:]*[A-Za-z0-9\s,#-]+/gi
      ],
      severity: 'high',
      action: 'block',
      message: 'No compartas direcciones específicas por seguridad'
    },
    
    paymentEvasion: {
      patterns: [
        // Evasión de comisiones
        /(?:sin comision|evitar comision|fuera de la app|outside app)/gi,
        /(?:pago directo|transferencia directa|cash|efectivo solo)/gi,
        /(?:no usar servimap|mejor directo|ahorramos comision)/gi,
        // Pagos externos
        /(?:paypal|mercadopago|oxxo|spei|transferencia)/gi,
        /(?:cuenta bancaria|clabe|tarjeta|deposito)/gi,
        /(?:venmo|zelle|cashapp)/gi
      ],
      severity: 'critical',
      action: 'block_and_warn',
      message: 'Los pagos deben realizarse a través de la plataforma ServiMap'
    },
    
    inappropriateServices: {
      patterns: [
        // Servicios prohibidos implícitos
        /(?:masaje|relajante|terapeutico).*(?:personal|privado|especial)/gi,
        /(?:compañia|acompañar|salir juntos|encuentro personal)/gi,
        /(?:servicio completo|servicio especial|extras)/gi,
        // Referencias sexuales indirectas
        /(?:discreto|privado|sin ropa|desnud)/gi
      ],
      severity: 'critical',
      action: 'block_and_report',
      message: 'Este tipo de servicios no está permitido en ServiMap'
    },
    
    scamAttempts: {
      patterns: [
        // Intentos de estafa
        /(?:anticipo|adelanto|deposito primero|paga antes)/gi,
        /(?:urgente|emergencia|necesito dinero|prestamo)/gi,
        /(?:ganancia facil|dinero rapido|inversion)/gi,
        // Phishing
        /(?:verificar cuenta|problema con pago|suspender servicio)/gi,
        /(?:click aqui|enlace|link|website)/gi
      ],
      severity: 'critical',
      action: 'block_and_report',
      message: 'Detectado posible intento de estafa'
    }
  };

  // Datos mock para estadísticas
  const mockModerationStats = {
    totalMessages: 15420,
    blockedMessages: 89,
    warningsIssued: 156,
    usersReported: 12,
    accuracyRate: 94.7,
    responseTime: 0.3
  };

  const mockRecentModerations = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      type: 'contactInfo',
      message: 'Mi WhatsApp es 55-1234-5678',
      action: 'blocked',
      userId: 'user123',
      chatId: 'chat456',
      confidence: 0.95
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      type: 'paymentEvasion',
      message: 'mejor pagame directo sin comisión',
      action: 'blocked_and_warned',
      userId: 'user789',
      chatId: 'chat101',
      confidence: 0.87
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      type: 'addresses',
      message: 'vive en calle reforma #123 col centro',
      action: 'blocked',
      userId: 'user456',
      chatId: 'chat789',
      confidence: 0.92
    }
  ];

  useEffect(() => {
    loadModerationStats();
    loadRecentModerations();
    if (isMonitoring) {
      startRealTimeMonitoring();
    }
  }, [isMonitoring]);

  const loadModerationStats = async () => {
    try {
      // TODO: Cargar estadísticas reales
      setModerationStats(mockModerationStats);
    } catch (error) {
      console.error('Error loading moderation stats:', error);
    }
  };

  const loadRecentModerations = async () => {
    try {
      // TODO: Cargar moderaciones reales
      setRecentModerations(mockRecentModerations);
    } catch (error) {
      console.error('Error loading recent moderations:', error);
    }
  };

  const startRealTimeMonitoring = () => {
    // Simular monitoreo en tiempo real
    const interval = setInterval(() => {
      // En producción, esto se conectaría a WebSocket o SSE
      console.log('Monitoring chats in real-time...');
    }, 5000);

    return () => clearInterval(interval);
  };

  // Función principal de moderación
  const moderateMessage = async (message, chatId, userId) => {
    setIsProcessing(true);
    
    try {
      const result = await analyzeMessage(message);
      
      if (result.violation) {
        await handleViolation(result, chatId, userId, message);
      }
      
      return result;
      
    } catch (error) {
      console.error('Error in moderation:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeMessage = async (message) => {
    // Simular análisis con OpenAI
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verificar patrones prohibidos
    for (const [category, config] of Object.entries(prohibitedPatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(message)) {
          return {
            violation: true,
            category,
            severity: config.severity,
            action: config.action,
            message: config.message,
            confidence: 0.85 + Math.random() * 0.15,
            detectedPattern: pattern.source
          };
        }
      }
    }

    // Simular análisis con IA para casos complejos
    const aiAnalysis = await simulateOpenAIAnalysis(message);
    
    return {
      violation: aiAnalysis.flagged,
      category: aiAnalysis.category,
      severity: aiAnalysis.severity,
      action: aiAnalysis.suggestedAction,
      message: aiAnalysis.reason,
      confidence: aiAnalysis.confidence,
      aiGenerated: true
    };
  };

  const simulateOpenAIAnalysis = async (message) => {
    // Simulación de análisis con OpenAI Moderation API
    const suspiciousKeywords = [
      'encuentro', 'privado', 'secreto', 'efectivo', 'sin app', 
      'directo', 'personal', 'especial', 'discord', 'telegram'
    ];
    
    const containsSuspicious = suspiciousKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    if (containsSuspicious) {
      return {
        flagged: true,
        category: 'suspicious',
        severity: 'medium',
        suggestedAction: 'warn',
        reason: 'El mensaje contiene términos que requieren revisión',
        confidence: 0.65 + Math.random() * 0.25
      };
    }
    
    return {
      flagged: false,
      category: null,
      severity: 'low',
      suggestedAction: 'allow',
      reason: 'Mensaje apropiado',
      confidence: 0.95
    };
  };

  const handleViolation = async (violation, chatId, userId, originalMessage) => {
    const moderationRecord = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type: violation.category,
      message: originalMessage,
      action: violation.action,
      userId,
      chatId,
      confidence: violation.confidence
    };

    // Agregar a historial
    setRecentModerations(prev => [moderationRecord, ...prev.slice(0, 49)]);

    // Ejecutar acción
    switch (violation.action) {
      case 'block':
        await blockMessage(moderationRecord);
        break;
      case 'warn':
        await warnUser(moderationRecord);
        break;
      case 'block_and_warn':
        await blockMessage(moderationRecord);
        await warnUser(moderationRecord);
        break;
      case 'block_and_report':
        await blockMessage(moderationRecord);
        await reportUser(moderationRecord);
        break;
    }

    // Notificar callbacks
    onModerationAction?.(moderationRecord);
    if (violation.severity === 'critical') {
      onSuspiciousActivity?.(moderationRecord);
    }
  };

  const blockMessage = async (record) => {
    console.log('Blocking message:', record);
    
    // TODO: Implementar bloqueo real del mensaje
    
    if (moderationSettings.notifyUsers) {
      toast({
        title: "Mensaje bloqueado",
        description: prohibitedPatterns[record.type]?.message || "Contenido no permitido",
        variant: "destructive"
      });
    }
  };

  const warnUser = async (record) => {
    console.log('Warning user:', record);
    
    // TODO: Enviar advertencia al usuario
    
    if (moderationSettings.notifyUsers) {
      toast({
        title: "Advertencia de moderación",
        description: "Tu mensaje ha sido marcado para revisión",
        variant: "destructive"
      });
    }
  };

  const reportUser = async (record) => {
    console.log('Reporting user:', record);
    
    // TODO: Reportar usuario a administradores
  };

  const testModeration = async (testMessage) => {
    try {
      const result = await moderateMessage(testMessage, 'test-chat', 'test-user');
      
      toast({
        title: result.violation ? "Violación detectada" : "Mensaje permitido",
        description: result.message || "Análisis completado",
        variant: result.violation ? "destructive" : "default"
      });
      
      return result;
    } catch (error) {
      toast({
        title: "Error en prueba",
        description: "No se pudo analizar el mensaje de prueba",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (action) => {
    switch (action) {
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'blocked_and_warned': return 'bg-red-100 text-red-800';
      case 'blocked_and_report': return 'bg-red-100 text-red-800';
      case 'warned': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'blocked': return <Ban className="h-4 w-4" />;
      case 'blocked_and_warned': return <AlertTriangle className="h-4 w-4" />;
      case 'blocked_and_report': return <Flag className="h-4 w-4" />;
      case 'warned': return <Warning className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const TestModerationDialog = () => {
    const [testMessage, setTestMessage] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);

    const handleTest = async () => {
      if (!testMessage.trim()) return;
      
      setTesting(true);
      const result = await testModeration(testMessage);
      setTestResult(result);
      setTesting(false);
    };

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Brain className="h-4 w-4 mr-2" />
            Probar Moderación
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prueba de Moderación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mensaje de prueba</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Escribe un mensaje para probar la moderación..."
                rows={3}
              />
            </div>
            
            <Button 
              onClick={handleTest}
              disabled={!testMessage.trim() || testing}
              className="w-full"
            >
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Analizar Mensaje
            </Button>
            
            {testResult && (
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Resultado:</span>
                  <Badge className={testResult.violation ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                    {testResult.violation ? 'Violación Detectada' : 'Mensaje Permitido'}
                  </Badge>
                </div>
                
                {testResult.violation && (
                  <>
                    <div>
                      <strong>Categoría:</strong> {testResult.category}
                    </div>
                    <div>
                      <strong>Severidad:</strong> {testResult.severity}
                    </div>
                    <div>
                      <strong>Acción:</strong> {testResult.action}
                    </div>
                  </>
                )}
                
                <div>
                  <strong>Confianza:</strong> {Math.round(testResult.confidence * 100)}%
                </div>
                
                <div>
                  <strong>Motivo:</strong> {testResult.message}
                </div>
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
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Moderación de Chats con IA
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
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Protección automática:</strong> Sistema de IA que detecta y bloquea 
              intercambio de información personal, evasión de pagos y contenido inapropiado 
              en tiempo real.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="recent">Actividad Reciente</TabsTrigger>
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
                    <div className="text-2xl font-bold text-purple-600">
                      {moderationStats.totalMessages?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Mensajes analizados</div>
                  </div>
                  <MessageSquare className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {moderationStats.blockedMessages}
                    </div>
                    <div className="text-sm text-gray-600">Mensajes bloqueados</div>
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
                      {moderationStats.accuracyRate}%
                    </div>
                    <div className="text-sm text-gray-600">Precisión de IA</div>
                  </div>
                  <Brain className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {moderationStats.warningsIssued}
                    </div>
                    <div className="text-sm text-gray-600">Advertencias emitidas</div>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {moderationStats.responseTime}s
                    </div>
                    <div className="text-sm text-gray-600">Tiempo de respuesta</div>
                  </div>
                  <Zap className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {moderationStats.usersReported}
                    </div>
                    <div className="text-sm text-gray-600">Usuarios reportados</div>
                  </div>
                  <Flag className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Real-time Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Estado en Tiempo Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Patrones Activos</h4>
                  <div className="space-y-2">
                    {Object.entries(prohibitedPatterns).map(([category, config]) => (
                      <div key={category} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{category}</span>
                        <Badge className={
                          config.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          config.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {config.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Acciones Rápidas</h4>
                  <div className="space-y-2">
                    <TestModerationDialog />
                    
                    <Button variant="outline" className="w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Ver Reportes Detallados
                    </Button>
                    
                    <Button variant="outline" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar Alertas
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Actividad Reciente de Moderación
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentModerations.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No hay moderaciones recientes
                  </h3>
                  <p className="text-gray-600">
                    Cuando se detecte contenido inapropiado aparecerá aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentModerations.map((moderation) => (
                    <div
                      key={moderation.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          {getActionIcon(moderation.action)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge className={getStatusColor(moderation.action)}>
                              {moderation.action.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {moderation.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            "{moderation.message}"
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Usuario: {moderation.userId}</span>
                            <span>Chat: {moderation.chatId}</span>
                            <span>Confianza: {Math.round(moderation.confidence * 100)}%</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right text-xs text-gray-500">
                        {moderation.timestamp.toLocaleTimeString()}
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
            {Object.entries(prohibitedPatterns).map(([category, config]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="capitalize">{category.replace(/([A-Z])/g, ' $1')}</span>
                    <Badge className={
                      config.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      config.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }>
                      {config.severity}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <strong>Acción:</strong> {config.action.replace(/_/g, ' ')}
                    </div>
                    <div>
                      <strong>Mensaje:</strong> {config.message}
                    </div>
                    <div>
                      <strong>Patrones detectados:</strong> {config.patterns.length}
                    </div>
                    
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Este patrón utiliza análisis de expresiones regulares y procesamiento 
                        de lenguaje natural para detectar violaciones.
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
              <CardTitle>Configuración de Moderación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Nivel de Estrictez</Label>
                    <Select 
                      value={moderationSettings.strictness} 
                      onValueChange={(value) => 
                        setModerationSettings(prev => ({...prev, strictness: value}))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Bajo - Solo violaciones obvias</SelectItem>
                        <SelectItem value="medium">Medio - Balance entre precisión y cobertura</SelectItem>
                        <SelectItem value="high">Alto - Máxima protección</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-block">Bloqueo automático</Label>
                    <Switch
                      id="auto-block"
                      checked={moderationSettings.autoBlock}
                      onCheckedChange={(checked) => 
                        setModerationSettings(prev => ({...prev, autoBlock: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-users">Notificar usuarios</Label>
                    <Switch
                      id="notify-users"
                      checked={moderationSettings.notifyUsers}
                      onCheckedChange={(checked) => 
                        setModerationSettings(prev => ({...prev, notifyUsers: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="log-all">Registrar todas las acciones</Label>
                    <Switch
                      id="log-all"
                      checked={moderationSettings.logAll}
                      onCheckedChange={(checked) => 
                        setModerationSettings(prev => ({...prev, logAll: checked}))
                      }
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Recomendación:</strong> Mantén el nivel de estrictez en "Medio" 
                      para un balance óptimo entre seguridad y usabilidad.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Los cambios en la configuración se aplican inmediatamente a todos 
                      los chats monitoreados.
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

// Hook para usar la moderación en otros componentes
export function useChatModeration() {
  const [moderationResult, setModerationResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeMessage = async (message) => {
    setIsAnalyzing(true);
    try {
      // TODO: Implementar análisis real
      const result = {
        violation: false,
        category: null,
        confidence: 0.95
      };
      setModerationResult(result);
      return result;
    } catch (error) {
      console.error('Error in moderation analysis:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    moderationResult,
    isAnalyzing,
    analyzeMessage
  };
}

// Componente simple para moderación inline
export function InlineModerationCheck({ message, onResult }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const checkMessage = async () => {
    setChecking(true);
    try {
      // Análisis simple de patrones
      const hasViolation = /\d{10}|@|\+52|whatsapp|tel/i.test(message);
      
      const result = {
        violation: hasViolation,
        category: hasViolation ? 'contactInfo' : null,
        confidence: hasViolation ? 0.85 : 0.95
      };
      
      setResult(result);
      onResult?.(result);
    } catch (error) {
      console.error('Error checking message:', error);
    } finally {
      setChecking(false);
    }
  };

  React.useEffect(() => {
    if (message) {
      checkMessage();
    }
  }, [message]);

  if (!result) return null;

  return (
    <div className={`text-xs p-2 rounded ${
      result.violation ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
    }`}>
      {result.violation ? (
        <div className="flex items-center">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Contenido bloqueado por moderación
        </div>
      ) : (
        <div className="flex items-center">
          <CheckCircle className="h-3 w-3 mr-1" />
          Mensaje verificado
        </div>
      )}
    </div>
  );
}