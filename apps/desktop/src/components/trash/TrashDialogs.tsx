import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import * as sounds from "@/lib/sounds";
import type { TrashItem } from "@/stores/use-trash-store";

interface RestoreAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  isProcessing: boolean;
  onConfirm: () => void;
}

export function RestoreAllDialog({
  open,
  onOpenChange,
  itemCount,
  isProcessing,
  onConfirm,
}: RestoreAllDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Restore everything
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will restore all {itemCount} items back to your gallery.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isProcessing}
            onClick={() => sounds.click()}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing}
            onClick={() => {
              sounds.success();
              onConfirm();
            }}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Restoring...
              </>
            ) : (
              "Restore All"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface EmptyTrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  isProcessing: boolean;
  onConfirm: () => void;
}

export function EmptyTrashDialog({
  open,
  onOpenChange,
  itemCount,
  isProcessing,
  onConfirm,
}: EmptyTrashDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Empty Trash
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all {itemCount} items in the trash.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isProcessing}
            onClick={() => sounds.click()}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isProcessing}
            onClick={() => {
              sounds.delete_();
              onConfirm();
            }}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Emptying...
              </>
            ) : (
              "Empty Trash"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TrashItem | null;
  onConfirm: () => void;
}

export function DeleteItemDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
}: DeleteItemDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
          <AlertDialogDescription>
            "{item?.name}" will be permanently deleted. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => sounds.click()}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              sounds.delete_();
              onConfirm();
            }}
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteSelectedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isProcessing: boolean;
  onConfirm: () => void;
}

export function DeleteSelectedDialog({
  open,
  onOpenChange,
  selectedCount,
  isProcessing,
  onConfirm,
}: DeleteSelectedDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Permanently delete {selectedCount} items
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {selectedCount} selected{" "}
            {selectedCount === 1 ? "item" : "items"}. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isProcessing}
            onClick={() => sounds.click()}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isProcessing}
            onClick={() => {
              sounds.delete_();
              onConfirm();
            }}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Permanently"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
