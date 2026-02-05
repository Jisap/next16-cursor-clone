import ky from "ky";
import { Octokit } from "octokit";
import { isBinaryFile } from "isbinaryfile";
import { NonRetriableError } from "inngest";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface ImportGithubRepoEvent {
  owner: string;
  repo: string;
  projectId: Id<"projects">;
  githubToken: string;
}

export const importGithubRepo = inngest.createFunction(
  {
    id: "import-github-repo",                                                  // Identificador único de la función en Inngest
    onFailure: async ({ event, step }) => {                                    // Manejador de errores en caso de fallo crítico
      const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
      if (!internalKey) return;

      const { projectId } = event.data.event.data as ImportGithubRepoEvent;

      await step.run("set-failed-status", async () => {
        await convex.mutation(api.system.updateImportStatus, {                 // Marca el proyecto como fallido en Convex
          internalKey,
          projectId,
          status: "failed",
        });
      });
    },
  },
  { event: "github/import.repo" },                                             // Evento que dispara esta función
  async ({ event, step }) => {
    const { owner, repo, projectId, githubToken } =
      event.data as ImportGithubRepoEvent;                                     // Extrae los datos recibidos del evento

    const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      throw new NonRetriableError("POLARIS_CONVEX_INTERNAL_KEY is not configured");
    };

    const octokit = new Octokit({ auth: githubToken });                        // Inicializa el cliente de GitHub con el token del usuario

    await step.run("cleanup-project", async () => {                            // Borra cualquier rastro previo en bd antes de importar
      await convex.mutation(api.system.cleanup, {
        internalKey,
        projectId
      });
    });

    const tree = await step.run("fetch-repo-tree", async () => {               // Obtiene la estructura completa del repositorio
      try {
        const { data } = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: "main",                                                    // Intenta primero con la rama principal 'main'
          recursive: "1",                                                      // De forma recursiva para traer todo el árbol
        });

        return data;
      } catch {
        // Fallback to master branch
        const { data } = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: "master",                                                  // Reintento con 'master' si 'main' no existe
          recursive: "1",
        });

        return data;
      }
    });


    const folders = tree.tree
      .filter((item) => item.type === "tree" && item.path)                     // Filtra solo los directorios (github los llama 'tree')
      .sort((a, b) => {                                                        // Ordena por profundidad para padres -> hijos
        const aDepth = a.path ? a.path.split("/").length : 0;                  // Cuenta la profundidad de la carpeta para a
        const bDepth = b.path ? b.path.split("/").length : 0;                  // Cuenta la profundidad de la carpeta para b


        return aDepth - bDepth;                                                // Ordena por profundidad
      });


    const folderIdMap = await step.run("create-folders", async () => {         // Procesa la creación de cada carpeta
      const map: Record<string, Id<"files">> = {};                             // Define un mapa de rutas -> IDs de Convex

      for (const folder of folders) {                                          // Recorre cada carpeta
        if (!folder.path) continue;

        const pathParts = folder.path.split("/");                              // Divide la ruta en partes
        const name = pathParts.pop()!;                                         // Nombre de la carpeta actual
        const parentPath = pathParts.join("/");                                // Ruta del padre para buscar su ID
        const parentId = parentPath ? map[parentPath] : undefined;

        const folderId = await convex.mutation(api.system.createFolder, {      // Crea el registro de carpeta en Convex
          internalKey,
          projectId,
          name,
          parentId,
        });

        map[folder.path] = folderId;                                           // Guarda el ID para referenciarlo en subcarpetas/archivos
      }

      return map;                                                              // Retorna el mapa de rutas -> IDs de Convex
    });

    const allFiles = tree.tree.filter(                                         // Consigue todos los archivos del árbol
      (item) => item.type === "blob" && item.path && item.sha                  // En GitHub, tanto texto como imágenes se marcan como 'blob'
    );

    await step.run("create-files", async () => {                               // Procesa la creación de cada archivo
      for (const file of allFiles) {
        if (!file.path || !file.sha) continue;

        try {
          const { data: blob } = await octokit.rest.git.getBlob({              // Descarga el contenido del archivo desde GitHub
            owner,
            repo,
            file_sha: file.sha,
          });

          const buffer = Buffer.from(blob.content, "base64");                  // Decodifica el contenido (siempre viene en base64)
          const isBinary = await isBinaryFile(buffer);                         // Analiza el buffer para saber si es binario o texto

          const pathParts = file.path.split("/");
          const name = pathParts.pop()!;
          const parentPath = pathParts.join("/");
          const parentId = parentPath ? folderIdMap[parentPath] : undefined;

          if (isBinary) {                                                      // Si es binario (img/pdf/exe), usamos el storage
            const uploadUrl = await convex.mutation(
              api.system.generateUploadUrl,                                    // Genera URL para subir el archivo físico
              { internalKey }
            );

            const { storageId } = await ky
              .post(uploadUrl, {                                               // Sube el buffer binario a Convex Storage
                headers: { "Content-Type": "application/octet-stream" },
                body: buffer,
              })
              .json<{ storageId: Id<"_storage"> }>();

            await convex.mutation(api.system.createBinaryFile, {               // Guarda solo la referencia (ID) en la tabla files
              internalKey,
              projectId,
              name,
              storageId,
              parentId,
            });
          } else {                                                             // Si es texto (código/md), lo guardamos como string
            const content = buffer.toString("utf-8");                          // Convierte el buffer a texto legible

            await convex.mutation(api.system.createFile, {                     // Guarda el código directamente en el campo 'content'
              internalKey,
              projectId,
              name,
              content,
              parentId,
            });
          }
        } catch {
          console.error(`Failed to import file: ${file.path}`);
        }
      }
    });

    await step.run("set-completed-status", async () => {                        // Marca el fin de la importación masiva
      await convex.mutation(api.system.updateImportStatus, {
        internalKey,
        projectId,
        status: "completed",
      });
    });

    return { success: true, projectId };                                       // Retorna éxito para log de Inngest
  }
);