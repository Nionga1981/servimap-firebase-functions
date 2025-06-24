
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
import { Checkbox } from "@/components/ui/checkbox";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, VenetianMask } from "lucide-react";
import { registerProvider } from "@/services/providerService";

const providerSignupSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(50),
  specialties: z.string().min(10, { message: "Describe tus especialidades (mínimo 10 caracteres)." }).max(200),
  categoryIds: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "Debes seleccionar al menos una categoría.",
  }),
  proposeNewCategory: z.boolean().default(false).optional(),
  newCategoryName: z.string().optional(),
  codigoEmbajador: z.string().optional(),
}).refine((data) => {
    if (data.proposeNewCategory && (!data.newCategoryName || data.newCategoryName.length < 3)) {
        return false;
    }
    return true;
}, {
    message: "El nombre de la nueva categoría debe tener al menos 3 caracteres.",
    path: ["newCategoryName"],
});

type ProviderSignupFormValues = z.infer<typeof providerSignupSchema>;

export function ProviderSignupForm() {
  const { toast } = useToast();
  const form = useForm<ProviderSignupFormValues>({
    resolver: zodResolver(providerSignupSchema),
    defaultValues: {
      name: "",
      specialties: "",
      categoryIds: [],
      proposeNewCategory: false,
      newCategoryName: "",
      codigoEmbajador: "",
    },
  });

  const { watch } = form;
  const proposeNew = watch("proposeNewCategory");

  async function onSubmit(data: ProviderSignupFormValues) {
    try {
        const registrationData = {
            name: data.name,
            specialties: data.specialties.split(',').map(s => s.trim()),
            selectedCategoryIds: data.categoryIds,
            ...(data.proposeNewCategory && data.newCategoryName && { newCategoryName: data.newCategoryName }),
            ...(data.codigoEmbajador && { codigoEmbajador: data.codigoEmbajador }),
        };

        await registerProvider(registrationData);

        toast({
            title: "¡Registro Enviado!",
            description: "Tu perfil de proveedor ha sido creado exitosamente. Si propusiste una nueva categoría, será revisada por nuestro equipo.",
        });
        form.reset();
    } catch (error: any) {
        console.error("Error en el registro:", error);
        toast({
            title: "Error en el Registro",
            description: error.message || "Ocurrió un problema al enviar tu registro. Por favor, intenta de nuevo.",
            variant: "destructive",
        });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Nombre del Proveedor o Empresa</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Plomería y Soluciones Rápidas" {...field} />
              </FormControl>
              <FormDescription>
                Este es el nombre que verán los clientes.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
            control={form.control}
            name="specialties"
            render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-base">Tus Especialidades</FormLabel>
                    <FormControl>
                        <Textarea
                        placeholder="Ej: Fugas de agua, instalación de boilers, desazolve de drenajes, reparaciones urgentes"
                        {...field}
                        />
                    </FormControl>
                    <FormDescription>
                        Describe brevemente las áreas en las que te especializas.
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <FormField
          control={form.control}
          name="categoryIds"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Categorías de Servicio</FormLabel>
                <FormDescription>
                  Selecciona todas las categorías que apliquen a tus servicios.
                </FormDescription>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {SERVICE_CATEGORIES.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="categoryIds"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={item.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), item.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id
                                      )
                                    )
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal flex items-center gap-2">
                             <item.icon className="h-4 w-4 text-muted-foreground" /> {item.name}
                          </FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
            control={form.control}
            name="proposeNewCategory"
            render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                        <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>
                        Proponer una nueva categoría
                        </FormLabel>
                        <FormDescription>
                        Si tu servicio no encaja en las categorías existentes, márcalo aquí.
                        </FormDescription>
                    </div>
                </FormItem>
            )}
        />

        {proposeNew && (
            <FormField
                control={form.control}
                name="newCategoryName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre de la Nueva Categoría Propuesta</FormLabel>
                        <FormControl>
                            <Input placeholder="Ej: Reparación de Línea Blanca" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        )}

        <FormField
          control={form.control}
          name="codigoEmbajador"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base flex items-center gap-2">
                <VenetianMask className="h-5 w-5 text-muted-foreground" /> Código de Embajador (Opcional)
              </FormLabel>
              <FormControl>
                <Input placeholder="Ingresa el código si fuiste referido por alguien" {...field} />
              </FormControl>
              <FormDescription>
                Si un embajador de ServiMap te invitó, ingresa su código aquí.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={form.formState.isSubmitting} size="lg">
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando Registro...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Completar Registro de Proveedor
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
