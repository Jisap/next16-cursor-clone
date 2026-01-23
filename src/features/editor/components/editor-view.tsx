import { useFile } from "@/features/projects/hooks/use-files";
import { Id } from "../../../../convex/_generated/dataModel"
import { useEditor } from "../hooks/use-editor";
import { FileBreadcrumbs } from "./file-breadcrumbs";

import { TopNavigation } from "./top-navigation"
import Image from "next/image";





export const EditorView = ({ projectId }: { projectId: Id<"projects"> }) => {

  const { activeTabId } = useEditor(projectId);
  const activeFile = useFile(activeTabId);

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
      </div>
    </div>
  )
}
