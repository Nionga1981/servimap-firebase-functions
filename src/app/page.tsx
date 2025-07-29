// src/app/page.tsx - Página principal de ServiMap
"use client";

import { useState, useEffect } from 'react';
import { Search, MapPin, Star, Clock, Shield, Zap, Users, MessageSquare, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Mock data para servicios destacados
const featuredServices = [
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
  },
  {
    id: 3,
    name: "Miguel López",
    service: "Electricidad",
    rating: 4.9,
    reviews: 203,
    image: "https://placehold.co/60x60.png",
    distance: "2.1 km",
    available: false,
    price: "Desde $400/hr"
  }
];

const categories = [
  { id: "plumbing", name: "Plomería", icon: "🔧", color: "bg-blue-100 text-blue-700" },
  { id: "cleaning", name: "Limpieza", icon: "🧽", color: "bg-green-100 text-green-700" },
  { id: "electrical", name: "Electricidad", icon: "⚡", color: "bg-yellow-100 text-yellow-700" },
  { id: "gardening", name: "Jardinería", icon: "🌱", color: "bg-emerald-100 text-emerald-700" },
  { id: "repair", name: "Reparaciones", icon: "🔨", color: "bg-orange-100 text-orange-700" },
  { id: "beauty", name: "Belleza", icon: "💄", color: "bg-pink-100 text-pink-700" }
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const router = useRouter();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}&category=${selectedCategory || ''}`);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    router.push(`/search?category=${categoryId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="relative px-4 py-16 text-center">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-4xl font-bold text-gray-900 md:text-6xl">
            Encuentra <span className="text-blue-600">Profesionales</span>
            <br />
            Cerca de Ti
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
            Conecta con prestadores de servicios verificados en tiempo real. 
            Chat, cotizaciones y videollamadas en una sola plataforma.
          </p>

          {/* Search Bar */}
          <div className="mx-auto max-w-xl">
            <div className="flex gap-2 p-2 bg-white rounded-lg shadow-lg border">
              <Input
                type="text"
                placeholder="¿Qué servicio necesitas?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-0 focus:ring-0"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} className="px-6">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-2xl font-bold text-center text-gray-900">
            Categorías Populares
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <Card 
                key={category.id}
                className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
                onClick={() => handleCategorySelect(category.id)}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">{category.icon}</div>
                  <h3 className="font-medium text-gray-900">{category.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Services */}
      <section className="px-4 py-12 bg-gray-50">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Prestadores Destacados
            </h2>
            <Button variant="outline" onClick={() => router.push('/search')}>
              Ver Todos
            </Button>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredServices.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Image
                      src={service.image}
                      alt={service.name}
                      width={60}
                      height={60}
                      className="rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        {service.available ? (
                          <Badge className="bg-green-100 text-green-700">Disponible</Badge>
                        ) : (
                          <Badge variant="secondary">Ocupado</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{service.service}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span>{service.rating}</span>
                          <span>({service.reviews})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{service.distance}</span>
                        </div>
                      </div>
                      <p className="mt-2 font-medium text-blue-600">{service.price}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-3xl font-bold text-center text-gray-900">
            ¿Por qué elegir ServiMap?
          </h2>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Prestadores Verificados</h3>
              <p className="text-gray-600">
                Todos nuestros prestadores pasan por un proceso de verificación riguroso.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Chat en Tiempo Real</h3>
              <p className="text-gray-600">
                Comunícate directamente con los prestadores mediante chat y videollamadas.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Respuesta Inmediata</h3>
              <p className="text-gray-600">
                Encuentra prestadores disponibles al instante cerca de tu ubicación.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Crown className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Servicios Premium</h3>
              <p className="text-gray-600">
                Accede a prestadores premium y servicios de emergencia 24/7.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Disponible 24/7</h3>
              <p className="text-gray-600">
                Encuentra ayuda cuando la necesites, incluso en emergencias.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Comunidad Local</h3>
              <p className="text-gray-600">
                Únete a comunidades locales y apoya el comercio de tu zona.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 bg-blue-600 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-bold">
            ¿Eres un prestador de servicios?
          </h2>
          <p className="mb-8 text-xl opacity-90">
            Únete a nuestra plataforma y conecta con clientes en tu área.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => router.push('/provider-signup')}
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Registrarse como Prestador
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => router.push('/ambassador')}
              className="border-white text-white hover:bg-white hover:text-blue-600"
            >
              Programa de Embajadores
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}