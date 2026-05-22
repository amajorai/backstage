import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { CheckCircle2, ChevronDown, Loader2, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { useBackgroundRemovalQueue } from "@/stores/use-background-removal-queue";

export function BackgroundRemovalQueue() {
  const queue = useBackgroundRemovalQueue((s) => s.queue);
  const removeFromQueue = useBackgroundRemovalQueue((s) => s.removeFromQueue);
  const clearCompleted = useBackgroundRemovalQueue((s) => s.clearCompleted);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // Show component only when there are items in the queue
  useEffect(() => {
    if (queue.length > 0) {
      setIsVisible(true);
      // Auto-expand if new items are added
      if (queue.some((i) => i.status === "pending")) {
        setIsExpanded(true);
      }
    } else {
      // Hide after a delay if empty
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [queue]);

  if (!isVisible && queue.length === 0) {
    return null;
  }

  const pendingCount = queue.filter(
    (i) => i.status === "pending" || i.status === "processing"
  ).length;
  const completedCount = queue.filter((i) => i.status === "done").length;
  const errorCount = queue.filter((i) => i.status === "error").length;

  return (
    <div className="fixed right-4 bottom-20 z-50 flex w-80 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl transition-all">
      <div className="flex items-center justify-between border-b bg-muted/50 p-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Processing Queue</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
            {pendingCount} pending
          </span>
        </div>
        <div className="flex gap-1">
          {queue.length > 0 && (completedCount > 0 || errorCount > 0) && (
            <Button
              className="h-6 w-6"
              onClick={() => {
                sounds.click();
                clearCompleted();
              }}
              size="icon-sm"
              title="Clear finished"
              variant="ghost"
            >
              <X className="size-3" />
            </Button>
          )}
          <Button
            className="h-6 w-6"
            onClick={() => {
              sounds.click();
              setIsExpanded(!isExpanded);
            }}
            size="icon-sm"
            title={isExpanded ? "Collapse" : "Expand"}
            variant="ghost"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                !isExpanded && "rotate-180"
              )}
            />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <ScrollArea className="max-h-60">
          <div className="flex flex-col gap-1 p-2">
            {queue.map((item) => (
              <div
                className="group flex items-center justify-between gap-2 rounded-md p-2 transition-colors hover:bg-muted/50"
                key={item.id}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {item.status === "pending" && (
                    <div className="flex size-4 items-center justify-center rounded-full border-2 border-muted-foreground/30" />
                  )}
                  {item.status === "processing" && (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  )}
                  {item.status === "done" && (
                    <CheckCircle2 className="size-4 text-green-500" />
                  )}
                  {item.status === "error" && (
                    <XCircle className="size-4 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <span className="block truncate text-sm">{item.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {item.operation === "add-color-bg"
                        ? `Add background${item.color ? ` (${item.color})` : ""}`
                        : item.status === "processing" && item.stage
                          ? item.stage
                          : "Remove background"}
                    </span>
                  </div>
                </div>
                {item.status !== "processing" && (
                  <Button
                    className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => {
                      sounds.click();
                      removeFromQueue(item.id);
                    }}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
