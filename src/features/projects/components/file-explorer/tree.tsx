import { ChevronRightIcon } from "lucide-react"
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils"
import { cn } from "@/lib/utils"
import {
  useCreateFile,
  useCreateFolder,
  useFolderContent,
  useRenameFile,
  useDeleteFile
} from "@/features/projects/hooks/use-files"
import { getItemPadding } from "./constants"
import { LoadingRow } from "./loading-row"
import { CreateInput } from "./create-input"
import type { Doc, Id } from "../../../../../convex/_generated/dataModel"
import { useState } from "react"
import { TreeItemWrapper } from "./tree-item-wrapper"
import { fi } from "zod/v4/locales"




export const Tree = ({
  item,
  level = 0,
  projectId
}:{
  item: Doc<"files">;
  level?: number;
  projectId: Id<"projects">;
}) => {

  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);

  const renameFile = useRenameFile();
  const deleteFile = useDeleteFile();
  const createFile = useCreateFile();
  const createFolder = useCreateFolder();

  const folderContent = useFolderContent({      // Contenido de la tabla files
    projectId,
    parentId: item._id,
    enabled: item.type === "folder" && isOpen
  });

  if(item.type === "file"){

    const fileName = item.name;

    return (
      <TreeItemWrapper
        item={item}
        level={level}
        isActive={false}
        onClick={() => {}}
        onDoubleClick={() => {}}
        onRename={() => setIsRenaming(true)}
        onDelete={() => {
          deleteFile({ id: item._id })
        }}
      >
        <FileIcon 
          fileName={fileName}
          autoAssign
          className="size-4"
        />
        <span className="truncate text-sm">{fileName}</span>
      </TreeItemWrapper>
    )
  }
  
  return (
    <div>
      I am a folder
    </div>
  )
}
