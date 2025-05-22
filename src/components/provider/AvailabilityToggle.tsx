
"use client";

import { useState, useEffect, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateProviderRealtimeStatus, disconnectProvider } from '@/services/providerService'; // Importar los servicios

// ID de proveedor de ejemplo. En una aplicación real, esto vendría de la sesión del usuario.
const MOCK_PROVIDER_ID = "provider123"; 

export function AvailabilityToggle() {
  const [isAvailable, setIsAvailable] = useState(false); // Iniciar como no disponible
  const [isLoading, setIsLoading] = useState(false); // Para feedback de carga
  const watchIdRef = useRef<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Limpiar el watchPosition si el componente se desmonta y está activo
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        // Opcional: informar al backend que se desconectó si el navegador se cierra abruptamente
        // disconnectProvider(MOCK_PROVIDER_ID); 
      }
    };
  }, []);

  const handleAvailabilityChange = async (checked: boolean) => {
    setIsLoading(true);

    if (checked) { // Si se está activando la disponibilidad
      try {
        // Verificar permisos de geolocalización
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          toast({
            title: "Permiso de Ubicación Denegado",
            description: "Por favor, habilita los permisos de ubicación en tu navegador para continuar.",
            variant: "destructive",
          });
          setIsLoading(false);
          setIsAvailable(false); // Asegurar que el switch se revierta
          return;
        }
        
        if (permissionStatus.state === 'prompt') {
            toast({
                title: "Permiso de Ubicación Requerido",
                description: "Por favor, permite el acceso a tu ubicación cuando el navegador lo solicite.",
            });
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            console.log('Nueva ubicación:', latitude, longitude);
            await updateProviderRealtimeStatus(MOCK_PROVIDER_ID, true, { lat: latitude, lng: longitude });
            // Solo actualizar el estado del switch y mostrar toast una vez que se obtiene la primera ubicación
            if (!isAvailable) { 
                setIsAvailable(true);
                 toast({
                    title: "Ahora Estás Disponible",
                    description: "Tu ubicación se está compartiendo en tiempo real.",
                });
            }
            setIsLoading(false); // Detener carga una vez que se recibe la primera ubicación
          },
          (error) => {
            console.error("Error en watchPosition:", error);
            toast({
              title: "Error de Geolocalización",
              description: error.message || "No se pudo obtener tu ubicación.",
              variant: "destructive",
            });
            setIsAvailable(false); // Revertir el estado del switch
            setIsLoading(false);
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000, // 10 segundos para obtener la primera posición
            maximumAge: 0, // No usar caché
          }
        );
        // No actualizamos isAvailable aquí inmediatamente, esperamos la primera ubicación.
        // Si el usuario deniega el permiso en el prompt del navegador, el callback de error se encargará.

      } catch (error) {
        console.error("Error al solicitar permiso de geolocalización:", error);
        toast({
            title: "Error de Permisos",
            description: "No se pudieron verificar los permisos de ubicación.",
            variant: "destructive",
        });
        setIsAvailable(false);
        setIsLoading(false);
      }
    } else { // Si se está desactivando la disponibilidad
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      await disconnectProvider(MOCK_PROVIDER_ID);
      setIsAvailable(false);
      toast({
        title: "Ahora Estás Desconectado",
        description: "Ya no compartes tu ubicación y no aparecerás como disponible.",
      });
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          {isAvailable ? <Wifi className="text-green-500 animate-pulse" /> : <WifiOff className="text-red-500" />}
          Estado de Disponibilidad
        </CardTitle>
        <CardDescription>
          Controla si los clientes te ven como disponible y comparte tu ubicación para servicios inmediatos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-3 p-4 rounded-lg bg-secondary/30">
          <Switch
            id="availability-mode"
            checked={isAvailable}
            onCheckedChange={handleAvailabilityChange}
            disabled={isLoading}
            aria-label="Alternar disponibilidad"
          />
          <Label htmlFor="availability-mode" className="text-lg font-medium cursor-pointer flex items-center">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Procesando...
              </>
            ) : isAvailable ? (
              'Estás Conectado y Disponible'
            ) : (
              'Estás Desconectado y No Disponible'
            )}
          </Label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {isAvailable 
            ? "Tu ubicación se actualiza en tiempo real. Para dejar de compartirla, desactiva el interruptor."
            : "Activa el interruptor para aparecer como disponible y comenzar a compartir tu ubicación."
          }
        </p>
      </CardContent>
    </Card>
  );
}
