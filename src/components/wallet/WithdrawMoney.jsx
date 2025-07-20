import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  DollarSign, 
  CreditCard, 
  Clock, 
  Shield,
  CheckCircle,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

const WithdrawMoney = ({ isOpen, onClose, currentBalance, withdrawalLimit, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Amount, 2: Bank Details, 3: Confirmation, 4: Processing
  const [withdrawalData, setWithdrawalData] = useState({
    amount: '',
    bankDetails: {
      bankName: '',
      accountNumber: '',
      routingNumber: '',
      accountHolderName: '',
      accountType: 'checking',
      country: 'MX',
      currency: 'MXN'
    }
  });
  const [feeCalculation, setFeeCalculation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  // Validaciones
  const validateAmount = () => {
    const amount = parseFloat(withdrawalData.amount);
    if (isNaN(amount) || amount <= 0) {
      return 'Ingresa un monto válido';
    }
    if (amount < 10) {
      return 'El monto mínimo es $10.00';
    }
    if (amount > currentBalance) {
      return `Saldo insuficiente. Disponible: $${currentBalance.toFixed(2)}`;
    }
    if (amount > withdrawalLimit) {
      return `Monto excede límite de retiro: $${withdrawalLimit.toLocaleString()}`;
    }
    return null;
  };

  const validateBankDetails = () => {
    const { bankName, accountNumber, accountHolderName } = withdrawalData.bankDetails;
    if (!bankName.trim()) return 'Selecciona un banco';
    if (!accountNumber.trim()) return 'Ingresa el número de cuenta';
    if (!accountHolderName.trim()) return 'Ingresa el nombre del titular';
    if (accountNumber.length < 10) return 'Número de cuenta muy corto';
    return null;
  };

  // Calcular fee cuando cambia el monto
  useEffect(() => {
    if (withdrawalData.amount && !validateAmount()) {
      calculateFee();
    } else {
      setFeeCalculation(null);
    }
  }, [withdrawalData.amount, withdrawalData.bankDetails.country]);

  const calculateFee = async () => {
    try {
      const amount = parseFloat(withdrawalData.amount);
      
      // Simular llamada a Cloud Function para mostrar fee
      // const processWalletWithdrawal = firebase.functions().httpsCallable('processWalletWithdrawal');
      // const result = await processWalletWithdrawal({
      //   amount,
      //   bankDetails: withdrawalData.bankDetails,
      //   acceptFee: false // Solo mostrar fee
      // });

      // Cálculo mock basado en país
      const feeRates = {
        MX: { base: 2.00, percentage: 0.015, min: 2.00, max: 5.00 },
        US: { base: 0.25, percentage: 0.0075, min: 0.25, max: 5.00 },
        CA: { base: 0.50, percentage: 0.01, min: 0.50, max: 4.00 }
      };

      const rates = feeRates[withdrawalData.bankDetails.country] || feeRates.MX;
      const calculatedFee = Math.max(
        rates.min,
        Math.min(rates.max, rates.base + (amount * rates.percentage))
      );

      setFeeCalculation({
        stripeFee: calculatedFee,
        totalDeducted: amount + calculatedFee,
        feeCalculation: rates,
        message: `Este retiro requiere un fee de $${calculatedFee.toFixed(2)}. Total a descontar: $${(amount + calculatedFee).toFixed(2)}`
      });

    } catch (err) {
      console.error('Error calculating fee:', err);
      setError('Error calculando fee de retiro');
    }
  };

  const handleNextStep = () => {
    setError('');
    
    if (step === 1) {
      const amountError = validateAmount();
      if (amountError) {
        setError(amountError);
        return;
      }
      if (!feeCalculation) {
        setError('Calculando fee...');
        return;
      }
      if (feeCalculation.totalDeducted > currentBalance) {
        setError(`Saldo insuficiente para cubrir monto + fee. Necesitas: $${feeCalculation.totalDeducted.toFixed(2)}`);
        return;
      }
    }

    if (step === 2) {
      const bankError = validateBankDetails();
      if (bankError) {
        setError(bankError);
        return;
      }
    }

    setStep(step + 1);
  };

  const handlePreviousStep = () => {
    setError('');
    setStep(step - 1);
  };

  const processWithdrawal = async () => {
    try {
      setProcessing(true);
      setError('');

      // Simular llamada a Cloud Function
      // const processWalletWithdrawal = firebase.functions().httpsCallable('processWalletWithdrawal');
      // const result = await processWalletWithdrawal({
      //   amount: parseFloat(withdrawalData.amount),
      //   bankDetails: withdrawalData.bankDetails,
      //   acceptFee: true
      // });

      // Simular proceso
      await new Promise(resolve => setTimeout(resolve, 2000));

      setStep(4); // Mostrar éxito
      
      // Notificar éxito después de 3 segundos
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 3000);

    } catch (err) {
      console.error('Error processing withdrawal:', err);
      setError(err.message || 'Error procesando el retiro');
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setWithdrawalData({
      amount: '',
      bankDetails: {
        bankName: '',
        accountNumber: '',
        routingNumber: '',
        accountHolderName: '',
        accountType: 'checking',
        country: 'MX',
        currency: 'MXN'
      }
    });
    setFeeCalculation(null);
    setError('');
    setProcessing(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const mexicanBanks = [
    'Banco de México',
    'BBVA Bancomer',
    'Banamex',
    'Santander México',
    'Banorte',
    'HSBC México',
    'Scotiabank México',
    'Inbursa',
    'Azteca',
    'Otro'
  ];

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#ac7afc]" />
            Retirar Dinero
            <span className="text-sm text-gray-500 ml-auto">
              Paso {step} de 3
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Amount */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Balance disponible</p>
              <p className="text-2xl font-bold text-[#FFD700]">
                ${currentBalance.toFixed(2)}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Monto a retirar</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={withdrawalData.amount}
                    onChange={(e) => setWithdrawalData(prev => ({ 
                      ...prev, 
                      amount: e.target.value 
                    }))}
                    className="pl-10"
                    min="10"
                    max={Math.min(currentBalance, withdrawalLimit)}
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo: $10.00 • Máximo: ${Math.min(currentBalance, withdrawalLimit).toLocaleString()}
                </p>
              </div>

              {/* Botones de cantidad rápida */}
              <div className="grid grid-cols-3 gap-2">
                {[25, 50, 100].map(amount => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setWithdrawalData(prev => ({ 
                      ...prev, 
                      amount: amount.toString() 
                    }))}
                    disabled={amount > currentBalance}
                    className="text-[#ac7afc] border-[#ac7afc] hover:bg-purple-50"
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
            </div>

            {/* Mostrar fee calculado */}
            {feeCalculation && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-semibold text-yellow-800">
                        Fee de transferencia
                      </p>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Monto a retirar:</span>
                          <span className="font-semibold">${parseFloat(withdrawalData.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Fee de Stripe:</span>
                          <span className="font-semibold">-${feeCalculation.stripeFee.toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-1 flex justify-between font-semibold">
                          <span>Total a descontar:</span>
                          <span className="text-[#ac7afc]">${feeCalculation.totalDeducted.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleNextStep}
              className="w-full bg-[#ac7afc] hover:bg-purple-600"
              disabled={!withdrawalData.amount || !feeCalculation}
            >
              Continuar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Bank Details */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Retirando</p>
              <p className="text-xl font-bold text-[#ac7afc]">
                ${withdrawalData.amount}
              </p>
              <p className="text-xs text-gray-500">
                (Fee: ${feeCalculation?.stripeFee.toFixed(2)})
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="bank">Banco</Label>
                <Select 
                  value={withdrawalData.bankDetails.bankName}
                  onValueChange={(value) => setWithdrawalData(prev => ({
                    ...prev,
                    bankDetails: { ...prev.bankDetails, bankName: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {mexicanBanks.map(bank => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="accountHolder">Nombre del titular</Label>
                <Input
                  id="accountHolder"
                  placeholder="Nombre completo como aparece en la cuenta"
                  value={withdrawalData.bankDetails.accountHolderName}
                  onChange={(e) => setWithdrawalData(prev => ({
                    ...prev,
                    bankDetails: { ...prev.bankDetails, accountHolderName: e.target.value }
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="accountNumber">Número de cuenta</Label>
                <Input
                  id="accountNumber"
                  placeholder="Número de cuenta bancaria"
                  value={withdrawalData.bankDetails.accountNumber}
                  onChange={(e) => setWithdrawalData(prev => ({
                    ...prev,
                    bankDetails: { ...prev.bankDetails, accountNumber: e.target.value }
                  }))}
                  maxLength={20}
                />
              </div>

              <div>
                <Label htmlFor="accountType">Tipo de cuenta</Label>
                <Select 
                  value={withdrawalData.bankDetails.accountType}
                  onValueChange={(value) => setWithdrawalData(prev => ({
                    ...prev,
                    bankDetails: { ...prev.bankDetails, accountType: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Corriente</SelectItem>
                    <SelectItem value="savings">Ahorros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handlePreviousStep}
                className="flex-1"
              >
                Atrás
              </Button>
              <Button 
                onClick={handleNextStep}
                className="flex-1 bg-[#ac7afc] hover:bg-purple-600"
              >
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-[#3ce923] mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Confirmar Retiro</h3>
              <p className="text-sm text-gray-600">
                Revisa los detalles antes de confirmar
              </p>
            </div>

            {/* Resumen del retiro */}
            <Card className="bg-gray-50">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Monto a retirar:</span>
                  <span className="font-semibold">${parseFloat(withdrawalData.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Fee de procesamiento:</span>
                  <span>-${feeCalculation?.stripeFee.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                  <span>Total a descontar:</span>
                  <span className="text-[#ac7afc]">${feeCalculation?.totalDeducted.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Detalles bancarios */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Datos bancarios
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Banco:</span>
                    <span>{withdrawalData.bankDetails.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Titular:</span>
                    <span>{withdrawalData.bankDetails.accountHolderName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cuenta:</span>
                    <span>***{withdrawalData.bankDetails.accountNumber.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span>{withdrawalData.bankDetails.accountType === 'checking' ? 'Corriente' : 'Ahorros'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advertencias */}
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Tiempo de procesamiento:</strong> Los retiros bancarios pueden tardar 
                entre 1-3 días hábiles en aparecer en tu cuenta.
              </AlertDescription>
            </Alert>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Seguridad:</strong> Esta transacción es segura y está protegida 
                por Stripe. El fee mostrado es transparente y no hay costos ocultos.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handlePreviousStep}
                className="flex-1"
                disabled={processing}
              >
                Atrás
              </Button>
              <Button 
                onClick={processWithdrawal}
                className="flex-1 bg-[#3ce923] hover:bg-green-600 text-white"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar Retiro
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-[#3ce923] rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-[#3ce923] mb-2">
                ¡Retiro Procesado!
              </h3>
              <p className="text-gray-600">
                Tu retiro de <span className="font-semibold text-[#ac7afc]">
                ${parseFloat(withdrawalData.amount).toFixed(2)}
                </span> ha sido procesado exitosamente.
              </p>
            </div>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Enviado a:</span>
                    <span className="font-semibold">{withdrawalData.bankDetails.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cuenta:</span>
                    <span>***{withdrawalData.bankDetails.accountNumber.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fee aplicado:</span>
                    <span>${feeCalculation?.stripeFee.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                El dinero aparecerá en tu cuenta bancaria en 1-3 días hábiles.
                Recibirás una notificación cuando el proceso esté completo.
              </AlertDescription>
            </Alert>

            <p className="text-xs text-gray-500">
              Esta ventana se cerrará automáticamente...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawMoney;