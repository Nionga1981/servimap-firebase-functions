import React, { useState, useCallback } from 'react';
import { 
  MapPin, 
  Upload, 
  Video, 
  Phone, 
  Mail, 
  Globe, 
  MessageCircle,
  Facebook,
  Eye,
  Check,
  AlertCircle,
  Clock,
  Building,
  Gift
} from 'lucide-react';
import { LogoUpload } from '../ui/LogoUpload';
import { uploadLogo } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import LaunchPromotionModal from './LaunchPromotionModal';

const BusinessRegistration = ({ 
  ambassadorCode, 
  onRegistrationComplete,
  onBack 
}) => {
  const [step, setStep] = useState(1); // 1: Datos, 2: Ubicación, 3: Perfil, 4: Preview, 5: Procesando
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [useLaunchPromo, setUseLaunchPromo] = useState(false);
  const [promoData, setPromoData] = useState(null);

  // Datos del negocio
  const [businessData, setBusinessData] = useState({
    name: '',
    category: '',
    address: '',
    location: { lat: null, lng: null }
  });
  
  // Logo state
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Perfil del negocio
  const [profileData, setProfileData] = useState({
    description: '',
    photos: [],
    video: '',
    hours: {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '14:00', closed: false },
      sunday: { open: '', close: '', closed: true }
    },
    contact: {
      phone: '',
      email: '',
      website: '',
      whatsapp: '',
      facebook: ''
    }
  });

  const [isLaunchPromo, setIsLaunchPromo] = useState(true);

  const businessCategories = [
    'Restaurante', 'Tienda', 'Farmacia', 'Ferretería', 'Supermercado',
    'Panadería', 'Carnicería', 'Veterinaria', 'Lavandería', 'Papelería',
    'Floristería', 'Librería', 'Joyería', 'Zapatería', 'Otro'
  ];

  // Validar datos básicos
  const validateStep1 = () => {
    if (!businessData.name.trim()) {
      setError('El nombre del negocio es requerido');
      return false;
    }
    if (!businessData.category) {
      setError('Selecciona una categoría');
      return false;
    }
    if (!businessData.address.trim()) {
      setError('La dirección es requerida');
      return false;
    }
    return true;
  };

  // Validar ubicación
  const validateStep2 = () => {
    if (!businessData.location.lat || !businessData.location.lng) {
      setError('Selecciona la ubicación en el mapa');
      return false;
    }
    return true;
  };

  // Subir fotos
  const handlePhotoUpload = useCallback((event) => {
    const files = Array.from(event.target.files);
    
    if (profileData.photos.length + files.length > 3) {
      setError('Máximo 3 fotos permitidas');
      return;
    }

    // Simular upload (en producción usar Firebase Storage)
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setProfileData(prev => ({
            ...prev,
            photos: [...prev.photos, e.target.result]
          }));
        };
        reader.readAsDataURL(file);
      }
    });
  }, [profileData.photos.length]);

  // Remover foto
  const removePhoto = (index) => {
    setProfileData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  // Validar paso 1 en tiempo real
  const handleValidateStep1 = async () => {
    if (!validateStep1()) return;
    
    setLoading(true);
    setError('');

    try {
      // Usar función optimizada de validación
      const validateBusinessRegistration = window.firebase ? window.firebase.functions().httpsCallable('validateBusinessRegistration') : null;
      if (!validateBusinessRegistration) {
        setError('Firebase no está inicializado');
        return;
      }
      
      const result = await validateBusinessRegistration({
        businessData: {
          name: businessData.name,
          category: businessData.category,
          location: businessData.location,
          address: businessData.address
        },
        ambassadorCode,
        contactInfo: {
          email: profileData.contact.email,
          phone: profileData.contact.phone
        }
      });

      setValidationResult(result.data);
      
      if (result.data.success) {
        // Mostrar modal de promoción antes de continuar
        setShowPromoModal(true);
      } else {
        // Mostrar errores específicos
        const { validations, conflicts } = result.data;
        let errorMsg = 'Errores encontrados:\n';
        
        if (!validations.locationValid) {
          errorMsg += '• Ubicación no disponible\n';
        }
        if (!validations.ambassadorValid) {
          errorMsg += '• Código de embajador inválido\n';
        }
        if (!validations.registrationUnique && conflicts) {
          errorMsg += `• ${conflicts.type} ya registrado por otro embajador\n`;
        }
        
        setError(errorMsg);
      }
    } catch (err) {
      setError('Error validando datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manejar decisión de promoción
  const handlePromotionDecision = ({ useLaunchPromo: usePromo, promoData: promo }) => {
    setUseLaunchPromo(usePromo);
    setPromoData(promo);
    setShowPromoModal(false);
    setStep(2); // Continuar al siguiente paso
  };

  // Procesar registro completo
  const handleCompleteRegistration = async () => {
    setLoading(true);
    setStep(5); // Procesando
    setUploadingLogo(true);

    try {
      // Usar función de promoción especial o función normal
      const functionName = useLaunchPromo ? 'registerLaunchPromotionBusiness' : 'registerCompleteFixedBusiness';
      const registrationFunction = window.firebase ? window.firebase.functions().httpsCallable(functionName) : null;
      if (!registrationFunction) {
        throw new Error('Firebase no está inicializado');
      }
      
      const registrationParams = useLaunchPromo ? {
        // Parámetros para promoción especial
        businessData: {
          name: businessData.name,
          category: businessData.category,
          location: businessData.location,
          address: businessData.address
        },
        ambassadorId: validationResult.ambassadorInfo.ambassadorId,
        initialProfile: {
          description: profileData.description,
          photos: profileData.photos,
          video: profileData.video,
          hours: profileData.hours,
          contact: profileData.contact
        }
      } : {
        // Parámetros para registro normal
        businessData: {
          name: businessData.name,
          category: businessData.category,
          location: businessData.location,
          address: businessData.address
        },
        ambassadorId: validationResult.ambassadorInfo.ambassadorId,
        initialProfile: {
          description: profileData.description,
          photos: profileData.photos,
          video: profileData.video,
          hours: profileData.hours,
          contact: profileData.contact
        },
        isLaunchPromo: false
      };
      
      const registrationResult = await registrationFunction(registrationParams);
      
      // Upload logo if provided and registration successful
      if (registrationResult.data?.businessId && logoFile) {
        try {
          const uploadResult = await uploadLogo(logoFile, 'negocio', registrationResult.data.businessId);
          const logoURL = uploadResult.url;
          
          // Update business document with logo URL
          const db = window.firebase.firestore();
          await db.collection('negocios_fijos').doc(registrationResult.data.businessId).update({ logoURL });
        } catch (uploadError) {
          console.error('Error uploading logo:', uploadError);
          // Don't fail the registration if logo upload fails
        }
      }

      // Solo procesar acciones post-registro si NO es promoción especial
      // (la promoción especial ya incluye todo el procesamiento)
      if (!useLaunchPromo) {
        const processPostRegistrationActions = window.firebase ? window.firebase.functions().httpsCallable('processPostRegistrationActions') : null;
        if (!processPostRegistrationActions) {
          throw new Error('Firebase no está inicializado');
        }
        
        await processPostRegistrationActions({
          businessId: registrationResult.data.businessId,
          isLaunchPromo: false
        });
      }

      // Registro exitoso
      onRegistrationComplete({
        businessId: registrationResult.data.businessId,
        businessName: businessData.name,
        promoActivated: useLaunchPromo ? registrationResult.data.promoActivated : false,
        promoMonths: useLaunchPromo ? registrationResult.data.promoMonths : 0,
        usedLaunchPromo: useLaunchPromo,
        immediateCommissionPaid: useLaunchPromo ? registrationResult.data.immediateCommissionPaid : false,
        ambassadorCommission: useLaunchPromo ? registrationResult.data.ambassadorCommission : 0,
        serviceValidUntil: useLaunchPromo ? registrationResult.data.serviceValidUntil : null
      });

    } catch (err) {
      console.error('Error en registro:', err);
      setError('Error completando registro: ' + err.message);
      setStep(4); // Volver a preview
    } finally {
      setLoading(false);
      setUploadingLogo(false);
    }
  };

  // Componente de ubicación (placeholder)
  const MapPicker = () => (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
      <MapPin className="w-12 h-12 text-[#60cdff] mx-auto mb-4" />
      <p className="text-gray-600 mb-4">Selecciona la ubicación de tu negocio</p>
      <Input
        placeholder="Buscar dirección..."
        value={businessData.address}
        onChange={(e) => setBusinessData(prev => ({ ...prev, address: e.target.value }))}
        className="mb-4"
      />
      <Button 
        onClick={() => {
          // Simular selección de ubicación
          setBusinessData(prev => ({
            ...prev,
            location: { lat: 19.4326, lng: -99.1332 } // Ciudad de México ejemplo
          }));
        }}
        className="bg-[#60cdff] hover:bg-blue-500"
      >
        Confirmar Ubicación
      </Button>
    </div>
  );

  if (step === 5) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="text-center py-12">
          <CardContent>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#ac7afc] mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-[#ac7afc] mb-4">
              Registrando tu negocio...
            </h2>
            <p className="text-gray-600 mb-4">
              Estamos procesando tu registro y configurando todo para ti
            </p>
            <div className="space-y-2 text-left max-w-md mx-auto">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#3ce923]" />
                <span className="text-sm">Validando información</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#3ce923]" />
                <span className="text-sm">Creando perfil del negocio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#ac7afc]"></div>
                <span className="text-sm">Configurando promoción de lanzamiento</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Notificando a tu embajador</span>
              </div>
            </div>
            {useLaunchPromo && (
              <Alert className="mt-6 bg-gradient-to-r from-yellow-50 to-green-50 border-yellow-200">
                <Gift className="h-4 w-4 text-[#FFD700]" />
                <AlertDescription className="text-yellow-800">
                  <strong>🎉 PROMOCIÓN LANZAMIENTO ACTIVADA!</strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>✅ 3 meses de servicio GRATIS</p>
                    <p>✅ Comisión de ${promoData?.promoDetails?.ambassadorCommission || 12.5} pagada al embajador (50%)</p>
                    <p>✅ Solo pagaste $25 USD (ahorraste $50 USD)</p>
                  </div>
                </AlertDescription>
              </Alert>
            ) || (!useLaunchPromo && (
              <Alert className="mt-6 bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Registro normal completado</strong> Tu negocio estará activo con el plan mensual de $25 USD.
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header con progreso */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-[#ac7afc]">Registrar Negocio Fijo</h1>
          <Badge className="bg-[#FFD700] text-black">
            Paso {step} de 4
          </Badge>
        </div>
        
        {/* Barra de progreso */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-[#ac7afc] to-[#3ce923] h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          ></div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}

      {/* Paso 1: Datos básicos */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-[#ac7afc]" />
              Información Básica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="businessName">Nombre del Negocio *</Label>
              <Input
                id="businessName"
                placeholder="Ej: Farmacia San José"
                value={businessData.name}
                onChange={(e) => setBusinessData(prev => ({ ...prev, name: e.target.value }))}
                className="text-lg"
              />
            </div>

            <div>
              <Label htmlFor="category">Categoría *</Label>
              <Select 
                value={businessData.category}
                onValueChange={(value) => setBusinessData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la categoría de tu negocio" />
                </SelectTrigger>
                <SelectContent>
                  {businessCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="address">Dirección *</Label>
              <Input
                id="address"
                placeholder="Ej: Av. Reforma 123, Col. Centro"
                value={businessData.address}
                onChange={(e) => setBusinessData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            
            <LogoUpload
              value={logoPreview || undefined}
              onChange={(file, preview) => {
                setLogoFile(file);
                setLogoPreview(preview);
              }}
              onRemove={() => {
                setLogoFile(null);
                setLogoPreview(null);
              }}
              label="Logo del Negocio (Opcional)"
              description="Tu logo aparecerá en el mapa y en tu perfil. PNG, JPG, WebP o SVG, máx 1MB"
              disabled={loading || uploadingLogo}
              loading={uploadingLogo}
            />

            {/* Promoción de lanzamiento */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="launchPromo"
                  checked={isLaunchPromo}
                  onChange={(e) => setIsLaunchPromo(e.target.checked)}
                  className="rounded border-yellow-300"
                />
                <Label htmlFor="launchPromo" className="text-yellow-800 font-semibold">
                  🎉 Activar Promoción de Lanzamiento 3x1
                </Label>
              </div>
              <p className="text-sm text-yellow-700">
                {isLaunchPromo 
                  ? "Tu negocio estará activo por 3 meses completamente GRATIS. Después pagas $25 USD mensuales."
                  : "Tu negocio estará activo inmediatamente por $25 USD mensuales."
                }
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={handleValidateStep1}
                disabled={loading}
                className="flex-1 bg-[#ac7afc] hover:bg-purple-600"
              >
                {loading ? 'Validando...' : 'Continuar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Ubicación */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#60cdff]" />
              Ubicación del Negocio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <MapPicker />
            
            {businessData.location.lat && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Ubicación confirmada:</strong> {businessData.address}
                  <br />
                  <small>Lat: {businessData.location.lat}, Lng: {businessData.location.lng}</small>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Atrás
              </Button>
              <Button 
                onClick={() => validateStep2() && setStep(3)}
                className="flex-1 bg-[#60cdff] hover:bg-blue-500"
                disabled={!businessData.location.lat}
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 3: Perfil */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Multimedia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#3ce923]" />
                Fotos y Video
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload de fotos */}
              <div>
                <Label>Fotos del Negocio (máx 3)</Label>
                <div className="grid grid-cols-3 gap-2 mt-2 mb-4">
                  {profileData.photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={photo} 
                        alt={`Foto ${index + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  {profileData.photos.length < 3 && (
                    <label className="border-2 border-dashed border-gray-300 rounded h-24 flex items-center justify-center cursor-pointer hover:border-[#3ce923]">
                      <Upload className="w-6 h-6 text-gray-400" />
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Video opcional */}
              <div>
                <Label htmlFor="video">Video del Negocio (opcional)</Label>
                <div className="flex gap-2">
                  <Video className="w-5 h-5 text-[#60cdff] mt-3" />
                  <Input
                    id="video"
                    placeholder="URL del video (YouTube, Vimeo, etc.)"
                    value={profileData.video}
                    onChange={(e) => setProfileData(prev => ({ ...prev, video: e.target.value }))}
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <Label htmlFor="description">Descripción del Negocio</Label>
                <Textarea
                  id="description"
                  placeholder="Describe tu negocio, servicios y lo que te hace especial..."
                  value={profileData.description}
                  onChange={(e) => setProfileData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contacto y horarios */}
          <Card>
            <CardHeader>
              <CardTitle>Contacto y Horarios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Información de contacto */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Phone className="w-5 h-5 text-[#3ce923] mt-2" />
                  <div className="flex-1">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      placeholder="55 1234 5678"
                      value={profileData.contact.phone}
                      onChange={(e) => setProfileData(prev => ({
                        ...prev,
                        contact: { ...prev.contact, phone: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <MessageCircle className="w-5 h-5 text-[#3ce923] mt-2" />
                  <div className="flex-1">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      placeholder="55 1234 5678"
                      value={profileData.contact.whatsapp}
                      onChange={(e) => setProfileData(prev => ({
                        ...prev,
                        contact: { ...prev.contact, whatsapp: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Mail className="w-5 h-5 text-[#60cdff] mt-2" />
                  <div className="flex-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="negocio@email.com"
                      value={profileData.contact.email}
                      onChange={(e) => setProfileData(prev => ({
                        ...prev,
                        contact: { ...prev.contact, email: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Facebook className="w-5 h-5 text-[#60cdff] mt-2" />
                  <div className="flex-1">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input
                      id="facebook"
                      placeholder="facebook.com/tu-negocio"
                      value={profileData.contact.facebook}
                      onChange={(e) => setProfileData(prev => ({
                        ...prev,
                        contact: { ...prev.contact, facebook: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Globe className="w-5 h-5 text-[#60cdff] mt-2" />
                  <div className="flex-1">
                    <Label htmlFor="website">Sitio Web</Label>
                    <Input
                      id="website"
                      placeholder="www.tu-negocio.com"
                      value={profileData.contact.website}
                      onChange={(e) => setProfileData(prev => ({
                        ...prev,
                        contact: { ...prev.contact, website: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </div>

              {/* Horarios básicos */}
              <div>
                <Label>Horarios de Atención</Label>
                <div className="space-y-2 mt-2">
                  {Object.entries(profileData.hours).map(([day, hours]) => (
                    <div key={day} className="flex items-center gap-2 text-sm">
                      <div className="w-20 font-medium capitalize">{day}:</div>
                      {hours.closed ? (
                        <span className="text-gray-500">Cerrado</span>
                      ) : (
                        <span className="text-[#3ce923]">{hours.open} - {hours.close}</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Podrás modificar horarios específicos después del registro
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Navegación */}
          <div className="lg:col-span-2">
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Atrás
              </Button>
              <Button 
                onClick={() => setStep(4)}
                className="flex-1 bg-[#3ce923] hover:bg-green-600"
              >
                Vista Previa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Paso 4: Preview y confirmación */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Preview del perfil */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-[#ac7afc]" />
                Vista Previa del Perfil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-gradient-to-br from-white to-gray-50">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 bg-[#ac7afc] rounded-lg flex items-center justify-center overflow-hidden">
                    {logoPreview ? (
                      <img 
                        src={logoPreview} 
                        alt="Logo del negocio" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Building className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-[#ac7afc]">{businessData.name}</h3>
                    <p className="text-gray-600">{businessData.category}</p>
                    <p className="text-sm text-gray-500">{businessData.address}</p>
                  </div>
                  <Badge className="bg-[#3ce923] text-white">
                    {isLaunchPromo ? '🎉 PROMO 3x1' : 'Activo'}
                  </Badge>
                </div>

                {profileData.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {profileData.photos.map((photo, index) => (
                      <img 
                        key={index}
                        src={photo} 
                        alt={`Foto ${index + 1}`}
                        className="w-full h-32 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}

                {profileData.description && (
                  <p className="text-gray-700 mb-4">{profileData.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-semibold text-[#ac7afc] mb-2">Contacto</h4>
                    {profileData.contact.phone && (
                      <p className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {profileData.contact.phone}
                      </p>
                    )}
                    {profileData.contact.whatsapp && (
                      <p className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" /> {profileData.contact.whatsapp}
                      </p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#ac7afc] mb-2">Horarios</h4>
                    <p className="text-[#3ce923]">Lun-Vie: 09:00-18:00</p>
                    <p className="text-[#3ce923]">Sáb: 09:00-14:00</p>
                    <p className="text-gray-500">Dom: Cerrado</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen de registro */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Registro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Nombre del negocio:</span>
                  <span className="font-semibold">{businessData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Categoría:</span>
                  <span className="font-semibold">{businessData.category}</span>
                </div>
                <div className="flex justify-between">
                  <span>Código de embajador:</span>
                  <span className="font-semibold text-[#ac7afc]">{ambassadorCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Plan:</span>
                  <span className="font-semibold text-[#FFD700]">
                    {useLaunchPromo ? 'Promoción Lanzamiento 3x1' : 'Mensual ($25 USD)'}
                  </span>
                </div>
                {useLaunchPromo && (
                  <div className="flex justify-between">
                    <span>Pago único:</span>
                    <span className="font-semibold text-[#3ce923]">$25 USD</span>
                  </div>
                )}
                {useLaunchPromo && (
                  <div className="flex justify-between">
                    <span>Ahorro:</span>
                    <span className="font-semibold text-[#3ce923]">
                      $50 USD ({Math.round((50/75)*100)}% descuento)
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Fotos subidas:</span>
                  <span className="font-semibold">{profileData.photos.length}/3</span>
                </div>
              </div>

              {useLaunchPromo && (
                <Alert className="mt-4 bg-gradient-to-r from-yellow-50 to-green-50 border-yellow-200">
                  <Gift className="h-4 w-4 text-[#FFD700]" />
                  <AlertDescription className="text-yellow-800">
                    <strong>🎉 Promoción de Lanzamiento Activada:</strong>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>• 3 meses de servicio completamente GRATIS</p>
                      <p>• Tu embajador recibe $12.50 USD de comisión inmediata (50%)</p>
                      <p>• Después de 3 meses: $25 USD mensuales automáticamente</p>
                      <p>• Puedes cancelar en cualquier momento</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Confirmación final */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
              Modificar
            </Button>
            <Button 
              onClick={handleCompleteRegistration}
              className="flex-1 bg-gradient-to-r from-[#ac7afc] to-[#3ce923] text-white hover:opacity-90"
              disabled={loading || uploadingLogo}
            >
              {loading ? (uploadingLogo ? 'Subiendo Logo...' : 'Registrando...') : 'Confirmar Registro'}
            </Button>
          </div>
        </div>
      )}
      
      {/* Modal de Promoción de Lanzamiento */}
      <LaunchPromotionModal
        isOpen={showPromoModal}
        onClose={() => {
          setShowPromoModal(false);
          setStep(2); // Continuar con registro normal si se cierra
        }}
        onAccept={handlePromotionDecision}
        ambassadorCode={ambassadorCode}
      />
    </div>
  );
};

export default BusinessRegistration;