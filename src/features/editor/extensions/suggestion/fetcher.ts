import ky from "ky";
import { z } from "zod";
import { toast } from "sonner"

/**
 * Este archivo vive en el navegador. 
 * Su única misión es empaquetar la información del editor y 
 * enviarla al servidor de forma segura.
 */

// Schema de validación de la solicitud
const suggestionRequestSchema = z.object({
  fileName: z.string(),
  code: z.string(),
  currentLine: z.string(),
  previousLines: z.string(),
  textBeforeCursor: z.string(),
  textAfterCursor: z.string(),
  nextLines: z.string(),
  lineNumber: z.number(),
});

// Schema de validación de la respuesta
const suggestionResponseSchema = z.object({
  suggestion: z.string(),
});

// Tipos inferidos
type SuggestionRequest = z.infer<typeof suggestionRequestSchema>;
type SuggestionResponse = z.infer<typeof suggestionResponseSchema>;

// Función fetcher con Ky
export const fetcher = async (
  payload: SuggestionRequest,
  signal: AbortSignal,
): Promise<string | null> => {
  try {
    const validatedPayload = suggestionRequestSchema.parse(payload);    // Validación del payload

    const response = await ky                                           // Petición al servidor
      .post("/api/suggestion", {
        json: validatedPayload,
        signal,
        timeout: 10_000,
        retry: 0
      })
      .json<SuggestionResponse>();

    const validatedResponse = suggestionResponseSchema.parse(response);  // Validación de la respuesta

    return validatedResponse.suggestion || null;                         // Devuelve la sugerencia o null

  } catch (error: any) {
    // Si es un error de límite de velocidad (429), fallamos silenciosamente
    if (error?.response?.status === 429) {
      return null;
    }

    if (signal.aborted) {
      return null;
    }
    if (error instanceof Error && error.name === "AbortError") {
      return null;
    }
    console.error("Suggestion error: ", error);
    toast.error("Failed to fetch AI completion");
    return null;
  }
}