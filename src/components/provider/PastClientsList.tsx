// src/components/provider/PastClientsList.tsx
"use client";

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getPastClients, sendRehireReminder } from '@/services/providerService';
import type { PastClientInfo } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Users, Send, CheckCircle } from 'lucide-react';
import { DEFAULT_USER_AVATAR } from '@/lib/constants';

// En una aplicación real, este ID vendría de la sesión de autenticación del proveedor.
const MOCK_PROVIDER_ID = "plumber1";

export function PastClientsList() {
  const [clients, setClients] = useState<PastClientInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null); // Contiene el ID del usuario al que se le está enviando
  const { toast } = useToast();

  useEffect(() => {
    async function fetchClients() {
      try {
        setIsLoading(true);
        const pastClients = await getPastClients(MOCK_PROVIDER_ID);
        setClients(pastClients);
      } catch (error) {
        toast({
          title: "Error al Cargar Clientes",
          description: "No se pudo obtener la lista de clientes anteriores.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchClients();
  }, [toast]);

  const handleSendReminder = async (client: PastClientInfo) => {
    setSendingReminder(client.usuarioId);
    try {
      await sendRehireReminder(client.usuarioId, client.ultimaCategoriaId);
      toast({
        title: "¡Recordatorio Enviado!",
        description: `Se ha enviado un recordatorio a ${client.nombreUsuario}.`,
        action: <CheckCircle className="text-green-500" />,
      });
    } catch (error: any) {
      toast({
        title: "Error al Enviar",
        description: error.message || "No se pudo enviar el recordatorio. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSendingReminder(null);
    }
  };

  const renderClientList = () => {
    if (clients.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>Aún no tienes un historial de clientes.</p>
          <p className="text-sm">Completa tu primer servicio para empezar a construir tu lista.</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {clients.map((client) => (
            <Card key={client.usuarioId} className="flex items-center p-3 gap-4">
              <Avatar className="h-12 w-12 border">
                <AvatarImage src={client.avatarUrl || DEFAULT_USER_AVATAR} alt={client.nombreUsuario} data-ai-hint="user avatar" />
                <AvatarFallback>{client.nombreUsuario.substring(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex-grow">
                <p className="font-semibold">{client.nombreUsuario}</p>
                <p className="text-xs text-muted-foreground">
                  Último servicio: {new Date(client.ultimoServicioFecha).toLocaleDateString()} ({client.ultimaCategoriaNombre})
                </p>
                <p className="text-xs text-muted-foreground">
                  Servicios totales: {client.serviciosContratados}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleSendReminder(client)}
                disabled={sendingReminder === client.usuarioId}
              >
                {sendingReminder === client.usuarioId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Enviar Recordatorio
              </Button>
            </Card>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Users className="text-primary" /> Clientes Anteriores
        </CardTitle>
        <CardDescription>
          Mantén el contacto con tus clientes y anímales a contratarte de nuevo enviando un recordatorio amigable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando clientes...</p>
          </div>
        ) : (
          renderClientList()
        )}
      </CardContent>
    </Card>
  );
}
