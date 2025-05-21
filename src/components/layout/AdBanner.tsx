// src/components/layout/AdBanner.tsx
"use client";

import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';

export function AdBanner() {
  const adImageUrl = "https://www.mexicanada.com.mx/images/logo.png";
  const adLink = "https://www.mexicanada.com.mx";

  return (
    <div className="bg-secondary/20 p-3 shadow-sm w-full flex items-center justify-between relative mb-4 rounded-lg border border-border/50">
      <Link href={adLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-grow hover:opacity-80 transition-opacity mr-8">
        <Image
          src={adImageUrl}
          alt="Logo del Patrocinador"
          width={120} 
          height={38} 
          className="object-contain rounded-sm"
          style={{ height: 'auto' }} // Added to maintain aspect ratio
          data-ai-hint="advertisement logo"
        />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Visita a nuestro patrocinador</p>
          <p className="text-xs text-muted-foreground">Contenido promocionado para ServiMap</p>
        </div>
      </Link>
      <div className="absolute top-1 right-1 flex items-center">
         <span className="text-xs text-muted-foreground/70 mr-2 opacity-75 select-none">Ad</span>
        <button 
          onClick={() => alert('La opción para remover anuncios estará disponible para usuarios premium.')} 
          className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
          aria-label="Cerrar publicidad"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
