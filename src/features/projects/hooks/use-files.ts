import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

// Sort: folders first, then files, alphabetically within each group
const sortFiles = <T extends { type: "file" | "folder"; name: string }>(
  files: T[]
): T[] => {
  return [...files].sort((a, b) => {                                     // Crea copia para no mutar y ordena
    if (a.type === "folder" && b.type === "file") return -1;             // Carpetas van antes que archivos
    if (a.type === "file" && b.type === "folder") return 1;              // Archivos van después de carpetas
    return a.name.localeCompare(b.name);                                 // Orden alfabético por nombre
  });
};

export const useCreateFile = () => {
  return useMutation(api.files.createFile)
}

export const useUpdateFile = () => {
  return useMutation(api.files.updateFile)
}

export const useCreateFolder = () => {
  return useMutation(api.files.createFolder).withOptimisticUpdate(
    (localStore, args) => {
      const existingFiles = localStore.getQuery(api.files.getFolderContent, {
        projectId: args.projectId,
        parentId: args.parentId,
      });

      if (existingFiles !== undefined) {
        // eslint-disable-next-line react-hooks/purity -- optimistic update callback runs on mutation, not render
        const now = Date.now();
        const newFolder = {
          _id: crypto.randomUUID() as Id<"files">,
          _creationTime: now,
          projectId: args.projectId,
          parentId: args.parentId,
          name: args.name,
          type: "folder" as const,
          updatedAt: now,
        };

        localStore.setQuery(
          api.files.getFolderContent,
          { projectId: args.projectId, parentId: args.parentId },
          sortFiles([...existingFiles, newFolder])
        );
      }
    }
  );
};

export const useRenameFile = ({
  projectId,
  parentId,
}: {
  projectId: Id<"projects">;
  parentId?: Id<"files">;
}) => {
  return useMutation(api.files.renameFile).withOptimisticUpdate(
    (localStore, args) => {
      const existingFiles = localStore.getQuery(api.files.getFolderContent, { // Se obtiene el contenido de la cache de la carpeta
        projectId,
        parentId,
      });

      if (existingFiles !== undefined) {                                     // Si existe el contenido en la cache
        const updatedFiles = existingFiles.map((file) =>                     // Se mapea la lista de archivos
          file._id === args.id ? { ...file, name: args.newName } : file      // Si el id del archivo es igual al id del archivo que se está renombrando, se actualiza el nombre
        );

        localStore.setQuery(                                                 // Sobreescribe la lista en cache con la lista filtrada -> useFolderContent dispara la renderización
          api.files.getFolderContent,
          { projectId, parentId },
          sortFiles(updatedFiles)
        );
      }
    }
  )
};

export const useDeleteFile = ({
  projectId,
  parentId,
}: {
  projectId: Id<"projects">;
  parentId?: Id<"files">;
}) => {
  return useMutation(api.files.deleteFile).withOptimisticUpdate(
    (localStore, args) => {
      const existingFiles = localStore.getQuery(api.files.getFolderContent, {  // Se busca la lista de archivos de la carpeta en cache
        projectId,
        parentId,
      });

      if (existingFiles !== undefined) {                                       // Si existe la lista en cache
        localStore.setQuery(                                                   // Sobreescribe la lista en cache con la lista filtrada
          api.files.getFolderContent,                                          // useFolderContent vuelve a renderizar el componente y el archivo desaparece de la pantalla
          { projectId, parentId },                                                      // Si todo sale bien, el servidor devuelve la nueva lista
          existingFiles.filter((file) => file._id !== args.id)                          // Si falla convex deshace el cambio y el archivo vuelve a aparecer    
        );
      }
    }
  );
};

export const useFolderContent = ({
  projectId,
  parentId,
  enabled = true,
}: {
  projectId: Id<"projects">;
  parentId?: Id<"files">;
  enabled?: boolean;
}) => {
  return useQuery( // Los useQuery de convex devuelven undefined mientras se carga la primera vez
    api.files.getFolderContent,
    enabled ? { projectId, parentId } : "skip" // Se ejecuta esta query si enabled es true
  )
}

export const useFile = (fileId: Id<"files"> | null) => {
  return useQuery(api.files.getFile, fileId ? { id: fileId } : "skip")   // Busca en la tabla "files" el documento con el id que le pasamos y si existe lo devuelve
}

export const useFiles = (projectId: Id<"projects"> | null) => {
  return useQuery(api.files.getFiles, projectId ? { projectId } : "skip"); // Devuelve todos los files de un project
};

export const useFilePath = (fileId: Id<"files"> | null) => {
  return useQuery(api.files.getFilePath, fileId ? { id: fileId } : "skip") // Devuelve un array con la ruta del archivo
}
