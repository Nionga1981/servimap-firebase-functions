'use client';

import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Camera, 
  FileImage, 
  RotateCw, 
  Crop,
  Check, 
  X, 
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  Brain,
  Scan,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Trash2,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function DocumentVerification({ 
  onVerificationComplete,
  onVerificationFailed,
  allowedDocumentTypes = ['INE', 'Pasaporte', 'Licencia'],
  crossCheckAge = null,
  className = "" 
}) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const cameraRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // Tipos de documentos por país
  const documentTypes = {
    MX: [
      { id: 'INE', label: 'INE (Credencial para Votar)', icon: '🆔' },
      { id: 'Pasaporte', label: 'Pasaporte Mexicano', icon: '📔' },
      { id: 'Licencia', label: 'Licencia de Conducir', icon: '🚗' }
    ],
    US: [
      { id: 'DriverLicense', label: 'Driver License', icon: '🚗' },
      { id: 'StateID', label: 'State ID', icon: '🆔' },
      { id: 'Passport', label: 'US Passport', icon: '📔' }
    ],
    TH: [
      { id: 'NationalID', label: 'Thai National ID', icon: '🆔' },
      { id: 'Passport', label: 'Thai Passport', icon: '📔' }
    ]
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      validateFile(file);
    }
  };

  const validateFile = (file) => {
    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Archivo no válido",
        description: "Solo se permiten archivos JPG, PNG o WebP",
        variant: "destructive"
      });
      return;
    }

    // Validar tamaño (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "El archivo debe ser menor a 10MB",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    
    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      setCameraStream(stream);
      setShowCamera(true);
      
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
      }
    } catch (error) {
      toast({
        title: "Error de cámara",
        description: "No se pudo acceder a la cámara",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (cameraRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = cameraRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], 'document-photo.jpg', { type: 'image/jpeg' });
        validateFile(file);
        stopCamera();
      }, 'image/jpeg', 0.9);
    }
  };

  const processDocument = async () => {
    if (!selectedFile || !documentType) {
      toast({
        title: "Información incompleta",
        description: "Selecciona un documento y especifica el tipo",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Simular procesamiento con IA
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simular análisis de documento
      const mockAnalysis = await analyzeDocument(selectedFile, documentType);
      
      setExtractedData(mockAnalysis.extractedData);
      setVerificationResult(mockAnalysis.result);
      
      // Agregar al historial
      const historyEntry = {
        id: Date.now(),
        documentType,
        timestamp: new Date(),
        result: mockAnalysis.result,
        fileName: selectedFile.name
      };
      
      setVerificationHistory(prev => [historyEntry, ...prev]);
      
      if (mockAnalysis.result.status === 'approved') {
        toast({
          title: "Documento verificado",
          description: "Tu documento ha sido verificado exitosamente"
        });
        onVerificationComplete?.(mockAnalysis);
      } else {
        toast({
          title: "Verificación fallida",
          description: mockAnalysis.result.message,
          variant: "destructive"
        });
        onVerificationFailed?.(mockAnalysis);
      }
      
    } catch (error) {
      toast({
        title: "Error de procesamiento",
        description: "No se pudo procesar el documento",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeDocument = async (file, type) => {
    // Simulación de análisis con IA
    
    // Simular extracción de datos
    const mockExtractedData = {
      fullName: 'Juan Pérez González',
      birthDate: '1990-05-15',
      documentNumber: 'PERJ900515H***',
      issueDate: '2018-03-20',
      expiryDate: '2028-03-20',
      nationality: 'Mexicana',
      confidence: 0.92
    };

    // Simular validaciones
    const validations = {
      isRealDocument: Math.random() > 0.1, // 90% probabilidad de ser real
      hasValidFormat: Math.random() > 0.05, // 95% probabilidad de formato válido
      isNotScreenshot: Math.random() > 0.15, // 85% probabilidad de no ser screenshot
      hasGoodQuality: Math.random() > 0.1, // 90% probabilidad de buena calidad
      ageMatchesDeclared: crossCheckAge ? 
        Math.abs(calculateAge(mockExtractedData.birthDate) - crossCheckAge) <= 1 : true
    };

    const allValidationsPassed = Object.values(validations).every(v => v === true);
    
    let result;
    if (allValidationsPassed) {
      result = {
        status: 'approved',
        message: 'Documento verificado exitosamente',
        confidence: mockExtractedData.confidence,
        validations
      };
    } else {
      // Determinar razón específica del rechazo
      let failureReason = 'Documento no válido';
      if (!validations.isRealDocument) failureReason = 'El documento parece ser falso o alterado';
      if (!validations.isNotScreenshot) failureReason = 'Debes subir una foto del documento físico, no una captura de pantalla';
      if (!validations.hasGoodQuality) failureReason = 'La calidad de la imagen es insuficiente';
      if (!validations.ageMatchesDeclared) failureReason = 'La edad en el documento no coincide con la declarada';
      
      result = {
        status: 'rejected',
        message: failureReason,
        confidence: mockExtractedData.confidence,
        validations
      };
    }

    return {
      extractedData: mockExtractedData,
      result
    };
  };

  const calculateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const resetForm = () => {
    setSelectedFile(null);
    setDocumentType('');
    setPreviewImage(null);
    setExtractedData(null);
    setVerificationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending': return <Clock className="h-5 w-5 text-yellow-600" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Verificación de Documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Documentos aceptados:</strong> Identificación oficial vigente con fotografía. 
              La información debe coincidir con tus datos de registro.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Subir Archivo</TabsTrigger>
              <TabsTrigger value="camera">Tomar Foto</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div>
                <Label htmlFor="documentType">Tipo de documento *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo de documento" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.MX?.map(doc => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <div className="flex items-center gap-2">
                          <span>{doc.icon}</span>
                          <span>{doc.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Archivo del documento</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    Arrastra tu documento aquí o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    JPG, PNG o WebP - Máximo 10MB
                  </p>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />
                  
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                  >
                    <FileImage className="h-4 w-4 mr-2" />
                    Seleccionar Archivo
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="camera" className="space-y-4">
              <div>
                <Label htmlFor="documentType">Tipo de documento *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo de documento" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.MX?.map(doc => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <div className="flex items-center gap-2">
                          <span>{doc.icon}</span>
                          <span>{doc.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {!showCamera ? (
                  <div className="text-center">
                    <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      Usa tu cámara para tomar una foto del documento
                    </p>
                    <Button onClick={startCamera}>
                      <Camera className="h-4 w-4 mr-2" />
                      Abrir Cámara
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative bg-black rounded-lg overflow-hidden">
                      <video
                        ref={cameraRef}
                        autoPlay
                        playsInline
                        className="w-full h-64 object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                    </div>
                    
                    <div className="flex space-x-3">
                      <Button onClick={capturePhoto} className="flex-1">
                        <Camera className="h-4 w-4 mr-2" />
                        Capturar Foto
                      </Button>
                      <Button onClick={stopCamera} variant="outline">
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview del documento */}
          {previewImage && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Vista previa del documento</h3>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={resetForm}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {showPreview && (
                <div className="border rounded-lg overflow-hidden">
                  <img 
                    src={previewImage} 
                    alt="Preview del documento"
                    className="w-full max-h-64 object-contain bg-gray-50"
                  />
                </div>
              )}

              <Alert>
                <Scan className="h-4 w-4" />
                <AlertDescription>
                  <strong>Consejos para mejores resultados:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Asegúrate de que el documento esté completamente visible</li>
                    <li>Evita reflejos y sombras</li>
                    <li>Mantén el documento plano y bien iluminado</li>
                    <li>La imagen debe ser clara y legible</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Botón de procesamiento */}
          <Button
            onClick={processDocument}
            disabled={!selectedFile || !documentType || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <div className="flex items-center">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analizando documento con IA...
              </div>
            ) : (
              <div className="flex items-center">
                <Brain className="h-4 w-4 mr-2" />
                Verificar Documento
              </div>
            )}
          </Button>

          {/* Progreso de procesamiento */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analizando documento...</span>
                <span>IA trabajando</span>
              </div>
              <Progress value={66} className="h-2" />
              <div className="text-xs text-gray-500 space-y-1">
                <div>✓ Detectando tipo de documento</div>
                <div>✓ Verificando autenticidad</div>
                <div className="text-yellow-600">⏳ Extrayendo información</div>
                <div className="text-gray-400">⏸ Validando datos</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados de verificación */}
      {verificationResult && (
        <Card className={`border-2 ${getStatusColor(verificationResult.status)}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(verificationResult.status)}
              Resultado de Verificación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className={getStatusColor(verificationResult.status)}>
                <AlertDescription>
                  <strong>{verificationResult.status === 'approved' ? 'Verificación exitosa' : 'Verificación fallida'}:</strong> {verificationResult.message}
                </AlertDescription>
              </Alert>

              {extractedData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Datos extraídos:</h4>
                    <div className="text-sm space-y-1">
                      <div><strong>Nombre:</strong> {extractedData.fullName}</div>
                      <div><strong>Fecha de nacimiento:</strong> {new Date(extractedData.birthDate).toLocaleDateString()}</div>
                      <div><strong>Número de documento:</strong> {extractedData.documentNumber}</div>
                      <div><strong>Vigencia:</strong> {new Date(extractedData.expiryDate).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Validaciones:</h4>
                    <div className="text-sm space-y-1">
                      {Object.entries(verificationResult.validations).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          {value ? 
                            <CheckCircle className="h-3 w-3 text-green-600" /> :
                            <XCircle className="h-3 w-3 text-red-600" />
                          }
                          <span className={value ? 'text-green-700' : 'text-red-700'}>
                            {getValidationLabel(key)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Confianza de IA: {Math.round(verificationResult.confidence * 100)}%
                </div>
                
                {verificationResult.status === 'rejected' && (
                  <Button onClick={resetForm} size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Otro Documento
                  </Button>
                )}
              </div>

              {/* Cross-check de edad */}
              {crossCheckAge && extractedData && (
                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Verificación cruzada de edad:</strong> 
                    {Math.abs(calculateAge(extractedData.birthDate) - crossCheckAge) <= 1 
                      ? ' ✓ La edad coincide con la declarada previamente'
                      : ' ⚠ La edad no coincide con la declarada previamente'
                    }
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial de verificaciones */}
      {verificationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Historial de Verificaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {verificationHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(entry.result.status)}
                    <div>
                      <div className="font-medium">{entry.documentType}</div>
                      <div className="text-sm text-gray-600">
                        {entry.timestamp.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusColor(entry.result.status)}>
                    {entry.result.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Función auxiliar para labels de validaciones
function getValidationLabel(key) {
  const labels = {
    isRealDocument: 'Documento auténtico',
    hasValidFormat: 'Formato válido',
    isNotScreenshot: 'No es captura de pantalla',
    hasGoodQuality: 'Buena calidad de imagen',
    ageMatchesDeclared: 'Edad coincide'
  };
  return labels[key] || key;
}