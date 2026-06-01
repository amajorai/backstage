import { memo } from "react";
import { useToolComplete } from "../hooks/use-tool-complete";
import { TextShimmer } from "../text-shimmer";
import type { StepState, TimelineStep } from "../types/timeline";
import {
  mapToolInvocationToStep,
  mapToolStateToStepState,
} from "../utils/tool-adapters";
import { type ToolApproval, ToolApprovalFooter } from "./tool-approval-footer";

function extractCommandSummary(cmd: string): string {
  return cmd
    .split("|")
    .map((s) => s.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
}

export type BashToolTerminalCardProps = {
  step: Extract<TimelineStep, { type: "tool-call" }>;
  state: StepState;
  onComplete: () => void;
  approval?: ToolApproval;
};

export function BashToolTerminalCard({
  step,
  state,
  onComplete,
  approval,
}: BashToolTerminalCardProps) {
  useToolComplete(state === "animating", step.duration, onComplete);
  const isPending = state === "animating";
  const command = step.bashCommand ?? step.toolDetail;
  const summary = extractCommandSummary(command);

  return (
    <div className="overflow-hidden rounded-an-tool-border-radius border border-border bg-an-tool-background">
      <div className="flex h-7 items-center justify-between pr-2 pl-2.5">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {isPending ? (
            <TextShimmer
              as="span"
              className="m-0 inline-flex h-full items-center truncate text-xs leading-none"
              duration={1.2}
            >
              Running command: {summary}
            </TextShimmer>
          ) : (
            <span className="truncate text-muted-foreground text-xs">
              Ran command: {summary}
            </span>
          )}
        </div>
        {isPending && (
          <svg
            className="h-3 w-3 shrink-0 animate-spin text-muted-foreground"
            fill="none"
            viewBox="0 0 16 16"
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeDasharray="28"
              strokeDashoffset="7"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </div>
      <div className="overflow-hidden border-border border-t bg-background px-2.5 py-1.5 font-mono text-[12px] leading-[16px]">
        <div className="break-all">
          <span className="select-none text-amber-600 dark:text-amber-400">
            ${" "}
          </span>
          <span className="text-foreground">{command}</span>
        </div>
        {!isPending && step.bashOutput && (
          <div className="mt-1 max-h-[80px] overflow-hidden whitespace-pre-line text-muted-foreground">
            {step.bashOutput}
          </div>
        )}
      </div>
      {approval && <ToolApprovalFooter isPending={isPending} {...approval} />}
    </div>
  );
}

export type BashToolProps = {
  part: any;
};

export const BashTool = memo(function BashTool({ part }: BashToolProps) {
  const approval = (part.input?.approval ?? part.args?.approval) as
    | ToolApproval
    | undefined;
  const step = mapToolInvocationToStep(part.toolCallId ?? part.id ?? "bash", {
    toolName: "Bash",
    args: part.input ?? part.args ?? {},
    state:
      part.state === "output-available"
        ? "result"
        : part.state === "input-streaming"
          ? "partial-call"
          : "call",
    result: part.output ?? part.result,
  });
  const stepState = mapToolStateToStepState(
    part.state === "output-available"
      ? "result"
      : part.state === "input-streaming"
        ? "partial-call"
        : "call"
  );
  const noop = () => {};

  return (
    <BashToolTerminalCard
      approval={approval}
      onComplete={noop}
      state={stepState}
      step={step}
    />
  );
});
