import { ChevronRightIcon } from "lucide-react"
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils"
import { cn } from "@/lib/utils"
import {
  useCreateFile,
  useCreateFolder,
  useFolderContent
} from "@/features/projects/hooks/use-files"
import { getItemPadding } from "./constants"
import { LoadingRow } from "./loading-row"
import { CreateInput } from "./create-input"
import { Doc, Id } from "../../../../../convex/_generated/dataModel"




export const Tree = ({
  item,
  level,
  projectId
}:{
  item: Doc<"files">;
  level?: number;
  projectId: Id<"projects">;
}) => {
  return (
    <div>Tree</div>
  )
}
