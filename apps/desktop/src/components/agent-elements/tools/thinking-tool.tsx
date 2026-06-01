import { memo } from "react";
import { useToolComplete } from "../hooks/use-tool-complete";
import type { StepState, TimelineStep } from "../types/timeline";
import {
  mapToolInvocationToStep,
  mapToolStateToStepState,
} from "../utils/tool-adapters";
import { ToolRowBase } from "./tool-row-base";

export type ThinkingCollapsedProps = {
  step: Extract<TimelineStep, { type: "tool-call" }>;
  state: StepState;
  onComplete: () => void;
  defaultOpen?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

export function ThinkingCollapsed({
  step,
  state,
  onComplete,
  defaultOpen,
  expanded,
  onToggleExpand,
}: ThinkingCollapsedProps) {
  useToolComplete(state === "animating", step.duration, onComplete);

  return (
    <ToolRowBase
      completeLabel="Thought"
      defaultOpen={defaultOpen}
      expandable={!!step.thoughtContent}
      expanded={expanded}
      isAnimating={state === "animating"}
      onToggleExpand={onToggleExpand}
      shimmerLabel="Thinking"
    >
      <div className="max-h-[175px] overflow-y-auto">
        <p className="whitespace-pre-wrap text-muted-foreground text-sm">
          {step.thoughtContent}
        </p>
      </div>
    </ToolRowBase>
  );
}

export type ThinkingToolProps = {
  part?: any;
  step?: Extract<TimelineStep, { type: "tool-call" }>;
  state?: StepState;
  onComplete?: () => void;
  defaultOpen?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

export const ThinkingTool = memo(function ThinkingTool({
  part,
  step: externalStep,
  state: externalState,
  onComplete: externalOnComplete,
  defaultOpen,
  expanded,
  onToggleExpand,
}: ThinkingToolProps) {
  let step: Extract<TimelineStep, { type: "tool-call" }>;
  let stepState: StepState;
  let onComplete: () => void;

  if (externalStep && externalState && externalOnComplete) {
    step = externalStep;
    stepState = externalState;
    onComplete = externalOnComplete;
  } else if (part) {
    step = mapToolInvocationToStep(part.toolCallId ?? part.id ?? "thinking", {
      toolName: "Thinking",
      args: part.input ?? part.args ?? {},
      state:
        part.state === "output-available"
          ? "result"
          : part.state === "input-streaming"
            ? "partial-call"
            : "call",
      result: part.output ?? part.result,
    });
    stepState = mapToolStateToStepState(
      part.state === "output-available"
        ? "result"
        : part.state === "input-streaming"
          ? "partial-call"
          : "call"
    );
    onComplete = () => {};
  } else {
    return null;
  }

  return (
    <ThinkingCollapsed
      defaultOpen={defaultOpen}
      expanded={expanded}
      onComplete={onComplete}
      onToggleExpand={onToggleExpand}
      state={stepState}
      step={step}
    />
  );
});
