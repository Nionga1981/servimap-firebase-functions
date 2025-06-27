// src/components/communities/CommunityQuestionForm.tsx
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { postCommunityQuestion } from '@/services/communityService';
import type { ProviderLocation } from '@/types';

interface CommunityQuestionFormProps {
  userId: string;
  userLocation: ProviderLocation;
}

const formSchema = z.object({
  question: z.string().min(10, {
    message: "Tu pregunta debe tener al menos 10 caracteres.",
  }).max(280, {
    message: "Tu pregunta no puede exceder los 280 caracteres."
  }),
});

export function CommunityQuestionForm({ userId, userLocation }: CommunityQuestionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const result = await postCommunityQuestion(values.question, userLocation);
      toast({
        title: "¡Pregunta Enviada!",
        description: "Tu pregunta ha sido publicada en la comunidad.",
      });
      form.reset();
      // Aquí podrías llamar a una función para refrescar la lista de preguntas
    } catch (error: any) {
      toast({
        title: "Error al Enviar",
        description: error.message || "No se pudo publicar tu pregunta. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Haz una pregunta a la comunidad</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Ej: ¿Alguien sabe dónde puedo encontrar un buen carpintero para una reparación pequeña?"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Publicar Pregunta
        </Button>
      </form>
    </Form>
  );
}
