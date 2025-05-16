import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DEFAULT_SERVICE_IMAGE, SERVICE_CATEGORIES } from '@/lib/constants';
import type { Service } from '@/types';
import { Tag, Edit3, Trash2 } from 'lucide-react';

interface ServiceCardProps {
  service: Service;
  onEdit?: (serviceId: string) => void;
  onDelete?: (serviceId: string) => void;
}

export function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  const category = SERVICE_CATEGORIES.find(cat => cat.id === service.category);
  const IconComponent = category?.icon;

  return (
    <Card className="flex flex-col overflow-hidden shadow-lg h-full">
      <CardHeader className="pb-2">
        <div className="relative aspect-[3/2] w-full mb-4 rounded-md overflow-hidden">
          <Image
            src={service.imageUrl || DEFAULT_SERVICE_IMAGE}
            alt={service.title}
            layout="fill"
            objectFit="cover"
            data-ai-hint="service visual"
          />
        </div>
        <CardTitle className="text-xl">{service.title}</CardTitle>
        {category && IconComponent && (
          <div className="flex items-center text-sm text-muted-foreground gap-1">
            <IconComponent className="h-4 w-4 text-accent" />
            <span>{category.name}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-grow">
        <CardDescription className="line-clamp-3 mb-2">{service.description}</CardDescription>
        <p className="text-lg font-semibold text-primary">${service.price.toFixed(2)}</p>
      </CardContent>
      {(onEdit || onDelete) && (
        <CardFooter className="flex justify-end gap-2 pt-4 border-t">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(service.id)}>
              <Edit3 className="mr-2 h-4 w-4" /> Editar
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(service.id)}>
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
