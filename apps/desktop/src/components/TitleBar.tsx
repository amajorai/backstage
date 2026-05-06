import { GalleryThumbnails } from "lucide-react";
import type { ReactNode } from "react";
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

  return (
    <TooltipProvider>
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
                <button className="flex items-center justify-center outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <GalleryThumbnails
                    className="fill-foreground"
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

        <div className="relative z-[1001] mr-[160px] flex items-center gap-2">
          {actions}
        </div>
      </div>
    </TooltipProvider>
  );
}
