import { FileIcon, FolderIcon } from "@react-symbols/icons/utils"
import { ChevronRightIcon, FilesIcon } from "lucide-react";
import { useState } from "react";
import { getItemPadding } from "./constants";
import { cn } from "@/lib/utils";

/*
  Es el input temporal que aparece cuando creas un archivo.
    Responsabilidad: Capturar el nombre y validar.
    Estilo: Usa getItemPadding para que el input aparezca alineado exactamente donde aparecerá el nuevo archivo, manteniendo la coherencia visual.
    Eventos: Al perder el foco (onBlur) o presionar Enter, llama a onSubmit para crear el archivo real en la base de datos.
*/

export const RenameInput = ({
  type,
  defaultValue,
  isOpen,
  level,
  onSubmit, // handleRename
  onCancel,
}: {
  type: "file" | "folder";
  defaultValue: string;
  isOpen?: boolean;
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) => {

  const [value, setValue] = useState(defaultValue);

  const handleSubmit = () => {
    const trimmedValue = value.trim() || defaultValue;

    if (trimmedValue) {
      onSubmit(trimmedValue);
    } else {
      onCancel();
    }
  }

  return (
    <div
      className="w-full flex items-center gap-1 h-5.5 bg-accent/30"
      style={{ paddingLeft: getItemPadding(level, type === "file") }}
    >
      <div className="flex items-center gap-0.5">
        {type === "folder" && (
          <ChevronRightIcon
            className={cn(`size-4 shrink-0 text-muted-foreground`, isOpen && "rotate-90")}
          />
        )}

        {type === "file" && (
          <FileIcon
            fileName={value}     // FileIcon detecta la extension mientras escribes
            autoAssign
            className="size-4"
          />
        )}

        {type === "folder" && (
          <FolderIcon
            className="size-4"
            folderName={value}
          />
        )}
      </div>

      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 bg-transparent text-sm outline-none focus:ring-1 focus:ring-inset focus:ring-ring"
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSubmit();
          }
          if (e.key === "Escape") {
            onCancel();
          }
        }}
        onFocus={(e) => {
          if (type === "folder") {                                  // Si es una carpeta
            e.currentTarget.select();                             // Se ejecuta .select() lo que resalta todo el texto
          } else {                                                // Si es un archivo el código intenta no borrar la extensión 
            const value = e.currentTarget.value;                  // Obtiene el texto actual del input
            const lastDotIndex = value.lastIndexOf(".");          // Busca la posición del último punto. Esto define donde empieza la extensioón
            if (lastDotIndex > 0) {                                 // Si encuentra el punto
              e.currentTarget.setSelectionRange(0, lastDotIndex); // Selecciona el texto desde el inicio 0 hasta justo antes del punto. Así solo se resalta el nombre del archivo
            } else {                                              // Sino hay punto 
              e.currentTarget.select()                            // Selecciona todo el texto, igual que con las carpetas
            }                                                     // Todo esto evita que el usuario tenga que volver a escribir la extensión
          }
        }}
      />
    </div>
  )
}
