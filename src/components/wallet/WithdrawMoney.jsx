'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  CreditCard, 
  Bank, 
  DollarSign, 
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Shield,
  Info,
  Calculator,
  History,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function WithdrawMoney({ className = "" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: amount, 2: method, 3: confirmation, 4: success
  const [withdrawalMethods, setWithdrawalMethods] = useState([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [fees, setFees] = useState({});
  const [showAccountDetails, setShowAccountDetails] = useState({});

  // Límites y configuraciones
  const WITHDRAWAL_LIMITS = {
    minimum: 100,
    maximum: 50000,
    dailyLimit: 10000,
    monthlyLimit: 100000
  };

  // Datos mock
  const mockWalletBalance = 2450.75;
  
  const mockWithdrawalMethods = [
    {
      id: '1',
      type: 'bank_account',
      name: 'Cuenta Bancaria Principal',
      bank: 'BBVA México',
      accountNumber: '****7891',
      isDefault: true,
      processingTime: '1-2 días hábiles',
      fee: 0,
      icon: Bank
    },
    {
      id: '2',
      type: 'debit_card',
      name: 'Tarjeta de Débito',
      bank: 'Santander',
      accountNumber: '****4532',
      isDefault: false,
      processingTime: 'Instantáneo',
      fee: 15,
      icon: CreditCard
    },
    {
      id: '3',
      type: 'digital_wallet',
      name: 'SPEI Express',
      bank: 'Sistema de Pagos',
      accountNumber: '****1234',
      isDefault: false,
      processingTime: 'Inmediato',
      fee: 8,
      icon: Smartphone
    }
  ];

  const mockWithdrawalHistory = [
    {
      id: '1',
      amount: 1500.00,
      method: 'Cuenta BBVA ****7891',
      status: 'completed',
      date: new Date('2024-01-18'),
      fee: 0,
      reference: 'WD-2024-001',
      estimatedDate: new Date('2024-01-20'),
      actualDate: new Date('2024-01-19')
    },
    {
      id: '2',
      amount: 800.00,
      method: 'Tarjeta Santander ****4532',
      status: 'processing',
      date: new Date('2024-01-20'),
      fee: 15,
      reference: 'WD-2024-002',
      estimatedDate: new Date('2024-01-20'),
      actualDate: null
    },
    {
      id: '3',
      amount: 2200.00,
      method: 'Cuenta BBVA ****7891',
      status: 'failed',
      date: new Date('2024-01-15'),
      fee: 0,
      reference: 'WD-2024-003',
      estimatedDate: new Date('2024-01-17'),
      actualDate: null,
      failureReason: 'Datos bancarios incorrectos'
    }
  ];

  useEffect(() => {
    loadWalletData();
    loadWithdrawalMethods();
    loadWithdrawalHistory();
  }, []);

  useEffect(() => {
    calculateFees();
  }, [withdrawAmount, selectedMethod]);

  const loadWalletData = async () => {
    try {
      // TODO: Cargar balance real del wallet
      setWalletBalance(mockWalletBalance);
    } catch (error) {
      console.error('Error loading wallet data:', error);
    }
  };

  const loadWithdrawalMethods = async () => {
    try {
      // TODO: Cargar métodos reales
      setWithdrawalMethods(mockWithdrawalMethods);
      const defaultMethod = mockWithdrawalMethods.find(m => m.isDefault);
      if (defaultMethod) {
        setSelectedMethod(defaultMethod.id);
      }
    } catch (error) {
      console.error('Error loading withdrawal methods:', error);
    }
  };

  const loadWithdrawalHistory = async () => {
    try {
      // TODO: Cargar historial real
      setWithdrawalHistory(mockWithdrawalHistory);
    } catch (error) {
      console.error('Error loading withdrawal history:', error);
    }
  };

  const calculateFees = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    const method = withdrawalMethods.find(m => m.id === selectedMethod);
    
    if (!method || amount <= 0) {
      setFees({});
      return;
    }

    const baseFee = method.fee;
    const percentageFee = amount > 5000 ? amount * 0.001 : 0; // 0.1% para montos altos
    const totalFee = baseFee + percentageFee;
    const netAmount = amount - totalFee;

    setFees({
      baseFee,
      percentageFee,
      totalFee,
      netAmount,
      processingTime: method.processingTime
    });
  };

  const validateWithdrawal = () => {
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount <= 0) {
      toast({
        title: "Monto inválido",
        description: "Ingresa un monto válido para retirar",
        variant: "destructive"
      });
      return false;
    }

    if (amount < WITHDRAWAL_LIMITS.minimum) {
      toast({
        title: "Monto muy bajo",
        description: `El monto mínimo de retiro es ${formatCurrency(WITHDRAWAL_LIMITS.minimum)}`,
        variant: "destructive"
      });
      return false;
    }

    if (amount > WITHDRAWAL_LIMITS.maximum) {
      toast({
        title: "Monto muy alto",
        description: `El monto máximo de retiro es ${formatCurrency(WITHDRAWAL_LIMITS.maximum)}`,
        variant: "destructive"
      });
      return false;
    }

    if (fees.netAmount > walletBalance) {
      toast({
        title: "Saldo insuficiente",
        description: "No tienes suficiente saldo para este retiro (incluyendo comisiones)",
        variant: "destructive"
      });
      return false;
    }

    if (!selectedMethod) {
      toast({
        title: "Método requerido",
        description: "Selecciona un método de retiro",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const processWithdrawal = async () => {
    if (!validateWithdrawal()) return;

    setLoading(true);
    try {
      // TODO: Procesar retiro real
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newWithdrawal = {
        id: Date.now().toString(),
        amount: parseFloat(withdrawAmount),
        method: withdrawalMethods.find(m => m.id === selectedMethod)?.name + ' ' + 
                withdrawalMethods.find(m => m.id === selectedMethod)?.accountNumber,
        status: 'processing',
        date: new Date(),
        fee: fees.totalFee,
        reference: `WD-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
        estimatedDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 día
        actualDate: null
      };

      setWithdrawalHistory(prev => [newWithdrawal, ...prev]);
      setStep(4);
      
    } catch (error) {
      toast({
        title: "Error en el retiro",
        description: "No se pudo procesar el retiro. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setWithdrawAmount('');
    setSelectedMethod(withdrawalMethods.find(m => m.isDefault)?.id || '');
    setStep(1);
    setFees({});
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'processing': return 'Procesando';
      case 'failed': return 'Falló';
      default: return 'Desconocido';
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Referencia copiada al portapapeles"
    });
  };

  const AddMethodDialog = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Método
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar Método de Retiro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo de método</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_account">Cuenta Bancaria</SelectItem>
                <SelectItem value="debit_card">Tarjeta de Débito</SelectItem>
                <SelectItem value="digital_wallet">Wallet Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Nombre del método</Label>
            <Input placeholder="Ej: Mi cuenta principal" />
          </div>
          
          <div>
            <Label>Número de cuenta/tarjeta</Label>
            <Input placeholder="1234567890123456" />
          </div>
          
          <Button className="w-full">
            Agregar Método
          </Button>
          
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Tus datos están protegidos con encriptación de nivel bancario
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (step === 4) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ¡Retiro Solicitado!
          </h2>
          
          <div className="max-w-md mx-auto space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Monto a retirar</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(parseFloat(withdrawAmount))}
              </div>
              <div className="text-sm text-gray-600">
                Comisión: {formatCurrency(fees.totalFee || 0)}
              </div>
            </div>
            
            <div className="text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Método:</span>
                <span className="font-medium">
                  {withdrawalMethods.find(m => m.id === selectedMethod)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tiempo estimado:</span>
                <span className="font-medium">{fees.processingTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Referencia:</span>
                <span className="font-medium">WD-{new Date().getFullYear()}-{String(Date.now()).slice(-3)}</span>
              </div>
            </div>
            
            <div className="space-y-3 pt-4">
              <Button 
                onClick={() => navigate('/wallet')}
                className="w-full"
              >
                Volver al Wallet
              </Button>
              <Button 
                onClick={resetForm}
                variant="outline"
                className="w-full"
              >
                Hacer Otro Retiro
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/wallet')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step > 1 ? 'Atrás' : 'Volver'}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Retirar Dinero</h1>
            <p className="text-gray-600">
              Saldo disponible: {formatCurrency(walletBalance)}
            </p>
          </div>
        </div>
        
        <Badge variant="outline" className="text-sm">
          Paso {step} de 3
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        ></div>
      </div>

      <Tabs defaultValue="withdraw" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="withdraw">Nuevo Retiro</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="withdraw" className="space-y-6">
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Monto a Retirar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="amount">Monto (MXN)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="pl-10 text-lg font-semibold text-center"
                      />
                    </div>
                  </div>
                  
                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[500, 1000, 2000, 'Todo'].map((amount, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => setWithdrawAmount(
                          amount === 'Todo' ? walletBalance.toString() : amount.toString()
                        )}
                      >
                        {amount === 'Todo' ? amount : formatCurrency(amount)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Limits Info */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Límites: Mínimo {formatCurrency(WITHDRAWAL_LIMITS.minimum)} - 
                    Máximo {formatCurrency(WITHDRAWAL_LIMITS.maximum)} por transacción
                  </AlertDescription>
                </Alert>

                <Button 
                  onClick={() => setStep(2)}
                  className="w-full"
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}
                >
                  Continuar
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Method Selection */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Método de Retiro
                    </CardTitle>
                    <AddMethodDialog />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {withdrawalMethods.map((method) => {
                      const Icon = method.icon;
                      return (
                        <div
                          key={method.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedMethod === method.id 
                              ? 'border-purple-500 bg-purple-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedMethod(method.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-gray-100 rounded-lg">
                                <Icon className="h-5 w-5 text-gray-600" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  {method.name}
                                  {method.isDefault && (
                                    <Badge className="ml-2 text-xs">Por defecto</Badge>
                                  )}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {method.bank} • {method.accountNumber}
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">
                                {method.processingTime}
                              </div>
                              <div className="text-sm text-gray-600">
                                Comisión: {method.fee === 0 ? 'Gratis' : formatCurrency(method.fee)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Button 
                onClick={() => setStep(3)}
                className="w-full"
                disabled={!selectedMethod}
              >
                Continuar
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Confirmar Retiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monto a retirar</span>
                    <span className="font-medium">{formatCurrency(parseFloat(withdrawAmount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Comisión</span>
                    <span className="font-medium">{formatCurrency(fees.totalFee || 0)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900">Total a recibir</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(fees.netAmount || parseFloat(withdrawAmount))}
                    </span>
                  </div>
                </div>

                {/* Method Details */}
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Método de retiro</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>{withdrawalMethods.find(m => m.id === selectedMethod)?.name}</div>
                    <div>{withdrawalMethods.find(m => m.id === selectedMethod)?.bank}</div>
                    <div>Tiempo estimado: {fees.processingTime}</div>
                  </div>
                </div>

                {/* Security Notice */}
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Este retiro se procesará de forma segura. Recibirás una notificación 
                    cuando el dinero esté disponible en tu cuenta.
                  </AlertDescription>
                </Alert>

                <Button 
                  onClick={processWithdrawal}
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Procesando...
                    </div>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Confirmar Retiro
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Retiros
              </CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawalHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Download className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No has hecho retiros aún
                  </h3>
                  <p className="text-gray-600">
                    Cuando hagas tu primer retiro aparecerá aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {withdrawalHistory.map((withdrawal) => (
                    <div
                      key={withdrawal.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Download className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900">
                              {formatCurrency(withdrawal.amount)}
                            </h3>
                            <Badge className={`text-xs ${getStatusColor(withdrawal.status)}`}>
                              {getStatusLabel(withdrawal.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{withdrawal.method}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-xs text-gray-500">
                              {formatDate(withdrawal.date)}
                            </p>
                            <button
                              onClick={() => copyToClipboard(withdrawal.reference)}
                              className="text-xs text-purple-600 hover:underline flex items-center"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              {withdrawal.reference}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          -{formatCurrency(withdrawal.amount + withdrawal.fee)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Comisión: {formatCurrency(withdrawal.fee)}
                        </div>
                        {withdrawal.status === 'failed' && withdrawal.failureReason && (
                          <div className="text-xs text-red-600 mt-1">
                            {withdrawal.failureReason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}