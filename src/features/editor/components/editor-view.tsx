import { Id } from "../../../../convex/_generated/dataModel"

import { TopNavigation } from "./top-navigation"





export const EditorView = ({ projectId }: { projectId: Id<"projects"> }) => {

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center h-[35px] border-b">
        <TopNavigation projectId={projectId} />
      </div>
    </div>
  )
}
