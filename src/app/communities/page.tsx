
// src/app/communities/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function CommunitiesPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-primary">
            <Users className="h-6 w-6" />
            Comunidades ServiMap
          </CardTitle>
          <CardDescription>
            Explora, únete y participa en comunidades de usuarios y proveedores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-muted-foreground">¡Próximamente!</h2>
            <p className="text-muted-foreground mt-2">
              Estamos trabajando en esta sección para que puedas conectar con otros miembros de ServiMap.
            </p>
            <p className="text-sm text-muted-foreground/80 mt-1">
              Aquí podrás encontrar grupos locales, discutir sobre servicios, compartir experiencias y mucho más.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    