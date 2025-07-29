"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import type { Service } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle } from "lucide-react";

const serviceFormSchema = z.object({
  title: z.string().min(5, { message: "El título debe tener al menos 5 caracteres." }).max(100),
  description: z.string().min(20, { message: "La descripción debe tener al menos 20 caracteres." }).max(500),
  price: z.number().positive({ message: "El precio debe ser un número positivo." }),
  category: z.string().min(1, { message: "Por favor selecciona una categoría." }),
  // imageUrl: z.string().url().optional(), // Opcional por ahora
});

type ServiceFormValues = z.infer<typeof serviceFormSchema>;

interface ServiceFormProps {
  onAddService: (service: Omit<Service, 'id' | 'providerId' | 'imageUrl'>) => void; // Ajustado para coincidir con el uso
}

export function ServiceForm({ onAddService }: ServiceFormProps) {
  const { toast } = useToast();
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      category: "",
    },
  });

  function onSubmit(data: ServiceFormValues) {
    onAddService(data);
    toast({
      title: "¡Servicio Añadido!",
      description: `"${data.title}" ha sido publicado exitosamente.`,
    });
    form.reset();
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
         <PlusCircle className="text-primary" /> Añadir Nuevo Servicio
        </CardTitle>
        <CardDescription>
          Completa los detalles a continuación para publicar un nuevo servicio que ofreces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título del Servicio</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Reparaciones Expertas de Plomería" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción del Servicio</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe tu servicio en detalle..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ej: 50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría de servicio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SERVICE_CATEGORIES.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center gap-2">
                              <category.icon className="h-4 w-4 text-muted-foreground" />
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full md:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Publicar Servicio
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
