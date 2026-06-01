import type React from "react";
import { memo } from "react";
import { QuestionTool } from "../question/question-tool";
import type { CustomToolRendererProps } from "../types";
import { getToolStatus } from "../utils/format-tool";
import { BashTool } from "./bash-tool";
import { EditTool } from "./edit-tool";
import { GenericTool } from "./generic-tool";
import { McpTool, unwrapMcpOutput } from "./mcp-tool";
import { PlanTool } from "./plan-tool";
import { SearchTool } from "./search-tool";
import { ThinkingTool } from "./thinking-tool";
import { TodoTool } from "./todo-tool";
import { ToolGroup } from "./tool-group";
import { parseMcpToolType, toolRegistry } from "./tool-registry";

export type ToolRendererProps = {
  part: any;
  nestedTools?: any[];
  chatStatus?: string;
  toolRenderers?: Record<string, React.ComponentType<CustomToolRendererProps>>;
};

function deriveToolStatus(
  part: any,
  chatStatus?: string
): CustomToolRendererProps["status"] {
  if (part.state === "input-streaming") return "streaming";
  if (part.state === "output-available") return "success";
  if (part.state === "output-error") return "error";
  const { isPending } = getToolStatus(part, chatStatus);
  return isPending ? "pending" : "success";
}

export const ToolRenderer = memo(function ToolRenderer({
  part,
  nestedTools,
  chatStatus,
  toolRenderers,
}: ToolRendererProps) {
  const partType = part.type as string;

  // Specialized tool components with variant dispatch
  switch (partType) {
    case "tool-Bash":
      return <BashTool part={part} />;
    case "tool-Edit":
    case "tool-Write":
      return <EditTool part={part} />;
    case "tool-WebSearch":
    case "tool-Grep":
    case "tool-Glob":
      return <SearchTool part={part} />;
    case "tool-PlanWrite":
      return <PlanTool chatStatus={chatStatus} part={part} />;
    case "tool-TodoWrite":
      return <TodoTool chatStatus={chatStatus} part={part} />;
    case "tool-Question":
      return <QuestionTool chatStatus={chatStatus} part={part} />;
    case "tool-Task":
    case "tool-Agent": {
      const labelBase = part.type === "tool-Agent" ? "Agent" : "Task";
      return (
        <ToolGroup
          chatStatus={chatStatus}
          completeLabel={`${labelBase} completed`}
          defaultOpen={false}
          interruptedLabel={`${labelBase} interrupted`}
          nestedTools={nestedTools}
          part={part}
          shimmerLabel={`Running ${labelBase.toLowerCase()}`}
        />
      );
    }
    case "tool-Thinking":
      return <ThinkingTool part={part} />;
  }

  // MCP tools
  const mcpInfo = parseMcpToolType(partType);
  if (mcpInfo) {
    // Custom renderer for user-defined tools
    if (toolRenderers && mcpInfo.serverName === "user-tools") {
      const CustomRenderer = toolRenderers[mcpInfo.toolName];
      if (CustomRenderer) {
        return (
          <CustomRenderer
            input={(part.input ?? {}) as Record<string, unknown>}
            name={mcpInfo.toolName}
            output={part.output ? unwrapMcpOutput(part.output) : undefined}
            status={deriveToolStatus(part, chatStatus)}
          />
        );
      }
    }
    return <McpTool chatStatus={chatStatus} mcpInfo={mcpInfo} part={part} />;
  }

  // Registry-based generic tools (Read, Grep, Glob, WebFetch, etc.)
  const meta = toolRegistry[partType];
  if (meta) {
    const { isPending, isError } = getToolStatus(part, chatStatus);
    return (
      <GenericTool
        isError={isError}
        isPending={isPending}
        subtitle={meta.subtitle?.(part)}
        title={meta.title(part)}
      />
    );
  }

  // Fallback: show tool name
  const toolName = partType.startsWith("tool-") ? partType.slice(5) : partType;
  const { isPending, isError } = getToolStatus(part, chatStatus);
  return (
    <GenericTool
      isError={isError}
      isPending={isPending}
      title={isPending ? `Running ${toolName}` : toolName}
    />
  );
});
