"use client";

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type SuggestionItem = {
  id: string;
  label: string;
  value?: string;
  icon?: ReactNode;
  className?: string;
};

export type SuggestionsProps = {
  items: SuggestionItem[];
  onSelect: (item: SuggestionItem) => void;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
};

export function Suggestions({
  items,
  onSelect,
  disabled,
  className,
  itemClassName,
}: SuggestionsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => (
        <button
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-[6px] border border-border bg-transparent px-2 text-an-foreground-muted text-sm transition-colors hover:bg-an-background-secondary/40 hover:text-an-foreground disabled:pointer-events-none disabled:opacity-50",
            itemClassName,
            item.className
          )}
          disabled={disabled}
          key={item.id}
          onClick={() => onSelect(item)}
          type="button"
        >
          {item.icon && (
            <span className="inline-flex shrink-0">{item.icon}</span>
          )}
          {item.label}
        </button>
      ))}
    </div>
  );
}
