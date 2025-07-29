
// src/services/communityService.ts
"use client";

import type { PreguntaComunidad, ProviderLocation, DemoUser, RespuestaPreguntaComunidad } from '@/types';
import firebaseCompat from '@/lib/firebaseCompat';
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
            respuestasCount: 1,
        },
        {
            id: 'q2',
            idUsuario: 'anotherUser',
            pregunta: 'Busco recomendación de un electricista de confianza para una instalación completa. Es en la zona norte.',
            fecha: Date.now() - (1000 * 60 * 60 * 24), // hace 1 día
            ubicacion: { lat: 24.84, lng: -107.4 },
            respuestasCount: 0,
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

    try {
        const result = await firebaseCompat.callFunction('publicarPreguntaComunidad', { pregunta, ubicacion });
        return result as { success: boolean; message: string; preguntaId: string; };
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

  try {
    const result = await firebaseCompat.callFunction('responderPreguntaComunidad', { preguntaId, textoRespuesta, prestadorRecomendadoId });
    return result as { success: boolean; message: string; };
  } catch (error) {
    console.error("Error calling 'responderPreguntaComunidad':", error);
    throw error;
  }
};

export const getCommunityAnswers = async (questionId: string): Promise<RespuestaPreguntaComunidad[]> => {
    console.log(`[CommunityService] Fetching answers for question ${questionId} (simulated)...`);
    // En una app real, esto llamaría a una función que obtiene las respuestas por questionId
    const mockAnswers: (RespuestaPreguntaComunidad & {nombreUsuario?: string, avatarUsuario?: string})[] = [
        {
            id: 'ans1',
            preguntaId: 'q1',
            autorId: 'currentUserDemoId',
            texto: '¡Claro! Te recomiendo "El Taller del Abuelo" en la calle Rosales. Son artesanos de verdad.',
            fecha: Date.now() - (1000 * 60 * 55), // hace 55 minutos
            prestadorRecomendadoId: 'business123' // ID de un negocio fijo (simulado)
        }
    ];

    const questionAnswers = mockAnswers.filter(a => a.preguntaId === questionId);
    
    const enrichedAnswers = questionAnswers.map(a => {
        const user = mockDemoUsers.find(u => u.id === a.autorId);
        return {
            ...a,
            nombreUsuario: user?.name || 'Usuario Anónimo',
            avatarUsuario: user?.avatarUrl,
        };
    });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    return enrichedAnswers.sort((a,b) => a.fecha - b.fecha);
};

    