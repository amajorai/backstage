import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SeasonalTheme =
  | "christmas"
  | "cny"
  | "valentine"
  | "easter"
  | "halloween"
  | "new_year"
  | "st_patrick";

export interface SeasonConfig {
  id: SeasonalTheme;
  label: string;
  /** Single emoji or array — if array, each particle picks one randomly */
  emoji: string | string[];
  /** Optional CSS color for the particle (use for non-emoji characters like snowflakes) */
  color?: string;
  /** Emoji shown in the UI dropdown (falls back to first emoji if not set) */
  displayEmoji?: string;
  /** Override max particle size in px (defaults to 30) */
  maxSize?: number;
  /** Override min particle size in px (defaults to 1) */
  minSize?: number;
  isActive: (date: Date) => boolean;
}

export const SEASONS: SeasonConfig[] = [
  {
    id: "new_year",
    label: "New Year's",
    emoji: ["🥳", "🍾", "🎉", "🎊", "🪅"],
    minSize: 8,
    maxSize: 18,
    isActive: (d) => {
      const m = d.getMonth();
      const day = d.getDate();
      return (m === 11 && day === 31) || (m === 0 && day <= 2);
    },
  },
  {
    id: "cny",
    label: "Chinese New Year",
    emoji: "🧧",
    minSize: 8,
    maxSize: 18,
    isActive: (d) => {
      const m = d.getMonth();
      const day = d.getDate();
      return (m === 0 && day >= 20) || (m === 1 && day <= 18);
    },
  },
  {
    id: "valentine",
    label: "Valentine's Day",
    emoji: "❤️",
    minSize: 8,
    maxSize: 18,
    isActive: (d) => d.getMonth() === 1 && d.getDate() <= 14,
  },
  {
    id: "st_patrick",
    label: "St. Patrick's Day",
    emoji: "🍀",
    minSize: 8,
    maxSize: 18,
    isActive: (d) => d.getMonth() === 2 && d.getDate() === 17,
  },
  {
    id: "easter",
    label: "Easter",
    emoji: "🐰",
    minSize: 8,
    maxSize: 18,
    isActive: (d) => {
      const m = d.getMonth();
      return (m === 2 && d.getDate() >= 15) || (m === 3 && d.getDate() <= 25);
    },
  },
  {
    id: "halloween",
    label: "Halloween",
    emoji: "🎃",
    minSize: 8,
    maxSize: 18,
    isActive: (d) => d.getMonth() === 9,
  },
  {
    id: "christmas",
    label: "Christmas",
    emoji: "*",
    color: "#fff",
    displayEmoji: "❄️",
    isActive: (d) => d.getMonth() === 11,
  },
];

export function getCurrentSeason(date = new Date()): SeasonConfig | null {
  return SEASONS.find((s) => s.isActive(date)) ?? null;
}

/** Returns the display emoji for a season (uses displayEmoji if set, else first emoji) */
export function getSeasonDisplayEmoji(season: SeasonConfig): string {
  if (season.displayEmoji) return season.displayEmoji;
  return Array.isArray(season.emoji) ? season.emoji[0] : season.emoji;
}

interface SnowflakeProps {
  id: number;
  size: number;
  left: number;
  animationDuration: number;
  opacity: number;
  emoji: string;
  color?: string;
}

interface SnowfallBackgroundProps {
  /** Number of particles */
  count?: number;
  /** Emoji(s) to use — if array, each particle picks one randomly */
  emoji?: string | string[];
  /** Optional CSS color for the particle */
  color?: string;
  /** Animation speed multiplier (lower = slower) */
  speed?: number;
  /** Minimum particle size in pixels */
  minSize?: number;
  /** Maximum particle size in pixels */
  maxSize?: number;
  /** Minimum opacity */
  minOpacity?: number;
  /** Maximum opacity */
  maxOpacity?: number;
  /** Z-index for the layer */
  zIndex?: number;
  /** Whether to enable wind effect */
  wind?: boolean;
  /** Optional class name */
  className?: string;
  /** Whether to fade out at the bottom */
  fadeBottom?: boolean;
}

const Snowflake = ({
  id,
  size,
  left,
  animationDuration,
  opacity,
  emoji,
  color,
}: SnowflakeProps) => (
  <div
    className="pointer-events-none absolute select-none"
    style={{
      left: `${left}%`,
      fontSize: `${size}px`,
      opacity,
      animation: `snowfall-${id} ${animationDuration}s linear infinite`,
      ...(color && {
        color,
        textShadow: "0 0 1px rgba(255,255,255,0.8)",
      }),
    }}
  >
    {emoji}
  </div>
);

function pickEmoji(emoji: string | string[]): string {
  if (Array.isArray(emoji)) {
    return emoji[Math.floor(Math.random() * emoji.length)];
  }
  return emoji;
}

export function SnowfallBackground({
  count = 50,
  emoji = "*",
  color,
  speed = 1,
  minSize = 10,
  maxSize = 20,
  minOpacity = 0.3,
  maxOpacity = 0.8,
  zIndex = -1,
  wind = true,
  className,
  fadeBottom = false,
}: SnowfallBackgroundProps) {
  const [snowflakes, setSnowflakes] = useState<SnowflakeProps[]>([]);
  const [mounted, setMounted] = useState(false);

  const emojiKey = Array.isArray(emoji) ? emoji.join(",") : emoji;

  useEffect(() => {
    setMounted(true);

    const flakes: SnowflakeProps[] = [];
    for (let i = 0; i < count; i++) {
      flakes.push({
        id: i,
        size: Math.random() * (maxSize - minSize) + minSize,
        left: Math.random() * 100,
        animationDuration: (Math.random() * 3 + 2) / speed,
        opacity: Math.random() * (maxOpacity - minOpacity) + minOpacity,
        emoji: pickEmoji(emoji),
        color,
      });
    }
    setSnowflakes(flakes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, emojiKey, speed, minSize, maxSize, minOpacity, maxOpacity]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";

    let cssRules = "";
    for (const flake of snowflakes) {
      const windOffset = wind ? Math.random() * 100 - 50 : 0;
      cssRules += `
        @keyframes snowfall-${flake.id} {
          0% { transform: translateY(-20%) translateX(0px) rotate(0deg); }
          100% { transform: translateY(120%) translateX(${windOffset}px) rotate(360deg); }
        }
      `;
    }

    styleSheet.innerHTML = cssRules;
    document.head.appendChild(styleSheet);

    return () => {
      document.head.removeChild(styleSheet);
    };
  }, [snowflakes, wind, mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        fadeBottom &&
          "[mask-image:linear-gradient(to_bottom,black_0%,black_60%,transparent_100%)]",
        className
      )}
      style={{ zIndex }}
    >
      {snowflakes.map((flake) => (
        <Snowflake key={flake.id} {...flake} />
      ))}
    </div>
  );
}
