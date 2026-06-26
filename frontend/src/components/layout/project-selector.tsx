'use client';

import { useState } from 'react';
import { Check, ChevronDown, Plus, FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore } from '@/stores/project-store';
import type { DashboardProject } from '@/types/project';

export function ProjectSelector() {
  const [open, setOpen] = useState(false);
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 text-sm font-normal"
        >
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[140px] truncate">
            {currentProject?.name || 'Select Project'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Projects
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No projects yet
          </div>
        ) : (
          projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => setCurrentProject(project)}
              className={cn(
                'flex items-center justify-between',
                currentProject?.id === project.id && 'bg-accent/10'
              )}
            >
              <span className="truncate">{project.name}</span>
              {currentProject?.id === project.id && (
                <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />
              )}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
          }}
          className="text-primary gap-2"
        >
          <Plus className="h-4 w-4" />
          New Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
