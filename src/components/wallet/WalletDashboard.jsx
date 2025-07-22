'use client';

import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  Download, 
  History, 
  DollarSign,
  Gift,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Target,
  Sparkles,
  Plus,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function WalletDashboard({ className = "" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [walletData, setWalletData] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bonusProgress, setBonusProgress] = useState(0);

  // Datos de ejemplo para demostración
  const mockWalletData = {
    balance: 1250.50,
    totalEarned: 8500.00,
    totalSpent: 6200.00,
    totalWithdrawn: 1050.00,
    nextBonusThreshold: 2000,
    progressToBonus: 1250.50,
    lastBonusEarned: new Date('2024-01-15'),
    pendingWithdrawals: 0
  };

  const mockTransactions = [
    {
      id: '1',
      type: 'commission',
      description: 'Comisión por servicio de plomería',
      amount: 75.00,
      date: new Date('2024-01-20'),
      balance: 1250.50,
      status: 'completed'
    },
    {
      id: '2',
      type: 'bonus',
      description: 'Bonificación por fidelidad ($2000 alcanzados)',
      amount: 20.00,
      date: new Date('2024-01-15'),
      balance: 1175.50,
      status: 'completed'
    },
    {
      id: '3',
      type: 'payment',
      description: 'Pago por servicio de limpieza',
      amount: -120.00,
      date: new Date('2024-01-12'),
      balance: 1155.50,
      status: 'completed'
    },
    {
      id: '4',
      type: 'withdrawal',
      description: 'Retiro a cuenta bancaria',
      amount: -500.00,
      date: new Date('2024-01-10'),
      balance: 1275.50,
      status: 'completed'
    },
    {
      id: '5',
      type: 'commission',
      description: 'Comisión por servicio de jardinería',
      amount: 45.00,
      date: new Date('2024-01-08'),
      balance: 1775.50,
      status: 'completed'
    }
  ];

  useEffect(() => {
    loadWalletData();
  }, []);

  useEffect(() => {
    if (walletData) {
      const progress = (walletData.progressToBonus / walletData.nextBonusThreshold) * 100;
      setBonusProgress(Math.min(progress, 100));
    }
  }, [walletData]);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      // TODO: Reemplazar con llamada real a la API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setWalletData(mockWalletData);
      setRecentTransactions(mockTransactions);
    } catch (error) {
      console.error('Error loading wallet data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del wallet",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = () => {
    navigate('/wallet/withdraw');
  };

  const handleViewHistory = () => {
    navigate('/wallet/transactions');
  };

  const handleUseWallet = () => {
    navigate('/search');
    toast({
      title: "¡Usa tu wallet!",
      description: "Busca un servicio y paga con tu saldo disponible",
      variant: "default"
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'commission':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'bonus':
        return <Gift className="h-4 w-4 text-yellow-600" />;
      case 'payment':
        return <ArrowUpRight className="h-4 w-4 text-blue-600" />;
      case 'withdrawal':
        return <ArrowDownLeft className="h-4 w-4 text-purple-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTransactionTypeLabel = (type) => {
    switch (type) {
      case 'commission': return 'Comisión';
      case 'bonus': return 'Bonificación';
      case 'payment': return 'Pago';
      case 'withdrawal': return 'Retiro';
      default: return 'Transacción';
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

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-6"></div>
          <div className="h-24 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Wallet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Error cargando wallet
        </h3>
        <p className="text-gray-600 mb-4">
          No se pudieron cargar los datos de tu wallet
        </p>
        <Button onClick={loadWalletData}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Balance Principal */}
      <Card className="premium-card relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
          <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full transform rotate-45 translate-x-16 -translate-y-16"></div>
        </div>
        
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              Saldo Disponible
            </CardTitle>
            <Badge className="premium-badge">
              <Sparkles className="h-3 w-3 mr-1" />
              ServiMap Wallet
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {formatCurrency(walletData.balance)}
              </div>
              <p className="text-gray-600">
                Dinero disponible para usar en servicios
              </p>
            </div>

            {/* Progreso hacia bonus */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Progreso hacia próximo bonus</span>
                <span className="font-medium text-yellow-600">
                  {formatCurrency(walletData.progressToBonus)} / {formatCurrency(walletData.nextBonusThreshold)}
                </span>
              </div>
              
              <div className="relative">
                <Progress 
                  value={bonusProgress} 
                  className="h-3"
                  style={{
                    background: 'linear-gradient(90deg, #FEF3C7 0%, #FCD34D 50%, #F59E0B 100%)'
                  }}
                />
                <div className="absolute top-0 left-0 h-full flex items-center pl-2">
                  <Target className="h-4 w-4 text-yellow-700" />
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Te faltan <span className="font-semibold text-yellow-600">
                    {formatCurrency(walletData.nextBonusThreshold - walletData.progressToBonus)}
                  </span> para ganar <span className="font-semibold text-green-600">$20 USD</span>
                </p>
              </div>
            </div>

            {/* Botones principales */}
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleWithdraw}
                variant="outline" 
                className="flex-1"
                disabled={walletData.balance < 100}
              >
                <Download className="h-4 w-4 mr-2" />
                Retirar
              </Button>
              <Button 
                onClick={handleUseWallet}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Usar Wallet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Plus className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(walletData.totalEarned)}
            </div>
            <div className="text-xs text-gray-600">Total Ganado</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Minus className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="text-lg font-bold text-blue-600">
              {formatCurrency(walletData.totalSpent)}
            </div>
            <div className="text-xs text-gray-600">Total Gastado</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ArrowDownLeft className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="text-lg font-bold text-purple-600">
              {formatCurrency(walletData.totalWithdrawn)}
            </div>
            <div className="text-xs text-gray-600">Total Retirado</div>
          </CardContent>
        </Card>
      </div>

      {/* Transacciones recientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transacciones Recientes
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleViewHistory}
            >
              Ver todo
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {recentTransactions.slice(0, 5).map((transaction) => (
              <div 
                key={transaction.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {getTransactionTypeLabel(transaction.type)}
                    </p>
                    <p className="text-xs text-gray-600 truncate max-w-48">
                      {transaction.description}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`font-semibold ${
                    transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(transaction.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {recentTransactions.length === 0 && (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay transacciones recientes</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call to action */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¡Usa tu Wallet ServiMap!
            </h3>
            <p className="text-gray-600 mb-4">
              Paga servicios directamente desde tu wallet y gana bonificaciones por fidelidad
            </p>
          </div>
          
          <Button 
            onClick={handleUseWallet}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            Buscar Servicios
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}