"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  CreditCard, 
  RefreshCw,
  Receipt
} from 'lucide-react';

export type PaymentStatusType = 
  | 'pending'
  | 'processing' 
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partial_refund';

interface PaymentStatusProps {
  status: PaymentStatusType;
  amount: number;
  currency: string;
  paymentIntentId?: string;
  refundAmount?: number;
  onRetry?: () => void;
  onViewReceipt?: () => void;
  serviceName?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Pendiente',
    description: 'El pago está pendiente de procesamiento',
    color: 'bg-yellow-500',
    variant: 'secondary' as const,
  },
  processing: {
    icon: RefreshCw,
    label: 'Procesando',
    description: 'Tu pago está siendo procesado',
    color: 'bg-blue-500',
    variant: 'secondary' as const,
  },
  succeeded: {
    icon: CheckCircle,
    label: 'Completado',
    description: 'Tu pago ha sido procesado exitosamente',
    color: 'bg-green-500',
    variant: 'default' as const,
  },
  failed: {
    icon: XCircle,
    label: 'Fallido',
    description: 'Hubo un problema procesando tu pago',
    color: 'bg-red-500',
    variant: 'destructive' as const,
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelado',
    description: 'El pago fue cancelado',
    color: 'bg-gray-500',
    variant: 'secondary' as const,
  },
  refunded: {
    icon: RefreshCw,
    label: 'Reembolsado',
    description: 'El pago ha sido reembolsado completamente',
    color: 'bg-purple-500',
    variant: 'secondary' as const,
  },
  partial_refund: {
    icon: RefreshCw,
    label: 'Reembolso parcial',
    description: 'Se ha procesado un reembolso parcial',
    color: 'bg-purple-500',
    variant: 'secondary' as const,
  },
};

export const PaymentStatus: React.FC<PaymentStatusProps> = ({
  status,
  amount,
  currency,
  paymentIntentId,
  refundAmount,
  onRetry,
  onViewReceipt,
  serviceName,
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  const formatAmount = (amt: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amt);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5" />
          <span>Estado del pago</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${config.color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <Badge variant={config.variant}>{config.label}</Badge>
              <span className="text-sm text-muted-foreground">
                {formatAmount(amount)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>

        {serviceName && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Servicio:</p>
            <p className="text-sm text-muted-foreground">{serviceName}</p>
          </div>
        )}

        {paymentIntentId && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">ID de transacción:</p>
            <p className="text-xs text-muted-foreground font-mono">{paymentIntentId}</p>
          </div>
        )}

        {status === 'refunded' && refundAmount && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm font-medium text-purple-900">
              Monto reembolsado: {formatAmount(refundAmount)}
            </p>
          </div>
        )}

        {status === 'partial_refund' && refundAmount && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm font-medium text-purple-900">
              Reembolso parcial: {formatAmount(refundAmount)}
            </p>
            <p className="text-xs text-purple-700">
              Restante: {formatAmount(amount - refundAmount)}
            </p>
          </div>
        )}

        <div className="flex space-x-2">
          {status === 'failed' && onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar pago
            </Button>
          )}
          
          {(status === 'succeeded' || status === 'refunded' || status === 'partial_refund') && onViewReceipt && (
            <Button onClick={onViewReceipt} variant="outline" size="sm">
              <Receipt className="h-4 w-4 mr-2" />
              Ver recibo
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentStatus;