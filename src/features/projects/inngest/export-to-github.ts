import ky from "ky";
import { Octokit } from "octokit";
import { NonRetriableError } from "inngest";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";

import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

interface ExportToGithubEvent {
  projectId: Id<"projects">;
  repoName: string;
  visibility: "public" | "private";
  description?: string;
  githubToken: string;
};

type FileWithUrl = Doc<"files"> & {
  storageUrl: string | null;
};

export const exportToGithub = inngest.createFunction(
  {
    id: "export-to-github",                                                    // Identificador único de la función
    cancelOn: [                                                                // Permite cancelar la exportación si llega un evento específico
      {
        event: "github/export.cancel",                                         // Escucha el evento de cancelación
        if: "event.data.projectId == async.data.projectId"                     // Solo cancela si el projectId coincide
      },
    ],
    onFailure: async ({ event, step }) => {                                    // Manejo de errores críticos
      const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
      if (!internalKey) return;

      const { projectId } = event.data.event.data as ExportToGithubEvent;

      await step.run("set-failed-status", async () => {
        await convex.mutation(api.system.updateExportStatus, {                 // Marca la exportación como fallida en Convex
          internalKey,
          projectId,
          status: "failed",
        });
      });
    }
  },
  {
    event: "github/export.repo"                                                // Evento que inicia la exportación
  },
  async ({ event, step }) => {
    const {
      projectId,
      repoName,
      visibility,
      description,
      githubToken,
    } = event.data as ExportToGithubEvent;

    const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      throw new NonRetriableError("POLARIS_CONVEX_INTERNAL_KEY is not configured");
    };

    // Set status to exporting
    await step.run("set-exporting-status", async () => {                       // Cambia el estado a "exportando" en la UI
      await convex.mutation(api.system.updateExportStatus, {
        internalKey,
        projectId,
        status: "exporting",
      });
    });

    const octokit = new Octokit({ auth: githubToken });                        // Inicializa el cliente de GitHub con el token del usuario

    // Get authenticated user
    const { data: user } = await step.run("get-github-user", async () => {     // Obtiene el perfil del usuario de GitHub
      return await octokit.rest.users.getAuthenticated();
    });


    const { data: repo } = await step.run("create-repo", async () => {         // Crea el repositorio físico en GitHub
      return await octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        description: description || `Exported from Polaris`,
        private: visibility === "private",
        auto_init: true,                                                       // Inicializa con commit para tener rama main
      });
    });


    await step.sleep("wait-for-repo-init", "3s");                              // Espera 3s a que GitHub termine de crear el repo

    // Get the initial commit SHA 
    // (we need this as parent for our commit)
    const initialCommitSha = await step.run("get-initial-commit", async () => { // Obtiene el SHA del commit inicial de GitHub
      const { data: ref } = await octokit.rest.git.getRef({
        owner: user.login,
        repo: repoName,
        ref: "heads/main",
      });
      return ref.object.sha;
    });

    // Fetch all project files with storage URLs
    const files = await step.run("fetch-project-files", async () => {          // Obtiene archivos y URLs de binarios desde Convex
      return (await convex.query(api.system.getProjectFilesWithUrls, {
        internalKey,
        projectId,
      })) as FileWithUrl[];
    });

    // Build a map of file IDs to their full paths
    const buildFilePaths = (files: FileWithUrl[]) => {                         // Reconstruye la jerarquía de carpetas -> rutas
      const fileMap = new Map<Id<"files">, FileWithUrl>();
      files.forEach((f) => fileMap.set(f._id, f));

      const getFullPath = (file: FileWithUrl): string => {                     // Función recursiva para sacar rutas (ej: src/main.js)
        if (!file.parentId) {
          return file.name;
        }

        const parent = fileMap.get(file.parentId);

        if (!parent) {
          return file.name;
        }

        return `${getFullPath(parent)}/${file.name}`;
      };

      const paths: Record<string, FileWithUrl> = {};
      files.forEach((file) => {
        paths[getFullPath(file)] = file;
      });

      return paths;
    };

    const filePaths = buildFilePaths(files);

    // Filter to only actual files (not folders)
    const fileEntries = Object.entries(filePaths).filter(                      // Filtra solo los archivos (GitHub no crea carpetas vacías)
      ([, file]) => file.type === "file"
    );

    if (fileEntries.length === 0) {
      throw new NonRetriableError("No files to export");
    }

    // Create blobs for each file
    const treeItems = await step.run("create-blobs", async () => {             // Crea los 'blobs' (objetos de archivo) en GitHub
      const items: {
        path: string;
        mode: "100644";
        type: "blob";
        sha: string;
      }[] = [];

      for (const [path, file] of fileEntries) {
        let content: string;
        let encoding: "utf-8" | "base64" = "utf-8";

        if (file.content !== undefined) {                                      // Si es archivo de texto (código)
          content = file.content;
        } else if (file.storageUrl) {                                          // Si es archivo binario (imagen)
          const response = await ky.get(file.storageUrl);                      // Descarga el archivo desde Convex Storage
          const buffer = Buffer.from(await response.arrayBuffer());
          content = buffer.toString("base64");                                 // Lo codifica en base64 para GitHub
          encoding = "base64";
        } else {
          continue;
        }

        const { data: blob } = await octokit.rest.git.createBlob({             // Registra el blob en el repo de GitHub
          owner: user.login,
          repo: repoName,
          content,
          encoding,
        });

        items.push({
          path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }

      return items;
    });

    if (treeItems.length === 0) {
      throw new NonRetriableError("Failed to create any file blobs");
    }

    // Create the tree
    const { data: tree } = await step.run("create-tree", async () => {         // Crea el árbol de archivos (jerarquía completa)
      return await octokit.rest.git.createTree({
        owner: user.login,
        repo: repoName,
        tree: treeItems,
      });
    });

    // Create the commit with the initial commit as parent
    const { data: commit } = await step.run("create-commit", async () => {     // Crea el commit con los archivos del IDE
      return await octokit.rest.git.createCommit({
        owner: user.login,
        repo: repoName,
        message: "Initial commit from Polaris",
        tree: tree.sha,
        parents: [initialCommitSha],                                           // El padre es el commit inicial creado por GitHub
      });
    });

    // Update the main branch reference to point to our new commit
    await step.run("update-branch-ref", async () => {                          // Mueve la rama 'main' al nuevo commit
      return await octokit.rest.git.updateRef({
        owner: user.login,
        repo: repoName,
        ref: "heads/main",
        sha: commit.sha,
        force: true,
      });
    });

    // Set status to completed with repo URL
    await step.run("set-completed-status", async () => {                       // Finaliza el proceso y guarda la URL del repo
      await convex.mutation(api.system.updateExportStatus, {
        internalKey,
        projectId,
        status: "completed",
        repoUrl: repo.html_url,                                                // URL final para que el usuario pueda visitarlo
      });
    });

    return {
      success: true,
      repoUrl: repo.html_url,
      filesExported: treeItems.length,
    };
  }
);