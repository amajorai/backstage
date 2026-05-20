import { Button, buttonVariants } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { GitBranch, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import * as sounds from "@/lib/sounds";
import { useAiProjectStore } from "@/stores/use-ai-project-store";

interface AiProjectsGalleryProps {
  onOpenProject: (id: string) => void;
}

export function AiProjectsGallery({ onOpenProject }: AiProjectsGalleryProps) {
  const { projects, isLoaded, load, createProject, removeProject } =
    useAiProjectStore();

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  const handleNew = async () => {
    sounds.click();
    const id = await createProject();
    onOpenProject(id);
  };

  const handleDelete = async (id: string) => {
    sounds.click();
    await removeProject(id);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-border border-b px-4">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-muted-foreground" />
          <span className="font-medium text-sm">AI Sessions</span>
        </div>
        <Button onClick={handleNew} size="sm" variant="default">
          <Plus className="mr-1.5 size-3.5" />
          New Session
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoaded ? (
          projects.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
              <GitBranch className="size-12 opacity-20" />
              <div className="text-center">
                <p className="font-medium text-sm">No AI sessions yet</p>
                <p className="mt-1 text-xs">
                  Create a new session to start generating and branching images.
                </p>
              </div>
              <Button onClick={handleNew} size="sm" variant="outline">
                <Plus className="mr-1.5 size-3.5" />
                Create first session
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {projects.map((project) => (
                <div
                  className="group relative cursor-pointer rounded-xl border-2 border-border bg-background p-3 transition-all hover:border-primary/40 hover:shadow-md"
                  key={project.id}
                  onClick={() => {
                    sounds.click();
                    onOpenProject(project.id);
                  }}
                >
                  {/* Placeholder preview */}
                  <div className="mb-2 flex aspect-video items-center justify-center rounded-lg bg-muted">
                    <GitBranch className="size-8 text-muted-foreground/30" />
                  </div>

                  <p className="truncate font-medium text-sm">{project.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(project.updatedAt, {
                      addSuffix: true,
                    })}
                  </p>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={`${buttonVariants({ variant: "ghost", size: "icon-sm" })} absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project.id);
                        }}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex h-32 items-center justify-center">
            <div className="size-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
