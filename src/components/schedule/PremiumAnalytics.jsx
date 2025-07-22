'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Users, 
  Crown,
  Clock,
  Star,
  Download,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

const PremiumAnalytics = ({ className = "" }) => {
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date()
  });
  const [timeRange, setTimeRange] = useState('last_month');
  const [filterType, setFilterType] = useState('all');

  // Colores ServiMap
  const premiumColor = '#ac7afc';
  const successColor = '#3ce923';
  const warningColor = '#FFD700';
  const errorColor = '#ef4444';

  useEffect(() => {
    checkPremiumStatus();
  }, []);

  useEffect(() => {
    if (isPremium) {
      fetchAnalyticsData();
    }
  }, [isPremium, dateRange, timeRange, filterType]);

  const checkPremiumStatus = async () => {
    try {
      const response = await fetch('/api/user/premium-status');
      if (response.ok) {
        const data = await response.json();
        setIsPremium(data.isPremium);
      }
    } catch (error) {
      console.error('Error checking premium status:', error);
    }
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/functions/generatePremiumAnalytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: {
            seconds: Math.floor(dateRange.from.getTime() / 1000),
            nanoseconds: 0
          },
          endDate: {
            seconds: Math.floor(dateRange.to.getTime() / 1000),
            nanoseconds: 0
          },
          timeRange,
          serviceFilter: filterType !== 'all' ? filterType : undefined
        })
      });

      if (!response.ok) throw new Error('Error obteniendo analytics');
      
      const data = await response.json();
      setAnalyticsData(data.result);
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las analíticas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange,
          filterType,
          format: 'pdf'
        })
      });

      if (!response.ok) throw new Error('Error exportando datos');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${dateRange.from.toISOString().split('T')[0]}-${dateRange.to.toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Exportación Exitosa",
        description: "El reporte se ha descargado correctamente",
        variant: "default"
      });
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar el reporte",
        variant: "destructive"
      });
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  };

  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return successColor;
      case 'cancelled': return errorColor;
      case 'pending': return warningColor;
      default: return '#9ca3af';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (!isPremium) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Crown className="h-16 w-16 mx-auto mb-4" style={{ color: premiumColor }} />
          <h3 className="text-xl font-semibold mb-2">Función Premium</h3>
          <p className="text-gray-600 mb-4">
            Las analíticas avanzadas están disponibles solo para usuarios Premium
          </p>
          <Button style={{ backgroundColor: premiumColor }}>
            Upgrade a Premium
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Premium */}
      <Card style={{ borderColor: premiumColor }}>
        <CardHeader style={{ backgroundColor: `${premiumColor}15` }}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" style={{ color: premiumColor }} />
              Analytics Premium
              <Badge style={{ backgroundColor: premiumColor }}>Premium</Badge>
            </CardTitle>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalyticsData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={exportAnalytics}
                disabled={loading || !analyticsData}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            Filtros de Análisis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Período de Tiempo
              </label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_week">Última semana</SelectItem>
                  <SelectItem value="last_month">Último mes</SelectItem>
                  <SelectItem value="last_quarter">Último trimestre</SelectItem>
                  <SelectItem value="last_year">Último año</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Tipo de Servicio
              </label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los servicios</SelectItem>
                  <SelectItem value="plomeria">Plomería</SelectItem>
                  <SelectItem value="electricidad">Electricidad</SelectItem>
                  <SelectItem value="carpinteria">Carpintería</SelectItem>
                  <SelectItem value="limpieza">Limpieza</SelectItem>
                  <SelectItem value="jardineria">Jardinería</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Rango de Fechas
              </label>
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
                disabled={timeRange !== 'custom'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          </CardContent>
        </Card>
      ) : analyticsData ? (
        <>
          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPrice(analyticsData.totalRevenue || 0)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600">
                    +{formatPercentage(analyticsData.revenueGrowth || 0)} vs período anterior
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Servicios Completados</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {analyticsData.completedServices || 0}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-blue-500" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-gray-600">
                    {formatPercentage(analyticsData.completionRate || 0)} tasa de finalización
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Clientes Únicos</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {analyticsData.uniqueCustomers || 0}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-purple-500" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-purple-600">
                    {formatPercentage(analyticsData.customerRetention || 0)} retención
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Calificación Promedio</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {(analyticsData.averageRating || 0).toFixed(1)}
                    </p>
                  </div>
                  <Star className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-gray-600">
                    Basado en {analyticsData.totalReviews || 0} reseñas
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficas y estadísticas detalladas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribución por tipo de servicio */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Tipo de Servicio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.serviceDistribution?.map((service, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{service.type.replace('_', ' ')}</span>
                        <span className="font-medium">
                          {service.count} ({formatPercentage(service.percentage)})
                        </span>
                      </div>
                      <Progress value={service.percentage} className="h-2" />
                    </div>
                  )) || []}
                </div>
              </CardContent>
            </Card>

            {/* Ingresos por período */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.revenueByPeriod?.map((period, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div>
                        <p className="font-medium">{period.period}</p>
                        <p className="text-sm text-gray-600">{period.services} servicios</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          {formatPrice(period.revenue)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Promedio: {formatPrice(period.revenue / period.services)}
                        </p>
                      </div>
                    </div>
                  )) || []}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Servicios recientes */}
          <Card>
            <CardHeader>
              <CardTitle>Servicios Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.recentServices?.slice(0, 10).map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div style={{ color: getStatusColor(service.status) }}>
                        {getStatusIcon(service.status)}
                      </div>
                      <div>
                        <p className="font-medium capitalize">
                          {service.serviceType.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {service.customerName} • {new Date(service.date.seconds * 1000).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        {formatPrice(service.price)}
                      </p>
                      <Badge 
                        variant="secondary"
                        style={{ 
                          backgroundColor: `${getStatusColor(service.status)}20`,
                          color: getStatusColor(service.status)
                        }}
                      >
                        {service.status === 'completed' ? 'Completado' :
                         service.status === 'cancelled' ? 'Cancelado' :
                         service.status === 'pending' ? 'Pendiente' : service.status}
                      </Badge>
                    </div>
                  </div>
                )) || []}
              </div>
            </CardContent>
          </Card>

          {/* Horarios más populares */}
          <Card>
            <CardHeader>
              <CardTitle>Horarios Más Populares</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Por Día de la Semana</h4>
                  <div className="space-y-3">
                    {analyticsData.popularDays?.map((day, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{day.day}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={day.percentage} className="w-24 h-2" />
                          <span className="text-sm font-medium w-12">
                            {formatPercentage(day.percentage)}
                          </span>
                        </div>
                      </div>
                    )) || []}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Por Hora del Día</h4>
                  <div className="space-y-3">
                    {analyticsData.popularHours?.map((hour, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{hour.hour}:00</span>
                        <div className="flex items-center gap-2">
                          <Progress value={hour.percentage} className="w-24 h-2" />
                          <span className="text-sm font-medium w-12">
                            {formatPercentage(hour.percentage)}
                          </span>
                        </div>
                      </div>
                    )) || []}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No hay datos disponibles</h3>
            <p className="text-gray-600 mb-4">
              Selecciona un rango de fechas para ver tus analíticas
            </p>
            <Button onClick={fetchAnalyticsData} disabled={loading}>
              Cargar Datos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Información adicional */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Los datos se actualizan automáticamente cada hora</p>
            <p>• Las analíticas incluyen servicios regulares, recurrentes y de emergencia</p>
            <p>• Los reportes pueden exportarse en formato PDF o Excel</p>
            <p>• Los datos históricos están disponibles por hasta 2 años</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PremiumAnalytics;