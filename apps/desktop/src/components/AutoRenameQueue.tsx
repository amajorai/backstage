import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAutoRenameQueue } from "@/stores/use-auto-rename-queue";

export function AutoRenameQueue() {
  const queue = useAutoRenameQueue((s) => s.queue);
  const removeFromQueue = useAutoRenameQueue((s) => s.removeFromQueue);
  const clearCompleted = useAutoRenameQueue((s) => s.clearCompleted);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (queue.length > 0) {
      setIsVisible(true);
      if (queue.some((i) => i.status === "pending")) {
        setIsExpanded(true);
      }
    } else {
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
          <Sparkles className="size-3.5 text-primary" />
          <span className="font-medium text-sm">Auto Rename</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
            {pendingCount} pending
          </span>
        </div>
        <div className="flex gap-1">
          {queue.length > 0 && (completedCount > 0 || errorCount > 0) && (
            <Button
              className="h-6 w-6"
              onClick={clearCompleted}
              size="icon-sm"
              title="Clear finished"
              variant="ghost"
            >
              <X className="size-3" />
            </Button>
          )}
          <Button
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
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
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {item.status === "pending" && (
                    <div className="flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30" />
                  )}
                  {item.status === "processing" && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                  )}
                  {item.status === "done" && (
                    <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                  )}
                  {item.status === "error" && (
                    <XCircle className="size-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {item.result ?? item.name}
                    </p>
                    {item.status === "done" && item.result && (
                      <p className="truncate text-muted-foreground text-xs">
                        was: {item.name}
                      </p>
                    )}
                    {item.status === "error" && (
                      <p className="truncate text-destructive text-xs">
                        {item.error}
                      </p>
                    )}
                  </div>
                </div>
                {item.status !== "processing" && (
                  <Button
                    className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeFromQueue(item.id)}
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
