
"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Search, Shield, Briefcase, Star } from 'lucide-react'; // Importa los iconos que usarás

export function BottomSearchContainer() {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background via-background/95 to-transparent space-y-3">
      {/* Search Bar Area */}
      <Card className="shadow-xl rounded-xl">
        <CardContent className="p-3 flex items-center space-x-3 cursor-pointer hover:bg-secondary/50 transition-colors">
          <Search className="h-5 w-5 text-muted-foreground" />
          <span className="text-lg font-medium text-foreground flex-grow">¿Qué servicio buscas?</span>
          {/* Placeholder for potential filter/options icon on the right */}
          {/* <Settings className="h-5 w-5 text-muted-foreground" /> */}
        </CardContent>
      </Card>

      {/* Promotional Banners / Quick Actions Area */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="bg-background/80 backdrop-blur-sm rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-full">
            <Shield className="h-6 w-6 mb-1 text-primary" />
            <p className="text-xs font-medium text-foreground leading-tight">Servicios Seguros</p>
            {/* <p className="text-[10px] text-muted-foreground leading-tight">Tu tranquilidad</p> */}
          </CardContent>
        </Card>
        
        <Card className="bg-background/80 backdrop-blur-sm rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-full">
            <Briefcase className="h-6 w-6 mb-1 text-primary" />
            <p className="text-xs font-medium text-foreground leading-tight">Profesionales</p>
            {/* <p className="text-[10px] text-muted-foreground leading-tight">Verificados</p> */}
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-sm rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-full">
            <Star className="h-6 w-6 mb-1 text-primary" />
            <p className="text-xs font-medium text-foreground leading-tight">Mejor Calificados</p>
            {/* <p className="text-[10px] text-muted-foreground leading-tight">Confiables</p> */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    