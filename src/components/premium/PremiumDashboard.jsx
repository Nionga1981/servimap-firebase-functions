'use client';

import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  TrendingUp, 
  Calendar, 
  MessageCircle, 
  Star,
  DollarSign,
  Clock,
  Shield,
  Zap,
  Heart,
  BarChart3,
  Gift,
  Sparkles,
  CheckCircle,
  ArrowRight,
  Award,
  Target,
  Users,
  MapPin,
  Phone,
  Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function PremiumDashboard({ className = "" }) {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [premiumStats, setPremiumStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Datos mock para demostración
  const mockDashboardData = {
    premiumStatus: {
      active: true,
      plan: 'Premium Pro',
      expiresAt: new Date('2024-12-31'),
      daysRemaining: 95,
      autoRenew: true
    },
    quickStats: {
      totalServices: 47,
      satisfactionRate: 98.5,
      responseTime: '12 min',
      monthlyEarnings: 2840.50,
      favoriteProviders: 12,
      emergencyServices: 3
    },
    achievements: [
      {
        id: 1,
        title: 'VIP Customer',
        description: 'Más de 50 servicios completados',
        icon: Crown,
        achieved: true,
        progress: 100
      },
      {
        id: 2,
        title: 'Loyal Partner',
        description: 'Un año como Premium',
        icon: Heart,
        achieved: false,
        progress: 65
      },
      {
        id: 3,
        title: 'Service Expert',
        description: '5 categorías diferentes',
        icon: Award,
        achieved: true,
        progress: 100
      }
    ],
    upcomingServices: [
      {
        id: 1,
        type: 'recurring',
        service: 'Limpieza residencial',
        provider: 'María González',
        date: new Date('2024-01-25T10:00:00'),
        avatar: null,
        premium: true
      },
      {
        id: 2,
        type: 'emergency',
        service: 'Plomería urgente',
        provider: 'Carlos Méndez',
        date: new Date('2024-01-22T15:30:00'),
        avatar: null,
        premium: true
      }
    ]
  };

  const mockRecentActivity = [
    {
      id: 1,
      type: 'service_completed',
      title: 'Servicio completado',
      description: 'Jardinería con Pedro López',
      time: '2 horas',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      id: 2,
      type: 'recurring_scheduled',
      title: 'Servicio recurrente programado',
      description: 'Limpieza cada martes',
      time: '1 día',
      icon: Calendar,
      color: 'text-blue-600'
    },
    {
      id: 3,
      type: 'favorite_added',
      title: 'Prestador agregado a favoritos',
      description: 'Ana Martín - Electricista',
      time: '3 días',
      icon: Heart,
      color: 'text-red-600'
    },
    {
      id: 4,
      type: 'bonus_earned',
      title: 'Bonificación ganada',
      description: '$15 por fidelidad',
      time: '5 días',
      icon: Gift,
      color: 'text-yellow-600'
    }
  ];

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // TODO: Reemplazar con llamada real a la API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setDashboardData(mockDashboardData);
      setRecentActivity(mockRecentActivity);
      
      // Calcular estadísticas Premium
      setPremiumStats({
        servicesThisMonth: 8,
        savingsVsStandard: 340.75,
        priorityResponseTime: '12 min',
        emergencyUsage: 3
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del dashboard",
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

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getDaysUntilExpiration = () => {
    if (!dashboardData?.premiumStatus?.expiresAt) return 0;
    const today = new Date();
    const expiration = new Date(dashboardData.premiumStatus.expiresAt);
    const diffTime = expiration - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-40 bg-gray-200 rounded-lg mb-6"></div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Crown className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Error cargando dashboard
        </h3>
        <p className="text-gray-600 mb-4">
          No se pudieron cargar los datos Premium
        </p>
        <Button onClick={loadDashboardData}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Premium Status */}
      <Card className="premium-card relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
          <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-purple-600 rounded-full transform rotate-45 translate-x-16 -translate-y-16"></div>
        </div>
        
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-yellow-400 to-purple-600 rounded-xl">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Premium Dashboard</CardTitle>
                <p className="text-gray-600">Plan {dashboardData.premiumStatus.plan}</p>
              </div>
            </div>
            <Badge className="premium-badge">
              <Sparkles className="h-3 w-3 mr-1" />
              Activo
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {getDaysUntilExpiration()}
              </div>
              <p className="text-gray-600 text-sm">días restantes</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 mb-1">
                {dashboardData.quickStats.satisfactionRate}%
              </div>
              <p className="text-gray-600 text-sm">satisfacción</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Renovación automática</span>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-600 font-medium">Activada</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {dashboardData.quickStats.totalServices}
            </div>
            <div className="text-sm text-gray-600">Servicios Totales</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-green-600 mb-1">
              {formatCurrency(dashboardData.quickStats.monthlyEarnings)}
            </div>
            <div className="text-sm text-gray-600">Este Mes</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {dashboardData.quickStats.responseTime}
            </div>
            <div className="text-sm text-gray-600">Respuesta</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Heart className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600 mb-1">
              {dashboardData.quickStats.favoriteProviders}
            </div>
            <div className="text-sm text-gray-600">Favoritos</div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Features Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Acceso Premium
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button 
              onClick={() => navigate('/schedule/recurring')}
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center space-y-1"
            >
              <Calendar className="h-5 w-5 text-blue-600" />
              <span className="text-sm">Servicios Recurrentes</span>
            </Button>

            <Button 
              onClick={() => navigate('/emergency')}
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center space-y-1"
            >
              <Shield className="h-5 w-5 text-red-600" />
              <span className="text-sm">Emergencias 24/7</span>
            </Button>

            <Button 
              onClick={() => navigate('/analytics')}
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center space-y-1"
            >
              <BarChart3 className="h-5 w-5 text-green-600" />
              <span className="text-sm">Analytics Avanzado</span>
            </Button>

            <Button 
              onClick={() => navigate('/international')}
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center space-y-1"
            >
              <MapPin className="h-5 w-5 text-purple-600" />
              <span className="text-sm">Servicios Internacionales</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Logros Premium
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboardData.achievements.map((achievement) => {
              const Icon = achievement.icon;
              return (
                <div 
                  key={achievement.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    achievement.achieved 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      achievement.achieved 
                        ? 'bg-green-100' 
                        : 'bg-gray-100'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        achievement.achieved 
                          ? 'text-green-600' 
                          : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {achievement.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {achievement.achieved ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completado
                      </Badge>
                    ) : (
                      <div className="w-16">
                        <Progress 
                          value={achievement.progress} 
                          className="h-2 mb-1"
                        />
                        <span className="text-xs text-gray-500">
                          {achievement.progress}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Services */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximos Servicios
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/schedule')}
            >
              Ver todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dashboardData.upcomingServices.map((service) => (
              <div 
                key={service.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={service.avatar} alt={service.provider} />
                    <AvatarFallback>
                      {service.provider.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-sm">{service.service}</h3>
                      {service.type === 'recurring' && (
                        <Badge variant="outline" className="text-xs">
                          Recurrente
                        </Badge>
                      )}
                      {service.type === 'emergency' && (
                        <Badge className="bg-red-100 text-red-800 text-xs">
                          Emergencia
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{service.provider}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatDate(service.date)}
                  </div>
                  <div className="flex items-center space-x-1 mt-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Phone className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Video className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dashboardData.upcomingServices.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No tienes servicios programados</p>
              <Button 
                onClick={() => navigate('/search')}
                className="mt-4"
              >
                Buscar Servicios
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((activity) => {
              const Icon = activity.icon;
              return (
                <div 
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Icon className={`h-4 w-4 ${activity.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">
                      {activity.title}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {activity.description}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {activity.time}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <div className="text-center">
            <Crown className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¡Aprovecha tu Premium!
            </h3>
            <p className="text-gray-600 mb-4">
              Accede a todas las funciones exclusivas de tu membresía
            </p>
            
            <div className="flex space-x-2">
              <Button 
                onClick={() => navigate('/wallet')}
                variant="outline" 
                className="flex-1"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Wallet
              </Button>
              <Button 
                onClick={() => navigate('/favorites')}
                variant="outline" 
                className="flex-1"
              >
                <Heart className="h-4 w-4 mr-2" />
                Favoritos
              </Button>
              <Button 
                onClick={() => navigate('/analytics')}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}