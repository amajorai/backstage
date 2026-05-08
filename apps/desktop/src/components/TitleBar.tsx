import { GalleryThumbnails } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { SnowfallBackground } from "./snow-flakes";

interface TitleBarProps {
  title?: ReactNode;
  actions?: ReactNode;
  center?: ReactNode;
  showIcon?: boolean;
  className?: string;
}

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TitleBar({
  title,
  actions,
  center,
  showIcon = true,
  className,
}: TitleBarProps) {
  const { showDecemberSnow } = useAppSettingsStore();
  const isDecember = new Date().getMonth() === 11;
  const [bounceKey, setBounceKey] = useState(0);

  const handleLogoClick = () => {
    setBounceKey((k) => k + 1);
  };

  return (
    <TooltipProvider>
      <style>{`
        @keyframes logo-bounce {
          0%   { transform: scale(1); }
          25%  { transform: scale(1.2); }
          50%  { transform: scale(0.9); }
          75%  { transform: scale(1.1); }
          90%  { transform: scale(0.97); }
          100% { transform: scale(1); }
        }
        .logo-bounce {
          animation: logo-bounce 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
      `}</style>
      <div
        className={cn(
          "relative flex h-11 select-none items-center justify-between pr-2 pl-4",
          className
        )}
      >
        <div
          className="absolute inset-0 z-0 bg-background/50 backdrop-blur-md"
          data-tauri-drag-region
        />

        {isDecember && showDecemberSnow && (
          <SnowfallBackground
            className="pointer-events-none h-[50px]"
            color="#fff"
            count={30}
            fadeBottom={true}
            maxOpacity={1}
            maxSize={30}
            minOpacity={0}
            minSize={1}
            speed={1}
            wind={true}
            zIndex={50}
          />
        )}

        <div className="relative z-[1001] flex items-center gap-3">
          {showIcon && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center justify-center outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={handleLogoClick}
                >
                  <GalleryThumbnails
                    className={cn(
                      "fill-foreground transition-opacity hover:opacity-80 active:opacity-60",
                      bounceKey > 0 && "logo-bounce"
                    )}
                    key={bounceKey}
                    size={16}
                    strokeWidth={3}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent align="start" side="bottom">
                <p className="font-bold text-[10px]">Backstage</p>
              </TooltipContent>
            </Tooltip>
          )}
          {title && <div className="flex items-center">{title}</div>}
        </div>

        {center && (
          <div className="absolute left-1/2 z-[1001] -translate-x-1/2">
            {center}
          </div>
        )}

        <div className="relative z-[1001] flex items-center gap-2">
          {actions}
        </div>
      </div>
    </TooltipProvider>
  );
}
