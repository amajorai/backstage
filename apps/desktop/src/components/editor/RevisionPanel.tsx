import { Clock, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ScrollFadeEffect } from "@/components/scroll-fade-effect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/use-editor-store";
import { useRevisionStore } from "@/stores/use-revision-store";

interface RevisionPanelProps {
  projectId: string;
  onRestored: () => void;
}

export function RevisionPanel({ projectId, onRestored }: RevisionPanelProps) {
  const { revisions, isLoading, restoreRevision, deleteRevision } =
    useRevisionStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const handleRestore = async (revId: string) => {
    const pages = await restoreRevision(revId, projectId);
    if (!pages) {
      toast.error("Failed to load revision");
      return;
    }
    useEditorStore.setState({
      pages,
      activePageIndex: 0,
      layers: pages[0]?.layers ?? [],
      activeLayerIds: [],
    });
    useEditorStore.getState().pushHistory("Restore revision");
    toast.success("Revision restored");
    onRestored();
  };

  const handleDelete = async (revId: string) => {
    await deleteRevision(revId, projectId);
    toast.success("Revision deleted");
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-neutral-500 text-xs">
        Loading…
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-neutral-500">
        <Clock size={24} />
        <p className="text-center text-xs">
          No saved revisions yet. Save your project to create a checkpoint.
        </p>
      </div>
    );
  }

  return (
    <>
      <ScrollFadeEffect className="flex flex-1 flex-col p-1.5">
        <div className="flex flex-col gap-1">
          {revisions.map((rev, i) => {
            const isLatest = i === 0;
            return (
              <div
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
                  isLatest
                    ? "bg-primary/20 font-medium text-primary"
                    : "text-neutral-300 hover:bg-neutral-700/50"
                )}
                key={rev.id}
              >
                <Clock
                  className={cn(
                    "shrink-0",
                    isLatest ? "text-primary" : "text-primary/50"
                  )}
                  size={11}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{rev.name}</p>
                </div>
                {isLatest && (
                  <span className="shrink-0 text-[10px] text-primary/70">
                    latest
                  </span>
                )}
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    className="h-5 w-5 text-primary/70 hover:bg-transparent hover:text-primary"
                    onClick={() => setConfirmRestoreId(rev.id)}
                    size="icon"
                    title="Restore this revision"
                    type="button"
                    variant="ghost"
                  >
                    <RotateCcw size={10} />
                  </Button>
                  <Button
                    className="h-5 w-5 text-neutral-400 hover:bg-transparent hover:text-red-400"
                    onClick={() => setConfirmDeleteId(rev.id)}
                    size="icon"
                    title="Delete this revision"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 size={10} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollFadeEffect>

      <AlertDialog
        onOpenChange={(open) => !open && setConfirmRestoreId(null)}
        open={!!confirmRestoreId}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Revision</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current canvas with the selected revision.
              Unsaved changes will be lost (but this action is undoable).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRestoreId) handleRestore(confirmRestoreId);
                setConfirmRestoreId(null);
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        open={!!confirmDeleteId}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Revision</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete this revision checkpoint? This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteId) handleDelete(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
