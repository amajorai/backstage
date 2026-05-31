import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Bot, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { acpPrompt } from "@/lib/acp-client";
import { cn } from "@/lib/utils";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PREAMBLE =
  "You are the in-app assistant for Backstage, a desktop thumbnail design app. " +
  "You can control the app for the user through the available tools — navigate between pages, " +
  "create and edit projects, add or modify layers, and more. When the user asks you to do something " +
  "in the app, take the action with the tools rather than only describing it. Keep replies concise.";

/**
 * Chat panel content for the global assistant. Rendered inside a resizable
 * right panel (like the editor's AI/settings panels). Talks to the selected
 * ACP agent (Claude/Gemini/Codex/…), which can drive the app UI via the
 * registered ACP tools. The agent/model is sourced from Settings.
 */
export function ChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const acpAgents = useAppSettingsStore((s) => s.acpAgents);
  const acpTextGenAgentId = useAppSettingsStore((s) => s.acpTextGenAgentId);
  const setAcpTextGenAgentId = useAppSettingsStore(
    (s) => s.setAcpTextGenAgentId
  );

  const selectedAgent = acpTextGenAgentId
    ? (acpAgents.find((a) => a.id === acpTextGenAgentId) ?? null)
    : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || isLoading) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: userMessage },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      if (!selectedAgent) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "No AI agent is selected. Choose one above, or set one up in Settings → AI Agents.",
          },
        ]);
        return;
      }

      // ACP sessions are stateless per call, so include the recent transcript
      // as context for multi-turn continuity.
      const history = messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");
      const prompt = `${SYSTEM_PREAMBLE}\n\n${
        history ? `Conversation so far:\n${history}\n\n` : ""
      }User: ${userMessage}`;

      const response = await acpPrompt(selectedAgent, prompt);

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: response },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            err instanceof Error
              ? `Error: ${err.message}`
              : "An unexpected error occurred. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="size-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Assistant</p>
            <p className="text-muted-foreground text-xs">
              Chat to control the app and get help.
            </p>
          </div>
        </div>
        <button
          aria-label="Close assistant"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Agent / model selector */}
      <div className="flex items-center gap-2 border-border border-b px-4 py-2">
        <span className="shrink-0 text-muted-foreground text-xs">Agent</span>
        <Select
          onValueChange={(v) => setAcpTextGenAgentId(v === "none" ? null : v)}
          value={acpTextGenAgentId ?? "none"}
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue>
              {selectedAgent?.name ?? "Select an agent"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {acpAgents.length === 0 ? (
              <SelectItem disabled value="none">
                No agents configured — add one in Settings
              </SelectItem>
            ) : (
              acpAgents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">
                How can I help?
              </p>
              <p className="mt-1 max-w-xs text-muted-foreground text-xs">
                Ask me to navigate, create a project, add layers, or anything
                else — I can act on the app for you.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
            key={msg.id}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3.5 py-2.5">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-border border-t p-4">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-xl border border-border bg-muted px-3.5 py-2.5 text-foreground text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything…"
            rows={2}
            value={input}
          />
          <button
            aria-label="Send message"
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              input.trim() && !isLoading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            )}
            disabled={!input.trim() || isLoading}
            onClick={handleSend}
            type="button"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
