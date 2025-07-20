import React, { useState, useEffect } from 'react';
import { 
  X, 
  Filter, 
  Download, 
  Search, 
  Calendar,
  TrendingUp,
  Gift,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

const WalletTransactions = ({ isOpen, onClose, userId }) => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'all',
    dateRange: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const transactionsPerPage = 20;

  // Datos de ejemplo para desarrollo
  const mockTransactions = [
    {
      id: 'tx_001',
      type: 'commission',
      amount: 25.00,
      description: 'Comisión por servicio de plomería',
      createdAt: new Date('2025-01-19T10:30:00'),
      balanceAfter: 125.50,
      balanceBefore: 100.50,
      sourceId: 'service_123',
      metadata: {
        serviceType: 'Plomería',
        commissionType: 'provider_ambassador'
      }
    },
    {
      id: 'tx_002',
      type: 'bonus',
      amount: 20.00,
      description: '¡Felicidades! $20.00 agregados por ser cliente frecuente',
      createdAt: new Date('2025-01-18T15:20:00'),
      balanceAfter: 100.50,
      balanceBefore: 80.50,
      sourceId: 'loyalty_001',
      metadata: {
        bonusType: 'loyalty',
        thresholdReached: 2000
      }
    },
    {
      id: 'tx_003',
      type: 'payment',
      amount: -150.00,
      description: 'Pago por servicio de limpieza',
      createdAt: new Date('2025-01-17T09:15:00'),
      balanceAfter: 80.50,
      balanceBefore: 230.50,
      sourceId: 'service_124',
      metadata: {
        serviceType: 'Limpieza',
        noStripeFees: true
      }
    },
    {
      id: 'tx_004',
      type: 'commission',
      amount: 30.00,
      description: 'Comisión por servicio de electricidad',
      createdAt: new Date('2025-01-16T14:45:00'),
      balanceAfter: 230.50,
      balanceBefore: 200.50,
      sourceId: 'service_125',
      metadata: {
        serviceType: 'Electricidad',
        commissionType: 'user_ambassador'
      }
    },
    {
      id: 'tx_005',
      type: 'withdrawal',
      amount: -100.00,
      description: 'Retiro a cuenta bancaria',
      createdAt: new Date('2025-01-15T11:00:00'),
      balanceAfter: 200.50,
      balanceBefore: 300.50,
      sourceId: 'withdrawal_001',
      metadata: {
        bankName: 'Banco de México',
        stripeFee: 3.50
      }
    },
    {
      id: 'tx_006',
      type: 'withdrawal_fee',
      amount: -3.50,
      description: 'Fee de Stripe por transferencia bancaria',
      createdAt: new Date('2025-01-15T11:01:00'),
      balanceAfter: 197.00,
      balanceBefore: 200.50,
      sourceId: 'withdrawal_001',
      metadata: {
        parentTransactionId: 'tx_005'
      }
    },
    {
      id: 'tx_007',
      type: 'refund',
      amount: 75.00,
      description: 'Reembolso por cancelación de servicio',
      createdAt: new Date('2025-01-14T16:30:00'),
      balanceAfter: 300.50,
      balanceBefore: 225.50,
      sourceId: 'service_126',
      metadata: {
        refundReason: 'Cancelación del cliente'
      }
    }
  ];

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      // Simular llamada a API
      // const result = await getWalletTransactions({ userId, page: currentPage, limit: transactionsPerPage });
      
      // Usar datos mock para desarrollo
      setTimeout(() => {
        setTransactions(mockTransactions);
        setFilteredTransactions(mockTransactions);
        setTotalPages(Math.ceil(mockTransactions.length / transactionsPerPage));
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchTransactions();
    }
  }, [isOpen, userId, currentPage]);

  useEffect(() => {
    applyFilters();
  }, [filters, transactions]);

  const applyFilters = () => {
    let filtered = [...transactions];

    // Filtro por tipo
    if (filters.type !== 'all') {
      filtered = filtered.filter(tx => tx.type === filters.type);
    }

    // Filtro por fecha
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate;

      switch (filters.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        filtered = filtered.filter(tx => new Date(tx.createdAt) >= startDate);
      }
    }

    // Filtro por búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.description.toLowerCase().includes(searchLower) ||
        tx.id.toLowerCase().includes(searchLower) ||
        tx.type.toLowerCase().includes(searchLower)
      );
    }

    setFilteredTransactions(filtered);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'commission':
        return <TrendingUp className="w-4 h-4 text-[#3ce923]" />;
      case 'bonus':
        return <Gift className="w-4 h-4 text-[#FFD700]" />;
      case 'payment':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'withdrawal':
      case 'withdrawal_fee':
        return <ArrowDownLeft className="w-4 h-4 text-red-500" />;
      case 'refund':
        return <RefreshCw className="w-4 h-4 text-[#3ce923]" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionBadge = (type) => {
    const badges = {
      commission: { label: 'Comisión', className: 'bg-green-100 text-green-800' },
      bonus: { label: 'Bonus', className: 'bg-yellow-100 text-yellow-800' },
      payment: { label: 'Pago', className: 'bg-red-100 text-red-800' },
      withdrawal: { label: 'Retiro', className: 'bg-purple-100 text-purple-800' },
      withdrawal_fee: { label: 'Fee', className: 'bg-gray-100 text-gray-800' },
      refund: { label: 'Reembolso', className: 'bg-blue-100 text-blue-800' }
    };

    const badge = badges[type] || { label: type, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  const formatAmount = (amount) => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    return (
      <span className={`font-semibold ${isNegative ? 'text-red-500' : 'text-[#3ce923]'}`}>
        {isNegative ? '-' : '+'}${absAmount.toFixed(2)}
      </span>
    );
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const exportTransactions = () => {
    // Crear CSV con las transacciones filtradas
    const csvHeaders = [
      'Fecha',
      'Tipo',
      'Descripción',
      'Monto',
      'Saldo Anterior',
      'Saldo Después',
      'ID Transacción'
    ];

    const csvData = filteredTransactions.map(tx => [
      formatDate(tx.createdAt),
      tx.type,
      tx.description,
      tx.amount.toFixed(2),
      tx.balanceBefore?.toFixed(2) || '',
      tx.balanceAfter.toFixed(2),
      tx.id
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `wallet-transactions-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const resetFilters = () => {
    setFilters({
      type: 'all',
      dateRange: 'all', 
      search: ''
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#ac7afc]" />
            Historial de Transacciones
          </DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Buscar transacciones..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full"
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <Select 
            value={filters.type} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="commission">Comisiones</SelectItem>
              <SelectItem value="bonus">Bonos</SelectItem>
              <SelectItem value="payment">Pagos</SelectItem>
              <SelectItem value="withdrawal">Retiros</SelectItem>
              <SelectItem value="refund">Reembolsos</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filters.dateRange} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Fecha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="quarter">Últimos 3 meses</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={resetFilters}>
            <Filter className="w-4 h-4 mr-2" />
            Limpiar
          </Button>

          <Button 
            onClick={exportTransactions}
            className="bg-[#3ce923] hover:bg-green-600 text-white"
            disabled={filteredTransactions.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>

        {/* Lista de transacciones */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ac7afc]"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>No se encontraron transacciones</p>
                  <p className="text-sm">Intenta ajustar los filtros</p>
                </div>
              ) : (
                filteredTransactions.map((transaction) => (
                  <Card key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getTransactionIcon(transaction.type)}
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm">{transaction.description}</p>
                              {getTransactionBadge(transaction.type)}
                            </div>
                            
                            <p className="text-xs text-gray-500 mb-2">
                              {formatDate(transaction.createdAt)} • ID: {transaction.id}
                            </p>
                            
                            {/* Metadata adicional */}
                            {transaction.metadata && (
                              <div className="text-xs text-gray-600 space-y-1">
                                {transaction.metadata.serviceType && (
                                  <p>Servicio: {transaction.metadata.serviceType}</p>
                                )}
                                {transaction.metadata.bankName && (
                                  <p>Banco: {transaction.metadata.bankName}</p>
                                )}
                                {transaction.metadata.stripeFee && (
                                  <p>Fee aplicado: ${transaction.metadata.stripeFee}</p>
                                )}
                                {transaction.metadata.thresholdReached && (
                                  <p>Umbral alcanzado: ${transaction.metadata.thresholdReached.toLocaleString()}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="text-lg font-semibold">
                            {formatAmount(transaction.amount)}
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <p>Anterior: ${transaction.balanceBefore?.toFixed(2) || 'N/A'}</p>
                            <p className="font-medium">Nuevo: <span className="text-[#FFD700]">${transaction.balanceAfter.toFixed(2)}</span></p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-600">
              Mostrando {filteredTransactions.length} de {transactions.length} transacciones
            </p>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              
              <span className="text-sm px-3 py-1 bg-gray-100 rounded">
                {currentPage} de {totalPages}
              </span>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {/* Resumen */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Total Ingresos</p>
              <p className="font-semibold text-[#3ce923]">
                +${filteredTransactions
                  .filter(tx => tx.amount > 0)
                  .reduce((sum, tx) => sum + tx.amount, 0)
                  .toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Egresos</p>
              <p className="font-semibold text-red-500">
                ${Math.abs(filteredTransactions
                  .filter(tx => tx.amount < 0)
                  .reduce((sum, tx) => sum + tx.amount, 0))
                  .toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Balance Neto</p>
              <p className="font-semibold text-[#FFD700]">
                ${filteredTransactions
                  .reduce((sum, tx) => sum + tx.amount, 0)
                  .toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletTransactions;