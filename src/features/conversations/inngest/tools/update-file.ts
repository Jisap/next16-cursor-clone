import { z } from "zod";
import { createTool } from "@inngest/agent-kit";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

interface UpdateFileToolOptions {
  internalKey: string;
}

// Esquema de validación interna. 
// (Este lo usamos nosotros para verificar los datos)
const paramsSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  content: z.string(),
});

/**
 * Crea una herramienta que permite actualizar el contenido de un archivo en bd.
 */
export const createUpdateFileTool = ({
  internalKey,
}: UpdateFileToolOptions) => {
  return createTool({                                       // createTool: Convierte una función normal en una "Skill" que el agente puede invocar.
    name: "updateFile",                                     // Nombre único que el agente usará para llamar a esta herramienta
    description: "Update the content of an existing file",  // Instrucciones para el agente sobre CUÁNDO usarla

    // Parámetros expuestos al Agente.
    // Esto es lo que la IA "lee" para saber qué argumentos debe enviar.
    parameters: z.object({
      fileId: z.string().describe("The ID of the file to update"),
      content: z.string().describe("The new content for the file"),
    }),

    // El "Handler" es la lógica que se ejecuta cuando 
    // el agente decide usar la herramienta.
    handler: async (params, { step: toolStep }) => {

      // 1. Validación de entrada: Aseguramos que los parámetros recibidos sean válidos.
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Error: ${parsed.error.issues[0].message}`;
      }

      const { fileId, content } = parsed.data;

      // 2. Verificación de permisos y estado (Pre-flight checks):
      // Antes de escribir nada, verificamos si el archivo existe en la base de datos.
      const file = await convex.query(api.system.getFileById, {
        internalKey,
        fileId: fileId as Id<"files">,
      });


      if (!file) {
        return `Error: File with ID "${fileId}" not found. Use listFiles to get valid file IDs.`; // El agente recibirá este error y sabrá que falló.
      }

      if (file.type === "folder") {
        return `Error: "${fileId}" is a folder, not a file. You can only update file contents.`; // Validación de lógica de negocio.
      }

      try {
        // 3. Ejecución Segura (Step Run):
        // Envolvemos la mutación en un step de Inngest.
        // Esto permite que:
        // - Se registre en el historial de ejecución.
        // - Se pueda reintentar automáticamente si hay un error de red momentáneo.
        return await toolStep?.run("update-file", async () => {
          await convex.mutation(api.system.updateFile, {
            internalKey,
            fileId: fileId as Id<"files">,
            content,
          });

          return `File "${file.name}" updated successfully`; // Feedback positivo para el agente.
        })
      } catch (error) {
        return `Error update file: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    }
  });
};