// src/app/communities/page.tsx
import { CommunityQuestionForm } from '@/components/communities/CommunityQuestionForm';
import { CommunityQuestionList } from '@/components/communities/CommunityQuestionList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Separator } from '@/components/ui/separator';

export default function CommunitiesPage() {
  // En una aplicación real, aquí podrías obtener los datos del usuario para pasarlos a los componentes.
  // const userData = await getUserData(); // Función hipotética
  const mockUserId = 'currentUserDemoId'; // Simulación
  const mockUserLocation = { lat: 24.8093, lng: -107.4255 }; // Simulación

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-primary">
            <Users className="h-6 w-6" />
            Comunidades ServiMap
          </CardTitle>
          <CardDescription>
            Haz una pregunta a la comunidad o ayuda a otros con tus recomendaciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <CommunityQuestionForm 
              userId={mockUserId}
              userLocation={mockUserLocation}
            />
        </CardContent>
      </Card>

      <Separator className="my-8" />
      
      <h2 className="text-xl font-semibold mb-4">Preguntas Recientes de la Comunidad</h2>
      <CommunityQuestionList />

    </div>
  );
}
