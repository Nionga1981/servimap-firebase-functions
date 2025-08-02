"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Star } from 'lucide-react';
import Image from 'next/image';

// Mock search results
const mockResults = [
  {
    id: 1,
    name: "Carlos Martínez",
    service: "Plomería",
    rating: 4.9,
    reviews: 156,
    image: "https://placehold.co/60x60.png",
    distance: "0.8 km",
    available: true,
    price: "Desde $300/hr"
  },
  {
    id: 2,
    name: "Ana García", 
    service: "Limpieza",
    rating: 4.8,
    reviews: 89,
    image: "https://placehold.co/60x60.png",
    distance: "1.2 km",
    available: true,
    price: "Desde $250/hr"
  }
];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Resultados de búsqueda
        </h1>
        
        <div className="flex gap-2 max-w-xl">
          <Input
            type="text"
            placeholder="¿Qué servicio necesitas?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button>
            <Search className="h-4 w-4 mr-2" />
            Buscar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockResults.map((result) => (
          <Card key={result.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Image
                  src={result.image}
                  alt={result.name}
                  width={60}
                  height={60}
                  className="rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{result.name}</h3>
                    {result.available ? (
                      <Badge className="bg-green-100 text-green-700">Disponible</Badge>
                    ) : (
                      <Badge variant="secondary">Ocupado</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{result.service}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span>{result.rating}</span>
                      <span>({result.reviews})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{result.distance}</span>
                    </div>
                  </div>
                  <p className="mt-2 font-medium text-[#209ded]">{result.price}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}