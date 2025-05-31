// src/components/client/CategoryIconBar.tsx
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import type { CategoriaServicio } from '@/types';
import { cn } from '@/lib/utils';
import { LayoutGrid } from 'lucide-react'; // Import a default icon

interface CategoryIconBarProps {
  categories: CategoriaServicio[];
  onCategorySelect: (categoryId: string | null) => void;
  selectedCategoryId: string | null;
}

export function CategoryIconBar({ categories, onCategorySelect, selectedCategoryId }: CategoryIconBarProps) {
  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto py-2 bg-background/80 backdrop-blur-sm rounded-lg shadow">
      <div className="flex space-x-3 items-center justify-start px-3">
        {/* Botón para "Todas las categorías" */}
        <Button
          variant={selectedCategoryId === null ? "default" : "outline"}
          size="sm"
          onClick={() => onCategorySelect(null)}
          className={cn(
            "flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm border h-12", // Adjusted height
            selectedCategoryId === null
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-card-foreground border-border hover:bg-muted/50"
          )}
        >
          <LayoutGrid size={18} /> {/* Default Lucide icon */}
          <span>Todas</span>
        </Button>

        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategoryId === category.id ? "default" : "outline"}
            size="sm"
            onClick={() => onCategorySelect(category.id)}
            className={cn(
              "flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm border h-12", // Adjusted height
              selectedCategoryId === category.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-card-foreground border-border hover:bg-muted/50"
            )}
            title={category.nombre}
          >
            <div className="relative h-5 w-5">
              <Image
                src={category.iconoUrl || 'https://placehold.co/40x40/008080/ffffff.png?text=?'} // Fallback icon
                alt={category.nombre}
                width={20}
                height={20}
                className="rounded-sm object-contain"
              />
            </div>
            <span className="truncate max-w-[100px] text-xs">{category.nombre}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
