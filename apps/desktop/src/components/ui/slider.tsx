"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const [localValues, setLocalValues] = React.useState(
    props.value || props.defaultValue || [0]
  );

  React.useEffect(() => {
    if (props.value) {
      setLocalValues(props.value);
    }
  }, [props.value]);

  const rootRef = React.useRef<HTMLSpanElement>(null);
  const propsRef = React.useRef(props);
  propsRef.current = props;
  const localValuesRef = React.useRef(localValues);
  localValuesRef.current = localValues;

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const p = propsRef.current;
      const step = typeof p.step === "number" ? p.step : 1;
      const min = typeof p.min === "number" ? p.min : 0;
      const max = typeof p.max === "number" ? p.max : 100;
      const current = (p.value ?? localValuesRef.current)?.[0] ?? 0;
      const multiplier = e.ctrlKey ? 10 : e.altKey ? 0.1 : 1;
      const effectiveStep = step * multiplier;
      const delta = e.deltaY < 0 ? effectiveStep : -effectiveStep;
      const raw = Math.min(max, Math.max(min, current + delta));
      const precision =
        effectiveStep < 1 ? Math.ceil(-Math.log10(effectiveStep)) : 0;
      const newVal = Number.parseFloat(raw.toFixed(precision));
      setLocalValues([newVal]);
      p.onValueChange?.([newVal]);
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      ref={(node) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/10">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {(Array.isArray(props.value || props.defaultValue)
        ? props.value || props.defaultValue
        : [0])!.map((_, i) => (
        <SliderPrimitive.Thumb
          className="block h-3 w-3 rounded-full border-2 border-primary bg-primary ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          key={i}
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
