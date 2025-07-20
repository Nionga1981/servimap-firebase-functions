import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Calculator, 
  Clock, 
  FileText, 
  Eye, 
  Send,
  AlertTriangle,
  DollarSign,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';

const QuotationCreator = ({ 
  chatId, 
  providerId, 
  userId,
  onQuotationSent,
  onCancel 
}) => {
  const [items, setItems] = useState([
    { id: 1, description: '', quantity: 1, unitPrice: 0, category: 'labor', total: 0 }
  ]);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [validityDays, setValidityDays] = useState(7);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Categorías disponibles
  const itemCategories = [
    { value: 'labor', label: 'Mano de obra', icon: '🔧' },
    { value: 'materials', label: 'Materiales', icon: '📦' },
    { value: 'transport', label: 'Transporte', icon: '🚚' },
    { value: 'other', label: 'Otros', icon: '📋' }
  ];

  // Opciones de tiempo estimado
  const timeOptions = [
    '30 minutos - 1 hora',
    '1-2 horas',
    '2-4 horas',
    '4-8 horas',
    '1 día',
    '2-3 días',
    '1 semana',
    'Más de 1 semana'
  ];

  // Calcular totales automáticamente
  useEffect(() => {
    const updatedItems = items.map(item => ({
      ...item,
      total: item.quantity * item.unitPrice
    }));
    setItems(updatedItems);
  }, [items.map(item => `${item.quantity}-${item.unitPrice}`).join(',')]);

  // Agregar nuevo item
  const addItem = () => {
    const newItem = {
      id: Date.now(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      category: 'labor',
      total: 0
    };
    setItems([...items, newItem]);
  };

  // Remover item
  const removeItem = (itemId) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== itemId));
    }
  };

  // Actualizar item
  const updateItem = (itemId, field, value) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  // Calcular totales
  const getTotals = () => {
    const breakdown = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.total;
      acc.total += item.total;
      return acc;
    }, { labor: 0, materials: 0, transport: 0, other: 0, total: 0 });

    return breakdown;
  };

  // Validar cotización
  const validateQuotation = () => {
    if (items.some(item => !item.description.trim())) {
      setError('Todos los items deben tener descripción');
      return false;
    }

    if (items.some(item => item.quantity <= 0 || item.unitPrice < 0)) {
      setError('Cantidad debe ser mayor a 0 y precio no puede ser negativo');
      return false;
    }

    if (!estimatedTime.trim()) {
      setError('El tiempo estimado es requerido');
      return false;
    }

    const total = getTotals().total;
    if (total <= 0) {
      setError('El total debe ser mayor a 0');
      return false;
    }

    return true;
  };

  // Enviar cotización
  const sendQuotation = async () => {
    if (!validateQuotation()) return;

    setLoading(true);
    setError('');

    try {
      const createCustomQuotation = firebase.functions().httpsCallable('createCustomQuotation');
      
      const quotationData = {
        chatId,
        providerId,
        userId,
        items: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          category: item.category
        })),
        totalAmount: getTotals().total,
        estimatedTime,
        validityDays,
        notes: notes.trim() || undefined
      };

      const result = await createCustomQuotation(quotationData);

      if (result.data.success) {
        onQuotationSent && onQuotationSent(result.data.quotationId);
      }
    } catch (err) {
      console.error('Error enviando cotización:', err);
      setError('Error enviando cotización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Renderizar item de cotización
  const renderQuotationItem = (item, index) => (
    <Card key={item.id} className="mb-4 border-l-4 border-l-[#ac7afc]">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-3">
            {/* Descripción */}
            <div>
              <Label htmlFor={`description-${item.id}`}>Descripción *</Label>
              <Input
                id={`description-${item.id}`}
                placeholder="Ej: Reparación de tubería principal"
                value={item.description}
                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Cantidad, Precio y Categoría */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor={`quantity-${item.id}`}>Cantidad</Label>
                <Input
                  id={`quantity-${item.id}`}
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                  className="text-sm"
                />
              </div>

              <div>
                <Label htmlFor={`unitPrice-${item.id}`}>Precio Unit.</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2.5 w-4 h-4 text-gray-500" />
                  <Input
                    id={`unitPrice-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="pl-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={`category-${item.id}`}>Categoría</Label>
                <Select 
                  value={item.category}
                  onValueChange={(value) => updateItem(item.id, 'category', value)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itemCategories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Total</Label>
                <div className="bg-[#FFD700] text-black px-3 py-2 rounded font-semibold text-sm">
                  ${item.total.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Botón eliminar */}
          {items.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeItem(item.id)}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Preview de la cotización
  const QuotationPreview = () => {
    const totals = getTotals();
    
    return (
      <Card className="border-[#FFD700]">
        <CardHeader className="bg-gradient-to-r from-[#FFD700] to-yellow-400">
          <CardTitle className="text-black flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Vista Previa - Cotización
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* Items */}
          <div className="space-y-3 mb-6">
            {items.map((item, index) => (
              <div key={item.id} className="flex justify-between items-start py-2 border-b border-gray-100">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.description}</p>
                  <p className="text-sm text-gray-600">
                    {itemCategories.find(c => c.value === item.category)?.icon} 
                    {itemCategories.find(c => c.value === item.category)?.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${item.total.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown por categoría */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold mb-3 text-gray-900">Desglose por Categoría</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {itemCategories.map(cat => {
                const amount = totals[cat.value];
                if (amount <= 0) return null;
                
                return (
                  <div key={cat.value} className="flex justify-between">
                    <span className="text-gray-600">{cat.icon} {cat.label}:</span>
                    <span className="font-medium">${amount.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="bg-[#FFD700] rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-black">Total:</span>
              <span className="text-2xl font-bold text-black">${totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Tiempo estimado */}
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#60cdff]" />
            <span className="font-medium">Tiempo estimado:</span>
            <Badge variant="outline" className="text-[#60cdff] border-[#60cdff]">
              {estimatedTime}
            </Badge>
          </div>

          {/* Notas */}
          {notes.trim() && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2 text-gray-900">Notas adicionales:</h4>
              <p className="text-gray-700 bg-gray-50 p-3 rounded">{notes}</p>
            </div>
          )}

          {/* Validez */}
          <div className="text-sm text-gray-600">
            <p>• Esta cotización es válida por {validityDays} días</p>
            <p>• Los precios pueden variar según condiciones del trabajo</p>
            <p>• Se requiere inspección previa para confirmación final</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (showPreview) {
    return (
      <div className="space-y-6">
        <QuotationPreview />
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowPreview(false)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button 
            onClick={sendQuotation}
            disabled={loading}
            className="flex-1 bg-[#3ce923] hover:bg-green-600"
          >
            <Send className={`w-4 h-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? 'Enviando...' : 'Enviar Cotización'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#ac7afc]">
            <Calculator className="w-5 h-5" />
            Crear Cotización Detallada
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Items de cotización */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Items del Servicio</h3>
          <Button 
            onClick={addItem}
            variant="outline"
            className="text-[#3ce923] border-[#3ce923] hover:bg-green-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Item
          </Button>
        </div>

        {items.map(renderQuotationItem)}
      </div>

      {/* Resumen rápido */}
      <Card className="bg-gradient-to-r from-gray-50 to-blue-50">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Items</p>
              <p className="text-xl font-bold text-[#ac7afc]">{items.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Mano de Obra</p>
              <p className="text-xl font-bold text-[#3ce923]">${getTotals().labor.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Materiales</p>
              <p className="text-xl font-bold text-[#60cdff]">${getTotals().materials.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-[#FFD700]">${getTotals().total.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalles adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tiempo Estimado</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={estimatedTime} onValueChange={setEstimatedTime}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tiempo estimado" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map(time => (
                  <SelectItem key={time} value={time}>{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Validez</CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              value={validityDays.toString()} 
              onValueChange={(value) => setValidityDays(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 días</SelectItem>
                <SelectItem value="7">7 días (recomendado)</SelectItem>
                <SelectItem value="14">14 días</SelectItem>
                <SelectItem value="30">30 días</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Notas adicionales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notas Adicionales (Opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Ej: Incluye garantía de 6 meses, requiere acceso vehicular, etc..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Acciones */}
      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={onCancel}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button 
          onClick={() => setShowPreview(true)}
          disabled={!validateQuotation()}
          className="flex-1 bg-[#ac7afc] hover:bg-purple-600"
        >
          <Eye className="w-4 h-4 mr-2" />
          Vista Previa
        </Button>
      </div>
    </div>
  );
};

export default QuotationCreator;