// src/services/communityService.ts
"use client";

import type { PreguntaComunidad, ProviderLocation, DemoUser } from '@/types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { mockDemoUsers, mockProviders } from '@/lib/mockData'; // Para enriquecer los datos

export const getCommunityQuestions = async (): Promise<PreguntaComunidad[]> => {
    console.log('[CommunityService] Fetching community questions (simulated)...');
    
    // Simulación de llamada a una función que obtiene las preguntas.
    // En una app real:
    // const getQuestionsFunction = httpsCallable(functions, 'getCommunityQuestions');
    // const result = await getQuestionsFunction();
    // const data = result.data as PreguntaComunidad[];
    
    // Simulación con datos de mock:
    const mockQuestions: PreguntaComunidad[] = [
        {
            id: 'q1',
            idUsuario: 'standardUserDemoId',
            pregunta: '¿Alguien conoce un buen lugar para reparar zapatos de cuero en el centro?',
            fecha: Date.now() - (1000 * 60 * 60 * 2), // hace 2 horas
            ubicacion: { lat: 24.81, lng: -107.4 },
        },
        {
            id: 'q2',
            idUsuario: 'anotherUser',
            pregunta: 'Busco recomendación de un electricista de confianza para una instalación completa. Es en la zona norte.',
            fecha: Date.now() - (1000 * 60 * 60 * 24), // hace 1 día
            ubicacion: { lat: 24.84, lng: -107.4 },
        }
    ];

    // Enriquecer con datos de usuario (nombre y avatar)
    const enrichedQuestions = mockQuestions.map(q => {
        const user = mockDemoUsers.find(u => u.id === q.idUsuario);
        return {
            ...q,
            nombreUsuario: user?.name || 'Usuario Anónimo',
            avatarUsuario: user?.avatarUrl,
        };
    });

    await new Promise(resolve => setTimeout(resolve, 400)); // Simular delay
    
    return enrichedQuestions.sort((a,b) => b.fecha - a.fecha);
};

export const postCommunityQuestion = async (
    pregunta: string, 
    ubicacion: ProviderLocation,
): Promise<{ success: boolean; message: string; preguntaId: string; }> => {
    console.log('[CommunityService] Posting new community question...');
    const functions = getFunctions(app);
    const postQuestionFunction = httpsCallable(functions, 'publicarPreguntaComunidad');

    try {
        const result = await postQuestionFunction({ pregunta, ubicacion });
        return result.data as { success: boolean; message: string; preguntaId: string; };
    } catch (error) {
        console.error("Error calling 'publicarPreguntaComunidad':", error);
        throw error; // Re-lanzar para que el componente UI pueda manejarlo
    }
};

export const postCommunityAnswer = async (
  preguntaId: string,
  textoRespuesta: string,
  prestadorRecomendadoId?: string,
): Promise<{ success: boolean; message: string; }> => {
  console.log('[CommunityService] Posting new community answer...');
  const functions = getFunctions(app);
  const postAnswerFunction = httpsCallable(functions, 'responderPreguntaComunidad');

  try {
    const result = await postAnswerFunction({ preguntaId, textoRespuesta, prestadorRecomendadoId });
    return result.data as { success: boolean; message: string; };
  } catch (error) {
    console.error("Error calling 'responderPreguntaComunidad':", error);
    throw error;
  }
};
