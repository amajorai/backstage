import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/drawer";
import { Bot, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { acpPrompt } from "@/lib/acp-client";
import { cn } from "@/lib/utils";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { useYtMyChannelStore } from "@/stores/use-yt-my-channel-store";
import { useYtOAuthStore } from "@/stores/use-yt-oauth-store";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface YoutubeAnalystPanelProps {
  open: boolean;
  onClose: () => void;
}

export function YoutubeAnalystPanel({
  open,
  onClose,
}: YoutubeAnalystPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const acpAgents = useAppSettingsStore((s) => s.acpAgents);
  const acpTextGenAgentId = useAppSettingsStore((s) => s.acpTextGenAgentId);

  const channelName = useYtOAuthStore((s) => s.channelName);
  const channelId = useYtOAuthStore((s) => s.channelId);
  const videos = useYtMyChannelStore((s) => s.videos);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const agent = acpTextGenAgentId
        ? acpAgents.find((a) => a.id === acpTextGenAgentId)
        : null;

      if (!agent) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "No AI agent configured. Go to Settings → AI Agents to set one up.",
          },
        ]);
        return;
      }

      const topVideos = videos
        .slice()
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 20)
        .map((v) => ({
          id: v.id,
          title: v.title,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          publishedAt: v.publishedAt,
          durationSeconds: v.durationSeconds,
        }));

      const context = {
        channelName,
        channelId,
        topVideos,
      };

      const prompt = `You are a YouTube analytics expert and creative strategist helping a content creator improve their channel.

Channel data:
${JSON.stringify(context, null, 2)}

User question: ${userMessage}

Provide specific, actionable insights based on the data.`;

      const response = await acpPrompt(agent, prompt);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
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
    <Drawer direction="right" onClose={onClose} open={open}>
      <DrawerContent className="w-[420px] max-w-full">
        <DrawerHeader className="flex flex-row items-center justify-between border-border border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div>
              <DrawerTitle>YouTube AI Analyst</DrawerTitle>
              <DrawerDescription className="mt-0.5">
                Ask questions about your channel performance and get AI-powered
                insights.
              </DrawerDescription>
            </div>
          </div>
          <DrawerClose asChild>
            <button
              aria-label="Close panel"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              type="button"
            >
              <X className="size-4" />
            </button>
          </DrawerClose>
        </DrawerHeader>

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot className="size-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    YouTube AI Analyst
                  </p>
                  <p className="mt-1 max-w-xs text-muted-foreground text-xs">
                    Ask about your top-performing videos, content patterns, or
                    ideas to grow your channel.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
                key={`${msg.role}-${i}`}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
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

          {/* Input area */}
          <div className="border-border border-t p-4">
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 resize-none rounded-xl border border-border bg-muted px-3.5 py-2.5 text-foreground text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                disabled={isLoading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your channel..."
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
      </DrawerContent>
    </Drawer>
  );
}
