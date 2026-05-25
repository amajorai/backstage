import { Button } from "@repo/ui/button";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { MyChannelTab } from "@/components/explore/MyChannelTab";
import { VideoAnalyticsPanel } from "@/components/explore/VideoAnalyticsPanel";
import * as sounds from "@/lib/sounds";

interface MyChannelPageProps {
  onRemix: (thumbnailUrl: string, title: string) => void;
  onClose: () => void;
  onSettings: () => void;
}

export function MyChannelPage({
  onRemix,
  onClose,
  onSettings,
}: MyChannelPageProps) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  return (
    <>
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
        <MyChannelTab
          onRemix={onRemix}
          onSelectVideo={setSelectedVideoId}
          onSettings={onSettings}
        />
      </div>

      <div className="mx-1 mb-1">
        <div className="relative flex h-12 items-center rounded-xl bg-muted px-4">
          <Button
            aria-label="Back to Gallery"
            onClick={() => {
              sounds.click();
              onClose();
            }}
            size="icon-sm"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
          </Button>
        </div>
      </div>

      <VideoAnalyticsPanel
        onClose={() => setSelectedVideoId(null)}
        videoId={selectedVideoId}
      />
    </>
  );
}
