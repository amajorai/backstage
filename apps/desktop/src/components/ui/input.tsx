import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({
  className,
  type,
  onWheel,
  ...props
}: React.ComponentProps<"input">) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const propsRef = React.useRef({ type, onWheel, ...props });
  propsRef.current = { type, onWheel, ...props };

  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      const p = propsRef.current;
      if (p.type !== "number" || !p.onChange) {
        p.onWheel?.(e as unknown as React.WheelEvent<HTMLInputElement>);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const step = Number(p.step) || 1;
      const min =
        p.min !== undefined ? Number(p.min) : Number.NEGATIVE_INFINITY;
      const max =
        p.max !== undefined ? Number(p.max) : Number.POSITIVE_INFINITY;
      const current = Number(p.value) || 0;
      const multiplier = e.ctrlKey ? 10 : e.altKey ? 0.1 : 1;
      const effectiveStep = step * multiplier;
      const delta = e.deltaY < 0 ? effectiveStep : -effectiveStep;
      const raw = Math.min(max, Math.max(min, current + delta));
      const precision =
        effectiveStep < 1 ? Math.ceil(-Math.log10(effectiveStep)) : 0;
      const newVal = Number.parseFloat(raw.toFixed(precision));
      const fakeEvent = {
        target: { value: String(newVal) },
        currentTarget: { value: String(newVal) },
      } as React.ChangeEvent<HTMLInputElement>;
      p.onChange(fakeEvent);
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <InputPrimitive
      className={cn(
        "h-8 w-full min-w-0 rounded-lg bg-muted px-2.5 py-1 text-base outline-none transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:disabled:bg-input/80",
        className
      )}
      data-slot="input"
      ref={inputRef}
      type={type}
      {...props}
    />
  );
}

export { Input };
