"use client"

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { SparkleIcon } from "lucide-react";
import { Poppins } from "next/font/google";
import { FaGithub } from "react-icons/fa"
import { ProjectstList } from "./projects-lists";
import { useEffect, useState } from "react";
import { ProjectsCommandDialog } from "./projects-command-dialog";
import { ImportGithubDialog } from "./import-github-dialog";
import { NewProjectDialog } from "./new-project-dialog";


const font = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
})

export const ProjectsView = () => {

  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setCommandDialogOpen(true)
      }
      if (event.key === "i" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setImportDialogOpen(true);
      }
      if (event.key === "j" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setNewProjectDialogOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])



  return (
    <>
      <ProjectsCommandDialog
        open={commandDialogOpen}
        onOpenChange={setCommandDialogOpen}
      />

      <ImportGithubDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      <NewProjectDialog
        open={newProjectDialogOpen}
        onOpenChange={setNewProjectDialogOpen}
      />


      <div className='min-h-screen bg-sidebar flex flex-col items-center justify-center p-6 md:p-16'>
        <div className='w-full max-w-sm mx-auto flex flex-col gap-4 items-center'>
          <div className='flex justify-between gap-4 w-full items-center'>
            <div className='flex items-center gap-2 w-full group/logo'>
              <img src="/logo.svg" alt="logo" className='size-[32px] md:size-[46px]' />

              <h1 className={cn(
                " text-4xl md:text-5xl font-semibold",
                font.className
              )}
              >
                Polaris
              </h1>
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setNewProjectDialogOpen(true)}
                className="h-full items-start p-4 bg-background border flex flex-col gap-6 rounded-none"
              >
                <div className="flex items-center justify-between w-full">
                  <SparkleIcon className="size-4" />

                  <Kbd className="bg-accent border">
                    Ctrl + J
                  </Kbd>
                </div>

                <div>
                  <span className="text-sm">
                    New
                  </span>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
                className="h-full items-start p-4 bg-background border flex flex-col gap-6 rounded-none"
              >
                <div className="flex items-center justify-between w-full">
                  <FaGithub className="size-4" />

                  <Kbd className="bg-accent border">
                    Ctrl + I
                  </Kbd>
                </div>

                <div>
                  <span className="text-sm">
                    Import
                  </span>
                </div>
              </Button>
            </div>

            <ProjectstList onViewAll={() => setCommandDialogOpen(true)} />
          </div>
        </div>
      </div>
    </>
  )
}
