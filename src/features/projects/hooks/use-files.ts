import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";



export const useCreateFile = () => {
  return useMutation(api.files.createFile)
}

export const useCreateFolder = () => {
  return useMutation(api.files.createFolder)
}

export const useFolderContent = ({
  projectId,
  parentId,
  enabled=true,
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