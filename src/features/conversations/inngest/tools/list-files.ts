import { z } from "zod";
import { createTool } from "@inngest/agent-kit";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

interface ListFilesToolOptions {
  projectId: Id<"projects">;
  internalKey: string;
}

/**
 * La herramienta listFiles permite al Agente de IA listar todos los archivos y carpetas 
 * del proyecto. Devuelve nombres, IDs, tipos y parentId para cada elemento. 
 * Los elementos con parentId: null están en el nivel raíz. 
 * Usa el parentId para entender la estructura de carpetas - los elementos con el mismo parentId 
 * están en la misma carpeta.
 */

export const createListFilesTool = ({
  projectId,
  internalKey,
}: ListFilesToolOptions) => {
  return createTool({
    name: "listFiles",
    description:
      "List all files and folders in the project. Returns names, IDs, types, and parentId for each item. Items with parentId: null are at root level. Use the parentId to understand the folder structure - items with the same parentId are in the same folder.",
    parameters: z.object({}),
    handler: async (_, { step: toolStep }) => {
      try {
        return await toolStep?.run("list-files", async () => {
          const files = await convex.query(api.system.getProjectFiles, { // Se consulta a Convex para obtener los archivos del proyecto.
            internalKey,
            projectId,
          });

          const sorted = files.sort((a, b) => {                          // Ordena: primero carpetas, luego archivos, alfabéticamente                      
            if (a.type !== b.type) {
              return a.type === "folder" ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });

          const fileList = sorted.map((f) => ({                          // Mapea los archivos ordenados a un formato simple para el agente.
            id: f._id,
            name: f.name,
            type: f.type,
            parentId: f.parentId ?? null,
          }));

          return JSON.stringify(fileList);                                // Devuelve los datos de los archivos en formato JSON string. 
        })
      } catch (error) {
        return `Error listing files: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    }
  });
};