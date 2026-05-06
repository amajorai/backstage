"use client";

import * as TagsInputPrimitive from "@diceui/tags-input";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

function TagsInput({
  className,
  ...props
}: React.ComponentProps<typeof TagsInputPrimitive.Root>) {
  return (
    <TagsInputPrimitive.Root
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function TagsInputLabel({
  className,
  ...props
}: React.ComponentProps<typeof TagsInputPrimitive.Label>) {
  return (
    <TagsInputPrimitive.Label
      className={cn("font-medium text-sm leading-none", className)}
      {...props}
    />
  );
}

function TagsInputItem({
  className,
  ...props
}: React.ComponentProps<typeof TagsInputPrimitive.Item>) {
  return (
    <TagsInputPrimitive.Item
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-input bg-secondary px-2 font-medium text-secondary-foreground text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 data-[disabled]:cursor-not-allowed data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function TagsInputItemText({
  className,
  ...props
}: React.ComponentProps<typeof TagsInputPrimitive.ItemText>) {
  return (
    <TagsInputPrimitive.ItemText className={cn("", className)} {...props} />
  );
}

function TagsInputItemDelete({
  className,
  ...props
}: React.ComponentProps<typeof TagsInputPrimitive.ItemDelete>) {
  return (
    <TagsInputPrimitive.ItemDelete
      className={cn(
        "-mr-1 flex size-4 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none",
        className
      )}
      {...props}
    >
      <X className="size-3" />
    </TagsInputPrimitive.ItemDelete>
  );
}

function TagsInputInput({
  className,
  ...props
}: React.ComponentProps<typeof TagsInputPrimitive.Input>) {
  return (
    <TagsInputPrimitive.Input
      className={cn(
        "min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function TagsInputClear({
  className,
  ...props
}: React.ComponentProps<typeof TagsInputPrimitive.Clear>) {
  return (
    <TagsInputPrimitive.Clear
      className={cn(
        "ml-auto flex h-6 items-center justify-center rounded-md px-2 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      {...props}
    />
  );
}

export {
  TagsInput,
  TagsInputLabel,
  TagsInputItem,
  TagsInputItemText,
  TagsInputItemDelete,
  TagsInputInput,
  TagsInputClear,
};
