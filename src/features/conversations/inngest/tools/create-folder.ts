import { z } from "zod";
import { createTool } from "@inngest/agent-kit";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

interface CreateFolderToolOptions { // Proporcionados por sistema
  projectId: Id<"projects">;        // Se obtiene del evento que inicia la ejecución. Es un dato de ctx del sistema
  internalKey: string;              // Proviene de las variables de entorno del servidor
}

// Esquema de validación interna para verificar los datos antes de operar.
// Estas propiedades son proporcionadas por el AGENTE DE IA (el LLM), 
// basándose en la petición del usuario.
const paramsSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parentId: z.string(), // Puede ser un ID o "" para la raíz
});

/**
 * Crea una herramienta (Tool) para crear carpetas.
 * Permite al agente organizar los archivos en estructuras jerárquicas.
 */

export const createCreateFolderTool = ({
  projectId,
  internalKey,
}: CreateFolderToolOptions) => {
  return createTool({
    name: "createFolder",                              // Nombre visible para el agente
    description: "Create a new folder in the project", // Instrucción simple y directa
    parameters: z.object({
      name: z.string().describe("The name of the folder to create"),
      parentId: z
        .string()
        .describe(
          "The ID (not name!) of the parent folder from listFiles, or empty string for root level"
        ),
    }),
    handler: async (params, { step: toolStep }) => {
      // 1. Validar parámetros de entrada
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Error: ${parsed.error.issues[0].message}`;
      }

      const { name, parentId } = parsed.data;

      try {
        // Envolvemos en step.run para que Inngest registre la operación y permita reintentos
        return await toolStep?.run("create-folder", async () => {

          // 2. Validación del CONTENEDOR (Parent Folder)
          // OJO: Aquí NO estamos verificando si la nueva carpeta ya existe.
          // Estamos verificando que la carpeta "padre" (donde queremos meter la nueva) exista realmente.
          // Ejemplo: Si quiero crear "/Documentos/Vacaciones", verifico que "/Documentos" exista antes.
          if (parentId) {
            try {
              // try/catch ID VALIDATION:
              // Convex lanza una excepción si intentamos buscar el ID de "/Documentos" y el ID está mal formado.
              const parentFolder = await convex.query(api.system.getFileById, {
                internalKey,
                fileId: parentId as Id<"files">,
              });

              // Verificaciones de seguridad:
              if (!parentFolder) {
                return `Error: Parent folder with ID "${parentId}" not found. Use listFiles to get valid folder IDs.`;
              }
              if (parentFolder.type !== "folder") {
                return `Error: The ID "${parentId}" is a file, not a folder. Use a folder ID as parentId.`;
              }
            } catch {
              // Si el ID no es válido (e.g. string random), Convex lanzará error al intentar parsear el Id
              return `Error: Invalid parentId "${parentId}". Use listFiles to get valid folder IDs, or use empty string for root level.`;
            }
          }

          // 3. Crear la carpeta en la base de datos
          const folderId = await convex.mutation(api.system.createFolder, {
            internalKey,
            projectId,
            name,
            parentId: parentId ? (parentId as Id<"files">) : undefined, // Convertimos a undefined si es string vacío
          });

          return `Folder created with ID: ${folderId}`; // Retornamos el ID para que el agente pueda usarlo inmediatamente
        });
      } catch (error) {
        // try/catch GENERAL SAFETY:
        // Si cualquier cosa explota (base de datos caída, error de red, bug inesperado),
        // capturamos el error y se lo devolvemos como TEXTO al agente.
        // Así el agente dice "Ups, ocurrió un error..." en lugar de que el programa crashee.
        return `Error creating folder: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    }
  });
};