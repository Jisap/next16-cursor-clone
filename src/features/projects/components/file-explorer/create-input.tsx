import { FileIcon, FolderIcon } from "@react-symbols/icons/utils"
import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";



export const CreateInput = ({
  type,
  level,
  onSubmit,
  onCancel
}:{
  type: "file" | "folder";
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) => {

  const [value, setValue] = useState("");
  
  return (
    <div>CreateInput</div>
  )
}
