'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  DollarSign, 
  Clock,
  Star,
  MapPin,
  Users,
  Target,
  Award,
  Sparkles,
  RefreshCw,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Brain,
  Zap,
  PieChart,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function PremiumAnalytics({ className = "" }) {
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState(null);

  // Datos mock para demostración
  const mockAnalyticsData = {
    overview: {
      totalSpent: 3450.75,
      totalServices: 24,
      avgServiceCost: 143.78,
      satisfactionScore: 4.8,
      timeToCompletion: '2.3 días',
      repeatProviders: 67,
      emergencyServices: 3,
      internationalServices: 2
    },
    trends: {
      spendingTrend: [
        { month: 'Ene', amount: 850, services: 6 },
        { month: 'Feb', amount: 920, services: 7 },
        { month: 'Mar', amount: 1180, services: 8 },
        { month: 'Abr', amount: 1100, services: 9 },
        { month: 'May', amount: 1350, services: 11 },
        { month: 'Jun', amount: 1450, services: 13 }
      ],
      categoryBreakdown: [
        { category: 'Limpieza', amount: 1250, percentage: 36, services: 8 },
        { category: 'Plomería', amount: 890, percentage: 26, services: 5 },
        { category: 'Electricidad', amount: 650, percentage: 19, services: 4 },
        { category: 'Jardinería', amount: 420, percentage: 12, services: 3 },
        { category: 'Otros', amount: 240, percentage: 7, services: 4 }
      ],
      providerPerformance: [
        { 
          name: 'María González', 
          services: 6, 
          avgRating: 4.9, 
          avgCost: 180,
          specialty: 'Limpieza',
          reliability: 98
        },
        { 
          name: 'Carlos Méndez', 
          services: 4, 
          avgRating: 4.7, 
          avgCost: 220,
          specialty: 'Plomería',
          reliability: 95
        },
        { 
          name: 'Ana López', 
          services: 3, 
          avgRating: 4.8, 
          avgCost: 160,
          specialty: 'Electricidad',
          reliability: 97
        }
      ]
    },
    aiInsights: [
      {
        id: 1,
        type: 'cost_optimization',
        title: 'Optimización de Costos',
        description: 'Podrías ahorrar hasta $340/mes cambiando tu patrón de contratación',
        details: 'Análisis muestra que agendando servicios de limpieza en martes y miércoles obtienes 15% de descuento promedio. Además, contratar servicios recurrentes reduce costos en 23%.',
        impact: 'high',
        confidence: 89,
        actionable: true,
        icon: DollarSign
      },
      {
        id: 2,
        type: 'provider_recommendation',
        title: 'Recomendación de Prestadores',
        description: 'Basado en tu historial, estos prestadores son ideales para ti',
        details: 'Tu preferencia por alta calidad (rating >4.7) y puntualidad se alinea con 3 prestadores nuevos en tu área. Todos tienen especialización en servicios que usas frecuentemente.',
        impact: 'medium',
        confidence: 94,
        actionable: true,
        icon: Users
      },
      {
        id: 3,
        type: 'schedule_optimization',
        title: 'Optimización de Horarios',
        description: 'Patrones ideales para mejor disponibilidad y precios',
        details: 'Tu patrón de uso muestra preferencia por horarios matutinos (8-11 AM). Los datos indican que agendar entre 9-10 AM reduce tiempo de espera en 40% y costos en 12%.',
        impact: 'medium',
        confidence: 76,
        actionable: true,
        icon: Clock
      },
      {
        id: 4,
        type: 'seasonal_trends',
        title: 'Tendencias Estacionales',
        description: 'Planifica tus servicios según patrones estacionales',
        details: 'Análisis predictivo sugiere incrementar servicios de jardinería en primavera (marzo-mayo) y mantenimiento preventivo antes de temporada de lluvias.',
        impact: 'low',
        confidence: 82,
        actionable: false,
        icon: Calendar
      }
    ],
    predictions: {
      nextMonthSpending: 1580,
      recommendedBudget: 1400,
      savingsOpportunity: 180,
      upcomingNeeds: [
        'Mantenimiento de jardín (en 2 semanas)',
        'Limpieza profunda (en 1 mes)',
        'Revisión eléctrica (en 6 semanas)'
      ]
    },
    comparisons: {
      vsAverage: {
        spending: 23, // 23% más que el promedio
        satisfaction: 12, // 12% más satisfacción
        serviceFrequency: -8 // 8% menos frecuencia
      },
      vsPremiumUsers: {
        spending: -15, // 15% menos que otros Premium
        satisfaction: 5, // 5% más satisfacción
        emergencyUsage: 40 // 40% más uso de emergencias
      }
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // TODO: Reemplazar con llamada real a la API
      await new Promise(resolve => setTimeout(resolve, 1500));
      setAnalyticsData(mockAnalyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    setRefreshing(true);
    try {
      await loadAnalyticsData();
      toast({
        title: "Analytics actualizados",
        description: "Los datos han sido actualizados con la información más reciente"
      });
    } finally {
      setRefreshing(false);
    }
  };

  const exportReport = () => {
    toast({
      title: "Generando reporte",
      description: "Tu reporte será enviado por email en unos minutos"
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getImpactLabel = (impact) => {
    switch (impact) {
      case 'high': return 'Alto Impacto';
      case 'medium': return 'Impacto Medio';
      case 'low': return 'Bajo Impacto';
      default: return 'Sin Impacto';
    }
  };

  const getTrendIcon = (value) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getTrendColor = (value) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-lg mb-6"></div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="h-32 bg-gray-200 rounded-lg"></div>
            <div className="h-32 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-64 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Error cargando analytics
        </h3>
        <p className="text-gray-600 mb-4">
          No se pudieron cargar los datos de analytics
        </p>
        <Button onClick={loadAnalyticsData}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Premium</h1>
            <p className="text-gray-600">Insights inteligentes sobre tus servicios</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="90d">90 días</SelectItem>
              <SelectItem value="1y">1 año</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            onClick={refreshAnalytics}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          
          <Button
            onClick={exportReport}
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <Badge variant="outline" className="text-xs">Total</Badge>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatCurrency(analyticsData.overview.totalSpent)}
            </div>
            <p className="text-sm text-gray-600">Gastado</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-5 w-5 text-blue-600" />
              <Badge variant="outline" className="text-xs">Servicios</Badge>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {analyticsData.overview.totalServices}
            </div>
            <p className="text-sm text-gray-600">Completados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-yellow-600" />
              <Badge variant="outline" className="text-xs">Rating</Badge>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {analyticsData.overview.satisfactionScore}
            </div>
            <p className="text-sm text-gray-600">Satisfacción</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <Badge variant="outline" className="text-xs">Promedio</Badge>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {analyticsData.overview.timeToCompletion}
            </div>
            <p className="text-sm text-gray-600">Duración</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Insights de IA
            <Badge className="premium-badge ml-2">
              <Zap className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.aiInsights.map((insight) => {
              const Icon = insight.icon;
              const isExpanded = expandedInsight === insight.id;
              
              return (
                <div 
                  key={insight.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Icon className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium text-gray-900">
                            {insight.title}
                          </h3>
                          <Badge className={`text-xs ${getImpactColor(insight.impact)}`}>
                            {getImpactLabel(insight.impact)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {insight.confidence}% confianza
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {insight.description}
                        </p>
                        
                        {isExpanded && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800">
                              {insight.details}
                            </p>
                            {insight.actionable && (
                              <Button 
                                size="sm" 
                                className="mt-2"
                                onClick={() => toast({
                                  title: "Acción registrada",
                                  description: "Te notificaremos cuando podamos implementar esta recomendación"
                                })}
                              >
                                Aplicar recomendación
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs para diferentes vistas */}
      <Tabs defaultValue="spending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="spending">Gastos</TabsTrigger>
          <TabsTrigger value="providers">Prestadores</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="predictions">Predicciones</TabsTrigger>
        </TabsList>

        <TabsContent value="spending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Gastos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.trends.spendingTrend.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 text-sm font-medium text-gray-600">
                        {item.month}
                      </div>
                      <div className="flex-1">
                        <Progress 
                          value={(item.amount / 1500) * 100} 
                          className="h-3"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(item.amount)}</div>
                      <div className="text-sm text-gray-500">{item.services} servicios</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">vs Usuarios Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Gasto</span>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(analyticsData.comparisons.vsAverage.spending)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.comparisons.vsAverage.spending)}`}>
                        {Math.abs(analyticsData.comparisons.vsAverage.spending)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Satisfacción</span>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(analyticsData.comparisons.vsAverage.satisfaction)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.comparisons.vsAverage.satisfaction)}`}>
                        {Math.abs(analyticsData.comparisons.vsAverage.satisfaction)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Frecuencia</span>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(analyticsData.comparisons.vsAverage.serviceFrequency)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.comparisons.vsAverage.serviceFrequency)}`}>
                        {Math.abs(analyticsData.comparisons.vsAverage.serviceFrequency)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">vs Usuarios Premium</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Gasto</span>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(analyticsData.comparisons.vsPremiumUsers.spending)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.comparisons.vsPremiumUsers.spending)}`}>
                        {Math.abs(analyticsData.comparisons.vsPremiumUsers.spending)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Satisfacción</span>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(analyticsData.comparisons.vsPremiumUsers.satisfaction)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.comparisons.vsPremiumUsers.satisfaction)}`}>
                        {Math.abs(analyticsData.comparisons.vsPremiumUsers.satisfaction)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Emergencias</span>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(analyticsData.comparisons.vsPremiumUsers.emergencyUsage)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.comparisons.vsPremiumUsers.emergencyUsage)}`}>
                        {Math.abs(analyticsData.comparisons.vsPremiumUsers.emergencyUsage)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento de Prestadores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.trends.providerPerformance.map((provider, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-purple-600">
                          {provider.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{provider.name}</h3>
                        <p className="text-sm text-gray-600">{provider.specialty}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center space-x-4 text-sm">
                        <div>
                          <div className="font-medium">{provider.services} servicios</div>
                          <div className="text-gray-500">Cantidad</div>
                        </div>
                        <div>
                          <div className="font-medium flex items-center">
                            <Star className="h-3 w-3 text-yellow-500 mr-1" />
                            {provider.avgRating}
                          </div>
                          <div className="text-gray-500">Rating</div>
                        </div>
                        <div>
                          <div className="font-medium">{formatCurrency(provider.avgCost)}</div>
                          <div className="text-gray-500">Promedio</div>
                        </div>
                        <div>
                          <div className="font-medium text-green-600">{provider.reliability}%</div>
                          <div className="text-gray-500">Confiabilidad</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Categorías</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.trends.categoryBreakdown.map((category, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{category.category}</span>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(category.amount)}</div>
                        <div className="text-sm text-gray-500">{category.services} servicios</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Progress value={category.percentage} className="flex-1 h-2" />
                      <span className="text-sm font-medium text-gray-600 w-12">
                        {category.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  Predicciones IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Gasto próximo mes</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(analyticsData.predictions.nextMonthSpending)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Presupuesto recomendado</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(analyticsData.predictions.recommendedBudget)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Ahorro potencial</span>
                      <span className="font-medium text-purple-600">
                        {formatCurrency(analyticsData.predictions.savingsOpportunity)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Necesidades Futuras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.predictions.upcomingNeeds.map((need, index) => (
                    <div key={index} className="flex items-center space-x-3 p-2 bg-blue-50 rounded-lg">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-800">{need}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}