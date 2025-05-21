
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Shield, CreditCard, Tag } from 'lucide-react';
import Image from 'next/image';

export function BottomSearchContainer() {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-4 bg-gradient-to-t from-background via-background/90 to-transparent">
      {/* Search Bar Area */}
      <Card className="shadow-xl rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3 mb-3">
            <Search className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">¿Qué servicio buscas?</h2>
          </div>
          {/* Placeholder for recent searches or quick actions if needed later */}
          {/* 
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Ej: Plomero cerca de mí</p>
            <p>Ej: Reparación de aire acondicionado</p>
          </div> 
          */}
           <Input 
            type="search" 
            placeholder="Escribe un servicio, nombre o categoría..." 
            className="w-full text-base"
            // onClick={() => alert("Funcionalidad de búsqueda no implementada en este prototipo")}
          />
        </CardContent>
      </Card>

      {/* Promotional Banners Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-primary text-primary-foreground rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div>
              <Shield className="h-8 w-8 mb-2 opacity-80" />
              <CardTitle className="text-lg leading-tight">Nuevas Funciones de Seguridad</CardTitle>
              <CardDescription className="text-primary-foreground/80 text-xs mb-3">Actívalas ahora para tu tranquilidad.</CardDescription>
            </div>
            <Image 
                src="https://placehold.co/300x150.png" 
                alt="Seguridad App" 
                width={300} 
                height={150} 
                className="w-full h-auto rounded-md mt-2 object-cover aspect-[2/1]"
                data-ai-hint="security app illustration"
            />
            <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => alert('Ver más sobre seguridad')}>Ver más</Button>
          </CardContent>
        </Card>
        
        <Card className="bg-secondary text-secondary-foreground rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div>
              <CreditCard className="h-8 w-8 mb-2 opacity-80" />
              <CardTitle className="text-lg leading-tight">Tu ServiCard Exclusiva</CardTitle>
              <CardDescription className="text-secondary-foreground/80 text-xs mb-3">Beneficios y descuentos en cada servicio.</CardDescription>
            </div>
             <Image 
                src="https://placehold.co/300x150.png" 
                alt="ServiCard" 
                width={300} 
                height={150} 
                className="w-full h-auto rounded-md mt-2 object-cover aspect-[2/1]"
                data-ai-hint="credit card promotion"
            />
            <Button variant="default" size="sm" className="mt-3 w-full text-primary-foreground bg-primary/80 hover:bg-primary" onClick={() => alert('Más sobre ServiCard')}>Obtén la tuya</Button>
          </CardContent>
        </Card>

        <Card className="bg-accent/20 text-accent-foreground rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow">
          <CardContent className="p-4 flex flex-col justify-between h-full">
             <div>
              <Tag className="h-8 w-8 mb-2 text-accent opacity-80" />
              <CardTitle className="text-lg leading-tight text-foreground">Profesionales 20% OFF</CardTitle>
              <CardDescription className="text-muted-foreground text-xs mb-3">Descuentos en servicios seleccionados este mes.</CardDescription>
            </div>
            <Image 
                src="https://placehold.co/300x150.png" 
                alt="Descuento" 
                width={300} 
                height={150} 
                className="w-full h-auto rounded-md mt-2 object-cover aspect-[2/1]"
                data-ai-hint="discount offer"
            />
            <Button variant="outline" size="sm" className="mt-3 w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground" onClick={() => alert('Ver descuentos')}>Descubre Ofertas</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
