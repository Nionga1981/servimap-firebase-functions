import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building, 
  DollarSign,
  Copy,
  Share2,
  TrendingUp,
  UserPlus,
  Store,
  Award,
  Calendar,
  ExternalLink,
  BarChart3,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';

const AmbassadorDashboard = ({ userId, onRegisterBusiness }) => {
  const [ambassadorData, setAmbassadorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState(null);

  // Datos mock para desarrollo
  const mockAmbassadorData = {
    ambassadorCode: 'JUAN2025001',
    referralLink: 'https://servimap.com/register?ref=JUAN2025001',
    isPremium: false,
    level: 'gratuito',
    isActive: true,
    stats: {
      totalReferrals: 12,
      activeReferrals: 8,
      totalCommissions: 450.75,
      monthlyCommissions: 125.50,
      userReferrals: 5,
      providerReferrals: 3,
      businessReferrals: 4
    },
    assignedBusinesses: [
      {
        id: 'biz_001',
        name: 'Farmacia San José',
        category: 'Farmacia',
        address: 'Av. Reforma 123',
        subscriptionStatus: 'active',
        monthlyCommissions: 12.50,
        isLaunchPromo: false,
        photos: ['https://via.placeholder.com/100x100'],
        phone: '55 1234 5678'
      },
      {
        id: 'biz_002',
        name: 'Panadería El Sol',
        category: 'Panadería',
        address: 'Calle Principal 456',
        subscriptionStatus: 'active',
        monthlyCommissions: 10.00,
        isLaunchPromo: true,
        promoEndsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 días
        photos: ['https://via.placeholder.com/100x100'],
        phone: '55 8765 4321'
      }
    ],
    recentCommissions: [
      {
        id: 'comm_001',
        type: 'membership',
        amount: 12.50,
        description: 'Comisión mensual - Farmacia San José',
        businessName: 'Farmacia San José',
        date: new Date('2025-01-20'),
        status: 'paid'
      },
      {
        id: 'comm_002',
        type: 'service',
        amount: 25.00,
        description: 'Comisión por servicio completado',
        businessName: 'Cliente referido',
        date: new Date('2025-01-19'),
        status: 'paid'
      },
      {
        id: 'comm_003',
        type: 'membership',
        amount: 10.00,
        description: 'Comisión mensual - Panadería El Sol',
        businessName: 'Panadería El Sol',
        date: new Date('2025-01-18'),
        status: 'paid'
      }
    ]
  };

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setAmbassadorData(mockAmbassadorData);
      setMonthlyStats({
        thisMonth: {
          commissions: 125.50,
          newReferrals: 3,
          activeBusinesses: 2
        },
        lastMonth: {
          commissions: 98.25,
          newReferrals: 2,
          activeBusinesses: 1
        }
      });
      setLoading(false);
    }, 1000);
  }, [userId]);

  const copyReferralLink = () => {
    navigator.clipboard.writeText(ambassadorData.referralLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const shareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '¡Únete a ServiMap!',
          text: `Regístrate con mi código ${ambassadorData.ambassadorCode} y obtén beneficios exclusivos`,
          url: ambassadorData.referralLink
        });
      } catch (err) {
        copyReferralLink();
      }
    } else {
      copyReferralLink();
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const calculateGrowth = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ac7afc]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header del dashboard */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#ac7afc]">Panel de Embajador</h1>
          <p className="text-gray-600">Gestiona tus referidos y gana comisiones</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${ambassadorData.isPremium ? 'bg-[#FFD700] text-black' : 'bg-gray-500 text-white'}`}>
            {ambassadorData.isPremium ? '👑 Premium' : '🆓 Gratuito'}
          </Badge>
          <Button 
            onClick={onRegisterBusiness}
            className="bg-[#3ce923] hover:bg-green-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Negocio
          </Button>
        </div>
      </div>

      {/* Código de referido prominente */}
      <Card className="bg-gradient-to-r from-[#ac7afc] to-purple-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">Tu Código de Referido</h2>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 rounded-lg px-4 py-2">
                  <span className="text-2xl font-mono font-bold">{ambassadorData.ambassadorCode}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={copyReferralLink}
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copySuccess ? '¡Copiado!' : 'Copiar Link'}
                  </Button>
                  <Button
                    onClick={shareReferralLink}
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Compartir
                  </Button>
                </div>
              </div>
            </div>
            <div className="text-center">
              <Award className="w-16 h-16 text-[#FFD700] mx-auto mb-2" />
              <p className="text-sm opacity-90">Embajador Oficial</p>
            </div>
          </div>
          
          {copySuccess && (
            <Alert className="mt-4 bg-green-500/20 border-green-400/30">
              <AlertDescription className="text-white">
                ✅ Link copiado al portapapeles. ¡Compártelo para ganar comisiones!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referidos</CardTitle>
            <Users className="h-4 w-4 text-[#ac7afc]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ac7afc]">
              {ambassadorData.stats.totalReferrals}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="text-[#3ce923]">
                {ambassadorData.stats.activeReferrals} activos
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-[#FFD700]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FFD700]">
              {formatCurrency(ambassadorData.stats.totalCommissions)}
            </div>
            <div className="flex items-center text-sm">
              <TrendingUp className="w-3 h-3 text-[#3ce923] mr-1" />
              <span className="text-[#3ce923]">
                +{calculateGrowth(monthlyStats.thisMonth.commissions, monthlyStats.lastMonth.commissions)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <Calendar className="h-4 w-4 text-[#3ce923]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#3ce923]">
              {formatCurrency(ambassadorData.stats.monthlyCommissions)}
            </div>
            <div className="text-sm text-gray-600">
              {monthlyStats.thisMonth.newReferrals} nuevos referidos
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negocios Activos</CardTitle>
            <Building className="h-4 w-4 text-[#60cdff]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#60cdff]">
              {ambassadorData.assignedBusinesses.length}
            </div>
            <div className="text-sm text-gray-600">
              {ambassadorData.assignedBusinesses.filter(b => b.subscriptionStatus === 'active').length} con pago al día
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de contenido */}
      <Tabs defaultValue="businesses" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="businesses" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Mis Negocios
          </TabsTrigger>
          <TabsTrigger value="referrals" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Referidos
          </TabsTrigger>
          <TabsTrigger value="commissions" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Comisiones
          </TabsTrigger>
        </TabsList>

        {/* Tab de Negocios */}
        <TabsContent value="businesses" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Negocios Registrados</h3>
            <Button 
              onClick={onRegisterBusiness}
              className="bg-[#3ce923] hover:bg-green-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Negocio
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ambassadorData.assignedBusinesses.map((business) => (
              <Card key={business.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {business.photos && business.photos[0] ? (
                      <img 
                        src={business.photos[0]} 
                        alt={business.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-[#ac7afc] rounded-lg flex items-center justify-center">
                        <Store className="w-8 h-8 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#ac7afc] mb-1">{business.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{business.category}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={
                          business.subscriptionStatus === 'active' 
                            ? 'bg-[#3ce923] text-white' 
                            : 'bg-yellow-500 text-white'
                        }>
                          {business.subscriptionStatus === 'active' ? 'Activo' : 'Pendiente'}
                        </Badge>
                        {business.isLaunchPromo && (
                          <Badge className="bg-[#FFD700] text-black">
                            🎉 Promo
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm space-y-1">
                        <p className="text-gray-600">{business.address}</p>
                        <p className="text-[#FFD700] font-semibold">
                          {formatCurrency(business.monthlyCommissions)}/mes
                        </p>
                      </div>
                    </div>
                  </div>

                  {business.isLaunchPromo && business.promoEndsAt && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                      <p className="text-xs text-yellow-800">
                        Promo termina: {business.promoEndsAt.toLocaleDateString()}
                      </p>
                      <Progress 
                        value={75} 
                        className="h-1 mt-1"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 text-[#60cdff] border-[#60cdff]"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Ver Perfil
                    </Button>
                    {business.phone && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-[#3ce923] border-[#3ce923]"
                        onClick={() => window.open(`tel:${business.phone}`)}
                      >
                        📞
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {ambassadorData.assignedBusinesses.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  Aún no tienes negocios registrados
                </h3>
                <p className="text-gray-500 mb-4">
                  Registra tu primer negocio fijo y comienza a ganar comisiones mensuales
                </p>
                <Button 
                  onClick={onRegisterBusiness}
                  className="bg-[#3ce923] hover:bg-green-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Primer Negocio
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab de Referidos */}
        <TabsContent value="referrals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#60cdff]" />
                  Usuarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#60cdff] mb-2">
                  {ambassadorData.stats.userReferrals}
                </div>
                <p className="text-sm text-gray-600">Usuarios referidos activos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#3ce923]" />
                  Prestadores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#3ce923] mb-2">
                  {ambassadorData.stats.providerReferrals}
                </div>
                <p className="text-sm text-gray-600">Prestadores referidos activos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-[#ac7afc]" />
                  Negocios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#ac7afc] mb-2">
                  {ambassadorData.stats.businessReferrals}
                </div>
                <p className="text-sm text-gray-600">Negocios fijos registrados</p>
              </CardContent>
            </Card>
          </div>

          {/* Link de referido para compartir */}
          <Card>
            <CardHeader>
              <CardTitle>Comparte tu código y gana comisiones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tu link de referido:</Label>
                <div className="flex gap-2 mt-2">
                  <Input 
                    value={ambassadorData.referralLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button 
                    onClick={copyReferralLink}
                    variant="outline"
                    className="text-[#ac7afc] border-[#ac7afc]"
                  >
                    {copySuccess ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                <h4 className="font-semibold text-[#ac7afc] mb-2">💰 Comisiones por Referido:</h4>
                <div className="space-y-1 text-sm">
                  <p>• <strong>Servicios completados:</strong> 60% de la comisión ServiMap</p>
                  <p>• <strong>Membresías Premium:</strong> ${ambassadorData.isPremium ? '5' : '4'} USD/mes</p>
                  <p>• <strong>Negocios Fijos:</strong> ${ambassadorData.isPremium ? '12.50' : '10'} USD/mes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Comisiones */}
        <TabsContent value="commissions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Resumen de comisiones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#FFD700]" />
                  Resumen del Mes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#FFD700] mb-2">
                    {formatCurrency(ambassadorData.stats.monthlyCommissions)}
                  </div>
                  <p className="text-gray-600">Total este mes</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Servicios:</span>
                    <span className="font-semibold">{formatCurrency(75.50)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Membresías:</span>
                    <span className="font-semibold">{formatCurrency(50.00)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total:</span>
                    <span className="text-[#FFD700]">{formatCurrency(125.50)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Proyección */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#3ce923]" />
                  Proyección Mensual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#3ce923] mb-2">
                    {formatCurrency(150.00)}
                  </div>
                  <p className="text-gray-600">Estimado fin de mes</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progreso del mes:</span>
                    <span className="font-semibold">83%</span>
                  </div>
                  <Progress value={83} className="h-2" />
                </div>

                <Alert className="bg-green-50 border-green-200">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>¡Excelente!</strong> Vas 27% arriba del mes pasado.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          {/* Historial de comisiones */}
          <Card>
            <CardHeader>
              <CardTitle>Comisiones Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ambassadorData.recentCommissions.map((commission) => (
                  <div key={commission.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        commission.type === 'membership' ? 'bg-[#ac7afc]' : 'bg-[#3ce923]'
                      }`}></div>
                      <div>
                        <p className="font-medium">{commission.description}</p>
                        <p className="text-sm text-gray-600">
                          {commission.businessName} • {commission.date.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[#FFD700]">
                        {formatCurrency(commission.amount)}
                      </div>
                      <Badge className="bg-[#3ce923] text-white text-xs">
                        {commission.status === 'paid' ? 'Pagado' : 'Pendiente'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {ambassadorData.recentCommissions.length === 0 && (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Aún no tienes comisiones</p>
                  <p className="text-sm text-gray-500">Comparte tu código para comenzar a ganar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AmbassadorDashboard;