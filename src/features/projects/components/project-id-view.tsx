
"use client"

import { cn } from "@/lib/utils";
import { Id } from "../../../../convex/_generated/dataModel"
import { useState } from "react";
import { set } from "date-fns";

const Tab = ({
  label,
  isActive,
  onClick
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 h-full px-3 cursor-pointer text-muted-foreground border-r hover:bg-accent/30",
        isActive && "bg-background text-foreground"
      )}
    >
      <span className="text-sm">{label}</span>
    </div>
  )
}

export const ProjectIdView = ({ projectId }: { projectId: Id<"projects"> }) => {

  const [activeView, setActiveView] = useState<"editor" | "preview">("editor")

  return (
    <div className="h-full flex flex-col">
      <nav className="h-[35px] flex items-center bg-sidebar border-b">
        <Tab
          label="Code"
          isActive={activeView === "editor"}
          onClick={() => setActiveView("editor")}
        />

        <Tab
          label="preview"
          isActive={activeView === "preview"}
          onClick={() => setActiveView("preview")}
        />
      </nav>

      <div className="flex-1 relative">
        <div className={cn(
          "absolute inset-0",
          activeView === "editor" ? "visible" : "invisible"
        )}
        >
          <div>Editor</div>
        </div>


        <div className={cn(
          "absolute inset-0",
          activeView === "preview" ? "visible" : "invisible"
        )}
        >
          <div>Preview</div>
        </div>
      </div>
    </div>
  )
}
