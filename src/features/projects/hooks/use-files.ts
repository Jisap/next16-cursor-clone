import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";



export const useCreateFile = () => {
  return useMutation(api.files.createFile)
}

export const useUpdateFile = () => {
  return useMutation(api.files.updateFile)
}

export const useCreateFolder = () => {
  return useMutation(api.files.createFolder)
}

export const useRenameFile = () => {
  return useMutation(api.files.renameFile)
}

export const useDeleteFile = () => {
  return useMutation(api.files.deleteFile)
}

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

export const useFilePath = (fileId: Id<"files"> | null) => {
  return useQuery(api.files.getFilePath, fileId ? { id: fileId } : "skip") // Devuelve un array con la ruta del archivo
}
