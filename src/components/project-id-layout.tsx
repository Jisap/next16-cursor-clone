"use client"

import { Navbar } from "@/features/projects/components/navbar";
import { Id } from "../../convex/_generated/dataModel";



export const ProjectIdLayout = ({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId: Id<"projects">;  
}) => {
  return (
    <div className="w-full h-screen flex flex-col">
      <Navbar projectId={projectId} />
      {children}
    </div>
  )
}
