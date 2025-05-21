
"use client";

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Shield, Briefcase, Star } from 'lucide-react';

interface BottomSearchContainerProps {
  onSearch: (searchTerm: string) => void;
}

export function BottomSearchContainer({ onSearch }: BottomSearchContainerProps) {
  const [internalSearchTerm, setInternalSearchTerm] = useState('');

  const handleSearchClick = () => {
    onSearch(internalSearchTerm);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearch(internalSearchTerm);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background via-background/95 to-transparent space-y-3 z-10">
      {/* Search Bar Area */}
      <Card className="shadow-xl rounded-xl">
        <CardContent className="p-2 flex items-center space-x-2">
          <Input
            type="text"
            placeholder="¿Qué servicio buscas?"
            value={internalSearchTerm}
            onChange={(e) => setInternalSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-grow text-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            aria-label="Buscar servicio"
          />
          <Button onClick={handleSearchClick} size="icon" variant="ghost" className="text-primary hover:bg-primary/10">
            <Search className="h-5 w-5" />
            <span className="sr-only">Buscar</span>
          </Button>
        </CardContent>
      </Card>

      {/* Promotional Banners / Quick Actions Area */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="bg-background/80 backdrop-blur-sm rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-full">
            <Shield className="h-6 w-6 mb-1 text-primary" />
            <p className="text-xs font-medium text-foreground leading-tight">Servicios Seguros</p>
          </CardContent>
        </Card>
        
        <Card className="bg-background/80 backdrop-blur-sm rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-full">
            <Briefcase className="h-6 w-6 mb-1 text-primary" />
            <p className="text-xs font-medium text-foreground leading-tight">Profesionales</p>
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-sm rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-full">
            <Star className="h-6 w-6 mb-1 text-primary" />
            <p className="text-xs font-medium text-foreground leading-tight">Mejor Calificados</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
