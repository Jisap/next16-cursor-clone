import { z } from "zod";
import { createTool } from "@inngest/agent-kit";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";


interface ReadFilesToolOptions {                                                       // Clave de autenticación interna.
  internalKey: string;
}


const paramsSchema = z.object({                                                        //Esquema Zod para validar que se reciba un array de IDs de archivo no vacío.
  fileIds: z
    .array(z.string().min(1, "File ID cannot be empty"))
    .min(1, "Provide at least one file ID"),
});

/**
 * La herramienta readFiles permite al Agente de IA leer el contenido 
 * de archivos específicos almacenados en la base de datos. 
 */
export const createReadFilesTool = ({ internalKey }: ReadFilesToolOptions) => {
  return createTool({                                                                  // Se crea la herramienta.
    name: "readFiles",                                                                 // Identificador único de la herramienta para el agente.
    description: "Read the content of files from the project. Returns file contents.", // Instrucción para el LLM sobre cuándo usarla.
    parameters: z.object({                                                             // Definición de los parámetros que el agente debe proporcionar.
      fileIds: z.array(z.string()).describe("Array of file IDs to read"),              // * Lista de IDs de archivos a leer.
    }),

    handler: async (params, { step: toolStep }) => {                                   // Función principal que se ejecuta cuando el agente invoca la herramienta.
      const parsed = paramsSchema.safeParse(params);                                   // * Valida los parámetros de entrada contra el esquema definido.
      if (!parsed.success) {
        return `Error: ${parsed.error.issues[0].message}`;                             // Retorna error si la validación falla.
      }

      const { fileIds } = parsed.data;                                                 // Extrae los IDs validados.

      try {
        return await toolStep?.run("read-files", async () => {                         // * Envuelve la lógica en un paso de Inngest para trazabilidad y reintentos.
          const results: { id: string; name: string; content: string }[] = [];         // Inicializa array para resultados.


          for (const fileId of fileIds) {                                              // * Itera sobre cada ID solicitado por el agente. 
            const file = await convex.query(api.system.getFileById, {                  // Consulta a Convex para obtener el archivo, usando la clave interna. 
              internalKey,
              fileId: fileId as Id<"files">,
            });


            if (file && file.content) {                                                // * Si el archivo existe y tiene contenido, lo añade a los resultados.
              results.push({
                id: file._id,
                name: file.name,
                content: file.content,
              });
            };
          }


          if (results.length === 0) {                                                  // Si no se encontraron archivos válidos, devuelve un error descriptivo.
            return "Error: No files found with provided IDs. Use listFiles to get valid fileIDs.";
          }


          return JSON.stringify(results);                                              // * Devuelve los datos de los archivos en formato JSON string. 
        })
      } catch (error) {
        return `Error reading files: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    }
  });
};
