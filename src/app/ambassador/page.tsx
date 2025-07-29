// src/app/ambassador/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { AmbassadorDashboard } from '@/components/ambassador/AmbassadorDashboard';
import { getAmbassadorData } from '@/services/userService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Crown, Loader2 } from 'lucide-react';
import { AdBanner } from '@/components/layout/AdBanner';

// Simulación de ID de usuario actual. En una app real, esto vendría de una sesión de autenticación.
const CURRENT_USER_ID = "currentUserDemoId";

export default function AmbassadorPage() {
  const [ambassadorData, setAmbassadorData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    async function loadAmbassadorData() {
      try {
        const data = await getAmbassadorData(CURRENT_USER_ID);
        setAmbassadorData(data);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAmbassadorData();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando datos del embajador...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <AdBanner />
      <div className="flex items-center gap-3 mb-6">
        <Crown className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-primary">Panel de Embajador</h1>
          <p className="text-muted-foreground">Gestiona tus referidos y monitorea tus ganancias.</p>
        </div>
      </div>
      
      {error || !ambassadorData ? (
        <Card className="max-w-xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="text-destructive"/>
                    Error
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>No se pudieron cargar los datos del embajador. Por favor, intenta de nuevo más tarde.</p>
            </CardContent>
        </Card>
      ) : (
        <AmbassadorDashboard data={ambassadorData} />
      )}
    </div>
  );
}
