"use client";

import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ShieldAlert, ShieldCheck, MessageSquare } from 'lucide-react';
import { chatGuard, type ChatGuardInput, type ChatGuardOutput } from '@/ai/flows/chat-guard';
import { useToast } from '@/hooks/use-toast';

export function ChatGuardDemo() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ChatGuardOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast({
        title: "Entrada Requerida",
        description: "Por favor, ingresa un mensaje para verificar.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      const guardResult = await chatGuard({ message });
      setResult(guardResult);
      toast({
        title: "Verificación Completa",
        description: `Seguridad del mensaje: ${guardResult.isSafe ? 'Seguro' : 'No Seguro'}.`,
      });
    } catch (error) {
      console.error("Error en ChatGuard:", error);
      toast({
        title: "Error",
        description: "Falló la verificación del mensaje. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MessageSquare className="text-accent" /> Demo del Guardián de Chat IA
        </CardTitle>
        <CardDescription>
          Prueba nuestra moderación de chat impulsada por IA. Ingresa cualquier mensaje para ver si es marcado como potencialmente inapropiado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="chat-message-input" className="block text-sm font-medium mb-1">
              Ingresa Mensaje a Verificar:
            </label>
            <Textarea
              id="chat-message-input"
              placeholder="Escribe tu mensaje aquí..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verificando...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" /> Verificar Seguridad del Mensaje
              </>
            )}
          </Button>
        </form>

        {result && (
          <div className="mt-6 p-4 rounded-md border">
            <h3 className="text-lg font-semibold mb-2">Resultado de Moderación:</h3>
            {result.isSafe ? (
              <div className="flex items-center gap-2 text-green-600">
                <ShieldCheck className="h-5 w-5" />
                <p>El mensaje se considera SEGURO.</p>
              </div>
            ) : (
              <div className="text-red-600">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="h-5 w-5" />
                  <p>El mensaje se considera NO SEGURO.</p>
                </div>
                <p className="text-sm"><span className="font-medium">Razón:</span> {result.reason || "No se proporcionó una razón específica."}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
