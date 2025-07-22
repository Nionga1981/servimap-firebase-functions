'use client';

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Phone, 
  User, 
  Calendar, 
  Eye, 
  EyeOff,
  Shield,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function AuthFlow() {
  const { signUp, signIn, loading } = useAuth();
  
  const [mode, setMode] = useState('welcome'); // welcome, login, register, age-verification, onboarding
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    birthDate: '',
    acceptTerms: false,
    acceptPrivacy: false,
    wantToBeProvider: false
  });
  const [errors, setErrors] = useState({});
  const [ageVerified, setAgeVerified] = useState(false);

  // Calcular edad basada en fecha de nacimiento
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

  // Validar campos
  const validateField = (name, value) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors.email = 'Email inválido';
        } else {
          delete newErrors.email;
        }
        break;

      case 'password':
        if (value.length < 6) {
          newErrors.password = 'Mínimo 6 caracteres';
        } else {
          delete newErrors.password;
        }
        break;

      case 'confirmPassword':
        if (value !== formData.password) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        } else {
          delete newErrors.confirmPassword;
        }
        break;

      case 'fullName':
        if (value.trim().length < 2) {
          newErrors.fullName = 'Nombre muy corto';
        } else {
          delete newErrors.fullName;
        }
        break;

      case 'phone':
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(value.replace(/\D/g, ''))) {
          newErrors.phone = 'Teléfono debe tener 10 dígitos';
        } else {
          delete newErrors.phone;
        }
        break;

      case 'birthDate':
        if (!value) {
          newErrors.birthDate = 'Fecha de nacimiento requerida';
        } else {
          const age = calculateAge(value);
          if (age < 18) {
            newErrors.birthDate = 'Debes ser mayor de 18 años';
            setAgeVerified(false);
          } else {
            delete newErrors.birthDate;
            setAgeVerified(true);
          }
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
  };

  // Manejar cambios en el formulario
  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  // Manejar envío de formulario de login
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos",
        variant: "destructive"
      });
      return;
    }

    try {
      await signIn(formData.email, formData.password);
    } catch (error) {
      toast({
        title: "Error de inicio de sesión",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Manejar envío de formulario de registro
  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Validaciones finales
    if (Object.keys(errors).length > 0) {
      toast({
        title: "Corrige los errores",
        description: "Hay campos con errores que debes corregir",
        variant: "destructive"
      });
      return;
    }

    if (!formData.acceptTerms || !formData.acceptPrivacy) {
      toast({
        title: "Acepta los términos",
        description: "Debes aceptar los términos y condiciones",
        variant: "destructive"
      });
      return;
    }

    if (!ageVerified) {
      toast({
        title: "Verificación de edad",
        description: "Debes ser mayor de 18 años para registrarte",
        variant: "destructive"
      });
      return;
    }

    try {
      await signUp(formData.email, formData.password, {
        fullName: formData.fullName,
        phone: formData.phone,
        birthDate: formData.birthDate,
        wantToBeProvider: formData.wantToBeProvider
      });
      
      setMode('onboarding');
      setStep(1);
    } catch (error) {
      toast({
        title: "Error de registro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Renderizar pantalla de bienvenida
  const renderWelcome = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo grande */}
        <div className="space-y-4">
          <div className="w-32 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg mx-auto flex items-center justify-center">
            <span className="text-white font-bold text-2xl">ServiMap</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Bienvenido a ServiMap
          </h1>
          <p className="text-gray-600">
            Conecta con prestadores de servicios locales cerca de ti
          </p>
        </div>

        {/* Características principales */}
        <div className="space-y-4">
          <FeatureItem 
            icon={Shield}
            title="Prestadores Verificados"
            description="Todos nuestros prestadores están verificados"
          />
          <FeatureItem 
            icon={CheckCircle}
            title="Pagos Seguros"
            description="Transacciones protegidas y garantizadas"
          />
          <FeatureItem 
            icon={Crown}
            title="Servicios Premium"
            description="Accede a servicios exclusivos y prioritarios"
          />
        </div>

        {/* Botones de acción */}
        <div className="space-y-3">
          <Button 
            onClick={() => setMode('register')}
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            Crear cuenta
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          <Button 
            onClick={() => setMode('login')}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Ya tengo cuenta
          </Button>
        </div>

        {/* Términos */}
        <p className="text-xs text-gray-500">
          Al continuar, aceptas nuestros{' '}
          <a href="/terms" className="text-purple-600 underline">
            Términos de Servicio
          </a>{' '}
          y{' '}
          <a href="/privacy" className="text-purple-600 underline">
            Política de Privacidad
          </a>
        </p>
      </div>
    </div>
  );

  // Renderizar formulario de login
  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-sm">ServiMap</span>
          </div>
          <CardTitle>Iniciar Sesión</CardTitle>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <a href="/forgot-password" className="text-sm text-purple-600 hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
            
            <div>
              <span className="text-sm text-gray-600">¿No tienes cuenta? </span>
              <button 
                onClick={() => setMode('register')}
                className="text-sm text-purple-600 hover:underline"
              >
                Regístrate
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Renderizar formulario de registro
  const renderRegister = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-sm">ServiMap</span>
          </div>
          <CardTitle>Crear Cuenta</CardTitle>
          <p className="text-sm text-gray-600">
            Únete a la comunidad de ServiMap
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Nombre completo */}
            <div>
              <Label htmlFor="fullName">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Juan Pérez"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.fullName && (
                <p className="text-sm text-red-500 mt-1">{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )}
            </div>

            {/* Teléfono */}
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="5551234567"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.phone && (
                <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Fecha de nacimiento */}
            <div>
              <Label htmlFor="birthDate">Fecha de nacimiento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                  className="pl-10"
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                />
              </div>
              {errors.birthDate && (
                <p className="text-sm text-red-500 mt-1">{errors.birthDate}</p>
              )}
              {ageVerified && (
                <div className="flex items-center space-x-2 mt-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Edad verificada</span>
                </div>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500 mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirma tu contraseña"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Opción de ser prestador */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="wantToBeProvider"
                checked={formData.wantToBeProvider}
                onCheckedChange={(checked) => handleInputChange('wantToBeProvider', checked)}
              />
              <Label htmlFor="wantToBeProvider" className="text-sm">
                Quiero registrarme también como prestador de servicios
              </Label>
            </div>

            {/* Términos y condiciones */}
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="acceptTerms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => handleInputChange('acceptTerms', checked)}
                />
                <Label htmlFor="acceptTerms" className="text-xs">
                  Acepto los{' '}
                  <a href="/terms" className="text-purple-600 underline">
                    Términos de Servicio
                  </a>
                </Label>
              </div>
              
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="acceptPrivacy"
                  checked={formData.acceptPrivacy}
                  onCheckedChange={(checked) => handleInputChange('acceptPrivacy', checked)}
                />
                <Label htmlFor="acceptPrivacy" className="text-xs">
                  Acepto la{' '}
                  <a href="/privacy" className="text-purple-600 underline">
                    Política de Privacidad
                  </a>
                </Label>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={loading || !ageVerified}
            >
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm text-gray-600">¿Ya tienes cuenta? </span>
            <button 
              onClick={() => setMode('login')}
              className="text-sm text-purple-600 hover:underline"
            >
              Inicia sesión
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Renderizar onboarding
  const renderOnboarding = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <CardTitle>¡Bienvenido a ServiMap!</CardTitle>
          <p className="text-sm text-gray-600">
            Tu cuenta ha sido creada exitosamente
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <OnboardingStep
              number={1}
              title="Verifica tu ubicación"
              description="Permitiremos encontrar prestadores cerca de ti"
              completed={true}
            />
            <OnboardingStep
              number={2}
              title="Configura tu perfil"
              description="Completa tu información para mejores recomendaciones"
              completed={false}
            />
            <OnboardingStep
              number={3}
              title="Explora servicios"
              description="Descubre todos los servicios disponibles"
              completed={false}
            />
          </div>

          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            Comenzar a explorar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Determinar qué renderizar
  switch (mode) {
    case 'welcome':
      return renderWelcome();
    case 'login':
      return renderLogin();
    case 'register':
      return renderRegister();
    case 'onboarding':
      return renderOnboarding();
    default:
      return renderWelcome();
  }
}

// Componente para características en welcome
function FeatureItem({ icon: Icon, title, description }) {
  return (
    <div className="flex items-center space-x-3 text-left">
      <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
        <Icon className="h-5 w-5 text-purple-600" />
      </div>
      <div>
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}

// Componente para pasos del onboarding
function OnboardingStep({ number, title, description, completed }) {
  return (
    <div className="flex items-start space-x-3">
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
        ${completed 
          ? 'bg-green-100 text-green-600' 
          : 'bg-gray-100 text-gray-600'
        }
      `}>
        {completed ? <CheckCircle className="h-4 w-4" /> : number}
      </div>
      <div>
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}