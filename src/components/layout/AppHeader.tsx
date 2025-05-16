
"use client";

import Link from 'next/link';
import { Menu, Package2, UserCircle, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { DEFAULT_USER_AVATAR } from '@/lib/constants';
import React, { useState } from 'react';

const navLinks = [
  // { href: "/client", label: "Buscar Servicios" }, // Eliminado
  { href: "/provider", label: "Ofrecer Servicios" },
  { href: "/chat", label: "Demo de Chat" },
];

export function AppHeader() {
  const [currentLanguage, setCurrentLanguage] = useState<'ES' | 'EN'>('ES');

  const toggleLanguage = () => {
    setCurrentLanguage((prevLang) => (prevLang === 'ES' ? 'EN' : 'ES'));
    // En una implementación real, aquí llamarías a tu lógica de i18n para cambiar el idioma.
    console.log(`Idioma cambiado a: ${currentLanguage === 'ES' ? 'Inglés' : 'Español'}. Funcionalidad de i18n completa pendiente.`);
    alert(`Simulación: Idioma cambiado a ${currentLanguage === 'ES' ? 'Inglés' : 'Español'}.\nLa traducción completa de la interfaz requiere un sistema i18n.`);
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
      <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold md:text-base text-primary"
        >
          <Package2 className="h-6 w-6" />
          <span className="sr-only">ServiMap</span>
          ServiMap
        </Link>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-foreground/80 transition-colors hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 md:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Alternar menú de navegación</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold text-primary"
            >
              <Package2 className="h-6 w-6" />
              <span className="sr-only">ServiMap</span>
              ServiMap
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="flex w-full items-center gap-2 md:ml-auto md:gap-2 lg:gap-4 justify-end">
        <Button variant="outline" size="sm" onClick={toggleLanguage} className="gap-1">
          <Globe className="h-4 w-4" />
          {currentLanguage === 'ES' ? 'EN' : 'ES'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full">
              <Image 
                src={DEFAULT_USER_AVATAR}
                width={36}
                height={36}
                alt="Avatar de Usuario"
                className="rounded-full"
                data-ai-hint="user avatar"
              />
              <span className="sr-only">Alternar menú de usuario</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Perfil</DropdownMenuItem>
            <DropdownMenuItem>Configuración</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Cerrar Sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
