import type { ChatStatus, UIMessage } from "ai";

/**
 * Minimal chat message shape used by the in-app assistants. The ACP agents
 * return a single final string per turn (no streaming, no tool-call parts),
 * so a flat {role, content} record is all we carry around.
 */
export interface SimpleChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Convert our flat chat records into the `ai` SDK `UIMessage[]` that the
 * agent-elements components render. Each message becomes a single text part.
 */
export function toUIMessages(messages: SimpleChatMessage[]): UIMessage[] {
  return messages.map((message, index) => ({
    id: message.id ?? `msg-${index}`,
    role: message.role,
    parts: [{ type: "text" as const, text: message.content }],
  }));
}

/**
 * Map our loading flag to the agent-elements `ChatStatus`. ACP turns don't
 * stream, so a pending turn is reported as "submitted" (which surfaces the
 * processing indicator) and otherwise "ready".
 */
export function chatStatusFor(isLoading: boolean): ChatStatus {
  return isLoading ? "submitted" : "ready";
}
