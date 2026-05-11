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

/**
 * Footer component with bottom padding for VirtuosoGrid.
 */
export function GridFooter() {
  return <div className="col-span-full h-8" />;
}

/**
 * Header component with top padding for VirtuosoGrid.
 */
export function GridHeader() {
  return <div className="col-span-full h-4" />;
}

/**
 * Default grid components configuration for VirtuosoGrid.
 */
export const gridComponents = {
  List: GridList,
  Item: GridItem,
  Footer: GridFooter,
  Header: GridHeader,
};
