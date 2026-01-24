import { useFile, useUpdateFile } from "@/features/projects/hooks/use-files";
import { Id } from "../../../../convex/_generated/dataModel"
import { useEditor } from "../hooks/use-editor";
import { FileBreadcrumbs } from "./file-breadcrumbs";

import { TopNavigation } from "./top-navigation"
import Image from "next/image";
import { CodeEditor } from "./code-editor";
import { useRef } from "react";

const DEBOUNCE_MS = 1500;



export const EditorView = ({ projectId }: { projectId: Id<"projects"> }) => {

  const { activeTabId } = useEditor(projectId);                   // Hook que nos devuelve el id del tab activo
  const activeFile = useFile(activeTabId);                        // Hook que nos devuelve el archivo activo en base al id del tab activo
  const updateFile = useUpdateFile();                             // Hook que nos devuelve la función para actualizar el archivo
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);         // Hook que nos devuelve un timeout para actualizar el archivo

  const isActiveFileBinary = activeFile && activeFile.storageId;  // Los archivos binarios si tinenen storageId
  const isActiveFileText = activeFile && !activeFile.storageId;   // Los archivos de texto no tienen storageId

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center h-[35px] border-b">
        <TopNavigation projectId={projectId} />
      </div>

      {activeTabId && <FileBreadcrumbs projectId={projectId} />}

      <div className="flex-1 min-h-0 bg-background">
        {!activeFile && (
          <div className="size-full flex items-center justify-center">
            <Image
              src="/logo-alt.svg"
              alt="Logo Polaris"
              width={50}
              height={50}
              className="opacity-50"
            />
          </div>
        )}

        {isActiveFileText && (
          <CodeEditor
            key={activeFile._id}
            fileName={activeFile.name}
            initialValue={activeFile.content ?? ""}      // Cuando se crea un archivo nuevo createFile le da un valor inicial de content vacio
            onChange={(content: string) => {
              if (timeoutRef.current) {                  // Si existe un timeout, lo limpiamos
                clearTimeout(timeoutRef.current);
              }

              timeoutRef.current = setTimeout(() => {    // Si no existe un timeout, creamos uno nuevo
                updateFile({                             // Le pasamos la función de actualización del archivo
                  id: activeFile._id,
                  content,                               // con el contenido que le pasamos
                })
              }, DEBOUNCE_MS)
            }}
          />
        )}

        {isActiveFileBinary && (
          <p>TODO: Implement binary preview</p>
        )}
      </div>
    </div>
  )
}
