const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Configuración para OpenAI (usar variable de entorno en producción)
const OPENAI_API_KEY = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;

/**
 * Sistema de moderación con IA para contenido de texto (chat, descripciones, etc.)
 */
class IAModerador {
  constructor() {
    this.openaiHeaders = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Moderar texto usando OpenAI
   */
  async moderarTexto(texto, contexto = 'general') {
    try {
      const prompt = this.construirPromptModeracion(texto, contexto);
      
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres un moderador de contenido profesional para una plataforma de servicios. Debes analizar contenido y determinar si es apropiado, seguro y cumple con las políticas de la plataforma.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }, { headers: this.openaiHeaders });

      const resultado = response.data.choices[0].message.content;
      return this.parsearResultadoModeracion(resultado);

    } catch (error) {
      console.error('Error en moderación de texto:', error);
      // En caso de error, ser conservador y marcar como requiere revisión
      return {
        aprobado: false,
        confianza: 0.5,
        razon: 'Error en el sistema de moderación',
        requiereRevisionHumana: true,
        categoria: 'error_sistema'
      };
    }
  }

  /**
   * Moderar imagen usando OpenAI Vision
   */
  async moderarImagen(imageUrl, contexto = 'portafolio') {
    try {
      const prompt = this.construirPromptModeracionImagen(contexto);
      
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: 'Eres un moderador de contenido visual para una plataforma profesional de servicios. Analiza imágenes para determinar si son apropiadas y profesionales.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'low'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      }, { headers: this.openaiHeaders });

      const resultado = response.data.choices[0].message.content;
      return this.parsearResultadoModeracion(resultado);

    } catch (error) {
      console.error('Error en moderación de imagen:', error);
      return {
        aprobado: false,
        confianza: 0.5,
        razon: 'Error al analizar la imagen',
        requiereRevisionHumana: true,
        categoria: 'error_sistema'
      };
    }
  }

  /**
   * Verificar documento de identidad
   */
  async verificarDocumentoIdentidad(imageUrl, tipoDocumento, pais) {
    try {
      const prompt = this.construirPromptVerificacionIdentidad(tipoDocumento, pais);
      
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en verificación de documentos de identidad. Analiza documentos oficiales para validar su autenticidad y extraer información relevante de forma segura.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }, { headers: this.openaiHeaders });

      const resultado = response.data.choices[0].message.content;
      return this.parsearResultadoVerificacion(resultado);

    } catch (error) {
      console.error('Error en verificación de identidad:', error);
      return {
        valido: false,
        confianza: 0,
        razon: 'Error al procesar el documento',
        requiereRevisionHumana: true,
        datosExtraidos: null
      };
    }
  }

  construirPromptModeracion(texto, contexto) {
    const contextos = {
      chat: 'Este texto es de un chat durante una videollamada de servicios profesionales.',
      descripcion: 'Este texto es la descripción de un prestador de servicios.',
      servicio: 'Este texto describe un servicio ofrecido por un prestador.',
      general: 'Este texto es contenido general de la plataforma.'
    };

    return `
Analiza el siguiente texto en el contexto: ${contextos[contexto] || contextos.general}

Texto a analizar: "${texto}"

Evalúa si el contenido:
1. Es apropiado y profesional
2. No contiene lenguaje ofensivo, discriminatorio o inapropiado
3. No incluye información personal sensible (números de teléfono, direcciones exactas, etc.)
4. No contiene spam o contenido promocional inadecuado
5. Es relevante para el contexto de servicios profesionales

Responde SOLO en el siguiente formato JSON:
{
  "aprobado": true/false,
  "confianza": 0.0-1.0,
  "razon": "razón específica si no es aprobado",
  "requiereRevisionHumana": true/false,
  "categoria": "apropiado|inapropiado|spam|informacion_personal|ofensivo|irrelevante"
}
    `;
  }

  construirPromptModeracionImagen(contexto) {
    const contextos = {
      portafolio: 'Esta imagen es parte del portafolio de trabajo de un prestador de servicios.',
      documento: 'Esta imagen es un documento o certificado profesional.',
      perfil: 'Esta imagen es una foto de perfil profesional.'
    };

    return `
Analiza esta imagen en el contexto: ${contextos[contexto] || contextos.portafolio}

Evalúa si la imagen:
1. Es profesional y apropiada para una plataforma de servicios
2. No contiene contenido inapropiado, ofensivo o sexual
3. Es relevante para el contexto profesional
4. No contiene información personal sensible visible
5. Tiene calidad suficiente para ser útil

Responde SOLO en el siguiente formato JSON:
{
  "aprobado": true/false,
  "confianza": 0.0-1.0,
  "razon": "razón específica si no es aprobado",
  "requiereRevisionHumana": true/false,
  "categoria": "apropiado|inapropiado|baja_calidad|irrelevante|informacion_sensible"
}
    `;
  }

  construirPromptVerificacionIdentidad(tipoDocumento, pais) {
    return `
Analiza este documento de identidad oficial.

Tipo de documento esperado: ${tipoDocumento}
País: ${pais}

Verifica:
1. Si es un documento de identidad oficial válido
2. Si corresponde al tipo y país especificado
3. Si la imagen tiene calidad suficiente para verificación
4. Si hay signos evidentes de falsificación o manipulación

Extrae ÚNICAMENTE (sin mostrar datos sensibles completos):
- Tipo de documento identificado
- País emisor
- Si hay nombre visible (SIN mostrar el nombre completo)
- Si hay fecha de nacimiento visible (SIN mostrar la fecha)
- Calidad general del documento

Responde SOLO en el siguiente formato JSON:
{
  "valido": true/false,
  "confianza": 0.0-1.0,
  "razon": "razón si no es válido",
  "requiereRevisionHumana": true/false,
  "datosExtraidos": {
    "tipoDocumento": "tipo identificado",
    "paisEmisor": "país",
    "tieneNombre": true/false,
    "tieneFechaNacimiento": true/false,
    "calidadImagen": "alta|media|baja"
  }
}
    `;
  }

  parsearResultadoModeracion(resultado) {
    try {
      // Limpiar el resultado para obtener solo el JSON
      const jsonMatch = resultado.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No se pudo parsear el resultado');
    } catch (error) {
      console.error('Error parseando resultado de moderación:', error);
      return {
        aprobado: false,
        confianza: 0.5,
        razon: 'Error al procesar la respuesta del moderador',
        requiereRevisionHumana: true,
        categoria: 'error_sistema'
      };
    }
  }

  parsearResultadoVerificacion(resultado) {
    try {
      const jsonMatch = resultado.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No se pudo parsear el resultado');
    } catch (error) {
      console.error('Error parseando resultado de verificación:', error);
      return {
        valido: false,
        confianza: 0,
        razon: 'Error al procesar la respuesta del verificador',
        requiereRevisionHumana: true,
        datosExtraidos: null
      };
    }
  }
}

// Instancia global del moderador
const moderador = new IAModerador();

/**
 * Cloud Function para moderar mensajes de chat en tiempo real
 */
exports.moderarMensajeChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { mensaje, serviceId } = data;

  if (!mensaje || !serviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'Mensaje y serviceId son requeridos');
  }

  try {
    // Moderar el mensaje
    const resultadoModeracion = await moderador.moderarTexto(mensaje, 'chat');

    // Registrar el resultado de moderación
    await admin.firestore().collection('moderacion_mensajes').add({
      serviceId,
      usuarioId: context.auth.uid,
      mensaje: resultadoModeracion.aprobado ? mensaje : '[MENSAJE MODERADO]',
      mensajeOriginal: mensaje,
      resultadoModeracion,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Si no está aprobado y requiere revisión, notificar a moderadores
    if (!resultadoModeracion.aprobado && resultadoModeracion.requiereRevisionHumana) {
      await notificarModeradoresHumanos('mensaje_chat', {
        serviceId,
        usuarioId: context.auth.uid,
        mensaje,
        razon: resultadoModeracion.razon
      });
    }

    return {
      aprobado: resultadoModeracion.aprobado,
      mensajeModificado: resultadoModeracion.aprobado ? mensaje : null,
      razon: resultadoModeracion.aprobado ? null : 'Mensaje no cumple con las políticas de la plataforma'
    };

  } catch (error) {
    console.error('Error moderando mensaje:', error);
    throw new functions.https.HttpsError('internal', 'Error al moderar el mensaje');
  }
});

/**
 * Cloud Function para moderar imágenes subidas
 */
exports.moderarImagen = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { imageUrl, contexto, prestadorId } = data;

  if (!imageUrl) {
    throw new functions.https.HttpsError('invalid-argument', 'URL de imagen requerida');
  }

  try {
    const resultadoModeracion = await moderador.moderarImagen(imageUrl, contexto || 'portafolio');

    // Registrar resultado
    await admin.firestore().collection('moderacion_imagenes').add({
      prestadorId: prestadorId || context.auth.uid,
      imageUrl,
      contexto,
      resultadoModeracion,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Si no está aprobado, marcar imagen para revisión
    if (!resultadoModeracion.aprobado) {
      if (resultadoModeracion.requiereRevisionHumana) {
        await notificarModeradoresHumanos('imagen', {
          prestadorId: prestadorId || context.auth.uid,
          imageUrl,
          contexto,
          razon: resultadoModeracion.razon
        });
      }

      // Si es contenido inapropiado, eliminar la imagen
      if (resultadoModeracion.categoria === 'inapropiado') {
        try {
          await eliminarImagenDeStorage(imageUrl);
        } catch (error) {
          console.error('Error eliminando imagen inapropiada:', error);
        }
      }
    }

    return {
      aprobado: resultadoModeracion.aprobado,
      razon: resultadoModeracion.aprobado ? null : resultadoModeracion.razon,
      requiereRevision: resultadoModeracion.requiereRevisionHumana
    };

  } catch (error) {
    console.error('Error moderando imagen:', error);
    throw new functions.https.HttpsError('internal', 'Error al moderar la imagen');
  }
});

/**
 * Cloud Function para verificar documento de identidad
 */
exports.verificarDocumentoIdentidad = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { imageUrl, tipoDocumento, pais } = data;

  if (!imageUrl || !tipoDocumento || !pais) {
    throw new functions.https.HttpsError('invalid-argument', 'Imagen, tipo de documento y país son requeridos');
  }

  try {
    const resultadoVerificacion = await moderador.verificarDocumentoIdentidad(imageUrl, tipoDocumento, pais);

    // Registrar verificación (sin datos sensibles)
    const registroVerificacion = {
      usuarioId: context.auth.uid,
      tipoDocumento,
      pais,
      resultado: {
        valido: resultadoVerificacion.valido,
        confianza: resultadoVerificacion.confianza,
        requiereRevision: resultadoVerificacion.requiereRevisionHumana
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    await admin.firestore().collection('verificaciones_identidad').add(registroVerificacion);

    // Actualizar estado de verificación del prestador
    const estadoVerificacion = resultadoVerificacion.valido && resultadoVerificacion.confianza > 0.8 
      ? 'verificado' 
      : resultadoVerificacion.requiereRevisionHumana 
        ? 'pendiente_revision' 
        : 'rechazado';

    await admin.firestore().collection('prestadores').doc(context.auth.uid).update({
      verificacionIdentidad: {
        estado: estadoVerificacion,
        tipoDocumento,
        pais,
        fechaVerificacion: admin.firestore.FieldValue.serverTimestamp(),
        confianza: resultadoVerificacion.confianza
      }
    });

    // Si requiere revisión humana, notificar
    if (resultadoVerificacion.requiereRevisionHumana) {
      await notificarModeradoresHumanos('verificacion_identidad', {
        usuarioId: context.auth.uid,
        tipoDocumento,
        pais,
        razon: resultadoVerificacion.razon
      });
    }

    return {
      valido: resultadoVerificacion.valido,
      estado: estadoVerificacion,
      requiereRevision: resultadoVerificacion.requiereRevisionHumana,
      razon: resultadoVerificacion.valido ? null : resultadoVerificacion.razon
    };

  } catch (error) {
    console.error('Error verificando documento:', error);
    throw new functions.https.HttpsError('internal', 'Error al verificar el documento');
  }
});

/**
 * Trigger para moderar contenido automáticamente cuando se crea un prestador
 */
exports.moderarContenidoPrestador = functions.firestore
  .document('prestadores/{prestadorId}')
  .onCreate(async (snap, context) => {
    const prestador = snap.data();
    const prestadorId = context.params.prestadorId;

    try {
      let contenidoAprobado = true;
      const resultadosModeracion = [];

      // Moderar descripción del perfil
      if (prestador.descripcionPerfil) {
        const resultado = await moderador.moderarTexto(prestador.descripcionPerfil, 'descripcion');
        resultadosModeracion.push({ tipo: 'descripcion', resultado });
        if (!resultado.aprobado) contenidoAprobado = false;
      }

      // Moderar servicios itemizados
      if (prestador.serviciosItemizados && prestador.serviciosItemizados.length > 0) {
        for (let i = 0; i < prestador.serviciosItemizados.length; i++) {
          const servicio = prestador.serviciosItemizados[i];
          if (servicio.descripcion) {
            const resultado = await moderador.moderarTexto(servicio.descripcion, 'servicio');
            resultadosModeracion.push({ tipo: `servicio_${i}`, resultado });
            if (!resultado.aprobado) contenidoAprobado = false;
          }
        }
      }

      // Actualizar estado de moderación del prestador
      await snap.ref.update({
        moderacion: {
          estado: contenidoAprobado ? 'aprobado' : 'pendiente_revision',
          resultados: resultadosModeracion,
          fechaModeracion: admin.firestore.FieldValue.serverTimestamp()
        }
      });

      // Si hay contenido no aprobado, notificar moderadores
      if (!contenidoAprobado) {
        await notificarModeradoresHumanos('contenido_prestador', {
          prestadorId,
          resultados: resultadosModeracion.filter(r => !r.resultado.aprobado)
        });
      }

    } catch (error) {
      console.error('Error moderando contenido de prestador:', error);
      
      // Marcar como requiere revisión manual en caso de error
      await snap.ref.update({
        moderacion: {
          estado: 'error_sistema',
          fechaModeracion: admin.firestore.FieldValue.serverTimestamp()
        }
      });
    }
  });

// Funciones auxiliares

async function notificarModeradoresHumanos(tipo, datos) {
  try {
    await admin.firestore().collection('cola_moderacion').add({
      tipo,
      datos,
      estado: 'pendiente',
      prioridad: determinarPrioridad(tipo),
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    });

    // Enviar notificación push a moderadores (si están configuradas)
    // await enviarNotificacionPushMoaderadores(tipo, datos);
    
  } catch (error) {
    console.error('Error notificando moderadores:', error);
  }
}

function determinarPrioridad(tipo) {
  const prioridades = {
    'verificacion_identidad': 'alta',
    'contenido_prestador': 'media',
    'imagen': 'media',
    'mensaje_chat': 'baja'
  };
  return prioridades[tipo] || 'media';
}

async function eliminarImagenDeStorage(imageUrl) {
  try {
    // Extraer el path de la URL de Firebase Storage
    const pathMatch = imageUrl.match(/\/o\/(.*?)\?/);
    if (pathMatch) {
      const filePath = decodeURIComponent(pathMatch[1]);
      const bucket = admin.storage().bucket();
      await bucket.file(filePath).delete();
      console.log(`Imagen eliminada: ${filePath}`);
    }
  } catch (error) {
    console.error('Error eliminando imagen:', error);
    throw error;
  }
}

module.exports = {
  IAModerador,
  moderador
};