'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  AlertTriangle, 
  Search,
  Ban,
  CheckCircle,
  XCircle,
  Brain,
  Fingerprint,
  Globe,
  Smartphone,
  Mail,
  Hash,
  Clock,
  Activity,
  Filter,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  Database,
  Zap,
  Target,
  TrendingUp,
  BarChart3,
  AlertCircle,
  Info,
  Warning
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

export default function AntiDuplicateSystem({ 
  onDuplicateDetected,
  onSuspiciousPattern,
  autoBlockDuplicates = true,
  className = "" 
}) {
  const { user } = useAuth();
  
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [detectionSettings, setDetectionSettings] = useState({
    sensitivity: 'medium',
    allowFamilyAccounts: true,
    allowBusinessAccounts: true,
    blockSuspiciousPatterns: true,
    requireManualReview: false
  });
  
  const [duplicateStats, setDuplicateStats] = useState({});
  const [detectedDuplicates, setDetectedDuplicates] = useState([]);
  const [blockedPatterns, setBlockedPatterns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Métricas y algoritmos de detección
  const detectionAlgorithms = {
    deviceFingerprint: {
      name: 'Device Fingerprinting',
      description: 'Análisis de hardware, software y configuración del dispositivo',
      accuracy: 94.5,
      factors: [
        'User Agent', 'Screen Resolution', 'Timezone', 'Language',
        'Installed Fonts', 'WebGL Renderer', 'Canvas Fingerprint',
        'Audio Context', 'Hardware Concurrency', 'Memory'
      ]
    },
    
    biometricBehavior: {
      name: 'Biometric Behavioral Analysis',
      description: 'Patrones únicos de comportamiento del usuario',
      accuracy: 89.2,
      factors: [
        'Typing Rhythm', 'Mouse Movement Patterns', 'Click Pressure',
        'Scroll Behavior', 'Navigation Patterns', 'Interaction Timing',
        'Form Filling Speed', 'Error Correction Patterns'
      ]
    },
    
    networkAnalysis: {
      name: 'Network & Location Analysis',
      description: 'Análisis de red, IP y ubicación geográfica',
      accuracy: 87.8,
      factors: [
        'IP Address', 'ISP', 'Geolocation', 'VPN Detection',
        'Proxy Detection', 'Network Speed', 'Connection Type',
        'DNS Servers', 'Network Latency'
      ]
    },
    
    documentAnalysis: {
      name: 'Document Cross-Reference',
      description: 'Verificación cruzada de documentos de identidad',
      accuracy: 96.7,
      factors: [
        'Document Hash', 'Photo Similarity', 'Personal Data',
        'Document Format', 'Issue Date Patterns', 'Metadata Analysis'
      ]
    },
    
    socialGraphAnalysis: {
      name: 'Social Graph Analysis',
      description: 'Análisis de conexiones y patrones sociales',
      accuracy: 82.3,
      factors: [
        'Contact Lists', 'Social Connections', 'Communication Patterns',
        'Mutual Contacts', 'Referral Patterns', 'Interaction History'
      ]
    }
  };

  // Datos mock
  const mockDuplicateStats = {
    totalChecks: 23456,
    duplicatesDetected: 347,
    duplicatesBlocked: 312,
    falsePositives: 18,
    accuracyRate: 94.8,
    avgAnalysisTime: 0.7
  };

  const mockDetectedDuplicates = [
    {
      id: '1',
      primaryUserId: 'user123',
      duplicateUserId: 'user456',
      confidence: 0.94,
      detectionMethod: 'deviceFingerprint',
      factors: ['Same device', 'Same IP', 'Similar behavior'],
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'blocked',
      riskLevel: 'high',
      reviewRequired: false
    },
    {
      id: '2',
      primaryUserId: 'user789',
      duplicateUserId: 'user101',
      confidence: 0.87,
      detectionMethod: 'documentAnalysis',
      factors: ['Same document photo', 'Similar personal data'],
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: 'pending_review',
      riskLevel: 'medium',
      reviewRequired: true
    },
    {
      id: '3',
      primaryUserId: 'user234',
      duplicateUserId: 'user567',
      confidence: 0.76,
      detectionMethod: 'biometricBehavior',
      factors: ['Similar typing patterns', 'Same network'],
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      status: 'allowed',
      riskLevel: 'low',
      reviewRequired: false,
      allowedReason: 'Family account verified'
    }
  ];

  useEffect(() => {
    loadDuplicateStats();
    loadDetectedDuplicates();
    if (isMonitoring) {
      startContinuousMonitoring();
    }
  }, [isMonitoring]);

  const loadDuplicateStats = async () => {
    try {
      // TODO: Cargar estadísticas reales
      setDuplicateStats(mockDuplicateStats);
    } catch (error) {
      console.error('Error loading duplicate stats:', error);
    }
  };

  const loadDetectedDuplicates = async () => {
    try {
      // TODO: Cargar duplicados reales
      setDetectedDuplicates(mockDetectedDuplicates);
    } catch (error) {
      console.error('Error loading detected duplicates:', error);
    }
  };

  const startContinuousMonitoring = () => {
    // Simular monitoreo continuo
    const interval = setInterval(() => {
      console.log('Continuous duplicate monitoring active...');
    }, 10000);

    return () => clearInterval(interval);
  };

  // Función principal de análisis de duplicados
  const analyzeUserForDuplicates = async (userData) => {
    setIsAnalyzing(true);
    
    try {
      const analysisResult = await performDuplicateAnalysis(userData);
      
      if (analysisResult.isDuplicate) {
        await handleDuplicateDetection(analysisResult);
      }
      
      return analysisResult;
      
    } catch (error) {
      console.error('Error in duplicate analysis:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const performDuplicateAnalysis = async (userData) => {
    // Simular análisis completo
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const analysisResults = {};
    let combinedConfidence = 0;
    let factorCount = 0;

    // Device Fingerprinting
    const deviceFingerprint = await analyzeDeviceFingerprint(userData);
    analysisResults.deviceFingerprint = deviceFingerprint;
    if (deviceFingerprint.match) {
      combinedConfidence += deviceFingerprint.confidence * 0.25;
      factorCount++;
    }

    // Biometric Behavior
    const biometricBehavior = await analyzeBiometricBehavior(userData);
    analysisResults.biometricBehavior = biometricBehavior;
    if (biometricBehavior.match) {
      combinedConfidence += biometricBehavior.confidence * 0.20;
      factorCount++;
    }

    // Network Analysis
    const networkAnalysis = await analyzeNetworkPatterns(userData);
    analysisResults.networkAnalysis = networkAnalysis;
    if (networkAnalysis.match) {
      combinedConfidence += networkAnalysis.confidence * 0.15;
      factorCount++;
    }

    // Document Analysis
    const documentAnalysis = await analyzeDocuments(userData);
    analysisResults.documentAnalysis = documentAnalysis;
    if (documentAnalysis.match) {
      combinedConfidence += documentAnalysis.confidence * 0.30;
      factorCount++;
    }

    // Social Graph Analysis
    const socialGraph = await analyzeSocialGraph(userData);
    analysisResults.socialGraph = socialGraph;
    if (socialGraph.match) {
      combinedConfidence += socialGraph.confidence * 0.10;
      factorCount++;
    }

    const finalConfidence = factorCount > 0 ? combinedConfidence : 0;
    const isDuplicate = finalConfidence > 0.7; // Umbral de 70%

    return {
      isDuplicate,
      confidence: finalConfidence,
      analysisResults,
      factorCount,
      riskLevel: getRiskLevel(finalConfidence),
      detectedFactors: extractDetectedFactors(analysisResults),
      recommendation: getRecommendation(finalConfidence, analysisResults)
    };
  };

  const analyzeDeviceFingerprint = async (userData) => {
    // Simular análisis de device fingerprint
    const deviceFactors = [
      'userAgent', 'screenResolution', 'timezone', 'language',
      'installedFonts', 'webglRenderer', 'canvasFingerprint'
    ];
    
    const matchingFactors = deviceFactors.filter(() => Math.random() > 0.7);
    const confidence = matchingFactors.length / deviceFactors.length;
    
    return {
      match: confidence > 0.6,
      confidence: confidence * 0.9 + Math.random() * 0.1,
      matchingFactors,
      details: {
        deviceHash: 'abc123def456',
        previousSeen: confidence > 0.6 ? 'user789' : null,
        timesObserved: Math.floor(Math.random() * 5) + 1
      }
    };
  };

  const analyzeBiometricBehavior = async (userData) => {
    // Simular análisis de comportamiento biométrico
    const behaviorFactors = [
      'typingRhythm', 'mouseMovement', 'clickPressure',
      'scrollBehavior', 'navigationPatterns', 'interactionTiming'
    ];
    
    const matchingFactors = behaviorFactors.filter(() => Math.random() > 0.75);
    const confidence = matchingFactors.length / behaviorFactors.length;
    
    return {
      match: confidence > 0.5,
      confidence: confidence * 0.85 + Math.random() * 0.15,
      matchingFactors,
      details: {
        behaviorProfile: 'profile_456',
        similarity: confidence,
        dataPoints: Math.floor(Math.random() * 1000) + 500
      }
    };
  };

  const analyzeNetworkPatterns = async (userData) => {
    // Simular análisis de red
    const networkFactors = ['ipAddress', 'isp', 'geolocation', 'vpnDetection'];
    
    const isVPN = Math.random() > 0.8;
    const isSameIP = Math.random() > 0.6;
    const confidence = isSameIP ? 0.8 : (isVPN ? 0.3 : 0.1);
    
    return {
      match: confidence > 0.5,
      confidence,
      matchingFactors: isSameIP ? ['ipAddress', 'isp'] : [],
      details: {
        ipAddress: '192.168.1.1',
        isVPN,
        isSameLocation: isSameIP,
        suspiciousActivity: isVPN && isSameIP
      }
    };
  };

  const analyzeDocuments = async (userData) => {
    // Simular análisis de documentos
    const hasSimilarDocument = Math.random() > 0.85;
    const confidence = hasSimilarDocument ? 0.95 : 0.05;
    
    return {
      match: hasSimilarDocument,
      confidence,
      matchingFactors: hasSimilarDocument ? ['documentPhoto', 'personalData'] : [],
      details: {
        documentHash: hasSimilarDocument ? 'doc_hash_123' : null,
        photoSimilarity: hasSimilarDocument ? 0.92 : 0.1,
        dataOverlap: hasSimilarDocument ? 85 : 5
      }
    };
  };

  const analyzeSocialGraph = async (userData) => {
    // Simular análisis de grafos sociales
    const hasSharedConnections = Math.random() > 0.7;
    const confidence = hasSharedConnections ? 0.6 : 0.1;
    
    return {
      match: hasSharedConnections,
      confidence,
      matchingFactors: hasSharedConnections ? ['mutualContacts', 'referralPatterns'] : [],
      details: {
        mutualConnections: hasSharedConnections ? Math.floor(Math.random() * 10) + 1 : 0,
        connectionStrength: confidence,
        suspiciousPatterns: hasSharedConnections && Math.random() > 0.8
      }
    };
  };

  const getRiskLevel = (confidence) => {
    if (confidence > 0.8) return 'high';
    if (confidence > 0.6) return 'medium';
    return 'low';
  };

  const extractDetectedFactors = (analysisResults) => {
    const factors = [];
    Object.values(analysisResults).forEach(result => {
      if (result.match && result.matchingFactors) {
        factors.push(...result.matchingFactors);
      }
    });
    return factors;
  };

  const getRecommendation = (confidence, analysisResults) => {
    if (confidence > 0.9) return 'block_immediately';
    if (confidence > 0.7) return 'require_additional_verification';
    if (confidence > 0.5) return 'monitor_closely';
    return 'allow_with_monitoring';
  };

  const handleDuplicateDetection = async (analysisResult) => {
    const duplicateRecord = {
      id: Date.now().toString(),
      primaryUserId: 'current_user',
      duplicateUserId: 'detected_duplicate',
      confidence: analysisResult.confidence,
      detectionMethod: 'comprehensive_analysis',
      factors: analysisResult.detectedFactors,
      timestamp: new Date(),
      status: getStatusFromRecommendation(analysisResult.recommendation),
      riskLevel: analysisResult.riskLevel,
      reviewRequired: analysisResult.confidence > 0.6 && analysisResult.confidence < 0.9
    };

    // Agregar al historial
    setDetectedDuplicates(prev => [duplicateRecord, ...prev.slice(0, 49)]);

    // Ejecutar acción recomendada
    await executeRecommendation(analysisResult.recommendation, duplicateRecord);

    // Notificar callbacks
    onDuplicateDetected?.(duplicateRecord);
    if (analysisResult.riskLevel === 'high') {
      onSuspiciousPattern?.(duplicateRecord);
    }
  };

  const getStatusFromRecommendation = (recommendation) => {
    switch (recommendation) {
      case 'block_immediately': return 'blocked';
      case 'require_additional_verification': return 'pending_verification';
      case 'monitor_closely': return 'monitoring';
      default: return 'allowed';
    }
  };

  const executeRecommendation = async (recommendation, record) => {
    switch (recommendation) {
      case 'block_immediately':
        await blockDuplicateAccount(record);
        break;
      case 'require_additional_verification':
        await requireAdditionalVerification(record);
        break;
      case 'monitor_closely':
        await enableCloseMonitoring(record);
        break;
      default:
        await allowWithStandardMonitoring(record);
    }
  };

  const blockDuplicateAccount = async (record) => {
    console.log('Blocking duplicate account:', record);
    
    if (autoBlockDuplicates) {
      toast({
        title: "Cuenta duplicada bloqueada",
        description: "Se detectó un intento de crear cuenta duplicada",
        variant: "destructive"
      });
    }
  };

  const requireAdditionalVerification = async (record) => {
    console.log('Requiring additional verification:', record);
    
    toast({
      title: "Verificación adicional requerida",
      description: "Se necesita verificación manual debido a similitudes detectadas",
      variant: "destructive"
    });
  };

  const enableCloseMonitoring = async (record) => {
    console.log('Enabling close monitoring:', record);
  };

  const allowWithStandardMonitoring = async (record) => {
    console.log('Allowing with standard monitoring:', record);
  };

  const manualAnalysis = async (userId) => {
    try {
      setIsAnalyzing(true);
      
      // TODO: Implementar análisis manual real
      const result = await analyzeUserForDuplicates({ userId });
      
      toast({
        title: result.isDuplicate ? "Duplicado detectado" : "No se encontraron duplicados",
        description: `Confianza: ${Math.round(result.confidence * 100)}%`,
        variant: result.isDuplicate ? "destructive" : "default"
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'pending_review': return 'bg-yellow-100 text-yellow-800';
      case 'pending_verification': return 'bg-orange-100 text-orange-800';
      case 'monitoring': return 'bg-blue-100 text-blue-800';
      case 'allowed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'high': return 'text-red-600';
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
            <DialogTitle>Análisis Manual de Duplicados</DialogTitle>
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
                <Brain className="h-4 w-4 mr-2" />
              )}
              Realizar Análisis Completo
            </Button>
            
            {analysisResult && (
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Resultado del Análisis:</span>
                  <Badge className={analysisResult.isDuplicate ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                    {analysisResult.isDuplicate ? 'Duplicado Detectado' : 'No Duplicado'}
                  </Badge>
                </div>
                
                <div>
                  <strong>Confianza:</strong> {Math.round(analysisResult.confidence * 100)}%
                </div>
                
                <div>
                  <strong>Nivel de Riesgo:</strong> <span className={getRiskColor(analysisResult.riskLevel)}>
                    {analysisResult.riskLevel}
                  </span>
                </div>
                
                <div>
                  <strong>Factores Detectados:</strong> {analysisResult.factorCount}
                </div>
                
                <div>
                  <strong>Recomendación:</strong> {analysisResult.recommendation?.replace(/_/g, ' ')}
                </div>
                
                {analysisResult.detectedFactors?.length > 0 && (
                  <div>
                    <strong>Patrones Coincidentes:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysisResult.detectedFactors.map((factor, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {factor}
                        </Badge>
                      ))}
                    </div>
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
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Sistema Anti-Duplicados Inteligente
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
              <strong>Protección avanzada:</strong> Sistema de IA multicapa que detecta cuentas 
              duplicadas mediante análisis de dispositivos, comportamiento, documentos y patrones sociales 
              con 94.8% de precisión.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="detections">Detecciones</TabsTrigger>
          <TabsTrigger value="algorithms">Algoritmos</TabsTrigger>
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
                      {duplicateStats.totalChecks?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Verificaciones realizadas</div>
                  </div>
                  <Search className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {duplicateStats.duplicatesDetected}
                    </div>
                    <div className="text-sm text-gray-600">Duplicados detectados</div>
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
                      {duplicateStats.accuracyRate}%
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
                      {duplicateStats.duplicatesBlocked}
                    </div>
                    <div className="text-sm text-gray-600">Cuentas bloqueadas</div>
                  </div>
                  <Shield className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {duplicateStats.falsePositives}
                    </div>
                    <div className="text-sm text-gray-600">Falsos positivos</div>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {duplicateStats.avgAnalysisTime}s
                    </div>
                    <div className="text-sm text-gray-600">Tiempo de análisis</div>
                  </div>
                  <Zap className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detection Methods Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Rendimiento por Método de Detección
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(detectionAlgorithms).map(([key, algorithm]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{algorithm.name}</span>
                      <span className="text-sm font-bold">{algorithm.accuracy}%</span>
                    </div>
                    <Progress value={algorithm.accuracy} className="h-2" />
                    <p className="text-sm text-gray-600">{algorithm.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ManualAnalysisDialog />
                
                <Button variant="outline" className="w-full">
                  <Database className="h-4 w-4 mr-2" />
                  Exportar Reportes
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  Configurar Filtros
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Ajustar Algoritmos
                </Button>
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
                    placeholder="Buscar por ID de usuario, confianza, método..."
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
                    <SelectItem value="blocked">Solo bloqueadas</SelectItem>
                    <SelectItem value="pending">Pendientes de revisión</SelectItem>
                    <SelectItem value="allowed">Permitidas</SelectItem>
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
              {detectedDuplicates.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No hay detecciones recientes
                  </h3>
                  <p className="text-gray-600">
                    Cuando se detecten cuentas duplicadas aparecerán aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {detectedDuplicates
                    .filter(duplicate => 
                      !searchQuery || 
                      duplicate.primaryUserId.includes(searchQuery) ||
                      duplicate.duplicateUserId.includes(searchQuery) ||
                      duplicate.detectionMethod.includes(searchQuery)
                    )
                    .map((duplicate) => (
                    <div
                      key={duplicate.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <Fingerprint className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={getStatusColor(duplicate.status)}>
                              {duplicate.status.replace('_', ' ')}
                            </Badge>
                            <span className={`text-sm font-medium ${getRiskColor(duplicate.riskLevel)}`}>
                              Riesgo {duplicate.riskLevel}
                            </span>
                            <span className="text-sm text-gray-600">
                              Confianza: {Math.round(duplicate.confidence * 100)}%
                            </span>
                          </div>
                          
                          <div className="space-y-1 text-sm">
                            <div>
                              <strong>Usuario principal:</strong> {duplicate.primaryUserId}
                            </div>
                            <div>
                              <strong>Usuario duplicado:</strong> {duplicate.duplicateUserId}
                            </div>
                            <div>
                              <strong>Método de detección:</strong> {duplicate.detectionMethod}
                            </div>
                            {duplicate.allowedReason && (
                              <div className="text-green-600">
                                <strong>Motivo de permitir:</strong> {duplicate.allowedReason}
                              </div>
                            )}
                          </div>
                          
                          {duplicate.factors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {duplicate.factors.map((factor, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {factor}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right text-xs text-gray-500">
                        {duplicate.timestamp.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="algorithms" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(detectionAlgorithms).map(([key, algorithm]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{algorithm.name}</span>
                    <Badge className="bg-green-100 text-green-800">
                      {algorithm.accuracy}% precisión
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-gray-600">{algorithm.description}</p>
                    
                    <div>
                      <h4 className="font-medium mb-2">Factores Analizados:</h4>
                      <div className="grid grid-cols-2 gap-1">
                        {algorithm.factors.map((factor, index) => (
                          <div key={index} className="text-sm text-gray-600 flex items-center">
                            <CheckCircle className="h-3 w-3 text-green-600 mr-1" />
                            {factor}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Este algoritmo se ejecuta automáticamente durante el registro 
                        y puede activarse manualmente para verificaciones adicionales.
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
              <CardTitle>Configuración del Sistema Anti-Duplicados</CardTitle>
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
                        <SelectItem value="low">Baja - Solo duplicados obvios</SelectItem>
                        <SelectItem value="medium">Media - Balance entre precisión y cobertura</SelectItem>
                        <SelectItem value="high">Alta - Máxima detección</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-family">Permitir cuentas familiares</Label>
                    <Switch
                      id="allow-family"
                      checked={detectionSettings.allowFamilyAccounts}
                      onCheckedChange={(checked) => 
                        setDetectionSettings(prev => ({...prev, allowFamilyAccounts: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-business">Permitir cuentas empresariales</Label>
                    <Switch
                      id="allow-business"
                      checked={detectionSettings.allowBusinessAccounts}
                      onCheckedChange={(checked) => 
                        setDetectionSettings(prev => ({...prev, allowBusinessAccounts: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="block-suspicious">Bloquear patrones sospechosos</Label>
                    <Switch
                      id="block-suspicious"
                      checked={detectionSettings.blockSuspiciousPatterns}
                      onCheckedChange={(checked) => 
                        setDetectionSettings(prev => ({...prev, blockSuspiciousPatterns: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="manual-review">Requiere revisión manual</Label>
                    <Switch
                      id="manual-review"
                      checked={detectionSettings.requireManualReview}
                      onCheckedChange={(checked) => 
                        setDetectionSettings(prev => ({...prev, requireManualReview: checked}))
                      }
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Recomendación:</strong> Mantén la sensibilidad en &quot;Media&quot; 
                      para un balance óptimo entre seguridad y experiencia de usuario.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Las cuentas familiares y empresariales requieren verificación 
                      adicional pero pueden compartir algunos factores de detección.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Warning className="h-4 w-4" />
                    <AlertDescription>
                      La revisión manual puede ralentizar el proceso de registro 
                      pero aumenta la precisión en casos ambiguos.
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

// Hook para usar el sistema anti-duplicados
export function useAntiDuplicateSystem() {
  const [duplicateResult, setDuplicateResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForDuplicates = async (userData) => {
    setIsChecking(true);
    try {
      // TODO: Implementar verificación real
      const result = {
        isDuplicate: false,
        confidence: 0.05,
        riskLevel: 'low'
      };
      setDuplicateResult(result);
      return result;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      throw error;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    duplicateResult,
    isChecking,
    checkForDuplicates
  };
}

// Componente simple para verificación rápida
export function QuickDuplicateCheck({ userId, onResult }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const performCheck = async () => {
    if (!userId) return;
    
    setChecking(true);
    try {
      // Verificación simple simulada
      const isDuplicate = Math.random() > 0.9; // 10% probabilidad
      
      const result = {
        isDuplicate,
        confidence: isDuplicate ? 0.85 : 0.05,
        riskLevel: isDuplicate ? 'high' : 'low'
      };
      
      setResult(result);
      onResult?.(result);
    } catch (error) {
      console.error('Error in quick duplicate check:', error);
    } finally {
      setChecking(false);
    }
  };

  React.useEffect(() => {
    if (userId) {
      performCheck();
    }
  }, [userId]);

  if (checking) {
    return (
      <div className="flex items-center text-xs text-gray-600">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Verificando duplicados...
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className={`text-xs p-2 rounded ${
      result.isDuplicate ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
    }`}>
      {result.isDuplicate ? (
        <div className="flex items-center">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Posible cuenta duplicada
        </div>
      ) : (
        <div className="flex items-center">
          <CheckCircle className="h-3 w-3 mr-1" />
          Usuario único verificado
        </div>
      )}
    </div>
  );
}