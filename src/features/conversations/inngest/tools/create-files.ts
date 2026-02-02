import { z } from "zod";
import { createTool } from "@inngest/agent-kit";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

interface CreateFilesToolOptions {
  projectId: Id<"projects">;
  internalKey: string;
}

// Esquema Zod interno para validar los datos que llegan antes de procesarlos.
const paramsSchema = z.object({
  parentId: z.string(), // ID de la carpeta, o "" para la raíz
  files: z              // Array de objetos que contienen name & content
    .array(
      z.object({
        name: z.string().min(1, "File name cannot be empty"),
        content: z.string(),
      })
    )
    .min(1, "Provide at least one file to create"),
});

/**
 * Crea una herramienta (Tool) que permite crear MÚLTIPLES archivos de una sola vez.
 * Esto es vital para que el agente no pierda tiempo (burn-in loops) creando 10 archivos en 10 pasos.
 */
export const createCreateFilesTool = ({
  projectId,
  internalKey,
}: CreateFilesToolOptions) => {
  return createTool({
    name: "createFiles", // Nombre de la tool
    description:
      "Create multiple files at once in the same folder. Use this to batch create files that share the same parent folder. More efficient than creating files one by one.", // Prompt para el modelo: "Usa esto para ahorrar pasos"
    parameters: z.object({
      parentId: z
        .string()
        .describe(
          "The ID of the parent folder. Use empty string for root level. Must be a valid folder ID from listFiles."
        ),
      files: z
        .array(
          z.object({
            name: z.string().describe("The file name including extension"),
            content: z.string().describe("The file content"),
          })
        )
        .describe("Array of files to create"),
    }),
    handler: async (params, { step: toolStep }) => {
      // 1. Validar parámetros de entrada
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Error: ${parsed.error.issues[0].message}`;
      }

      const { parentId, files } = parsed.data;

      try {
        // Envolvemos en step.run para trazabilidad en Inngest
        return await toolStep?.run("create-files", async () => {
          let resolvedParentId: Id<"files"> | undefined;

          // 2. Resolver y validar la carpeta padre (si se especificó una)
          if (parentId && parentId !== "") {
            try {
              resolvedParentId = parentId as Id<"files">;
              const parentFolder = await convex.query(api.system.getFileById, {
                internalKey,
                fileId: resolvedParentId,
              });

              // Verificaciones de seguridad:
              if (!parentFolder) {
                return `Error: Parent folder with ID "${parentId}" not found. Use listFiles to get valid folder IDs.`;
              }
              if (parentFolder.type !== "folder") {
                return `Error: The ID "${parentId}" is a file, not a folder. Use a folder ID as parentId.`;
              }
            } catch {
              // Captura error si el ID no tiene formato válido de Convex
              return `Error: Invalid parentId "${parentId}". Use listFiles to get valid folder IDs, or use empty string for root level.`;
            }
          }

          // 3. Ejecutar la mutación en lote (Batch Mutation)
          // Enviamos todos los archivos juntos para minimizar llamadas a la BD
          const results = await convex.mutation(api.system.createFiles, {
            internalKey,
            projectId,
            parentId: resolvedParentId,
            files,
          });

          // 4. Procesar resultados para dar feedback detallado al agente
          const created = results.filter((r) => !r.error);
          const failed = results.filter((r) => r.error);

          let response = `Created ${created.length} file(s)`;

          if (created.length > 0) {
            response += `: ${created.map((r) => r.name).join(", ")}`;
          }

          // Si alguno falló, explicamos por qué (e.g., nombre duplicado)
          if (failed.length > 0) {
            response += `. Failed: ${failed.map((r) => `${r.name} (${r.error})`).join(", ")}`;
          }

          return response;
        });
      } catch (error) {
        return `Error creating files: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    }
  });
};