import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Stable grid list component for VirtuosoGrid.
 * MUST be defined outside the parent component to prevent remounting.
 */
export const GridList = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ children, style, className, ...props }, ref) => (
  <div
    ref={ref}
    style={style}
    {...props}
    className={cn("grid gap-4 px-4 pt-4 pb-4", className)}
  >
    {children}
  </div>
));
GridList.displayName = "GridList";

/**
 * Stable grid item component for VirtuosoGrid.
 * MUST be defined outside the parent component to prevent remounting.
 */
export const GridItem = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
GridItem.displayName = "GridItem";

export function GridFooter() {
  return <div className="col-span-full h-8" />;
}

export function GridHeader() {
  return <div className="col-span-full h-4" />;
}

/** Taller header used when the folder bar is visible — matches h-10 bar height. */
export function GridHeaderWithFolderBar() {
  return <div className="col-span-full h-14" />;
}

export const gridComponents = {
  List: GridList,
  Item: GridItem,
  Footer: GridFooter,
  Header: GridHeader,
};

export const gridComponentsWithFolderBar = {
  List: GridList,
  Item: GridItem,
  Footer: GridFooter,
  Header: GridHeaderWithFolderBar,
};
