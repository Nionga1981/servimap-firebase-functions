
"use client";

import Link from 'next/link';
import { Menu, Package2, UserCircle, Globe, ChevronDown, Search, Users, type LucideIcon } from 'lucide-react'; // Added Users
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { DEFAULT_USER_AVATAR, SERVICE_CATEGORIES } from '@/lib/constants';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { mockIdiomas } from '@/lib/mockData';

interface NavLink {
  href: string;
  labelKey: string;
  icon?: LucideIcon;
}

const navLinks: NavLink[] = [
  { href: "/provider", labelKey: "label_offer_services" },
  { href: "/communities", labelKey: "label_communities", icon: Users },
  { href: "/chat", labelKey: "label_chat", icon: Users } // Added chat link as per app PRD
];

type LanguageCode = 'es' | 'en';

export function AppHeader() {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('es');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const langData = mockIdiomas.find(lang => lang.codigo === currentLanguage);
    if (langData) {
      setTranslations(langData.recursos);
    }
  }, [currentLanguage]);

  const getTranslatedText = (key: string, fallback: string) => {
    return translations[key] || fallback;
  };

  const toggleLanguage = () => {
    const newLang = currentLanguage === 'es' ? 'en' : 'es';
    setCurrentLanguage(newLang);
    console.log(`Simulación: Idioma cambiado a ${newLang}. Preferencia debería guardarse y UI actualizarse con i18n.`);
  };

  const handleCategorySelect = (categoryId: string | null) => {
    const targetPath = categoryId && categoryId !== 'all' ? `/?category=${categoryId}` : '/';
    if (pathname === '/' || pathname.startsWith('/?')) {
      router.push(targetPath);
    } else {
      router.push(targetPath);
    }
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-foreground/80 transition-colors hover:text-foreground hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0">
              {getTranslatedText('label_categories', 'Categorías')} <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{getTranslatedText('label_categories', 'Explorar por Categoría')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleCategorySelect('all')}>
                <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{getTranslatedText('label_all_categories', 'Todas las Categorías')}</span>
              </DropdownMenuItem>
              {SERVICE_CATEGORIES.map((category) => {
                const IconComponent = category.icon;
                return (
                  <DropdownMenuItem key={category.id} onClick={() => handleCategorySelect(category.id)}>
                    <IconComponent className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{category.name}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 text-foreground/80 transition-colors hover:text-foreground"
            >
              {Icon && <Icon className="h-4 w-4" />}
              {getTranslatedText(link.labelKey, link.labelKey.replace('label_','').replace('_', ' '))}
            </Link>
          );
        })}
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
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center justify-start text-muted-foreground hover:text-foreground w-full text-left">
                  {getTranslatedText('label_categories', 'Categorías')} <ChevronDown className="ml-auto h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-full">
                 <DropdownMenuLabel>{getTranslatedText('label_categories', 'Explorar por Categoría')}</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 <DropdownMenuGroup>
                   <DropdownMenuItem onClick={() => handleCategorySelect('all')}>
                     <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                     <span>{getTranslatedText('label_all_categories', 'Todas las Categorías')}</span>
                   </DropdownMenuItem>
                    {SERVICE_CATEGORIES.map((category) => {
                      const IconComponent = category.icon;
                      return (
                        <DropdownMenuItem key={category.id} onClick={() => handleCategorySelect(category.id)}>
                           <IconComponent className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>{category.name}</span>
                        </DropdownMenuItem>
                      );
                    })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 text-muted-foreground hover:text-foreground"
              >
                {Icon && <Icon className="h-5 w-5" />}
                {getTranslatedText(link.labelKey, link.labelKey.replace('label_','').replace('_', ' '))}
              </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="flex w-full items-center gap-2 md:ml-auto md:gap-2 lg:gap-4 justify-end">
        <Button variant="outline" size="sm" onClick={toggleLanguage} className="gap-1">
          <Globe className="h-4 w-4" />
          {currentLanguage === 'es' ? 'EN' : 'ES'}
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
                style={{ objectFit: "cover" }}
              />
              <span className="sr-only">Alternar menú de usuario</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{getTranslatedText('my_account', 'Mi Cuenta')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{getTranslatedText('profile', 'Perfil')}</DropdownMenuItem>
            <DropdownMenuItem>{getTranslatedText('settings', 'Configuración')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{getTranslatedText('logout', 'Cerrar Sesión')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

    