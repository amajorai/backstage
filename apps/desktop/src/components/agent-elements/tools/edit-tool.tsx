import { type FileContents, MultiFileDiff } from "@pierre/diffs/react";
import { IconChevronDown } from "@tabler/icons-react";
import React, { memo } from "react";
import { useToolComplete } from "../hooks/use-tool-complete";
import { FileExtIcon } from "../icons/file-ext-icon";
import { TextShimmer } from "../text-shimmer";
import type { StepState, TimelineStep } from "../types/timeline";
import {
  mapToolInvocationToStep,
  mapToolStateToStepState,
} from "../utils/tool-adapters";
import { type ToolApproval, ToolApprovalFooter } from "./tool-approval-footer";

export type EditToolDiffCardProps = {
  step: Extract<TimelineStep, { type: "tool-call" }>;
  state: StepState;
  onComplete: () => void;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  isCollapsible?: boolean;
  approval?: ToolApproval;
};

export function EditToolDiffCard({
  step,
  state,
  onComplete,
  input,
  output,
  isCollapsible = false,
  approval,
}: EditToolDiffCardProps) {
  useToolComplete(state === "animating", step.duration, onComplete);
  const isPending = state === "animating";
  const fileName = step.filePath?.split("/").pop() ?? step.toolDetail;
  const hasFileName = Boolean(fileName);
  const isWrite = step.toolName === "Write";
  const [themeType, setThemeType] = React.useState<"light" | "dark">("light");
  const [isExpanded, setIsExpanded] = React.useState(!isCollapsible);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setThemeType(isDark ? "dark" : "light");
    };
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    setIsExpanded(!isCollapsible);
  }, [isCollapsible]);

  const diffFiles = React.useMemo(() => {
    const fileLabel = fileName || "file";
    const oldFromOutput =
      typeof output?.old_content === "string" ? output.old_content : undefined;
    const newFromOutput =
      typeof output?.content === "string" ? output.content : undefined;
    const oldFromInput =
      !oldFromOutput && typeof input?.old_string === "string"
        ? input.old_string
        : undefined;
    const newFromInput =
      !newFromOutput && typeof input?.new_string === "string"
        ? input.new_string
        : undefined;

    const fallbackOld = step.diffLines
      ?.filter((line) => line.type !== "add")
      .map((line) => line.content)
      .join("\n");
    const fallbackNew = step.diffLines
      ?.filter((line) => line.type !== "remove")
      .map((line) => line.content)
      .join("\n");

    const oldContents = oldFromInput ?? oldFromOutput ?? fallbackOld ?? "";
    const newContents = newFromInput ?? newFromOutput ?? fallbackNew ?? "";

    if (!(oldContents || newContents)) return null;

    const oldFile: FileContents = {
      name: fileLabel,
      contents: oldContents,
    };
    const newFile: FileContents = {
      name: fileLabel,
      contents: newContents,
    };

    return { oldFile, newFile };
  }, [fileName, input, output, step.diffLines]);

  const diffCssVars = React.useMemo(
    () =>
      themeType === "dark"
        ? ({
            "--diffs-bg": "#000",
            "--diffs-bg-buffer-override": "#000",
            "--diffs-bg-context-override": "#000",
            "--diffs-bg-hover-override": "#0a0a0a",
            "--diffs-bg-separator-override": "#0f0f0f",
          } as React.CSSProperties)
        : undefined,
    [themeType]
  );

  const diffUnsafeCss = React.useMemo(
    () =>
      themeType === "dark"
        ? `
[data-diff],
[data-file],
[data-diffs-header],
[data-error-wrapper],
[data-virtualizer-buffer] {
  --diffs-bg: #000;
  --diffs-bg-buffer-override: #000;
  --diffs-bg-context-override: #000;
  --diffs-bg-hover-override: #0a0a0a;
  --diffs-bg-separator-override: #0f0f0f;
}
`
        : undefined,
    [themeType]
  );

  const diffClassName =
    "an-edit-diff dark:bg-black dark:[--diffs-bg:#000] dark:[--diffs-bg-buffer-override:#000] dark:[--diffs-bg-context-override:#000] dark:[--diffs-bg-hover-override:#0a0a0a] dark:[--diffs-bg-separator-override:#0f0f0f]";

  return (
    <div className="an-edit-tool-card overflow-hidden rounded-an-tool-border-radius border border-an-tool-border-color bg-an-tool-background dark:bg-black">
      <div
        className={
          // Explicit bg-an-tool-background so the header keeps its light-grey
          // contrast in dark mode — the wrapper forces `dark:bg-black` for the
          // diff body, which would otherwise bleed into the header.
          "flex h-7 items-center justify-between bg-an-tool-background px-2.5 py-0" +
          (isPending && !diffFiles
            ? ""
            : "border-an-tool-border-color border-b")
        }
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {hasFileName && (
            <FileExtIcon className="h-3 w-3 shrink-0" filename={fileName} />
          )}
          {isPending && !diffFiles ? (
            <TextShimmer as="span" className="text-xs" duration={1.2}>
              Generating...
            </TextShimmer>
          ) : isPending ? (
            <TextShimmer as="span" className="text-xs" duration={1.2}>
              {isWrite ? "Creating" : "Editing"} {fileName}
            </TextShimmer>
          ) : (
            <span className="truncate text-an-tool-color-muted text-xs">
              {isWrite ? "Created" : "Edited"} {fileName}
            </span>
          )}
        </div>
        {step.diffStats && !isPending && (
          <span className="inline-flex gap-2 font-mono text-[11px] text-an-tool-color-muted">
            {step.diffStats.split(" ").map((token) => (
              <span
                className={
                  token.startsWith("+")
                    ? "text-an-diff-added-text"
                    : token.startsWith("-")
                      ? "text-an-diff-removed-text"
                      : undefined
                }
                key={token}
              >
                {token}
              </span>
            ))}
          </span>
        )}
      </div>
      {diffFiles ? (
        <div className={`${diffClassName} text-[12px]`} style={diffCssVars}>
          <div
            className={isCollapsible ? "group/edit-diff relative" : "relative"}
          >
            <div
              className={
                isCollapsible && !isExpanded
                  ? "max-h-[260px] overflow-hidden"
                  : undefined
              }
            >
              <MultiFileDiff
                className={diffClassName}
                key={themeType}
                newFile={diffFiles.newFile}
                oldFile={diffFiles.oldFile}
                options={{
                  theme: { dark: "github-dark", light: "github-light" },
                  themeType,
                  unsafeCSS: diffUnsafeCss,
                  diffStyle: "unified",
                  disableFileHeader: true,
                }}
                style={diffCssVars}
              />
            </div>
            {isCollapsible && (
              <>
                <button
                  aria-label={isExpanded ? "Hide" : "Show more"}
                  className={
                    "group absolute inset-x-0 bottom-0 flex h-16 items-end justify-center pb-2 text-muted-foreground" +
                    (isExpanded
                      ? "bg-transparent"
                      : "bg-linear-to-b from-transparent to-background")
                  }
                  onClick={() => setIsExpanded((prev) => !prev)}
                  type="button"
                >
                  <IconChevronDown
                    className={
                      "h-4 w-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100" +
                      (isExpanded ? "rotate-180" : "rotate-0")
                    }
                  />
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
      {approval && <ToolApprovalFooter isPending={isPending} {...approval} />}
    </div>
  );
}

export type EditToolProps = {
  part: any;
  isCollapsible?: boolean;
};

export const EditTool = memo(function EditTool({
  part,
  isCollapsible = false,
}: EditToolProps) {
  const approval = (part.input?.approval ?? part.args?.approval) as
    | ToolApproval
    | undefined;
  const toolName = (part.type as string)?.replace("tool-", "") || "Edit";
  const step = mapToolInvocationToStep(part.toolCallId ?? part.id ?? "edit", {
    toolName,
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
    <EditToolDiffCard
      approval={approval}
      input={part.input ?? part.args}
      isCollapsible={isCollapsible}
      onComplete={noop}
      output={part.output ?? part.result}
      state={stepState}
      step={step}
    />
  );
});
