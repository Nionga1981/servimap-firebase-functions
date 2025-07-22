'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  Shield, 
  CheckCircle,
  X,
  Clock,
  Info,
  UserX,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function AgeVerification({ 
  onVerificationComplete, 
  onVerificationFailed,
  requiredAge = 18,
  showDocumentCrossCheck = true,
  className = "" 
}) {
  const { user } = useAuth();
  
  const [birthDate, setBirthDate] = useState('');
  const [age, setAge] = useState(null);
  const [isValid, setIsValid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [country, setCountry] = useState('MX');
  const [documentAge, setDocumentAge] = useState(null);
  const [showAgeCalculation, setShowAgeCalculation] = useState(false);

  // Regional age requirements
  const ageRequirements = {
    MX: { minimumAge: 18, legalName: 'mayoría de edad en México' },
    US: { minimumAge: 18, legalName: 'legal adult age in the United States' },
    TH: { minimumAge: 18, legalName: 'legal adult age in Thailand' },
    CA: { minimumAge: 18, legalName: 'legal adult age in Canada' },
    GB: { minimumAge: 18, legalName: 'legal adult age in the United Kingdom' }
  };

  const currentRequiredAge = ageRequirements[country]?.minimumAge || requiredAge;

  useEffect(() => {
    if (birthDate) {
      const calculatedAge = calculateAge(birthDate);
      setAge(calculatedAge);
      
      const valid = calculatedAge >= currentRequiredAge;
      setIsValid(valid);
      
      if (!valid && calculatedAge !== null) {
        logMinorAttempt(birthDate, calculatedAge);
      }
    } else {
      setAge(null);
      setIsValid(null);
    }
  }, [birthDate, currentRequiredAge]);

  const calculateAge = (birthDateString) => {
    if (!birthDateString) return null;
    
    const today = new Date();
    const birth = new Date(birthDateString);
    
    // Validar fecha no sea futura
    if (birth > today) {
      return null;
    }
    
    // Validar fecha no sea irreal (> 120 años)
    const maxAge = new Date();
    maxAge.setFullYear(maxAge.getFullYear() - 120);
    if (birth < maxAge) {
      return null;
    }
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    // Ajustar si no ha pasado el cumpleaños este año
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const logMinorAttempt = async (birthDate, calculatedAge) => {
    try {
      // TODO: Enviar a sistema de logging de seguridad
      const logData = {
        event: 'minor_registration_attempt',
        timestamp: new Date().toISOString(),
        attemptedBirthDate: birthDate,
        calculatedAge: calculatedAge,
        requiredAge: currentRequiredAge,
        userAgent: navigator.userAgent,
        ip: 'detected_client_ip', // Se detectaría en el backend
        country: country,
        sessionId: 'current_session_id'
      };
      
      console.warn('SECURITY ALERT: Minor registration attempt:', logData);
      
      // En producción, esto se enviaría al backend
      // await fetch('/api/security/log-minor-attempt', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(logData)
      // });
      
      setVerificationAttempts(prev => prev + 1);
      
      if (verificationAttempts >= 2) {
        setShowBlockedDialog(true);
      }
    } catch (error) {
      console.error('Error logging minor attempt:', error);
    }
  };

  const crossCheckWithDocument = (documentBirthDate) => {
    if (!documentBirthDate || !birthDate) return null;
    
    const userDeclaredAge = calculateAge(birthDate);
    const documentCalculatedAge = calculateAge(documentBirthDate);
    
    setDocumentAge(documentCalculatedAge);
    
    // Permitir diferencia de 1 día por zonas horarias
    const ageDifference = Math.abs(userDeclaredAge - documentCalculatedAge);
    
    return ageDifference <= 0; // Debe coincidir exactamente
  };

  const handleVerification = async () => {
    if (!birthDate) {
      toast({
        title: "Fecha requerida",
        description: "Por favor ingresa tu fecha de nacimiento",
        variant: "destructive"
      });
      return;
    }

    if (age === null) {
      toast({
        title: "Fecha inválida",
        description: "La fecha ingresada no es válida",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Simular validación del servidor
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (isValid) {
        // Verificación exitosa
        const verificationData = {
          birthDate: birthDate,
          age: age,
          country: country,
          verifiedAt: new Date().toISOString(),
          requiredAge: currentRequiredAge
        };

        toast({
          title: "Edad verificada",
          description: `Verificación exitosa: ${age} años`,
        });

        onVerificationComplete?.(verificationData);
      } else {
        // Usuario menor de edad
        toast({
          title: "Acceso denegado",
          description: `Debes ser mayor de ${currentRequiredAge} años para usar ServiMap`,
          variant: "destructive"
        });

        setShowBlockedDialog(true);
        onVerificationFailed?.({
          reason: 'underage',
          age: age,
          requiredAge: currentRequiredAge,
          attemptCount: verificationAttempts + 1
        });
      }
    } catch (error) {
      toast({
        title: "Error de verificación",
        description: "No se pudo completar la verificación. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getMaxDate = () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - currentRequiredAge);
    return today.toISOString().split('T')[0];
  };

  const getMinDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 120);
    return date.toISOString().split('T')[0];
  };

  const BlockedDialog = () => (
    <Dialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <UserX className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <DialogTitle className="text-center">Acceso No Autorizado</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 text-center">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Debes ser mayor de {currentRequiredAge} años para usar ServiMap</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-gray-700">
              ServiMap está diseñado exclusivamente para adultos mayores de {currentRequiredAge} años. 
              Esta restricción se aplica en cumplimiento de las leyes locales y para garantizar 
              la seguridad de todos nuestros usuarios.
            </p>
            
            <p className="text-sm text-gray-600">
              Si crees que esto es un error, verifica que hayas ingresado tu fecha de nacimiento correctamente.
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Info className="h-5 w-5 text-blue-600 mr-2" />
              <span className="font-medium text-blue-900">Recursos de Apoyo</span>
            </div>
            <p className="text-sm text-blue-800">
              Si necesitas servicios apropiados para tu edad, te recomendamos contactar 
              a organizaciones locales de apoyo juvenil en tu comunidad.
            </p>
          </div>

          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full"
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            Verificación de Edad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Requerido por ley:</strong> Debes ser mayor de {currentRequiredAge} años para 
              usar ServiMap. Esta verificación protege a menores y cumple con las regulaciones locales.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {/* Selector de país */}
            <div>
              <Label htmlFor="country">País de residencia</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MX">México</SelectItem>
                  <SelectItem value="US">Estados Unidos</SelectItem>
                  <SelectItem value="TH">Tailandia</SelectItem>
                  <SelectItem value="CA">Canadá</SelectItem>
                  <SelectItem value="GB">Reino Unido</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600 mt-1">
                Edad mínima requerida: {currentRequiredAge} años ({ageRequirements[country]?.legalName})
              </p>
            </div>

            {/* Fecha de nacimiento */}
            <div>
              <Label htmlFor="birthDate">Fecha de nacimiento *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="pl-10"
                  max={getMaxDate()}
                  min={getMinDate()}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-600">
                  Debes tener al menos {currentRequiredAge} años para continuar
                </p>
                {age !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAgeCalculation(!showAgeCalculation)}
                    className="text-xs"
                  >
                    {showAgeCalculation ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showAgeCalculation ? 'Ocultar' : 'Ver'} cálculo
                  </Button>
                )}
              </div>
            </div>

            {/* Mostrar cálculo de edad */}
            {showAgeCalculation && age !== null && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <h4 className="font-medium text-gray-900 mb-2">Cálculo de edad:</h4>
                <div className="space-y-1 text-gray-700">
                  <div>Fecha de nacimiento: {new Date(birthDate).toLocaleDateString('es-MX')}</div>
                  <div>Fecha actual: {new Date().toLocaleDateString('es-MX')}</div>
                  <div className="font-medium">Edad calculada: {age} años</div>
                </div>
              </div>
            )}

            {/* Resultado de la verificación */}
            {age !== null && (
              <div className="space-y-3">
                {isValid ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Edad verificada:</strong> {age} años - Cumples con el requisito mínimo de {currentRequiredAge} años
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-red-200 bg-red-50">
                    <X className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>Edad insuficiente:</strong> {age} años - Requieres ser mayor de {currentRequiredAge} años
                    </AlertDescription>
                  </Alert>
                )}

                {/* Cross-check con documento si está disponible */}
                {showDocumentCrossCheck && documentAge !== null && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Verificación cruzada con documento</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>Edad declarada: {age} años</div>
                      <div>Edad según documento: {documentAge} años</div>
                      <div className={`font-medium ${
                        Math.abs(age - documentAge) <= 0 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {Math.abs(age - documentAge) <= 0 
                          ? '✓ Las edades coinciden' 
                          : '⚠ Las edades no coinciden'
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Intentos fallidos */}
            {verificationAttempts > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  Intentos de verificación: {verificationAttempts}/3
                  {verificationAttempts >= 2 && " - Próximo intento resultará en bloqueo temporal"}
                </AlertDescription>
              </Alert>
            )}

            {/* Botón de verificación */}
            <Button
              onClick={handleVerification}
              disabled={!birthDate || age === null || loading}
              className="w-full"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verificando edad...
                </div>
              ) : (
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  Verificar Edad
                </div>
              )}
            </Button>

            {/* Información legal */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">¿Por qué verificamos tu edad?</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Cumplimiento de leyes locales e internacionales</li>
                <li>• Protección de menores de edad</li>
                <li>• Garantizar servicios apropiados para adultos</li>
                <li>• Mantener la seguridad de la plataforma</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <BlockedDialog />
    </div>
  );
}

// Hook para usar la verificación de edad en otros componentes
export function useAgeVerification() {
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [ageVerificationData, setAgeVerificationData] = useState(null);

  const verifyAge = (data) => {
    setIsAgeVerified(true);
    setAgeVerificationData(data);
  };

  const resetVerification = () => {
    setIsAgeVerified(false);
    setAgeVerificationData(null);
  };

  return {
    isAgeVerified,
    ageVerificationData,
    verifyAge,
    resetVerification
  };
}

// Componente simple para verificación rápida
export function QuickAgeCheck({ onResult, requiredAge = 18 }) {
  const [birthDate, setBirthDate] = useState('');

  const handleCheck = () => {
    const age = calculateAge(birthDate);
    const isValid = age >= requiredAge;
    
    onResult?.({
      isValid,
      age,
      birthDate,
      requiredAge
    });
  };

  const calculateAge = (birthDateString) => {
    if (!birthDateString) return null;
    
    const today = new Date();
    const birth = new Date(birthDateString);
    
    if (birth > today) return null;
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <div className="space-y-3">
      <Label>Fecha de nacimiento</Label>
      <Input
        type="date"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        max={new Date(new Date().setFullYear(new Date().getFullYear() - requiredAge)).toISOString().split('T')[0]}
      />
      <Button 
        onClick={handleCheck}
        disabled={!birthDate}
        size="sm"
      >
        Verificar
      </Button>
    </div>
  );
}