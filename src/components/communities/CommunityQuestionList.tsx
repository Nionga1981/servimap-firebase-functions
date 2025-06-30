
// src/components/communities/CommunityQuestionList.tsx
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { MessageCircle, ThumbsUp, MapPin, Loader2 } from 'lucide-react';
import { getCommunityQuestions, postCommunityAnswer } from '@/services/communityService';
import type { PreguntaComunidad } from '@/types';
import { DEFAULT_USER_AVATAR } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

function timeSince(date: number) {
  const seconds = Math.floor((new Date().getTime() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return `hace ${Math.floor(interval)} años`;
  interval = seconds / 2592000;
  if (interval > 1) return `hace ${Math.floor(interval)} meses`;
  interval = seconds / 86400;
  if (interval > 1) return `hace ${Math.floor(interval)} días`;
  interval = seconds / 3600;
  if (interval > 1) return `hace ${Math.floor(interval)} horas`;
  interval = seconds / 60;
  if (interval > 1) return `hace ${Math.floor(interval)} minutos`;
  return "hace unos segundos";
}

const answerFormSchema = z.object({
  textoRespuesta: z.string().min(5, { message: 'La respuesta debe tener al menos 5 caracteres.' }).max(500),
  prestadorRecomendadoId: z.string().optional(),
});
type AnswerFormValues = z.infer<typeof answerFormSchema>;

interface AnswerFormProps {
  questionId: string;
  onAnswerPosted: () => void;
}

function AnswerForm({ questionId, onAnswerPosted }: AnswerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const form = useForm<AnswerFormValues>({
    resolver: zodResolver(answerFormSchema),
    defaultValues: { textoRespuesta: '', prestadorRecomendadoId: '' },
  });

  const onSubmit = async (values: AnswerFormValues) => {
    setIsSubmitting(true);
    try {
      await postCommunityAnswer(questionId, values.textoRespuesta, values.prestadorRecomendadoId);
      toast({ title: 'Respuesta enviada', description: 'Gracias por ayudar a la comunidad.' });
      form.reset();
      onAnswerPosted();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo enviar la respuesta.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="textoRespuesta"
          render={({ field }) => (
            <FormItem>
              <Textarea placeholder="Escribe tu respuesta o recomendación aquí..." {...field} rows={2} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="prestadorRecomendadoId"
          render={({ field }) => (
            <FormItem>
              <Input placeholder="ID del Proveedor Recomendado (opcional)" {...field} />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publicar Respuesta'}
        </Button>
      </form>
    </Form>
  );
}


export function CommunityQuestionList() {
  const [questions, setQuestions] = useState<PreguntaComunidad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuestions() {
      try {
        setIsLoading(true);
        const fetchedQuestions = await getCommunityQuestions();
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error("Failed to load community questions", error);
        // Podrías mostrar un toast de error aquí
      } finally {
        setIsLoading(false);
      }
    }
    loadQuestions();
  }, []);

  const handleReplyClick = (questionId: string) => {
    setReplyingTo(current => (current === questionId ? null : questionId));
  };


  if (isLoading) {
    return (
        <div className="space-y-4">
            <Card className="p-4 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></Card>
            <Card className="p-4 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></Card>
        </div>
    );
  }

  if (questions.length === 0) {
    return <p className="text-center text-muted-foreground">No hay preguntas en la comunidad todavía. ¡Sé el primero!</p>;
  }

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <Card key={q.id} className="shadow-sm">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
            <Avatar className="w-10 h-10 border">
              <AvatarImage src={q.avatarUsuario || DEFAULT_USER_AVATAR} alt={q.nombreUsuario} />
              <AvatarFallback>{q.nombreUsuario?.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-grow">
              <p className="font-semibold">{q.nombreUsuario}</p>
              <p className="text-xs text-muted-foreground">{timeSince(q.fecha)}</p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">{q.pregunta}</p>
            {q.ubicacion && (
                <div className="flex items-center text-xs text-muted-foreground mt-2 gap-1">
                    <MapPin className="h-3 w-3"/>
                    <span>Cerca de (Lat: {q.ubicacion.lat.toFixed(2)}, Lng: {q.ubicacion.lng.toFixed(2)})</span>
                </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between items-center text-sm border-t pt-3">
             <Button variant="ghost" size="sm" className="flex items-center gap-1 text-muted-foreground">
                <ThumbsUp className="h-4 w-4" />
                Recomendar (0)
             </Button>
             <Button variant="ghost" size="sm" className="flex items-center gap-1 text-muted-foreground" onClick={() => handleReplyClick(q.id)}>
                <MessageCircle className="h-4 w-4" />
                Responder ({q.respuestasCount || 0})
             </Button>
          </CardFooter>
            {replyingTo === q.id && (
                <CardContent className="border-t pt-4">
                    <AnswerForm
                    questionId={q.id}
                    onAnswerPosted={() => {
                        // En un futuro, podrías refrescar las preguntas o actualizar el estado local
                        setReplyingTo(null);
                    }}
                    />
                </CardContent>
            )}
        </Card>
      ))}
    </div>
  );
}

    