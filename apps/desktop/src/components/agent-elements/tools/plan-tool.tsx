import {
  IconChevronsDown,
  IconChevronsUp,
  IconFileDescription,
} from "@tabler/icons-react";
import { memo, useState } from "react";
import { IconSpinner } from "../icons";
import { Markdown } from "../markdown";
import { cn } from "../utils/cn";
import { areToolPropsEqual, getToolStatus } from "../utils/format-tool";

export type Plan = {
  id?: string;
  title: string;
  summary?: string;
};

export type PlanToolProps = {
  part: {
    type: string;
    toolCallId?: string;
    state?: string;
    input?: {
      plan?: Plan;
      onApprove?: () => void;
      approveLabel?: string;
      approved?: boolean;
    };
  };
  chatStatus?: string;
};

function getPlanFileName(plan: Plan) {
  const rawId = plan.id?.trim();
  if (!rawId) return "plan-working.md";
  if (rawId.endsWith(".md")) return rawId;
  return `plan-${rawId}.md`;
}

export const PlanTool = memo(function PlanTool({
  part,
  chatStatus,
}: PlanToolProps) {
  const { isPending } = getToolStatus(part, chatStatus);
  const plan = part.input?.plan;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  if (!plan) return null;

  const fileName = getPlanFileName(plan);
  const summary = plan.summary?.trim() ?? "";
  const hasSummary = summary.length > 0;

  const approveLabel = part.input?.approveLabel ?? "Approve";
  const isAlreadyApproved = part.input?.approved || isApproved;
  const approveText = isAlreadyApproved ? "Approved" : approveLabel;

  const handleApprove = () => {
    if (isAlreadyApproved) return;
    setIsApproved(true);
    if (typeof part.input?.onApprove === "function") {
      part.input.onApprove();
    }
  };

  return (
    <div className="an-tool-plan overflow-hidden rounded-an-tool-border-radius border border-border bg-an-tool-background">
      <div className="flex h-7 items-center justify-between pr-2.5 pl-3">
        <div className="flex min-w-0 items-center gap-1">
          {isPending ? (
            <IconSpinner className="h-3 w-3 shrink-0 animate-spin text-an-tool-color-muted" />
          ) : (
            <IconFileDescription className="h-3.5 w-3.5 shrink-0 text-an-tool-color-muted" />
          )}
          <span className="truncate text-an-tool-color-muted text-xs">
            {fileName}
          </span>
        </div>
        <button
          aria-label={isExpanded ? "Collapse plan" : "Expand plan"}
          className="inline-flex size-5 items-center justify-center text-an-tool-color-muted"
          onClick={() => setIsExpanded((prev) => !prev)}
          type="button"
        >
          {isExpanded ? (
            <IconChevronsUp className="h-3.5 w-3.5" />
          ) : (
            <IconChevronsDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="border-border border-t bg-background pt-2">
        <div className="space-y-1.5">
          <div className="px-3 text-an-tool-color text-sm">{plan.title}</div>

          {hasSummary ? (
            <div className="relative">
              <div
                className={cn(
                  "px-3",
                  "text-an-tool-color-muted text-sm",
                  !isExpanded && "max-h-[94px] overflow-hidden"
                )}
              >
                <Markdown className="text-sm" content={summary} />
              </div>

              {!isExpanded && (
                <div className="absolute inset-x-0 bottom-0 h-16 pr-2 pb-2 pl-3.5">
                  <div className="absolute inset-x-0 bottom-0 h-full w-full bg-linear-to-b from-0% from-transparent to-50% to-background" />
                  <div className="relative flex h-full items-end justify-between">
                    <button
                      className="-mx-2 h-5 rounded-[4px] px-1.5 text-muted-foreground text-xs hover:text-an-tool-color"
                      onClick={() => setIsExpanded(true)}
                      type="button"
                    >
                      Read detailed plan
                    </button>
                    {!isAlreadyApproved && (
                      <button
                        className="h-5 rounded-[4px] bg-an-primary-color px-1.5 font-medium text-an-send-button-color text-xs transition-[background-color,transform] duration-150 hover:bg-an-primary-color/90 active:scale-[0.98]"
                        onClick={handleApprove}
                        type="button"
                      >
                        {approveText}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-an-tool-color-muted text-xs">
              No plan summary provided.
            </div>
          )}
        </div>

        {(isExpanded || !hasSummary) && (
          <div className="mt-2 flex items-center justify-between border-border border-t bg-an-tool-background pt-1.5 pr-2 pb-2 pl-3.5">
            <button
              className="-mx-2 h-5 rounded-[4px] px-1.5 text-muted-foreground text-xs hover:text-an-tool-color"
              onClick={() => setIsExpanded((prev) => !prev)}
              type="button"
            >
              {isExpanded ? "Hide detailed plan" : "Read detailed plan"}
            </button>
            {!isAlreadyApproved && (
              <button
                className="h-5 rounded-[4px] bg-an-primary-color px-1.5 font-medium text-an-send-button-color text-xs transition-[background-color,transform] duration-150 hover:bg-an-primary-color/90 active:scale-[0.98]"
                onClick={handleApprove}
                type="button"
              >
                {approveText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}, areToolPropsEqual);
