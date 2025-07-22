'use client';

import React, { useState, useEffect } from 'react';
import { 
  Flag, 
  Shield, 
  AlertTriangle, 
  MessageSquare,
  User,
  Camera,
  FileText,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Ban,
  AlertCircle,
  Search,
  Filter,
  Settings,
  BarChart3,
  Users,
  TrendingUp,
  RefreshCw,
  Archive,
  ExternalLink,
  Download,
  Upload,
  Star,
  Heart,
  ThumbsDown,
  Zap,
  Target,
  Award,
  Info,
  Warning,
  Lock,
  Unlock
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function UserReporting({ 
  onReportSubmitted,
  onReportResolved,
  allowAnonymousReports = true,
  autoModeration = true,
  className = "" 
}) {
  const { user } = useAuth();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportStats, setReportStats] = useState({});
  const [reports, setReports] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Categorías de reportes específicas para ServiMap
  const reportCategories = {
    inappropriate_service: {
      name: 'Servicio Inapropiado',
      description: 'Servicios que violan las políticas de la plataforma',
      severity: 'critical',
      icon: Ban,
      subcategories: [
        'Servicios sexuales',
        'Servicios ilegales',
        'Servicios peligrosos',
        'Violación de términos'
      ]
    },
    
    fraud_scam: {
      name: 'Fraude o Estafa',
      description: 'Intentos de estafa o actividades fraudulentas',
      severity: 'critical',
      icon: AlertTriangle,
      subcategories: [
        'Estafa de pago',
        'Identidad falsa',
        'Servicios falsos',
        'Precios engañosos'
      ]
    },
    
    harassment: {
      name: 'Acoso o Hostigamiento',
      description: 'Comportamiento ofensivo, amenazas o acoso',
      severity: 'high',
      icon: Shield,
      subcategories: [
        'Acoso verbal',
        'Amenazas',
        'Hostigamiento sexual',
        'Discriminación'
      ]
    },
    
    fake_profile: {
      name: 'Perfil Falso',
      description: 'Perfiles con información falsa o suplantación',
      severity: 'high',
      icon: User,
      subcategories: [
        'Fotos falsas',
        'Información falsa',
        'Suplantación de identidad',
        'Cuenta duplicada'
      ]
    },
    
    inappropriate_content: {
      name: 'Contenido Inapropiado',
      description: 'Imágenes, textos o contenido ofensivo',
      severity: 'medium',
      icon: FileText,
      subcategories: [
        'Contenido sexual explícito',
        'Violencia gráfica',
        'Contenido ofensivo',
        'Spam o publicidad'
      ]
    },
    
    payment_issues: {
      name: 'Problemas de Pago',
      description: 'Disputas o problemas relacionados con pagos',
      severity: 'medium',
      icon: AlertCircle,
      subcategories: [
        'No cumplió el servicio',
        'Cobro indebido',
        'Reembolso no procesado',
        'Disputa de precio'
      ]
    },
    
    privacy_violation: {
      name: 'Violación de Privacidad',
      description: 'Uso indebido de información personal',
      severity: 'high',
      icon: Lock,
      subcategories: [
        'Compartir información personal',
        'Grabaciones sin consentimiento',
        'Uso indebido de datos',
        'Violación de confidencialidad'
      ]
    },
    
    platform_abuse: {
      name: 'Abuso de Plataforma',
      description: 'Uso inadecuado de funciones de la plataforma',
      severity: 'medium',
      icon: Settings,
      subcategories: [
        'Spam de mensajes',
        'Reseñas falsas',
        'Manipulación de calificaciones',
        'Evasión de comisiones'
      ]
    }
  };

  // Datos mock
  const mockReportStats = {
    totalReports: 1247,
    pendingReports: 89,
    resolvedReports: 1158,
    averageResolutionTime: 4.2, // horas
    actionsTaken: 234,
    falseReports: 67
  };

  const mockReports = [
    {
      id: 'RPT-001',
      reporterId: allowAnonymousReports ? 'anonymous' : 'user123',
      reportedUserId: 'user456',
      category: 'inappropriate_service',
      subcategory: 'Servicios sexuales',
      severity: 'critical',
      status: 'pending_review',
      title: 'Ofrece servicios prohibidos',
      description: 'Este usuario está ofreciendo servicios sexuales a través de la plataforma',
      evidence: ['screenshot1.jpg', 'chat_conversation.png'],
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      assignedTo: 'moderator_1',
      priority: 'high',
      isAnonymous: true,
      location: 'Ciudad de México',
      verificationStatus: 'pending'
    },
    {
      id: 'RPT-002',
      reporterId: 'user789',
      reportedUserId: 'user101',
      category: 'fraud_scam',
      subcategory: 'Estafa de pago',
      severity: 'critical',
      status: 'under_investigation',
      title: 'Cobró sin prestar el servicio',
      description: 'Recibí el pago pero nunca prestó el servicio acordado. No responde mensajes.',
      evidence: ['payment_receipt.pdf'],
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      assignedTo: 'moderator_2',
      priority: 'high',
      isAnonymous: false,
      location: 'Guadalajara',
      verificationStatus: 'verified'
    },
    {
      id: 'RPT-003',
      reporterId: 'user234',
      reportedUserId: 'user567',
      category: 'harassment',
      subcategory: 'Acoso verbal',
      severity: 'high',
      status: 'resolved',
      title: 'Lenguaje ofensivo y amenazas',
      description: 'Me envió mensajes ofensivos cuando rechacé su propuesta de servicio',
      evidence: ['chat_screenshots.png'],
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      assignedTo: 'moderator_1',
      priority: 'medium',
      isAnonymous: false,
      location: 'Monterrey',
      verificationStatus: 'verified',
      resolution: 'Usuario suspendido por 7 días. Se le envió advertencia formal.',
      actionTaken: 'user_suspended'
    }
  ];

  useEffect(() => {
    loadReportStats();
    loadReports();
    loadCategories();
  }, []);

  const loadReportStats = async () => {
    try {
      setReportStats(mockReportStats);
    } catch (error) {
      console.error('Error loading report stats:', error);
    }
  };

  const loadReports = async () => {
    try {
      setReports(mockReports);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  const loadCategories = async () => {
    try {
      setCategories(Object.keys(reportCategories));
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const submitReport = async (reportData) => {
    setIsProcessing(true);
    
    try {
      // Simular envío de reporte
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newReport = {
        id: `RPT-${String(Date.now()).slice(-3)}`,
        reporterId: reportData.isAnonymous ? 'anonymous' : user?.id || 'current_user',
        reportedUserId: reportData.reportedUserId,
        category: reportData.category,
        subcategory: reportData.subcategory,
        severity: reportCategories[reportData.category].severity,
        status: 'pending_review',
        title: reportData.title,
        description: reportData.description,
        evidence: reportData.evidence || [],
        timestamp: new Date(),
        assignedTo: null,
        priority: getPriorityFromSeverity(reportCategories[reportData.category].severity),
        isAnonymous: reportData.isAnonymous,
        location: reportData.location || 'No especificada',
        verificationStatus: 'pending'
      };
      
      setReports(prev => [newReport, ...prev]);
      
      toast({
        title: "Reporte enviado exitosamente",
        description: `ID del reporte: ${newReport.id}. Será revisado en las próximas 24 horas.`
      });
      
      onReportSubmitted?.(newReport);
      
      return newReport;
      
    } catch (error) {
      toast({
        title: "Error al enviar reporte",
        description: "No se pudo enviar el reporte. Intenta de nuevo.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const resolveReport = async (reportId, resolution) => {
    try {
      const updatedReports = reports.map(report => 
        report.id === reportId 
          ? { ...report, status: 'resolved', resolution: resolution.description, actionTaken: resolution.action }
          : report
      );
      
      setReports(updatedReports);
      
      const resolvedReport = updatedReports.find(r => r.id === reportId);
      onReportResolved?.(resolvedReport);
      
      toast({
        title: "Reporte resuelto",
        description: `El reporte ${reportId} ha sido marcado como resuelto.`
      });
      
    } catch (error) {
      toast({
        title: "Error al resolver reporte",
        description: "No se pudo resolver el reporte. Intenta de nuevo.",
        variant: "destructive"
      });
    }
  };

  const getPriorityFromSeverity = (severity) => {
    switch (severity) {
      case 'critical': return 'high';
      case 'high': return 'medium';
      default: return 'low';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_review': return 'bg-yellow-100 text-yellow-800';
      case 'under_investigation': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'escalated': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending_review': return <Clock className="h-4 w-4" />;
      case 'under_investigation': return <Search className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'escalated': return <TrendingUp className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const ReportDialog = () => {
    const [reportData, setReportData] = useState({
      reportedUserId: '',
      category: '',
      subcategory: '',
      title: '',
      description: '',
      isAnonymous: false,
      location: '',
      evidence: []
    });
    const [currentStep, setCurrentStep] = useState(1);

    const handleSubmit = async () => {
      if (!reportData.reportedUserId || !reportData.category || !reportData.description) {
        toast({
          title: "Campos requeridos",
          description: "Completa todos los campos obligatorios",
          variant: "destructive"
        });
        return;
      }

      try {
        await submitReport(reportData);
        setReportData({
          reportedUserId: '',
          category: '',
          subcategory: '',
          title: '',
          description: '',
          isAnonymous: false,
          location: '',
          evidence: []
        });
        setCurrentStep(1);
      } catch (error) {
        console.error('Error submitting report:', error);
      }
    };

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button className="bg-red-600 hover:bg-red-700">
            <Flag className="h-4 w-4 mr-2" />
            Hacer Reporte
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reportar Usuario o Actividad</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center space-x-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-12 h-1 ${
                      step < currentStep ? 'bg-red-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Información Básica</h3>
                
                <div>
                  <Label>ID del Usuario a Reportar *</Label>
                  <Input
                    value={reportData.reportedUserId}
                    onChange={(e) => setReportData(prev => ({...prev, reportedUserId: e.target.value}))}
                    placeholder="user123"
                  />
                </div>

                <div>
                  <Label>Categoría del Reporte *</Label>
                  <Select 
                    value={reportData.category} 
                    onValueChange={(value) => setReportData(prev => ({...prev, category: value, subcategory: ''}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(reportCategories).map(([key, category]) => {
                        const Icon = category.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center">
                              <Icon className="h-4 w-4 mr-2" />
                              <span>{category.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {reportData.category && (
                  <div>
                    <Label>Subcategoría</Label>
                    <Select 
                      value={reportData.subcategory} 
                      onValueChange={(value) => setReportData(prev => ({...prev, subcategory: value}))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una subcategoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportCategories[reportData.category]?.subcategories.map((sub) => (
                          <SelectItem key={sub} value={sub}>
                            {sub}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button 
                  onClick={() => setCurrentStep(2)}
                  className="w-full"
                  disabled={!reportData.reportedUserId || !reportData.category}
                >
                  Continuar
                </Button>
              </div>
            )}

            {/* Step 2: Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Detalles del Reporte</h3>
                
                <div>
                  <Label>Título del Reporte</Label>
                  <Input
                    value={reportData.title}
                    onChange={(e) => setReportData(prev => ({...prev, title: e.target.value}))}
                    placeholder="Breve resumen del problema"
                  />
                </div>

                <div>
                  <Label>Descripción Detallada *</Label>
                  <Textarea
                    value={reportData.description}
                    onChange={(e) => setReportData(prev => ({...prev, description: e.target.value}))}
                    placeholder="Describe en detalle lo que sucedió, cuándo, dónde y qué evidencia tienes..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Ubicación (opcional)</Label>
                  <Input
                    value={reportData.location}
                    onChange={(e) => setReportData(prev => ({...prev, location: e.target.value}))}
                    placeholder="Ciudad donde ocurrió el incidente"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anonymous"
                    checked={reportData.isAnonymous}
                    onCheckedChange={(checked) => setReportData(prev => ({...prev, isAnonymous: checked}))}
                  />
                  <Label htmlFor="anonymous">Enviar reporte de forma anónima</Label>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(1)}
                    className="flex-1"
                  >
                    Atrás
                  </Button>
                  <Button 
                    onClick={() => setCurrentStep(3)}
                    className="flex-1"
                    disabled={!reportData.description}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Evidence and Submit */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Evidencia y Envío</h3>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Evidencia:</strong> Incluye capturas de pantalla, conversaciones, 
                    recibos o cualquier evidencia que respalde tu reporte.
                  </AlertDescription>
                </Alert>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-2">
                    Arrastra archivos aquí o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-gray-500">
                    Formatos permitidos: JPG, PNG, PDF, DOC - Máximo 10MB por archivo
                  </p>
                  <Button variant="outline" className="mt-2">
                    <Camera className="h-4 w-4 mr-2" />
                    Seleccionar Archivos
                  </Button>
                </div>

                {/* Summary */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Resumen del Reporte</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Usuario reportado:</strong> {reportData.reportedUserId}</div>
                    <div><strong>Categoría:</strong> {reportCategories[reportData.category]?.name}</div>
                    {reportData.subcategory && (
                      <div><strong>Subcategoría:</strong> {reportData.subcategory}</div>
                    )}
                    <div><strong>Anónimo:</strong> {reportData.isAnonymous ? 'Sí' : 'No'}</div>
                  </div>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Política de Reportes:</strong> Los reportes falsos o malintencionados 
                    pueden resultar en la suspensión de tu cuenta. Todos los reportes son investigados 
                    por nuestro equipo de moderación.
                  </AlertDescription>
                </Alert>

                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(2)}
                    className="flex-1"
                  >
                    Atrás
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar Reporte
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = !searchQuery || 
      report.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.reportedUserId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || report.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-red-600" />
              Sistema de Reportes de Usuarios
            </CardTitle>
            <ReportDialog />
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Comunidad segura:</strong> Sistema integral de reportes que permite 
              a los usuarios denunciar actividades inapropiadas, fraudes y violaciones 
              con investigación profesional y respuesta rápida.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {reportStats.totalReports?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total de reportes</div>
                  </div>
                  <Flag className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {reportStats.pendingReports}
                    </div>
                    <div className="text-sm text-gray-600">Pendientes</div>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {reportStats.resolvedReports?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Resueltos</div>
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
                      {reportStats.averageResolutionTime}h
                    </div>
                    <div className="text-sm text-gray-600">Tiempo promedio</div>
                  </div>
                  <Timer className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {reportStats.actionsTaken}
                    </div>
                    <div className="text-sm text-gray-600">Acciones tomadas</div>
                  </div>
                  <Target className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {reportStats.falseReports}
                    </div>
                    <div className="text-sm text-gray-600">Reportes falsos</div>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ReportDialog />
                
                <Button variant="outline" className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Estadísticas Detalladas
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Reportes
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Notificaciones
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar por ID, usuario, título o descripción..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending_review">Pendientes</SelectItem>
                    <SelectItem value="under_investigation">En investigación</SelectItem>
                    <SelectItem value="resolved">Resueltos</SelectItem>
                    <SelectItem value="rejected">Rechazados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reports List */}
          <div className="space-y-4">
            {filteredReports.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No hay reportes que coincidan
                  </h3>
                  <p className="text-gray-600">
                    Intenta ajustar los filtros o realizar una nueva búsqueda
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredReports.map((report) => {
                const category = reportCategories[report.category];
                const Icon = category?.icon || Flag;
                
                return (
                  <Card key={report.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="p-2 bg-red-100 rounded-lg">
                            <Icon className="h-6 w-6 text-red-600" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-semibold text-lg">{report.title || 'Sin título'}</h3>
                              <Badge className={getStatusColor(report.status)}>
                                {getStatusIcon(report.status)}
                                <span className="ml-1">{report.status.replace('_', ' ')}</span>
                              </Badge>
                              <Badge className={getSeverityColor(report.severity)}>
                                {report.severity}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                              <div>
                                <strong>ID:</strong> {report.id}
                              </div>
                              <div>
                                <strong>Reportado:</strong> {report.reportedUserId}
                              </div>
                              <div>
                                <strong>Categoría:</strong> {category?.name}
                              </div>
                              <div>
                                <strong>Ubicación:</strong> {report.location}
                              </div>
                            </div>
                            
                            <p className="text-gray-700 mb-3 line-clamp-2">
                              {report.description}
                            </p>
                            
                            {report.subcategory && (
                              <div className="mb-3">
                                <Badge variant="outline">
                                  {report.subcategory}
                                </Badge>
                              </div>
                            )}
                            
                            {report.evidence?.length > 0 && (
                              <div className="flex items-center text-sm text-gray-600 mb-3">
                                <FileText className="h-4 w-4 mr-1" />
                                {report.evidence.length} archivo(s) de evidencia
                              </div>
                            )}
                            
                            {report.resolution && (
                              <Alert className="mt-3">
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>
                                  <strong>Resolución:</strong> {report.resolution}
                                </AlertDescription>
                              </Alert>
                            )}
                            
                            <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>
                                  {report.isAnonymous ? 'Reporte anónimo' : `Por: ${report.reporterId}`}
                                </span>
                                <span>
                                  {report.timestamp.toLocaleString()}
                                </span>
                                {report.assignedTo && (
                                  <span>
                                    Asignado a: {report.assignedTo}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver Detalles
                                </Button>
                                {report.status === 'pending_review' && (
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Resolver
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(reportCategories).map(([key, category]) => {
              const Icon = category.icon;
              return (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        <span>{category.name}</span>
                      </div>
                      <Badge className={getSeverityColor(category.severity)}>
                        {category.severity}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">{category.description}</p>
                    
                    <div>
                      <h4 className="font-medium mb-2">Subcategorías:</h4>
                      <div className="space-y-1">
                        {category.subcategories.map((sub, index) => (
                          <div key={index} className="flex items-center text-sm">
                            <CheckCircle className="h-3 w-3 text-green-600 mr-2" />
                            {sub}
                          </div>
                        ))}
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
                <CardTitle>Reportes por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(reportCategories).map(([key, category]) => {
                    const count = reports.filter(r => r.category === key).length;
                    const percentage = reports.length > 0 ? (count / reports.length) * 100 : 0;
                    
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{category.name}</span>
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
                <CardTitle>Estados de Reportes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['pending_review', 'under_investigation', 'resolved', 'rejected'].map((status) => {
                    const count = reports.filter(r => r.status === status).length;
                    const percentage = reports.length > 0 ? (count / reports.length) * 100 : 0;
                    
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{status.replace('_', ' ')}</span>
                          <span className="font-medium">{count} ({Math.round(percentage)}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Métricas de Rendimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {Math.round((reportStats.resolvedReports / reportStats.totalReports) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Tasa de Resolución</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {reportStats.averageResolutionTime}h
                  </div>
                  <div className="text-sm text-gray-600">Tiempo Promedio de Resolución</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {Math.round((reportStats.falseReports / reportStats.totalReports) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Tasa de Reportes Falsos</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Hook para usar el sistema de reportes
export function useUserReporting() {
  const [reportResult, setReportResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReport = async (reportData) => {
    setIsSubmitting(true);
    try {
      // TODO: Implementar envío real
      const result = {
        id: 'RPT-' + Date.now(),
        status: 'submitted',
        timestamp: new Date()
      };
      setReportResult(result);
      return result;
    } catch (error) {
      console.error('Error submitting report:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    reportResult,
    isSubmitting,
    submitReport
  };
}

// Componente simple para reporte rápido
export function QuickReportButton({ reportedUserId, category = 'inappropriate_service' }) {
  const [reporting, setReporting] = useState(false);

  const handleQuickReport = async () => {
    setReporting(true);
    try {
      // TODO: Implementar reporte rápido
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Reporte enviado",
        description: "Tu reporte ha sido enviado y será revisado pronto"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar el reporte",
        variant: "destructive"
      });
    } finally {
      setReporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleQuickReport}
      disabled={reporting}
      className="text-red-600 border-red-600 hover:bg-red-50"
    >
      {reporting ? (
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
      ) : (
        <Flag className="h-3 w-3 mr-1" />
      )}
      Reportar
    </Button>
  );
}