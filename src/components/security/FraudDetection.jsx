'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Shield, 
  AlertTriangle, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Brain,
  Zap,
  Eye,
  EyeOff,
  Clock,
  Users,
  Globe,
  Smartphone,
  MapPin,
  BarChart3,
  PieChart,
  LineChart,
  Search,
  Filter,
  Settings,
  RefreshCw,
  Ban,
  CheckCircle,
  XCircle,
  AlertCircle,
  Flag,
  Lock,
  Unlock,
  Info,
  Warning,
  Calendar,
  Download,
  Upload,
  Crosshair,
  Timer,
  Award,
  Star
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

export default function FraudDetection({ 
  onFraudDetected,
  onTransactionBlocked,
  realTimeScanning = true,
  autoResponse = true,
  className = "" 
}) {
  const { user } = useAuth();
  
  const [isMonitoring, setIsMonitoring] = useState(realTimeScanning);
  const [fraudSettings, setFraudSettings] = useState({
    sensitivity: 'medium',
    autoBlock: true,
    mlDetection: true,
    realTimeAnalysis: true,
    requireManualReview: false
  });
  
  const [fraudStats, setFraudStats] = useState({});
  const [detectedFraud, setDetectedFraud] = useState([]);
  const [riskScores, setRiskScores] = useState({});
  const [flaggedTransactions, setFlaggedTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Algoritmos de detección de fraude específicos para ServiMap
  const fraudDetectionAlgorithms = {
    velocity_analysis: {
      name: 'Análisis de Velocidad',
      description: 'Detecta patrones de transacciones anormalmente rápidas',
      accuracy: 94.2,
      factors: [
        'Frecuencia de transacciones',
        'Montos inusuales',
        'Horarios atípicos',
        'Ubicaciones múltiples'
      ]
    },
    
    behavioral_analysis: {
      name: 'Análisis Comportamental',
      description: 'Identifica desviaciones en patrones de comportamiento del usuario',
      accuracy: 91.7,
      factors: [
        'Cambios en patrones de gasto',
        'Ubicaciones inusuales',
        'Dispositivos nuevos',
        'Métodos de pago diferentes'
      ]
    },
    
    device_fingerprinting: {
      name: 'Huella Digital de Dispositivo',
      description: 'Analiza características únicas del dispositivo y sesión',
      accuracy: 96.8,
      factors: [
        'Información del navegador',
        'Resolución de pantalla',
        'Zona horaria',
        'Plugins instalados'
      ]
    },
    
    network_analysis: {
      name: 'Análisis de Red',
      description: 'Evalúa riesgos basados en información de red e IP',
      accuracy: 89.3,
      factors: [
        'Geolocalización de IP',
        'Detección de VPN/Proxy',
        'ISP y tipo de conexión',
        'Historial de IP sospechosas'
      ]
    },
    
    machine_learning: {
      name: 'Machine Learning Avanzado',
      description: 'Modelo de IA entrenado con patrones de fraude históricos',
      accuracy: 97.5,
      factors: [
        'Patrones complejos no obvios',
        'Correlaciones múltiples',
        'Aprendizaje continuo',
        'Adaptación a nuevas amenazas'
      ]
    }
  };

  // Tipos de fraude comunes en plataformas de servicios
  const fraudTypes = {
    payment_fraud: {
      name: 'Fraude de Pago',
      severity: 'critical',
      indicators: [
        'Tarjetas robadas/clonadas',
        'Chargebacks frecuentes',
        'Información de facturación inconsistente',
        'Múltiples tarjetas fallidas'
      ]
    },
    
    service_fraud: {
      name: 'Fraude de Servicio',
      severity: 'high',
      indicators: [
        'Servicios falsos',
        'Precios irrealmente bajos',
        'Perfiles de proveedores falsos',
        'Reseñas manipuladas'
      ]
    },
    
    identity_fraud: {
      name: 'Fraude de Identidad',
      severity: 'critical',
      indicators: [
        'Documentos falsos',
        'Suplantación de identidad',
        'Múltiples cuentas misma persona',
        'Información contradictoria'
      ]
    },
    
    chargeback_fraud: {
      name: 'Fraude de Contracargo',
      severity: 'high',
      indicators: [
        'Disputas fraudulentas',
        'Servicios recibidos pero disputados',
        'Patrones de contracargo repetitivos',
        'Evidencia manipulada'
      ]
    },
    
    refund_fraud: {
      name: 'Fraude de Reembolso',
      severity: 'medium',
      indicators: [
        'Solicitudes de reembolso falsas',
        'Servicios prestados correctamente',
        'Manipulación de evidencia',
        'Múltiples disputas similares'
      ]
    }
  };

  // Datos mock
  const mockFraudStats = {
    totalTransactions: 234567,
    fraudulentTransactions: 892,
    blockedTransactions: 734,
    falsePositives: 158,
    savedAmount: 125890.50, // MXN
    detectionRate: 97.3,
    averageResponseTime: 0.2
  };

  const mockDetectedFraud = [
    {
      id: 'FRD-001',
      transactionId: 'TXN-789123',
      userId: 'user456',
      amount: 2500.00,
      fraudType: 'payment_fraud',
      riskScore: 0.94,
      detectionMethod: 'machine_learning',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      status: 'blocked',
      evidence: [
        'Tarjeta reportada como robada',
        'Ubicación inconsistente con historial',
        'Velocidad de transacción anormal'
      ],
      paymentMethod: '**** 4532',
      location: 'Ciudad de México, MX',
      deviceInfo: 'Chrome/Mobile - Android'
    },
    {
      id: 'FRD-002',
      transactionId: 'TXN-456789',
      userId: 'user789',
      amount: 850.00,
      fraudType: 'chargeback_fraud',
      riskScore: 0.87,
      detectionMethod: 'behavioral_analysis',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      status: 'under_review',
      evidence: [
        'Historial de chargebacks previos',
        'Patrón de disputa sistemático',
        'Servicio completado según provider'
      ],
      paymentMethod: '**** 1234',
      location: 'Guadalajara, MX',
      deviceInfo: 'Firefox/Desktop - Windows'
    },
    {
      id: 'FRD-003',
      transactionId: 'TXN-321654',
      userId: 'user321',
      amount: 1200.00,
      fraudType: 'service_fraud',
      riskScore: 0.76,
      detectionMethod: 'velocity_analysis',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      status: 'confirmed',
      evidence: [
        'Proveedor con múltiples reportes',
        'Precio significativamente bajo',
        'Documentación insuficiente'
      ],
      paymentMethod: '**** 9876',
      location: 'Monterrey, MX',
      deviceInfo: 'Safari/Mobile - iOS'
    }
  ];

  const mockRiskScores = {
    low: 15672,
    medium: 8934,
    high: 2341,
    critical: 892
  };

  useEffect(() => {
    loadFraudData();
    if (isMonitoring) {
      startRealTimeMonitoring();
    }
  }, [isMonitoring]);

  const loadFraudData = async () => {
    try {
      setFraudStats(mockFraudStats);
      setDetectedFraud(mockDetectedFraud);
      setRiskScores(mockRiskScores);
    } catch (error) {
      console.error('Error loading fraud data:', error);
    }
  };

  const startRealTimeMonitoring = () => {
    const interval = setInterval(() => {
      console.log('Real-time fraud detection monitoring...');
      // En producción, esto se conectaría a streams de transacciones en tiempo real
    }, 5000);

    return () => clearInterval(interval);
  };

  // Función principal de análisis de fraude
  const analyzeTransaction = async (transactionData) => {
    setIsAnalyzing(true);
    
    try {
      const analysisResult = await performFraudAnalysis(transactionData);
      
      if (analysisResult.isFraudulent) {
        await handleFraudDetection(analysisResult);
      }
      
      return analysisResult;
      
    } catch (error) {
      console.error('Error in fraud analysis:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const performFraudAnalysis = async (transactionData) => {
    // Simular análisis completo de fraude
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const analysisResults = {};
    let maxRiskScore = 0;
    let detectedFraudType = null;

    // Ejecutar todos los algoritmos de detección
    for (const [algorithmKey, algorithm] of Object.entries(fraudDetectionAlgorithms)) {
      const algorithmResult = await runAlgorithm(algorithmKey, transactionData);
      analysisResults[algorithmKey] = algorithmResult;
      
      if (algorithmResult.riskScore > maxRiskScore) {
        maxRiskScore = algorithmResult.riskScore;
      }
    }

    // Determinar tipo de fraude más probable
    if (maxRiskScore > 0.7) {
      detectedFraudType = determineFraudType(analysisResults, transactionData);
    }

    const isFraudulent = maxRiskScore > 0.6; // Umbral del 60%

    return {
      isFraudulent,
      riskScore: maxRiskScore,
      fraudType: detectedFraudType,
      analysisResults,
      confidence: calculateConfidence(analysisResults),
      recommendation: getRecommendation(maxRiskScore, detectedFraudType),
      evidence: extractEvidence(analysisResults),
      mlPrediction: await generateMLPrediction(transactionData)
    };
  };

  const runAlgorithm = async (algorithmKey, transactionData) => {
    // Simular ejecución de algoritmo específico
    const algorithm = fraudDetectionAlgorithms[algorithmKey];
    
    // Simular diferentes probabilidades de detección basadas en la precisión del algoritmo
    const baseDetectionRate = algorithm.accuracy / 100;
    const detected = Math.random() < (baseDetectionRate * 0.1); // 10% de transacciones detectadas
    
    if (!detected) {
      return { riskScore: Math.random() * 0.3, detected: false, factors: [] };
    }

    // Simular score de riesgo y factores detectados
    const riskScore = 0.6 + Math.random() * 0.4; // 0.6-1.0 para transacciones detectadas
    const detectedFactors = algorithm.factors.filter(() => Math.random() > 0.5);

    return {
      riskScore,
      detected: true,
      factors: detectedFactors,
      confidence: riskScore * 0.9 + Math.random() * 0.1,
      algorithm: algorithmKey
    };
  };

  const determineFraudType = (analysisResults, transactionData) => {
    // Simular determinación del tipo de fraude basado en los resultados
    const fraudTypeWeights = {
      payment_fraud: 0.3,
      service_fraud: 0.2,
      identity_fraud: 0.2,
      chargeback_fraud: 0.15,
      refund_fraud: 0.15
    };

    // Seleccionar tipo de fraude con mayor peso (simulado)
    const randomValue = Math.random();
    let cumulativeWeight = 0;
    
    for (const [fraudType, weight] of Object.entries(fraudTypeWeights)) {
      cumulativeWeight += weight;
      if (randomValue <= cumulativeWeight) {
        return fraudType;
      }
    }
    
    return 'payment_fraud'; // Por defecto
  };

  const calculateConfidence = (analysisResults) => {
    const detectedAlgorithms = Object.values(analysisResults).filter(result => result.detected);
    if (detectedAlgorithms.length === 0) return 0;
    
    const avgConfidence = detectedAlgorithms.reduce((sum, result) => sum + result.confidence, 0) / detectedAlgorithms.length;
    const algorithmAgreement = detectedAlgorithms.length / Object.keys(analysisResults).length;
    
    return avgConfidence * algorithmAgreement;
  };

  const getRecommendation = (riskScore, fraudType) => {
    if (riskScore > 0.9) return 'block_immediately';
    if (riskScore > 0.7) return 'require_additional_verification';
    if (riskScore > 0.5) return 'flag_for_manual_review';
    return 'monitor_closely';
  };

  const extractEvidence = (analysisResults) => {
    const evidence = [];
    
    Object.values(analysisResults).forEach(result => {
      if (result.detected && result.factors) {
        evidence.push(...result.factors);
      }
    });
    
    // Agregar evidencia simulada adicional
    if (evidence.length > 0) {
      evidence.push('Análisis de IA confirmó patrones sospechosos');
    }
    
    return [...new Set(evidence)]; // Remover duplicados
  };

  const generateMLPrediction = async (transactionData) => {
    // Simular predicción de ML
    return {
      fraudProbability: Math.random(),
      modelVersion: 'v2.3.1',
      featuresAnalyzed: 47,
      predictionConfidence: 0.85 + Math.random() * 0.15
    };
  };

  const handleFraudDetection = async (analysisResult) => {
    const fraudRecord = {
      id: 'FRD-' + String(Date.now()).slice(-3),
      transactionId: 'TXN-' + Math.random().toString(36).substr(2, 6),
      userId: 'current_user',
      amount: 1000 + Math.random() * 5000,
      fraudType: analysisResult.fraudType,
      riskScore: analysisResult.riskScore,
      detectionMethod: 'comprehensive_analysis',
      timestamp: new Date(),
      status: getStatusFromRecommendation(analysisResult.recommendation),
      evidence: analysisResult.evidence,
      paymentMethod: '**** ' + Math.floor(Math.random() * 9000 + 1000),
      location: 'Ubicación Detectada',
      deviceInfo: 'Dispositivo Actual',
      mlPrediction: analysisResult.mlPrediction
    };

    // Agregar al historial
    setDetectedFraud(prev => [fraudRecord, ...prev.slice(0, 49)]);

    // Ejecutar recomendación
    await executeRecommendation(analysisResult.recommendation, fraudRecord);

    // Notificar callbacks
    onFraudDetected?.(fraudRecord);
    if (fraudRecord.status === 'blocked') {
      onTransactionBlocked?.(fraudRecord);
    }
  };

  const getStatusFromRecommendation = (recommendation) => {
    switch (recommendation) {
      case 'block_immediately': return 'blocked';
      case 'require_additional_verification': return 'pending_verification';
      case 'flag_for_manual_review': return 'under_review';
      default: return 'monitoring';
    }
  };

  const executeRecommendation = async (recommendation, record) => {
    switch (recommendation) {
      case 'block_immediately':
        await blockTransaction(record);
        break;
      case 'require_additional_verification':
        await requireVerification(record);
        break;
      case 'flag_for_manual_review':
        await flagForReview(record);
        break;
      case 'monitor_closely':
        await enableMonitoring(record);
        break;
    }
  };

  const blockTransaction = async (record) => {
    console.log('Blocking transaction:', record);
    
    if (autoResponse) {
      toast({
        title: "Transacción bloqueada",
        description: "Fraude detectado - transacción bloqueada automáticamente",
        variant: "destructive"
      });
    }
  };

  const requireVerification = async (record) => {
    console.log('Requiring verification:', record);
    
    toast({
      title: "Verificación requerida",
      description: "Transacción marcada para verificación adicional",
      variant: "destructive"
    });
  };

  const flagForReview = async (record) => {
    console.log('Flagging for manual review:', record);
    
    toast({
      title: "Marcado para revisión",
      description: "Transacción enviada para revisión manual"
    });
  };

  const enableMonitoring = async (record) => {
    console.log('Enabling monitoring:', record);
  };

  const manualAnalysis = async (transactionId) => {
    try {
      setIsAnalyzing(true);
      
      // TODO: Implementar análisis manual real
      const mockTransactionData = { transactionId, timestamp: new Date() };
      const result = await analyzeTransaction(mockTransactionData);
      
      toast({
        title: result.isFraudulent ? "Fraude detectado" : "Transacción limpia",
        description: `Score de riesgo: ${Math.round(result.riskScore * 100)}%`,
        variant: result.isFraudulent ? "destructive" : "default"
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

  const getSeverityColor = (fraudType) => {
    const type = fraudTypes[fraudType];
    if (!type) return 'bg-gray-100 text-gray-800';
    
    switch (type.severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'pending_verification': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-orange-100 text-orange-800';
      case 'monitoring': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (riskScore) => {
    if (riskScore >= 0.8) return 'text-red-600';
    if (riskScore >= 0.6) return 'text-orange-600';
    if (riskScore >= 0.4) return 'text-yellow-600';
    return 'text-green-600';
  };

  const ManualAnalysisDialog = () => {
    const [analysisTransactionId, setAnalysisTransactionId] = useState('');
    const [analysisResult, setAnalysisResult] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    const handleAnalysis = async () => {
      if (!analysisTransactionId.trim()) return;
      
      setAnalyzing(true);
      const result = await manualAnalysis(analysisTransactionId);
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
            <DialogTitle>Análisis Manual de Fraude</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ID de Transacción</Label>
              <Input
                value={analysisTransactionId}
                onChange={(e) => setAnalysisTransactionId(e.target.value)}
                placeholder="TXN-123456"
              />
            </div>
            
            <Button 
              onClick={handleAnalysis}
              disabled={!analysisTransactionId.trim() || analyzing}
              className="w-full"
            >
              {analyzing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Ejecutar Análisis de Fraude
            </Button>
            
            {analysisResult && (
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Resultado:</span>
                  <Badge className={analysisResult.isFraudulent ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                    {analysisResult.isFraudulent ? 'Fraude Detectado' : 'Transacción Limpia'}
                  </Badge>
                </div>
                
                <div>
                  <strong>Score de Riesgo:</strong> <span className={getRiskColor(analysisResult.riskScore)}>
                    {Math.round(analysisResult.riskScore * 100)}%
                  </span>
                </div>
                
                <div>
                  <strong>Confianza:</strong> {Math.round(analysisResult.confidence * 100)}%
                </div>
                
                {analysisResult.fraudType && (
                  <div>
                    <strong>Tipo de Fraude:</strong> 
                    <Badge className={getSeverityColor(analysisResult.fraudType)} variant="outline">
                      {fraudTypes[analysisResult.fraudType]?.name}
                    </Badge>
                  </div>
                )}
                
                <div>
                  <strong>Recomendación:</strong> {analysisResult.recommendation?.replace(/_/g, ' ')}
                </div>
                
                {analysisResult.evidence?.length > 0 && (
                  <div>
                    <strong>Evidencia:</strong>
                    <ul className="text-sm text-gray-600 mt-1">
                      {analysisResult.evidence.map((evidence, index) => (
                        <li key={index}>• {evidence}</li>
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

  const filteredFraud = detectedFraud.filter(fraud => 
    !searchQuery || 
    fraud.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fraud.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fraud.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-red-600" />
              Detección de Fraude en Pagos
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant={isMonitoring ? "default" : "secondary"}>
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
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Protección Avanzada:</strong> Sistema de IA multicapa que detecta fraude 
              en tiempo real mediante análisis comportamental, device fingerprinting y machine learning 
              con 97.3% de precisión.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="detection">Detecciones</TabsTrigger>
          <TabsTrigger value="algorithms">Algoritmos</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {fraudStats.totalTransactions?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Transacciones analizadas</div>
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
                      {fraudStats.fraudulentTransactions}
                    </div>
                    <div className="text-sm text-gray-600">Fraudes detectados</div>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      ${fraudStats.savedAmount?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Dinero protegido (MXN)</div>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {fraudStats.detectionRate}%
                    </div>
                    <div className="text-sm text-gray-600">Tasa de detección</div>
                  </div>
                  <Target className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Riesgo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {riskScores.low?.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Riesgo Bajo</div>
                  <Progress value={65} className="h-2 mt-2" />
                </div>
                
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {riskScores.medium?.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Riesgo Medio</div>
                  <Progress value={25} className="h-2 mt-2" />
                </div>
                
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {riskScores.high?.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Riesgo Alto</div>
                  <Progress value={8} className="h-2 mt-2" />
                </div>
                
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {riskScores.critical?.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Riesgo Crítico</div>
                  <Progress value={2} className="h-2 mt-2" />
                </div>
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
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Reportes de Fraude
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Datos
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Alertas
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detection" className="space-y-6">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <Input
                placeholder="Buscar por ID de transacción, usuario o fraude..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Fraud Detections */}
          <div className="space-y-4">
            {filteredFraud.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No hay detecciones de fraude
                  </h3>
                  <p className="text-gray-600">
                    Cuando se detecte fraude aparecerá aquí
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredFraud.map((fraud) => (
                <Card key={fraud.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <CreditCard className="h-6 w-6 text-red-600" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold">{fraud.id}</h3>
                            <Badge className={getStatusColor(fraud.status)}>
                              {fraud.status.replace('_', ' ')}
                            </Badge>
                            <Badge className={getSeverityColor(fraud.fraudType)}>
                              {fraudTypes[fraud.fraudType]?.name}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <strong>Transacción:</strong> {fraud.transactionId}
                            </div>
                            <div>
                              <strong>Usuario:</strong> {fraud.userId}
                            </div>
                            <div>
                              <strong>Monto:</strong> ${fraud.amount.toLocaleString()} MXN
                            </div>
                            <div>
                              <strong>Score de Riesgo:</strong> 
                              <span className={`ml-1 font-medium ${getRiskColor(fraud.riskScore)}`}>
                                {Math.round(fraud.riskScore * 100)}%
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                            <div>
                              <strong>Método de Pago:</strong> {fraud.paymentMethod}
                            </div>
                            <div>
                              <strong>Ubicación:</strong> {fraud.location}
                            </div>
                            <div>
                              <strong>Dispositivo:</strong> {fraud.deviceInfo}
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <strong>Método de Detección:</strong> {fraud.detectionMethod.replace('_', ' ')}
                          </div>
                          
                          {fraud.evidence?.length > 0 && (
                            <div className="mb-3">
                              <strong>Evidencia:</strong>
                              <ul className="text-sm text-gray-600 mt-1">
                                {fraud.evidence.map((evidence, index) => (
                                  <li key={index}>• {evidence}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {fraud.mlPrediction && (
                            <div className="p-2 bg-blue-50 rounded text-sm">
                              <strong>Predicción ML:</strong> Probabilidad de fraude {Math.round(fraud.mlPrediction.fraudProbability * 100)}% 
                              (Confianza: {Math.round(fraud.mlPrediction.predictionConfidence * 100)}%)
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right text-xs text-gray-500">
                        {fraud.timestamp.toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="algorithms" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(fraudDetectionAlgorithms).map(([key, algorithm]) => (
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
                      <div className="space-y-1">
                        {algorithm.factors.map((factor, index) => (
                          <div key={index} className="text-sm text-gray-600 flex items-center">
                            <CheckCircle className="h-3 w-3 text-green-600 mr-2" />
                            {factor}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Precisión</span>
                        <span>{algorithm.accuracy}%</span>
                      </div>
                      <Progress value={algorithm.accuracy} className="h-2" />
                    </div>
                    
                    <Alert>
                      <Brain className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Este algoritmo se ejecuta en tiempo real para cada transacción 
                        y contribuye al score de riesgo final.
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Fraude por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(fraudTypes).map(([key, fraudType]) => {
                    const count = detectedFraud.filter(f => f.fraudType === key).length;
                    const percentage = detectedFraud.length > 0 ? (count / detectedFraud.length) * 100 : 0;
                    
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{fraudType.name}</span>
                          <span className="font-medium">{count} ({Math.round(percentage)}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rendimiento de Algoritmos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(fraudDetectionAlgorithms).map(([key, algorithm]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{algorithm.name}</span>
                        <span className="font-medium">{algorithm.accuracy}%</span>
                      </div>
                      <Progress value={algorithm.accuracy} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Métricas de Efectividad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {Math.round((fraudStats.fraudulentTransactions - fraudStats.falsePositives) / fraudStats.fraudulentTransactions * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Precisión</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {fraudStats.detectionRate}%
                  </div>
                  <div className="text-sm text-gray-600">Tasa de Detección</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {fraudStats.averageResponseTime}s
                  </div>
                  <div className="text-sm text-gray-600">Tiempo de Respuesta</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {Math.round(fraudStats.falsePositives / fraudStats.totalTransactions * 10000) / 100}%
                  </div>
                  <div className="text-sm text-gray-600">Falsos Positivos</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Detección de Fraude</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Sensibilidad de Detección</Label>
                    <Select 
                      value={fraudSettings.sensitivity} 
                      onValueChange={(value) => 
                        setFraudSettings(prev => ({...prev, sensitivity: value}))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja - Menos falsos positivos</SelectItem>
                        <SelectItem value="medium">Media - Balance óptimo</SelectItem>
                        <SelectItem value="high">Alta - Máxima protección</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-block">Bloqueo automático</Label>
                    <Switch
                      id="auto-block"
                      checked={fraudSettings.autoBlock}
                      onCheckedChange={(checked) => 
                        setFraudSettings(prev => ({...prev, autoBlock: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ml-detection">Detección con ML</Label>
                    <Switch
                      id="ml-detection"
                      checked={fraudSettings.mlDetection}
                      onCheckedChange={(checked) => 
                        setFraudSettings(prev => ({...prev, mlDetection: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="real-time">Análisis en tiempo real</Label>
                    <Switch
                      id="real-time"
                      checked={fraudSettings.realTimeAnalysis}
                      onCheckedChange={(checked) => 
                        setFraudSettings(prev => ({...prev, realTimeAnalysis: checked}))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="manual-review">Revisión manual requerida</Label>
                    <Switch
                      id="manual-review"
                      checked={fraudSettings.requireManualReview}
                      onCheckedChange={(checked) => 
                        setFraudSettings(prev => ({...prev, requireManualReview: checked}))
                      }
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Alert>
                    <Brain className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Machine Learning:</strong> Utiliza modelos avanzados de IA 
                      entrenados con millones de transacciones para detectar patrones complejos.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Tiempo Real:</strong> Analiza cada transacción en menos de 200ms 
                      sin afectar la experiencia del usuario.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Warning className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Revisión Manual:</strong> Transacciones de alto riesgo pueden 
                      requerir aprobación manual antes de procesar.
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

// Hook para usar la detección de fraude
export function useFraudDetection() {
  const [fraudResult, setFraudResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeTransaction = async (transactionData) => {
    setIsAnalyzing(true);
    try {
      // TODO: Implementar análisis real
      const result = {
        isFraudulent: false,
        riskScore: 0.15,
        fraudType: null,
        confidence: 0.95
      };
      setFraudResult(result);
      return result;
    } catch (error) {
      console.error('Error analyzing transaction:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    fraudResult,
    isAnalyzing,
    analyzeTransaction
  };
}

// Componente para mostrar score de riesgo en línea
export function RiskScoreIndicator({ transactionId, riskScore = 0.1 }) {
  const getRiskLevel = (score) => {
    if (score >= 0.8) return { level: 'critical', color: 'text-red-600' };
    if (score >= 0.6) return { level: 'high', color: 'text-orange-600' };
    if (score >= 0.4) return { level: 'medium', color: 'text-yellow-600' };
    return { level: 'low', color: 'text-green-600' };
  };

  const risk = getRiskLevel(riskScore);

  return (
    <div className={`text-xs p-2 rounded ${
      risk.level === 'critical' ? 'bg-red-50' :
      risk.level === 'high' ? 'bg-orange-50' :
      risk.level === 'medium' ? 'bg-yellow-50' : 'bg-green-50'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span>Riesgo de Fraude</span>
        <span className={`font-medium ${risk.color}`}>
          {Math.round(riskScore * 100)}%
        </span>
      </div>
      <Progress value={riskScore * 100} className="h-1" />
      <div className={`text-xs ${risk.color} mt-1`}>
        {risk.level.toUpperCase()}
      </div>
    </div>
  );
}