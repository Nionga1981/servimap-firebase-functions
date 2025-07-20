import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  Gift, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  DollarSign,
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import WithdrawMoney from './WithdrawMoney';
import WalletTransactions from './WalletTransactions';

const WalletDashboard = ({ userId }) => {
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [error, setError] = useState(null);

  // Firebase function para obtener datos del wallet
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      // Simular llamada a Cloud Function
      // const getWalletBalance = firebase.functions().httpsCallable('getWalletBalance');
      // const result = await getWalletBalance({ userId });
      
      // Datos de ejemplo para desarrollo
      const mockData = {
        success: true,
        currentBalance: 125.50,
        totalEarned: 345.00,
        totalSpent: 2350.00,
        totalWithdrawn: 200.00,
        loyaltyBonusesEarned: 1,
        walletExists: true,
        nextBonusAt: 4000,
        progressToNextBonus: 87.5,
        amountNeededForNextBonus: 250.00,
        recentTransactions: [
          {
            id: 'tx_001',
            type: 'commission',
            amount: 25.00,
            description: 'Comisión por servicio de plomería',
            createdAt: new Date('2025-01-19T10:30:00'),
            balanceAfter: 125.50
          },
          {
            id: 'tx_002', 
            type: 'bonus',
            amount: 20.00,
            description: '¡Felicidades! $20.00 agregados por ser cliente frecuente',
            createdAt: new Date('2025-01-18T15:20:00'),
            balanceAfter: 100.50
          },
          {
            id: 'tx_003',
            type: 'payment',
            amount: -150.00,
            description: 'Pago por servicio de limpieza',
            createdAt: new Date('2025-01-17T09:15:00'),
            balanceAfter: 80.50
          },
          {
            id: 'tx_004',
            type: 'commission',
            amount: 30.00,
            description: 'Comisión por servicio de electricidad',
            createdAt: new Date('2025-01-16T14:45:00'),
            balanceAfter: 230.50
          },
          {
            id: 'tx_005',
            type: 'withdrawal',
            amount: -100.00,
            description: 'Retiro a cuenta bancaria',
            createdAt: new Date('2025-01-15T11:00:00'),
            balanceAfter: 200.50
          }
        ],
        breakdown: {
          totalEarnedFromBonuses: 25.00,
          totalEarnedFromCommissions: 270.00,
          totalEarnedFromRefunds: 50.00
        },
        limits: {
          dailySpendingLimit: 10000,
          withdrawalLimit: 5000,
          dailySpentToday: 0,
          blockedBalance: 0
        }
      };
      
      setWalletData(mockData);
    } catch (err) {
      console.error('Error fetching wallet data:', err);
      setError('Error al cargar los datos del wallet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchWalletData();
    }
  }, [userId]);

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'commission':
        return <TrendingUp className="w-4 h-4 text-[#3ce923]" />;
      case 'bonus':
        return <Gift className="w-4 h-4 text-[#FFD700]" />;
      case 'payment':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'withdrawal':
        return <ArrowDownLeft className="w-4 h-4 text-red-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionColor = (type, amount) => {
    if (amount > 0) return 'text-[#3ce923]';
    return 'text-red-500';
  };

  const formatAmount = (amount) => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    return (
      <span className={getTransactionColor('', amount)}>
        {isNegative ? '-' : '+'}${absAmount.toFixed(2)}
      </span>
    );
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ac7afc]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchWalletData} variant="outline">
          Reintentar
        </Button>
      </div>
    );
  }

  if (!walletData?.walletExists) {
    return (
      <Card className="text-center py-8">
        <CardContent>
          <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Wallet no inicializado</h3>
          <p className="text-gray-600">Realiza tu primera transacción para activar tu wallet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con balance principal */}
      <Card className="bg-gradient-to-r from-[#ac7afc] to-purple-600 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            Mi Wallet ServiMap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-4xl font-bold text-[#FFD700] mb-2">
              ${walletData.currentBalance.toFixed(2)}
            </div>
            <p className="text-purple-100">Balance disponible</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-purple-400">
            <div className="text-center">
              <div className="text-lg font-semibold text-[#FFD700]">
                ${walletData.totalEarned.toFixed(2)}
              </div>
              <p className="text-xs text-purple-100">Total ganado</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-[#FFD700]">
                ${walletData.totalSpent.toFixed(2)}
              </div>
              <p className="text-xs text-purple-100">Total gastado</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-[#FFD700]">
                ${walletData.totalWithdrawn.toFixed(2)}
              </div>
              <p className="text-xs text-purple-100">Total retirado</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progreso hacia próximo bonus */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#FFD700]" />
            Progreso de Lealtad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Próximo bonus en ${walletData.nextBonusAt.toLocaleString()}
              </span>
              <Badge variant="outline" className="text-[#FFD700] border-[#FFD700]">
                {walletData.loyaltyBonusesEarned} bonos ganados
              </Badge>
            </div>
            
            <Progress 
              value={walletData.progressToNextBonus} 
              className="h-3"
              style={{ 
                background: '#f1f5f9',
                '& [data-progress-bar]': { 
                  background: 'linear-gradient(to right, #FFD700, #fbbf24)' 
                }
              }}
            />
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                {walletData.progressToNextBonus.toFixed(1)}% completado
              </span>
              <span className="text-[#ac7afc] font-semibold">
                ${walletData.amountNeededForNextBonus.toFixed(2)} restantes
              </span>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#FFD700]" />
                <span className="text-sm font-medium">¡Próximo bonus: $20.00!</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Gasta ${walletData.amountNeededForNextBonus.toFixed(2)} más para obtener tu bonus de lealtad
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          onClick={() => setShowWithdraw(true)}
          className="bg-[#ac7afc] hover:bg-purple-600 text-white py-6"
          disabled={walletData.currentBalance < 10}
        >
          <ArrowDownLeft className="w-5 h-5 mr-2" />
          Retirar Dinero
        </Button>
        
        <Button 
          onClick={() => setShowTransactions(true)}
          variant="outline"
          className="border-[#ac7afc] text-[#ac7afc] hover:bg-purple-50 py-6"
        >
          <History className="w-5 h-5 mr-2" />
          Ver Historial
        </Button>
      </div>

      {/* Últimas 5 transacciones */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {walletData.recentTransactions.map((transaction) => (
              <div 
                key={transaction.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getTransactionIcon(transaction.type)}
                  <div>
                    <p className="font-medium text-sm">{transaction.description}</p>
                    <p className="text-xs text-gray-500">{formatDate(transaction.createdAt)}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-semibold">
                    {formatAmount(transaction.amount)}
                  </div>
                  <p className="text-xs text-gray-500">
                    Saldo: ${transaction.balanceAfter.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {walletData.recentTransactions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>No hay transacciones recientes</p>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="ghost" 
              className="w-full text-[#ac7afc] hover:bg-purple-50"
              onClick={() => setShowTransactions(true)}
            >
              Ver todas las transacciones
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Información de límites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Límites y Configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Límite de retiro</p>
              <p className="font-semibold text-[#ac7afc]">
                ${walletData.limits.withdrawalLimit.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Límite diario</p>
              <p className="font-semibold text-[#ac7afc]">
                ${walletData.limits.dailySpendingLimit.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modales */}
      {showWithdraw && (
        <WithdrawMoney
          isOpen={showWithdraw}
          onClose={() => setShowWithdraw(false)}
          currentBalance={walletData.currentBalance}
          withdrawalLimit={walletData.limits.withdrawalLimit}
          onSuccess={() => {
            setShowWithdraw(false);
            fetchWalletData(); // Refrescar datos
          }}
        />
      )}

      {showTransactions && (
        <WalletTransactions
          isOpen={showTransactions}
          onClose={() => setShowTransactions(false)}
          userId={userId}
        />
      )}
    </div>
  );
};

export default WalletDashboard;