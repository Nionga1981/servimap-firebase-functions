const functions = require('firebase-functions');
const admin = require('firebase-admin');

const CATEGORIAS_SISTEMA = {
  'REPARACIONES_Y_SERVICIOS_DEL_HOGAR': {
    id: 1,
    nombre: 'REPARACIONES Y SERVICIOS DEL HOGAR',
    palabrasClave: ['electricista', 'plomero', 'fontanero', 'carpintero', 'pintor', 'cerrajero', 'albañil', 'reparación', 'instalación', 'hogar', 'casa', 'construcción', 'obra', 'mantenimiento', 'jardinero', 'jardinería', 'poda', 'fumigación', 'plagas', 'aire acondicionado', 'calefacción', 'techos', 'impermeabilización']
  },
  'BELLEZA_Y_CUIDADO_PERSONAL': {
    id: 2,
    nombre: 'BELLEZA Y CUIDADO PERSONAL',
    palabrasClave: ['estilista', 'peluquero', 'barbero', 'manicura', 'pedicura', 'maquillaje', 'maquillista', 'masaje', 'masajista', 'spa', 'belleza', 'estética', 'cosmetología', 'depilación', 'uñas', 'pestañas', 'cejas', 'tratamiento facial', 'corte de pelo', 'tinte', 'peinado']
  },
  'MASCOTAS_Y_SERVICIOS_VETERINARIOS': {
    id: 3,
    nombre: 'MASCOTAS Y SERVICIOS VETERINARIOS',
    palabrasClave: ['veterinario', 'veterinaria', 'mascota', 'perro', 'gato', 'animal', 'grooming', 'paseador', 'paseo', 'adiestramiento', 'entrenamiento', 'guardería', 'hotel para mascotas', 'vacunación', 'consulta veterinaria', 'peluquería canina', 'cuidado de mascotas']
  },
  'SALUD_Y_BIENESTAR': {
    id: 4,
    nombre: 'SALUD Y BIENESTAR',
    palabrasClave: ['médico', 'doctor', 'enfermero', 'enfermera', 'psicólogo', 'psicóloga', 'terapeuta', 'nutriólogo', 'nutricionista', 'fisioterapeuta', 'dentista', 'odontólogo', 'consulta', 'terapia', 'rehabilitación', 'salud', 'bienestar', 'acupuntura', 'quiropráctico', 'medicina alternativa', 'homeopatía']
  },
  'TRANSPORTE_Y_SERVICIOS_DE_CHOFER': {
    id: 5,
    nombre: 'TRANSPORTE Y SERVICIOS DE CHOFER',
    palabrasClave: ['chofer', 'conductor', 'transporte', 'taxi', 'uber', 'mudanza', 'flete', 'carga', 'traslado', 'viaje', 'aeropuerto', 'mensajería en moto', 'reparto', 'delivery', 'envío', 'paquetería', 'grúa', 'remolque']
  },
  'EDUCACION_Y_TUTORIAS': {
    id: 6,
    nombre: 'EDUCACIÓN Y TUTORÍAS',
    palabrasClave: ['profesor', 'maestro', 'tutor', 'clases', 'enseñanza', 'educación', 'matemáticas', 'inglés', 'español', 'física', 'química', 'música', 'guitarra', 'piano', 'idiomas', 'regularización', 'apoyo escolar', 'universidad', 'preparatoria', 'primaria', 'secundaria']
  },
  'EVENTOS_Y_ENTRETENIMIENTO': {
    id: 7,
    nombre: 'EVENTOS Y ENTRETENIMIENTO',
    palabrasClave: ['fotógrafo', 'fotografía', 'video', 'videógrafo', 'dj', 'música', 'animador', 'payaso', 'fiesta', 'evento', 'boda', 'cumpleaños', 'organizador', 'banquete', 'catering', 'decoración', 'sonido', 'iluminación', 'maestro de ceremonias', 'mariachi', 'grupo musical']
  },
  'TECNOLOGIA_Y_SOPORTE_TECNICO': {
    id: 8,
    nombre: 'TECNOLOGÍA Y SOPORTE TÉCNICO',
    palabrasClave: ['programador', 'desarrollador', 'técnico', 'computadora', 'laptop', 'celular', 'reparación', 'software', 'hardware', 'redes', 'internet', 'wifi', 'instalación', 'soporte', 'sistemas', 'página web', 'aplicación', 'app', 'diseño web', 'impresora', 'informática']
  },
  'LIMPIEZA_Y_SERVICIOS_DOMESTICOS': {
    id: 9,
    nombre: 'LIMPIEZA Y SERVICIOS DOMÉSTICOS',
    palabrasClave: ['limpieza', 'empleada', 'doméstica', 'mucama', 'lavandería', 'planchado', 'cocina', 'cocinero', 'chef', 'niñera', 'cuidado de niños', 'cuidado de adultos', 'enfermería', 'aseo', 'mantenimiento', 'conserje', 'intendencia']
  },
  'SERVICIOS_PROFESIONALES_ESPECIALIZADOS': {
    id: 10,
    nombre: 'SERVICIOS PROFESIONALES ESPECIALIZADOS',
    palabrasClave: ['abogado', 'contador', 'arquitecto', 'ingeniero', 'consultor', 'asesor', 'traductor', 'intérprete', 'notario', 'gestor', 'trámites', 'legal', 'fiscal', 'contabilidad', 'diseño', 'diseñador', 'publicidad', 'marketing', 'recursos humanos', 'investigador privado']
  },
  'COMPRAS_RECADOS_Y_ASISTENCIA_PERSONAL': {
    id: 11,
    nombre: 'COMPRAS, RECADOS Y ASISTENCIA PERSONAL',
    palabrasClave: ['mandadero', 'compras', 'súper', 'mercado', 'farmacia', 'recados', 'asistente', 'personal', 'gestiones', 'fila', 'banco', 'pagos', 'trámite', 'documentos', 'apoyo', 'ayuda', 'tercera edad']
  },
  'MENSAJERIA_Y_ENVIOS_LOCALES': {
    id: 12,
    nombre: 'MENSAJERÍA Y ENVÍOS LOCALES',
    palabrasClave: ['mensajero', 'mensajería', 'envío', 'paquete', 'sobre', 'documento', 'entrega', 'recolección', 'express', 'urgente', 'mismo día', 'moto', 'bicicleta', 'local', 'rápido']
  },
  'SERVICIOS_DE_RENTAS_ENTRE_PERSONAS': {
    id: 13,
    nombre: 'SERVICIOS DE RENTAS ENTRE PERSONAS',
    palabrasClave: ['renta', 'alquiler', 'préstamo', 'herramienta', 'equipo', 'bicicleta', 'scooter', 'inflable', 'silla', 'mesa', 'sonido', 'proyector', 'cámara', 'dron', 'carpa', 'toldo', 'vehículo', 'remolque']
  },
  'SERVICIOS_DE_NEGOCIOS_LOCALES_Y_TIENDAS_FISICAS': {
    id: 14,
    nombre: 'SERVICIOS DE NEGOCIOS LOCALES Y TIENDAS FÍSICAS',
    palabrasClave: ['tienda', 'negocio', 'local', 'comercio', 'venta', 'productos', 'abarrotes', 'papelería', 'ferretería', 'refacciones', 'taller', 'mecánico', 'vulcanizadora', 'llantero', 'cerería', 'floristería', 'panadería', 'tortillería', 'carnicería', 'frutería']
  }
};

/**
 * Clasifica automáticamente la categoría basándose en la descripción del servicio
 * @param {string} descripcion - Descripción del servicio proporcionada por el prestador
 * @returns {Object} Categoría asignada con id y nombre
 */
function clasificarPorDescripcion(descripcion) {
  if (!descripcion || typeof descripcion !== 'string') {
    return { id: 10, nombre: 'SERVICIOS PROFESIONALES ESPECIALIZADOS' };
  }

  const descripcionNormalizada = descripcion.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Elimina acentos

  let mejorCategoria = null;
  let mejorPuntuacion = 0;

  // Analizar cada categoría
  for (const [key, categoria] of Object.entries(CATEGORIAS_SISTEMA)) {
    let puntuacion = 0;
    
    // Buscar coincidencias con palabras clave
    for (const palabra of categoria.palabrasClave) {
      const palabraNormalizada = palabra.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      
      if (descripcionNormalizada.includes(palabraNormalizada)) {
        // Mayor peso a coincidencias exactas
        if (descripcionNormalizada.split(/\s+/).includes(palabraNormalizada)) {
          puntuacion += 3;
        } else {
          puntuacion += 1;
        }
      }
    }

    if (puntuacion > mejorPuntuacion) {
      mejorPuntuacion = puntuacion;
      mejorCategoria = categoria;
    }
  }

  // Si no hay coincidencias, asignar categoría por defecto
  if (!mejorCategoria || mejorPuntuacion === 0) {
    return { id: 10, nombre: 'SERVICIOS PROFESIONALES ESPECIALIZADOS' };
  }

  return {
    id: mejorCategoria.id,
    nombre: mejorCategoria.nombre,
    confianza: mejorPuntuacion > 5 ? 'alta' : mejorPuntuacion > 2 ? 'media' : 'baja'
  };
}

/**
 * Cloud Function HTTP para clasificar categoría por descripción
 */
exports.clasificarCategoriaPorDescripcion = functions.https.onCall(async (data, context) => {
  try {
    const { descripcion } = data;

    if (!descripcion) {
      throw new functions.https.HttpsError('invalid-argument', 'La descripción es requerida');
    }

    const categoria = clasificarPorDescripcion(descripcion);
    
    // Log para monitoreo
    console.log('Clasificación realizada:', {
      descripcion: descripcion.substring(0, 100),
      categoria: categoria.nombre,
      confianza: categoria.confianza || 'N/A'
    });

    return {
      success: true,
      categoria: categoria
    };

  } catch (error) {
    console.error('Error en clasificación:', error);
    throw new functions.https.HttpsError('internal', 'Error al clasificar la categoría');
  }
});

/**
 * Trigger para actualizar categoría automáticamente cuando se crea/actualiza un prestador
 */
exports.actualizarCategoriaPrestador = functions.firestore
  .document('prestadores/{prestadorId}')
  .onWrite(async (change, context) => {
    const prestadorId = context.params.prestadorId;
    const nuevosDatos = change.after.exists ? change.after.data() : null;
    const datosAnteriores = change.before.exists ? change.before.data() : null;

    // Solo procesar si hay cambios en la descripción del perfil
    if (!nuevosDatos || nuevosDatos.descripcionPerfil === datosAnteriores?.descripcionPerfil) {
      return null;
    }

    try {
      const categoria = clasificarPorDescripcion(nuevosDatos.descripcionPerfil);
      
      // Actualizar solo si la categoría cambió
      if (categoria.nombre !== nuevosDatos.categoriaSistema) {
        await change.after.ref.update({
          categoriaSistema: categoria.nombre,
          categoriaId: categoria.id,
          categoriaConfianza: categoria.confianza || 'N/A',
          categoriaActualizadaEn: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Categoría actualizada para prestador ${prestadorId}: ${categoria.nombre}`);
      }
    } catch (error) {
      console.error(`Error actualizando categoría para prestador ${prestadorId}:`, error);
    }
  });

module.exports = {
  clasificarPorDescripcion,
  CATEGORIAS_SISTEMA
};