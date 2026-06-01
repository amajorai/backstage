import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/drawer";
import { Bot, X } from "lucide-react";
import { useRef, useState } from "react";
import { AgentChat } from "@/components/agent-elements/agent-chat";
import { acpPrompt } from "@/lib/acp-client";
import {
  chatStatusFor,
  type SimpleChatMessage,
  toUIMessages,
} from "@/lib/agent-chat-adapter";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { useYtMyChannelStore } from "@/stores/use-yt-my-channel-store";
import { useYtOAuthStore } from "@/stores/use-yt-oauth-store";

interface YoutubeAnalystPanelProps {
  open: boolean;
  onClose: () => void;
}

const TOP_VIDEO_LIMIT = 20;

export function YoutubeAnalystPanel({
  open,
  onClose,
}: YoutubeAnalystPanelProps) {
  const [messages, setMessages] = useState<SimpleChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Each send bumps this; a stopped or superseded turn is discarded on resolve.
  const turnIdRef = useRef(0);

  const acpAgents = useAppSettingsStore((s) => s.acpAgents);
  const acpTextGenAgentId = useAppSettingsStore((s) => s.acpTextGenAgentId);

  const channelName = useYtOAuthStore((s) => s.channelName);
  const channelId = useYtOAuthStore((s) => s.channelId);
  const videos = useYtMyChannelStore((s) => s.videos);

  const handleSend = async (userMessage: string) => {
    const trimmed = userMessage.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const turnId = turnIdRef.current + 1;
    turnIdRef.current = turnId;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);
    setIsLoading(true);

    const appendAssistant = (content: string) => {
      if (turnIdRef.current !== turnId) {
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content },
      ]);
    };

    try {
      const agent = acpTextGenAgentId
        ? acpAgents.find((a) => a.id === acpTextGenAgentId)
        : null;

      if (!agent) {
        appendAssistant(
          "No AI agent configured. Go to Settings → AI Agents to set one up."
        );
        return;
      }

      const topVideos = videos
        .slice()
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, TOP_VIDEO_LIMIT)
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

User question: ${trimmed}

Provide specific, actionable insights based on the data.`;

      const response = await acpPrompt(agent, prompt);
      appendAssistant(response);
    } catch (err) {
      appendAssistant(
        err instanceof Error
          ? `Error: ${err.message}`
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      if (turnIdRef.current === turnId) {
        setIsLoading(false);
      }
    }
  };

  const handleStop = () => {
    // ACP turns can't truly be cancelled. Invalidate the in-flight turn so its
    // eventual response is dropped, and close the turn with a marker so the feed
    // stops showing the processing indicator (which keys off a trailing user
    // turn with no reply).
    turnIdRef.current += 1;
    setIsLoading(false);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content: "Stopped." },
    ]);
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

        {/* Message feed + composer (agent-elements) */}
        <AgentChat
          className="min-h-0 flex-1"
          emptyStatePosition="center"
          messages={toUIMessages(messages)}
          onSend={({ content }) => handleSend(content)}
          onStop={handleStop}
          status={chatStatusFor(isLoading)}
          suggestions={[
            {
              id: "top-videos",
              label: "What are my top videos?",
              value: "What are my top-performing videos and why?",
            },
            {
              id: "growth-ideas",
              label: "Ideas to grow",
              value: "Give me content ideas to grow my channel.",
            },
          ]}
        />
      </DrawerContent>
    </Drawer>
  );
}
