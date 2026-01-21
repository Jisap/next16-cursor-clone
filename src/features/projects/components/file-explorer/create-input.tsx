import { FileIcon, FolderIcon } from "@react-symbols/icons/utils"
import { ChevronRightIcon, FilesIcon } from "lucide-react";
import { useState } from "react";
import { getItemPadding } from "./constants";

/*
  Es el input temporal que aparece cuando creas un archivo.
    Responsabilidad: Capturar el nombre y validar.
    Estilo: Usa getItemPadding para que el input aparezca alineado exactamente donde aparecerá el nuevo archivo, manteniendo la coherencia visual.
    Eventos: Al perder el foco (onBlur) o presionar Enter, llama a onSubmit para crear el archivo real en la base de datos.
*/

export const CreateInput = ({
  type,
  level,
  onSubmit, // handleCreate
  onCancel
}: {
  type: "file" | "folder" | null;
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) => {

  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmedValue = value.trim();

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
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
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
      />
    </div>
  )
}
