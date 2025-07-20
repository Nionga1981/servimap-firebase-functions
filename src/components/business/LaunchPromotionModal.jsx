import React, { useState, useEffect } from 'react';
import { 
  X, 
  Star, 
  Clock, 
  DollarSign, 
  Gift, 
  CheckCircle,
  AlertCircle,
  Timer,
  Sparkles
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';

const LaunchPromotionModal = ({ 
  isOpen, 
  onClose, 
  onAccept, 
  ambassadorCode 
}) => {
  const [promoData, setPromoData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    if (isOpen) {
      checkPromotionAvailability();
    }
  }, [isOpen]);

  useEffect(() => {
    if (timeRemaining > 0) {
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, timeRemaining - (now - Date.now()));
        
        if (remaining > 0) {
          const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
          const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
          
          setCountdown({ days, hours, minutes, seconds });
        } else {
          setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [timeRemaining]);

  const checkPromotionAvailability = async () => {
    try {
      setLoading(true);
      
      // Simular llamada a la función
      // const checkLaunchPromotionAvailability = firebase.functions().httpsCallable('checkLaunchPromotionAvailability');
      // const result = await checkLaunchPromotionAvailability();
      
      // Mock data para desarrollo
      const mockResult = {
        available: true,
        timeRemaining: 60 * 24 * 60 * 60 * 1000, // 60 días en ms
        promoDetails: {
          months: 3,
          payment: 25,
          ambassadorCommission: 12.5, // 50% de $25
          normalPrice: 75,
          savings: 50,
          commissionPercentage: 50
        }
      };

      setPromoData(mockResult);
      setTimeRemaining(mockResult.timeRemaining || 0);
      setLoading(false);

    } catch (error) {
      console.error('Error checking promotion:', error);
      setLoading(false);
    }
  };

  const handleAcceptPromotion = () => {
    onAccept({ 
      useLaunchPromo: true, 
      promoData 
    });
    onClose();
  };

  const handleDeclinePromotion = () => {
    onAccept({ 
      useLaunchPromo: false, 
      promoData: null 
    });
    onClose();
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ac7afc]"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!promoData?.available) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Promoción No Disponible
            </DialogTitle>
          </DialogHeader>
          
          <div className="text-center py-6">
            <p className="text-gray-600 mb-4">
              La promoción de lanzamiento ha expirado o no está disponible en este momento.
            </p>
            <Button onClick={onClose} className="bg-[#ac7afc] hover:bg-purple-600">
              Continuar con Registro Normal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-[#FFD700]" />
            <span className="bg-gradient-to-r from-[#ac7afc] to-[#FFD700] bg-clip-text text-transparent">
              ¡Promoción de Lanzamiento!
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Banner promocional */}
        <div className="bg-gradient-to-r from-[#ac7afc] to-purple-600 text-white rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-8 h-8 text-[#FFD700]" />
            <span className="text-2xl font-bold">3x1 ESPECIAL</span>
            <Badge className="bg-[#FFD700] text-black font-bold">
              ¡LIMITADO!
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold">${promoData.promoDetails.payment}</div>
              <div className="text-sm opacity-90">Pago único</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{promoData.promoDetails.months}</div>
              <div className="text-sm opacity-90">Meses gratis</div>
            </div>
            <div>
              <div className="text-3xl font-bold">${promoData.promoDetails.savings}</div>
              <div className="text-sm opacity-90">Ahorras</div>
            </div>
          </div>
        </div>

        {/* Contador regresivo */}
        {countdown.days > 0 && (
          <Alert className="bg-red-50 border-red-200 mb-4">
            <Timer className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="flex items-center justify-between">
                <span className="font-semibold">¡Promoción termina en:</span>
                <div className="flex gap-2 font-mono font-bold">
                  <span>{countdown.days}d</span>
                  <span>{countdown.hours}h</span>
                  <span>{countdown.minutes}m</span>
                  <span>{countdown.seconds}s</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Beneficios */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-[#ac7afc]">
            Lo que obtienes con la promoción:
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-[#3ce923]" />
              <div>
                <p className="font-medium">3 Meses Completamente Gratis</p>
                <p className="text-sm text-gray-600">Servicio activo sin costo</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-[#60cdff]" />
              <div>
                <p className="font-medium">Solo $25 USD</p>
                <p className="text-sm text-gray-600">Pago único inicial</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
              <Star className="w-5 h-5 text-[#ac7afc]" />
              <div>
                <p className="font-medium">Perfil Completo</p>
                <p className="text-sm text-gray-600">Fotos, horarios, contacto</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
              <Gift className="w-5 h-5 text-[#FFD700]" />
              <div>
                <p className="font-medium">Embajador Gana ${promoData.promoDetails.ambassadorCommission}</p>
                <p className="text-sm text-gray-600">Comisión inmediata (50%)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Comparación de precios */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold mb-3">Comparación de Precios</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-gray-500 line-through text-lg">
                ${promoData.promoDetails.normalPrice} USD
              </div>
              <div className="text-sm text-gray-600">Precio normal 3 meses</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-[#3ce923]">
                ${promoData.promoDetails.payment} USD
              </div>
              <div className="text-sm text-[#3ce923]">¡Con promoción!</div>
            </div>
          </div>
          
          <div className="mt-3 p-2 bg-[#3ce923] bg-opacity-10 rounded text-center">
            <span className="text-[#3ce923] font-bold">
              Ahorras ${promoData.promoDetails.savings} USD ({Math.round((promoData.promoDetails.savings / promoData.promoDetails.normalPrice) * 100)}%)
            </span>
          </div>
        </div>

        {/* Información del embajador */}
        {ambassadorCode && (
          <div className="bg-purple-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-[#ac7afc]" />
              <span className="font-medium text-[#ac7afc]">Tu Embajador</span>
            </div>
            <p className="text-sm text-gray-700">
              Código: <span className="font-mono font-bold">{ambassadorCode}</span>
            </p>
            <p className="text-sm text-gray-600">
              Tu embajador recibirá ${promoData.promoDetails.ambassadorCommission} USD de comisión inmediata por esta promoción ({promoData.promoDetails.commissionPercentage}% del valor de membresía).
            </p>
          </div>
        )}

        {/* Términos importantes */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-yellow-800 mb-2">Términos Importantes:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Promoción válida solo durante el período de lanzamiento</li>
            <li>• Después de 3 meses, se cobra $25 USD mensuales automáticamente</li>
            <li>• Puedes cancelar en cualquier momento</li>
            <li>• Promoción limitada por ubicación</li>
          </ul>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleDeclinePromotion}
            className="flex-1"
          >
            Registro Normal ($25/mes)
          </Button>
          
          <Button 
            onClick={handleAcceptPromotion}
            className="flex-1 bg-gradient-to-r from-[#ac7afc] to-[#3ce923] text-white hover:opacity-90"
          >
            <Gift className="w-4 h-4 mr-2" />
            ¡Quiero la Promoción 3x1!
          </Button>
        </div>

        {/* Urgencia */}
        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            ⏰ Esta promoción es por tiempo limitado y no se repetirá
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LaunchPromotionModal;