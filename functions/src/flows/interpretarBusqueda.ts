// src/functions/src/flows/interpretarBusqueda.ts
import { z } from "zod";
import { ai } from "../genkit";

const interpretarBusquedaInputSchema = z.object({
  searchQuery: z.string().describe("El texto de búsqueda del usuario a analizar."),
});

const interpretarBusquedaOutputSchema = z.object({
  tipo: z
    .enum(["prestador", "negocio_fijo"])
    .describe(
      "El tipo de servicio. 'prestador' para servicios móviles/personas, " +
        "'negocio_fijo' para locales físicos.",
    ),
  categoria: z
    .string()
    .describe(
      "La categoría del servicio en español y minúsculas " +
        "(ej: plomería, electricidad).",
    ),
  idiomaDetectado: z
    .string()
    .describe("El código ISO 639-1 del idioma detectado (ej: es, en)."),
});

const interpretarBusquedaPrompt = ai.definePrompt({
  name: "interpretarBusquedaPrompt",
  input: { schema: interpretarBusquedaInputSchema },
  output: { schema: interpretarBusquedaOutputSchema },
  prompt: `Analiza la siguiente búsqueda de un usuario y clasifícala.
- "tipo": "prestador" si es un servicio móvil o una persona (ej: plomero, jardinero). "negocio_fijo" si es un lugar (ej: taller, consultorio).
- "categoría": Una categoría simple en español y minúsculas (ej: plomería, jardinería).
- "idiomaDetectado": El código ISO 639-1 del idioma.

Texto de búsqueda: {{{searchQuery}}}`,
});

export const interpretarBusquedaFlow = ai.defineFlow(
  {
    name: "interpretarBusquedaFlow",
    inputSchema: interpretarBusquedaInputSchema,
    outputSchema: interpretarBusquedaOutputSchema,
  },
  async (input) => {
    const { output } = await interpretarBusquedaPrompt(input);
    if (!output) {
      throw new Error("La respuesta del modelo de IA fue nula.");
    }
    return output;
  },
);
