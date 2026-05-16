import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchHistoryDropdownProps {
  items: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
}

export function SearchHistoryDropdown({
  items,
  onSelect,
  onRemove,
  onClearAll,
}: SearchHistoryDropdownProps) {
  if (items.length === 0) return null;

  return (
    <div className="absolute right-0 bottom-full left-0 mb-1.5 rounded-lg border border-border bg-popover shadow-lg">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
          Recent
        </span>
        <Button
          className="h-auto p-0 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={onClearAll}
          type="button"
          variant="ghost"
        >
          Clear all
        </Button>
      </div>
      <ul className="pb-1">
        {items.map((item) => (
          <li className="flex items-center px-2" key={item}>
            <button
              className="flex flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => onSelect(item)}
              type="button"
            >
              <Clock className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{item}</span>
            </button>
            <button
              className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item);
              }}
              type="button"
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
