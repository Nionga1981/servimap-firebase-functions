'use client';

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Heart, 
  ThumbsUp, 
  Star, 
  Gift,
  Sparkles,
  TrendingUp,
  Clock,
  Users,
  Award,
  Target,
  Send,
  Plus,
  Minus,
  Check,
  X,
  MessageCircle,
  Camera,
  Share2,
  History,
  Crown,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function DigitalTips({ 
  serviceId, 
  providerId, 
  serviceAmount,
  className = "" 
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [tipAmount, setTipAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState('');
  const [tipPercentage, setTipPercentage] = useState(15);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [tipMessage, setTipMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tipHistory, setTipHistory] = useState([]);
  const [providerInfo, setProviderInfo] = useState(null);
  const [tipStats, setTipStats] = useState({});

  // Presets de propina
  const tipPresets = [
    { id: 1, percentage: 10, label: '10%', description: 'Buen servicio' },
    { id: 2, percentage: 15, label: '15%', description: 'Muy buen servicio' },
    { id: 3, percentage: 20, label: '20%', description: 'Excelente servicio' },
    { id: 4, percentage: 25, label: '25%', description: 'Excepcional' }
  ];

  // Datos mock
  const mockProviderInfo = {
    id: providerId || 'p1',
    displayName: 'María González',
    specialty: 'Limpieza Residencial',
    photoURL: null,
    rating: 4.9,
    reviewCount: 127,
    tipStats: {
      totalTips: 2450.75,
      averageTip: 45.50,
      tipCount: 54,
      topTipper: false
    }
  };

  const mockTipHistory = [
    {
      id: '1',
      providerId: 'p1',
      providerName: 'María González',
      amount: 50.00,
      message: '¡Excelente trabajo como siempre!',
      date: new Date('2024-01-15'),
      serviceType: 'Limpieza profunda',
      isAnonymous: false
    },
    {
      id: '2',
      providerId: 'p2',
      providerName: 'Carlos Méndez',
      amount: 75.00,
      message: 'Muy profesional y puntual',
      date: new Date('2024-01-10'),
      serviceType: 'Reparación plomería',
      isAnonymous: true
    },
    {
      id: '3',
      providerId: 'p3',
      providerName: 'Ana López',
      amount: 40.00,
      message: '',
      date: new Date('2024-01-08'),
      serviceType: 'Instalación eléctrica',
      isAnonymous: false
    }
  ];

  const mockTipStats = {
    totalGiven: 165.00,
    thisMonth: 125.00,
    averageTip: 55.00,
    providersHelped: 3,
    topCategories: [
      { category: 'Limpieza', amount: 90.00, count: 2 },
      { category: 'Plomería', amount: 75.00, count: 1 }
    ]
  };

  useEffect(() => {
    loadProviderInfo();
    loadTipHistory();
    loadTipStats();
  }, [providerId]);

  useEffect(() => {
    if (serviceAmount && tipPercentage) {
      const calculatedTip = (serviceAmount * tipPercentage) / 100;
      setTipAmount(calculatedTip);
      setCustomAmount(calculatedTip.toString());
    }
  }, [serviceAmount, tipPercentage]);

  const loadProviderInfo = async () => {
    try {
      // TODO: Reemplazar con llamada real a la API
      setProviderInfo(mockProviderInfo);
    } catch (error) {
      console.error('Error loading provider info:', error);
    }
  };

  const loadTipHistory = async () => {
    try {
      // TODO: Reemplazar con llamada real a la API
      setTipHistory(mockTipHistory);
    } catch (error) {
      console.error('Error loading tip history:', error);
    }
  };

  const loadTipStats = async () => {
    try {
      // TODO: Reemplazar con llamada real a la API
      setTipStats(mockTipStats);
    } catch (error) {
      console.error('Error loading tip stats:', error);
    }
  };

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.id);
    setTipPercentage(preset.percentage);
    if (serviceAmount) {
      const amount = (serviceAmount * preset.percentage) / 100;
      setTipAmount(amount);
      setCustomAmount(amount.toString());
    }
  };

  const handleCustomAmountChange = (value) => {
    setCustomAmount(value);
    const amount = parseFloat(value) || 0;
    setTipAmount(amount);
    setSelectedPreset(null);
    
    if (serviceAmount && amount > 0) {
      const percentage = (amount / serviceAmount) * 100;
      setTipPercentage(Math.round(percentage));
    }
  };

  const handleSliderChange = (value) => {
    const percentage = value[0];
    setTipPercentage(percentage);
    setSelectedPreset(null);
    
    if (serviceAmount) {
      const amount = (serviceAmount * percentage) / 100;
      setTipAmount(amount);
      setCustomAmount(amount.toString());
    }
  };

  const sendTip = async () => {
    if (tipAmount <= 0) {
      toast({
        title: "Monto inválido",
        description: "Ingresa un monto de propina válido",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // TODO: Procesar pago de propina
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newTip = {
        id: Date.now().toString(),
        providerId: providerId,
        providerName: providerInfo?.displayName,
        amount: tipAmount,
        message: tipMessage,
        date: new Date(),
        serviceType: 'Servicio actual',
        isAnonymous: isAnonymous
      };

      setTipHistory(prev => [newTip, ...prev]);
      
      toast({
        title: "¡Propina enviada!",
        description: `$${tipAmount.toFixed(2)} enviados a ${providerInfo?.displayName}`,
      });

      // Reset form
      setTipAmount(0);
      setCustomAmount('');
      setTipMessage('');
      setSelectedPreset(null);
      setTipPercentage(15);
      
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar la propina. Intenta de nuevo.",
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const ShareTipDialog = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Compartir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartir Propina</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
            <Gift className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¡Acabas de dar una propina!
            </h3>
            <p className="text-gray-600">
              {formatCurrency(tipAmount)} para {providerInfo?.displayName}
            </p>
          </div>
          
          <div className="space-y-2">
            <Button className="w-full" onClick={() => {
              toast({ title: "Compartido en redes sociales" });
            }}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartir en redes
            </Button>
            <Button variant="outline" className="w-full" onClick={() => {
              navigator.clipboard.writeText(`¡Acabo de dar una propina de ${formatCurrency(tipAmount)} en ServiMap!`);
              toast({ title: "Texto copiado al portapapeles" });
            }}>
              Copiar texto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl">
            <Gift className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Propinas Digitales</h1>
            <p className="text-gray-600">Reconoce el excelente servicio</p>
          </div>
        </div>
        
        <Badge className="premium-badge">
          <Crown className="h-3 w-3 mr-1" />
          Premium
        </Badge>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send">Enviar Propina</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="stats">Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          {/* Provider Info */}
          {providerInfo && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={providerInfo.photoURL} alt={providerInfo.displayName} />
                    <AvatarFallback>
                      {providerInfo.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {providerInfo.displayName}
                    </h3>
                    <p className="text-gray-600">{providerInfo.specialty}</p>
                    
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-500 fill-current mr-1" />
                        <span className="text-sm font-medium">{providerInfo.rating}</span>
                        <span className="text-sm text-gray-500 ml-1">({providerInfo.reviewCount})</span>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <Gift className="h-4 w-4 mr-1" />
                        <span>{formatCurrency(providerInfo.tipStats.totalTips)} en propinas</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Service Amount */}
          {serviceAmount && (
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Monto del servicio</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(serviceAmount)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tip Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selecciona una propina</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {tipPresets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={selectedPreset === preset.id ? "default" : "outline"}
                    className="h-20 flex flex-col items-center justify-center space-y-1"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    <span className="text-lg font-bold">{preset.label}</span>
                    <span className="text-xs text-gray-600">{preset.description}</span>
                    {serviceAmount && (
                      <span className="text-xs font-medium">
                        {formatCurrency((serviceAmount * preset.percentage) / 100)}
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="space-y-3">
                <Label>Monto personalizado</Label>
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(e) => handleCustomAmountChange(e.target.value)}
                      className="text-center text-lg font-semibold"
                    />
                  </div>
                  <span className="text-gray-600">MXN</span>
                </div>
              </div>

              {/* Percentage Slider */}
              {serviceAmount && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Porcentaje: {tipPercentage}%</Label>
                    <span className="text-sm text-gray-600">
                      {formatCurrency((serviceAmount * tipPercentage) / 100)}
                    </span>
                  </div>
                  <Slider
                    value={[tipPercentage]}
                    onValueChange={handleSliderChange}
                    max={50}
                    min={5}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tip Message */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mensaje (opcional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Escribe un mensaje de agradecimiento..."
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                rows={3}
                maxLength={200}
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="anonymous"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="anonymous" className="text-sm">
                    Enviar de forma anónima
                  </Label>
                </div>
                <span className="text-xs text-gray-500">
                  {tipMessage.length}/200
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Summary and Send */}
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div>
                  <div className="text-sm text-gray-600">Total a enviar</div>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(tipAmount)}
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={sendTip}
                    disabled={loading || tipAmount <= 0}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Enviando...
                      </div>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Propina
                      </>
                    )}
                  </Button>
                  
                  {tipAmount > 0 && <ShareTipDialog />}
                </div>
                
                <p className="text-xs text-gray-600">
                  La propina se cargará a tu método de pago predeterminado
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Propinas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tipHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No has enviado propinas aún
                  </h3>
                  <p className="text-gray-600">
                    Cuando envíes tu primera propina aparecerá aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tipHistory.map((tip) => (
                    <div
                      key={tip.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Gift className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {tip.isAnonymous ? 'Propina anónima' : tip.providerName}
                          </h3>
                          <p className="text-sm text-gray-600">{tip.serviceType}</p>
                          {tip.message && (
                            <p className="text-sm text-gray-700 mt-1 italic">
                              &quot;{tip.message}&quot;
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(tip.date)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600">
                          {formatCurrency(tip.amount)}
                        </div>
                        {tip.isAnonymous && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Anónima
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(tipStats.totalGiven)}
                </div>
                <div className="text-sm text-gray-600">Total Dado</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <div className="text-xl font-bold text-blue-600">
                  {formatCurrency(tipStats.thisMonth)}
                </div>
                <div className="text-sm text-gray-600">Este Mes</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <div className="text-xl font-bold text-purple-600">
                  {formatCurrency(tipStats.averageTip)}
                </div>
                <div className="text-sm text-gray-600">Promedio</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Users className="h-5 w-5 text-yellow-600" />
                  </div>
                </div>
                <div className="text-xl font-bold text-yellow-600">
                  {tipStats.providersHelped}
                </div>
                <div className="text-sm text-gray-600">Prestadores</div>
              </CardContent>
            </Card>
          </div>

          {/* Top Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Categorías Favoritas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tipStats.topCategories?.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{category.category}</h3>
                        <p className="text-sm text-gray-600">{category.count} propinas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        {formatCurrency(category.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Achievement Card */}
          <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
            <CardContent className="p-6 text-center">
              <Award className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¡Generoso Reconocido!
              </h3>
              <p className="text-gray-600 mb-4">
                Has dado propinas a {tipStats.providersHelped} prestadores diferentes
              </p>
              <Badge className="bg-yellow-100 text-yellow-800">
                <Sparkles className="h-3 w-3 mr-1" />
                Top Supporter
              </Badge>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}