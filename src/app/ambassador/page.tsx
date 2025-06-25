// src/app/ambassador/page.tsx
import { AmbassadorDashboard } from '@/components/ambassador/AmbassadorDashboard';
import { getAmbassadorData } from '@/services/userService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Crown } from 'lucide-react';
import { AdBanner } from '@/components/layout/AdBanner';


// Simulación de ID de usuario actual. En una app real, esto vendría de una sesión de autenticación.
const CURRENT_USER_ID = "currentUserDemoId";

export default async function AmbassadorPage() {
  const ambassadorData = await getAmbassadorData(CURRENT_USER_ID);

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
      
      {!ambassadorData ? (
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
