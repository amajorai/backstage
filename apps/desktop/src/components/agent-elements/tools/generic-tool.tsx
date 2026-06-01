import type React from "react";
import { memo } from "react";
import { useToolComplete } from "../hooks/use-tool-complete";
import type { StepState, TimelineStep } from "../types/timeline";
import { ToolRowBase } from "./tool-row-base";

export type GenericToolRowProps = {
  step: Extract<TimelineStep, { type: "tool-call" }>;
  state: StepState;
  onComplete: () => void;
};

export function GenericToolRow({
  step,
  state,
  onComplete,
}: GenericToolRowProps) {
  useToolComplete(state === "animating", step.duration, onComplete);
  const isPending = state === "animating";

  return (
    <ToolRowBase
      completeLabel={step.toolName}
      detail={step.toolDetail}
      isAnimating={isPending}
      shimmerLabel={step.toolName}
    />
  );
}

export type GenericToolProps = {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  isPending: boolean;
  isError?: boolean;
};

export const GenericTool = memo(function GenericTool({
  icon,
  title,
  subtitle,
  isPending,
}: GenericToolProps) {
  const Icon = icon;

  return (
    <ToolRowBase
      completeLabel={title}
      detail={subtitle}
      icon={
        Icon ? (
          <Icon className="h-full w-full shrink-0 text-muted-foreground" />
        ) : undefined
      }
      isAnimating={isPending}
      shimmerLabel={title}
    />
  );
});
