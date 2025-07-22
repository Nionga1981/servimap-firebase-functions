'use client';

import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  Check, 
  X, 
  Star,
  Zap,
  Shield,
  Calendar,
  BarChart3,
  MapPin,
  Heart,
  Gift,
  Clock,
  Users,
  Sparkles,
  ArrowRight,
  CreditCard,
  DollarSign,
  RefreshCw,
  Award,
  Target,
  TrendingUp,
  ChevronRight,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function PremiumUpgrade({ className = "" }) {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('card');
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUsage, setCurrentUsage] = useState({});
  const [estimatedSavings, setEstimatedSavings] = useState(0);

  // Planes Premium
  const premiumPlans = [
    {
      id: 'basic',
      name: 'Premium Basic',
      monthlyPrice: 199,
      annualPrice: 1990,
      annualDiscount: 17,
      features: [
        'Servicios recurrentes ilimitados',
        'Prioridad en búsquedas',
        'Sin comisiones adicionales',
        'Soporte prioritario',
        'Analytics básicos'
      ],
      limits: {
        recurringServices: 'Ilimitado',
        emergencyServices: '3/mes',
        internationalServices: 'No incluido',
        analytics: 'Básico'
      },
      popular: false
    },
    {
      id: 'pro',
      name: 'Premium Pro',
      monthlyPrice: 349,
      annualPrice: 3490,
      annualDiscount: 17,
      features: [
        'Todo lo de Basic',
        'Servicios de emergencia 24/7',
        'Analytics avanzados con IA',
        'Wallet con bonificaciones',
        'Servicios internacionales',
        'Propinas digitales',
        'Gestión de favoritos avanzada'
      ],
      limits: {
        recurringServices: 'Ilimitado',
        emergencyServices: 'Ilimitado',
        internationalServices: '5/mes',
        analytics: 'Avanzado con IA'
      },
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Premium Enterprise',
      monthlyPrice: 599,
      annualPrice: 5990,
      annualDiscount: 17,
      features: [
        'Todo lo de Pro',
        'Servicios internacionales ilimitados',
        'Gerente de cuenta dedicado',
        'API personalizada',
        'Reportes ejecutivos',
        'Integración empresarial',
        'Facturación corporativa'
      ],
      limits: {
        recurringServices: 'Ilimitado',
        emergencyServices: 'Ilimitado',
        internationalServices: 'Ilimitado',
        analytics: 'Empresarial'
      },
      popular: false
    }
  ];

  // Comparación de características
  const featureComparison = [
    {
      category: 'Servicios Básicos',
      features: [
        { name: 'Búsqueda de prestadores', free: true, basic: true, pro: true, enterprise: true },
        { name: 'Contratación de servicios', free: true, basic: true, pro: true, enterprise: true },
        { name: 'Chat con prestadores', free: true, basic: true, pro: true, enterprise: true },
        { name: 'Calificaciones y reseñas', free: true, basic: true, pro: true, enterprise: true }
      ]
    },
    {
      category: 'Servicios Premium',
      features: [
        { name: 'Servicios recurrentes', free: '1/mes', basic: 'Ilimitado', pro: 'Ilimitado', enterprise: 'Ilimitado' },
        { name: 'Servicios de emergencia 24/7', free: false, basic: '3/mes', pro: 'Ilimitado', enterprise: 'Ilimitado' },
        { name: 'Servicios internacionales', free: false, basic: false, pro: '5/mes', enterprise: 'Ilimitado' },
        { name: 'Prioridad en búsquedas', free: false, basic: true, pro: true, enterprise: true }
      ]
    },
    {
      category: 'Analytics y Datos',
      features: [
        { name: 'Historial básico', free: true, basic: true, pro: true, enterprise: true },
        { name: 'Analytics avanzados', free: false, basic: 'Básico', pro: 'Con IA', enterprise: 'Empresarial' },
        { name: 'Reportes personalizados', free: false, basic: false, pro: true, enterprise: true },
        { name: 'Exportación de datos', free: false, basic: false, pro: true, enterprise: true }
      ]
    },
    {
      category: 'Wallet y Pagos',
      features: [
        { name: 'Wallet básico', free: true, basic: true, pro: true, enterprise: true },
        { name: 'Bonificaciones por fidelidad', free: false, basic: false, pro: true, enterprise: true },
        { name: 'Propinas digitales', free: false, basic: false, pro: true, enterprise: true },
        { name: 'Facturación empresarial', free: false, basic: false, pro: false, enterprise: true }
      ]
    },
    {
      category: 'Soporte',
      features: [
        { name: 'Soporte por email', free: true, basic: true, pro: true, enterprise: true },
        { name: 'Soporte prioritario', free: false, basic: true, pro: true, enterprise: true },
        { name: 'Gerente de cuenta', free: false, basic: false, pro: false, enterprise: true },
        { name: 'Soporte telefónico 24/7', free: false, basic: false, pro: true, enterprise: true }
      ]
    }
  ];

  // Datos mock de uso actual
  const mockCurrentUsage = {
    servicesThisMonth: 8,
    recurringServices: 2,
    emergencyServices: 1,
    avgServiceCost: 280,
    potentialSavings: 420
  };

  useEffect(() => {
    loadCurrentUsage();
    calculateEstimatedSavings();
  }, [selectedPlan]);

  const loadCurrentUsage = async () => {
    try {
      // TODO: Cargar uso real del usuario
      setCurrentUsage(mockCurrentUsage);
    } catch (error) {
      console.error('Error loading usage:', error);
    }
  };

  const calculateEstimatedSavings = () => {
    const plan = premiumPlans.find(p => p.id === selectedPlan);
    if (!plan) return;

    const monthlyCost = isAnnual ? plan.annualPrice / 12 : plan.monthlyPrice;
    const currentMonthlyCosts = currentUsage.servicesThisMonth * 15; // Comisión promedio
    const savings = Math.max(0, currentMonthlyCosts - monthlyCost);
    
    setEstimatedSavings(savings);
  };

  const handleUpgrade = async (planId) => {
    setLoading(true);
    try {
      // TODO: Procesar upgrade real
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "¡Upgrade exitoso!",
        description: "Bienvenido a Premium. Todas las funciones están ahora disponibles.",
      });
      
      navigate('/premium/dashboard');
      
    } catch (error) {
      toast({
        title: "Error en el upgrade",
        description: "No se pudo procesar el upgrade. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getFeatureIcon = (value) => {
    if (value === true) return <Check className="h-4 w-4 text-green-600" />;
    if (value === false) return <X className="h-4 w-4 text-gray-400" />;
    return <span className="text-sm font-medium text-gray-700">{value}</span>;
  };

  const PaymentMethodDialog = ({ plan }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          className={`w-full ${plan.popular ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center">
              <RefreshCw className="animate-spin h-4 w-4 mr-2" />
              Procesando...
            </div>
          ) : (
            <>
              Elegir {plan.name}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar Upgrade</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Plan Summary */}
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="font-semibold text-purple-900">{plan.name}</h3>
            <div className="flex items-center justify-between mt-2">
              <span className="text-purple-700">
                {isAnnual ? 'Anual' : 'Mensual'}
              </span>
              <span className="text-lg font-bold text-purple-900">
                {formatCurrency(isAnnual ? plan.annualPrice : plan.monthlyPrice)}
                {!isAnnual && <span className="text-sm font-normal">/mes</span>}
              </span>
            </div>
            {isAnnual && (
              <div className="text-sm text-green-600 mt-1">
                Ahorras {plan.annualDiscount}% pagando anual
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>Método de pago</Label>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">
                  <div className="flex items-center">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Tarjeta de crédito/débito
                  </div>
                </SelectItem>
                <SelectItem value="wallet">
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    ServiMap Wallet
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Annual Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="annual-billing">Facturación anual</Label>
            <Switch
              id="annual-billing"
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
            />
          </div>

          <Button 
            onClick={() => handleUpgrade(plan.id)}
            className="w-full bg-purple-600 hover:bg-purple-700"
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="animate-spin h-4 w-4 mr-2" />
            ) : (
              <Crown className="h-4 w-4 mr-2" />
            )}
            Confirmar Upgrade
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Puedes cancelar en cualquier momento desde tu perfil
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <div className="p-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl">
            <Crown className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Upgrade a Premium
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Desbloquea funciones exclusivas y obtén el máximo valor de ServiMap
        </p>
      </div>

      {/* Current Usage Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Tu Uso Actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {currentUsage.servicesThisMonth}
              </div>
              <div className="text-sm text-gray-600">Servicios este mes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(currentUsage.avgServiceCost)}
              </div>
              <div className="text-sm text-gray-600">Costo promedio</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(currentUsage.potentialSavings)}
              </div>
              <div className="text-sm text-gray-600">Ahorro potencial</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {currentUsage.recurringServices}
              </div>
              <div className="text-sm text-gray-600">Servicios recurrentes</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plans">Planes Premium</TabsTrigger>
          <TabsTrigger value="comparison">Comparar Características</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          {/* Annual/Monthly Toggle */}
          <div className="flex items-center justify-center space-x-4">
            <span className={`font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
              Mensual
            </span>
            <Switch
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              className="data-[state=checked]:bg-purple-600"
            />
            <span className={`font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
              Anual
            </span>
            {isAnnual && (
              <Badge className="bg-green-100 text-green-800">
                Ahorra hasta 17%
              </Badge>
            )}
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {premiumPlans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative ${plan.popular ? 'border-purple-500 border-2 shadow-lg' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-purple-600 text-white px-4 py-1">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Más Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-gray-900">
                      {formatCurrency(isAnnual ? plan.annualPrice / 12 : plan.monthlyPrice)}
                      <span className="text-base font-normal text-gray-600">/mes</span>
                    </div>
                    {isAnnual && (
                      <div className="text-sm text-green-600">
                        Facturado anualmente: {formatCurrency(plan.annualPrice)}
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 border-t">
                    <PaymentMethodDialog plan={plan} />
                  </div>
                  
                  {plan.popular && estimatedSavings > 0 && (
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-sm text-green-800">
                        <TrendingUp className="h-4 w-4 inline mr-1" />
                        Podrías ahorrar {formatCurrency(estimatedSavings)}/mes
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparación Detallada de Características</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Características</th>
                      <th className="text-center py-3 px-4 font-semibold">Gratuito</th>
                      <th className="text-center py-3 px-4 font-semibold">Basic</th>
                      <th className="text-center py-3 px-4 font-semibold">Pro</th>
                      <th className="text-center py-3 px-4 font-semibold">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featureComparison.map((category, categoryIndex) => (
                      <React.Fragment key={categoryIndex}>
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="py-2 px-4 font-semibold text-gray-900">
                            {category.category}
                          </td>
                        </tr>
                        {category.features.map((feature, featureIndex) => (
                          <tr key={featureIndex} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 text-gray-700">{feature.name}</td>
                            <td className="py-3 px-4 text-center">
                              {getFeatureIcon(feature.free)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {getFeatureIcon(feature.basic)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {getFeatureIcon(feature.pro)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {getFeatureIcon(feature.enterprise)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Preguntas Frecuentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                ¿Puedo cancelar mi suscripción en cualquier momento?
              </h4>
              <p className="text-gray-600 text-sm">
                Sí, puedes cancelar tu suscripción Premium en cualquier momento desde tu perfil. 
                Seguirás teniendo acceso a las funciones Premium hasta el final de tu período de facturación.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                ¿Qué sucede con mis datos si cancelo?
              </h4>
              <p className="text-gray-600 text-sm">
                Todos tus datos se mantienen seguros. Simplemente perderás acceso a las funciones Premium, 
                pero tu historial y configuraciones básicas permanecerán intactos.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                ¿Hay descuentos para estudiantes o organizaciones?
              </h4>
              <p className="text-gray-600 text-sm">
                Sí, ofrecemos descuentos especiales para estudiantes y organizaciones sin fines de lucro. 
                Contáctanos en soporte@servimap.com para más información.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trust Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <div className="font-semibold text-gray-900">Pagos Seguros</div>
          <div className="text-sm text-gray-600">Encriptación SSL</div>
        </div>
        
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <RefreshCw className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <div className="font-semibold text-gray-900">Sin Compromisos</div>
          <div className="text-sm text-gray-600">Cancela cuando quieras</div>
        </div>
        
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <div className="font-semibold text-gray-900">Soporte 24/7</div>
          <div className="text-sm text-gray-600">Siempre disponible</div>
        </div>
        
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <Award className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <div className="font-semibold text-gray-900">Garantía</div>
          <div className="text-sm text-gray-600">Satisfacción total</div>
        </div>
      </div>
    </div>
  );
}