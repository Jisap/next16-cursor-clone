import ky from "ky";
import { z } from "zod";
import { toast } from "sonner"

/**
 * Este archivo vive en el navegador. 
 * Su única misión es empaquetar la información del editor y 
 * enviarla al servidor de forma segura.
 */

// Schema de validación de la solicitud
const EditRequestSchema = z.object({
  selectedCode: z.string(),
  fullCode: z.string(),
  instruction: z.string(),
});

// Schema de validación de la respuesta
const editResponseSchema = z.object({
  editedCode: z.string(),
});

// Tipos inferidos
type EditRequest = z.infer<typeof EditRequestSchema>;
type EditResponse = z.infer<typeof editResponseSchema>;

// Función fetcher con Ky
export const fetcher = async (
  payload: EditRequest,
  signal: AbortSignal,
): Promise<string | null> => {
  try {
    const validatedPayload = EditRequestSchema.parse(payload);          // Validación del payload

    const response = await ky                                           // Petición al servidor
      .post("/api/quick-edit", {
        json: validatedPayload,
        signal,
        timeout: 30_000,
        retry: 0
      })
      .json<EditResponse>();

    const validatedResponse = editResponseSchema.parse(response);        // Validación de la respuesta

    return validatedResponse.editedCode || null;                         // Devuelve la sugerencia o null

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
    console.error("Quick edit error: ", error);
    toast.error("Failed to fetch quick edit");
    return null;
  }
}