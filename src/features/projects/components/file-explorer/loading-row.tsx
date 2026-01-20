import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { getItemPadding } from "./constants"

/*
  Se muestra mientras useFolderContent está cargando (cuando devuelve undefined).
  También usa getItemPadding para que el spinner de carga aparezca indentado correctamente dentro de la carpeta que estás abriendo.
*/

export const LoadingRow = ({
  className,
  level = 0,
}: {
  className?: string;
  level?: number;
}) => {
  return (
    <div className={cn(
      "h-5.5 flex items-center text-muted-foreground",
      className
    )}
      style={{ paddingLeft: getItemPadding(level, true) }}
    >
      <Spinner className="size-4 text-ring ml-0.5" />
    </div>
  )
}
