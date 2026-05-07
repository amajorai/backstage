import { Clock, CornerDownLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { ScrollFadeEffect } from "@/components/scroll-fade-effect";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/use-editor-store";

export function HistoryPanel() {
  const { historyPast, historyFuture, jumpToHistory } = useEditorStore();
  const currentRef = useRef<HTMLDivElement>(null);

  // panel row i shows label of allEntries[i-1] (which is past[i-1].label)
  // row 0 = "Initial", row 1..N = past labels, row N+1..end = future labels
  const currentPos = historyPast.length;
  const totalEntries = historyPast.length + 1 + historyFuture.length;

  const getLabelForRow = (i: number): string => {
    if (i === 0) return "Initial";
    if (i <= historyPast.length) return historyPast[i - 1].label;
    return historyFuture[i - historyPast.length - 1].label;
  };

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentPos]);

  if (totalEntries <= 1 && historyFuture.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-neutral-500">
        <Clock size={24} />
        <p className="text-center text-xs">
          No history yet. Start editing to track changes.
        </p>
      </div>
    );
  }

  return (
    <ScrollFadeEffect className="flex flex-1 flex-col">
      {Array.from({ length: totalEntries }, (_, i) => {
        const isCurrent = i === currentPos;
        const isPast = i < currentPos;
        const label = getLabelForRow(i);

        return (
          <div
            className={cn(
              "group flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors",
              isCurrent
                ? "bg-primary/20 font-medium text-primary"
                : isPast
                  ? "text-neutral-300 hover:bg-neutral-700/50"
                  : "text-neutral-600 hover:bg-neutral-700/30"
            )}
            key={i}
            onClick={() => jumpToHistory(i)}
            ref={isCurrent ? currentRef : undefined}
          >
            <CornerDownLeft
              className={cn(
                "shrink-0",
                isCurrent ? "text-primary" : "opacity-0 group-hover:opacity-50"
              )}
              size={11}
            />
            <span className="truncate">{label}</span>
            {isCurrent && (
              <span className="ml-auto shrink-0 text-[10px] text-primary/70">
                current
              </span>
            )}
          </div>
        );
      })}
    </ScrollFadeEffect>
  );
}
