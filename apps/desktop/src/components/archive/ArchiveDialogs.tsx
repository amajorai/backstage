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

interface RestoreAllArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  isProcessing: boolean;
  onConfirm: () => void;
}

export function RestoreAllArchiveDialog({
  open,
  onOpenChange,
  itemCount,
  isProcessing,
  onConfirm,
}: RestoreAllArchiveDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore everything</AlertDialogTitle>
          <AlertDialogDescription>
            This will restore all {itemCount} archived{" "}
            {itemCount === 1 ? "item" : "items"} back to your gallery.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isProcessing} onClick={onConfirm}>
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

interface RestoreSelectedArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isProcessing: boolean;
  onConfirm: () => void;
}

export function RestoreSelectedArchiveDialog({
  open,
  onOpenChange,
  selectedCount,
  isProcessing,
  onConfirm,
}: RestoreSelectedArchiveDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Restore {selectedCount} {selectedCount === 1 ? "item" : "items"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Selected {selectedCount === 1 ? "item" : "items"} will be restored
            to your gallery.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isProcessing} onClick={onConfirm}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Restoring...
              </>
            ) : (
              "Restore"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
