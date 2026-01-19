"use client"

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { ChevronRightIcon, CopyMinusIcon, FilePlusCornerIcon, FolderPlusIcon } from 'lucide-react'
import React, { useState } from 'react'
import { Id } from '../../../../../convex/_generated/dataModel'
import { useProject } from '../../hooks/use-projects'
import { Button } from '@/components/ui/button'

export const FileExplorer = ({ projectId }:{projectId: Id<"projects">}) => {

  const [isOpen, setIsOpen] = useState(false);
  const [collapseKey, setCollapseKey] = useState(0);
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);


  const project = useProject(projectId);
  if(!project) return null;


  return (
    <div className='h-full bg-sidebar'>
      <ScrollArea>
        <div 
          role="button"
          onClick={() => setIsOpen((value) => !value)}
          className='group/project cursor-pointer w-full text-left flex items-center gap-0.5 h-[22px] bg-accent font-bold'
        >
          <ChevronRightIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground",
              isOpen && "rotate-90"
            )}  
          />

          <p className='text-sm uppercase line-clamp-1'>
            {project?.name ?? "Loading..."}
          </p>

          <div className='opacity-0 group-hover/project:opacity-100 transition-none duration-0 flex items-center gap-0.5 ml-auto'>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault()
                setIsOpen(true);
                // Set creating file
              }}
              variant="highlight"
              size="icon-xs"
            >
              <FilePlusCornerIcon className="size-3.5" />
            </Button>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault()
                setIsOpen(true);
                // Set creating folder
              }}
              variant="highlight"
              size="icon-xs"
            >
              <FolderPlusIcon className="size-3.5" />
            </Button>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault()
                setCollapseKey((prev) => prev + 1);
              }}
              variant="highlight"
              size="icon-xs"
            >
              <CopyMinusIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
