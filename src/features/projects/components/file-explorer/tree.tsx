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
import { RenameInput } from "./rename-input"

/*
Cada vez que renderizas una carpeta, este componente se encarga de:
  - Mostrar la carpeta en sí.
  - Si está abierta (isOpen), buscar sus hijos (archivos/carpetas dentro de ella).
  - Por cada hijo encontrado, se vuelve a llamar a sí mismo (<Tree />), pero aumentando el level (nivel de profundidad) en 1.
*/


export const Tree = ({
  item,
  level = 0,
  projectId
}: {
  item: Doc<"files">;        // Data del archivo
  level?: number;            // Su profundidad
  projectId: Id<"projects">; // Id del proyecto al que pertenece
}) => {

  const [isOpen, setIsOpen] = useState(false);                                // Controla si todo el proyecto está colapsado o expandido.     
  const [isRenaming, setIsRenaming] = useState(false);
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);

  const renameFile = useRenameFile();
  const deleteFile = useDeleteFile();
  const createFile = useCreateFile();
  const createFolder = useCreateFolder();

  const folderContents = useFolderContent({      // Contenido de la tabla files
    projectId,
    parentId: item._id,
    enabled: item.type === "folder" && isOpen
  });

  const handleCreate = (name: string) => {
    setCreating(null)

    if (creating === "file") {
      createFile({
        projectId,
        name,
        content: "",
        parentId: item._id
      })
    } else {
      createFolder({
        projectId,
        name,
        parentId: item._id
      })
    }
  }

  const handleRename = (newName: string) => {
    setIsRenaming(false);
    if (newName === item.name) {
      return
    }

    renameFile({ id: item._id, newName });
  }

  const startCreating = (type: "file" | "folder") => {
    setIsOpen(true);
    setCreating(type);
  }

  // Si el item recibido es un archivo:
  //   Renderiza el TreeItemWrapper 
  //   Con el ícono del archivo. 
  //   No tiene estado de apertura ni busca hijos
  if (item.type === "file") {

    const fileName = item.name;

    if (isRenaming) {
      return (
        <RenameInput
          type="file"
          defaultValue={fileName}
          level={level}
          onSubmit={handleRename}
          onCancel={() => setIsRenaming(false)}
        />
      )
    }

    return (
      <TreeItemWrapper
        item={item}
        level={level}
        isActive={false}
        onClick={() => { }}
        onDoubleClick={() => { }}
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

  const folderName = item.name;

  const folderRender = ( // Contenido expecífico de cada folder
    <>
      <div className="flex items-center gap-2">
        <ChevronRightIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground",
            isOpen && "rotate-90"
          )}
        />

        <FolderIcon
          folderName={folderName}
          className="size-4"
        />
        <span className="truncate text-sm">{folderName}</span>
      </div>
    </>
  )

  if (creating) {
    return (
      <>
        <button
          onClick={() => setIsOpen((value) => !value)}
          className="group flex items-center gap-1 h-5.5 hover:bg-accent/30 w-full"
          style={{ paddingLeft: getItemPadding(level, false) }}
        >
          {folderRender}
        </button>

        {isOpen && (
          <>
            {folderContents === undefined && <LoadingRow level={level + 1} />}
            <CreateInput
              type={creating}
              level={level + 1}
              onSubmit={handleCreate}
              onCancel={() => setCreating(null)}
            />
            {folderContents?.map((subItem) => (
              <Tree
                key={subItem._id}
                item={subItem}
                level={level + 1}
                projectId={projectId}
              />
            ))}
          </>
        )}
      </>
    )
  }

  // Si el item recibido es carpeta:
  //   Tiene estado isOpen
  //   Carga perezosa con useFolderContent pasando el item._id como parentId
  //   La query a la base de datos tiene la condición enabled: isOpen -> Esto significa que no se descargan los datos de la subcarpeta hasta que el usuario la abre. Esto hace que la aplicación sea muy rápida aunque tengas miles de archivos.
  //   Recursividad: Cuando isOpen es true, hace un .map() sobre los hijos (folderContents) y renderiza <Tree level={level + 1} /> para cada uno.
  return (
    <>
      <TreeItemWrapper
        item={item}
        level={level}
        onClick={() => setIsOpen((value) => !value)}
        onRename={() => setIsRenaming(true)}
        onDelete={() => {
          deleteFile({ id: item._id })
        }}
        onCreateFile={() => startCreating("file")}
        onCreateFolder={() => startCreating("folder")}
      >
        {folderRender}
      </TreeItemWrapper>

      {isOpen && (
        <>
          {folderContents === undefined && <LoadingRow level={level + 1} />}
          {folderContents?.map((subItem) => (
            <Tree
              key={subItem._id}
              item={subItem}
              level={level + 1}
              projectId={projectId}
            />
          ))}

        </>

      )}
    </>
  )
}
