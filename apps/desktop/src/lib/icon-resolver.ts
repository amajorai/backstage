import { icons as HugeIcons } from "hugeicons-react";
import { icons as LucideIcons } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  fluentEmojiCategories,
  getFluentEmojiUrl,
} from "./fluent-emoji-manifest";

const UPPERCASE_START_REGEX = /^[A-Z]/;
const ICON_KEYWORD_CLEANUP_REGEX = /[-_\s]+/g;

// 1. Icon Categories (Keep as examples/fallback)
// Note: We can expand this with HugeIcons if desired, but these are mainly prompt pointers.
export const ICON_CATEGORIES = {
  arrows: [
    "ArrowRight",
    "ArrowLeft",
    "ArrowUp",
    "ArrowDown",
    "ChevronRight",
    "ChevronLeft",
    "ChevronUp",
    "ChevronDown",
    "MoveRight",
    "MoveLeft",
    "CornerDownRight",
    "CornerUpRight",
  ],
  actions: [
    "Check",
    "CheckCircle",
    "CheckSquare",
    "X",
    "XCircle",
    "Plus",
    "PlusCircle",
    "Minus",
    "MinusCircle",
    "Edit",
    "Pencil",
    "Trash",
    "Trash2",
    "Save",
    "Download",
    "Upload",
    "Copy",
    "Clipboard",
    "ExternalLink",
    "Link",
  ],
  social: [
    "Heart",
    "HeartHandshake",
    "Star",
    "ThumbsUp",
    "ThumbsDown",
    "Share",
    "Share2",
    "MessageCircle",
    "MessageSquare",
    "Send",
    "Users",
    "UserPlus",
    "UserCheck",
    "AtSign",
    "Hash",
  ],
  media: [
    "Play",
    "Pause",
    "PlayCircle",
    "PauseCircle",
    "SkipForward",
    "SkipBack",
    "Volume2",
    "VolumeX",
    "Mic",
    "Camera",
    "Video",
    "Image",
    "Film",
    "Music",
  ],
  objects: [
    "Lightbulb",
    "Target",
    "Trophy",
    "Award",
    "Medal",
    "Crown",
    "Gem",
    "Gift",
    "Package",
    "Box",
    "Briefcase",
    "Wallet",
    "CreditCard",
    "Coins",
    "DollarSign",
    "PiggyBank",
  ],
  nature: [
    "Sun",
    "Moon",
    "Cloud",
    "CloudRain",
    "Snowflake",
    "Flame",
    "Zap",
    "Rainbow",
    "Leaf",
    "TreeDeciduous",
    "Flower2",
    "Mountain",
    "Waves",
    "Droplet",
  ],
  tech: [
    "Rocket",
    "Cpu",
    "Server",
    "Database",
    "HardDrive",
    "Monitor",
    "Smartphone",
    "Tablet",
    "Laptop",
    "Wifi",
    "Bluetooth",
    "Globe",
    "Code",
    "Terminal",
    "Bug",
    "Shield",
    "Lock",
    "Key",
  ],
  communication: [
    "Mail",
    "Inbox",
    "Bell",
    "BellRing",
    "Phone",
    "PhoneCall",
    "Megaphone",
    "Radio",
    "Podcast",
    "Rss",
  ],
  navigation: [
    "Home",
    "Search",
    "Menu",
    "MoreHorizontal",
    "MoreVertical",
    "Settings",
    "Sliders",
    "Filter",
    "SortAsc",
    "SortDesc",
    "Layout",
    "Grid",
    "List",
    "Map",
    "MapPin",
    "Compass",
    "Navigation",
  ],
  time: [
    "Clock",
    "Timer",
    "Hourglass",
    "Calendar",
    "CalendarCheck",
    "CalendarPlus",
    "Alarm",
    "Watch",
    "History",
    "Repeat",
    "RefreshCw",
    "RotateCw",
  ],
  charts: [
    "BarChart",
    "BarChart2",
    "BarChart3",
    "LineChart",
    "PieChart",
    "TrendingUp",
    "TrendingDown",
    "Activity",
    "Gauge",
    "Percent",
  ],
  emotions: [
    "Smile",
    "Frown",
    "Meh",
    "Laugh",
    "Angry",
    "Heart",
    "HeartCrack",
    "Sparkles",
    "PartyPopper",
    "Confetti",
  ],
} as const;

// Flatten categories for quick lookups
const _CATEGORIZED_ICONS = Object.values(ICON_CATEGORIES).flat();

// Get ALL Lucide icon names dynamically
const ALL_LUCIDE_KEYS = Object.keys(LucideIcons).filter(
  (key) =>
    key !== "createLucideIcon" &&
    key !== "icons" &&
    UPPERCASE_START_REGEX.test(key)
) as string[];

// Get ALL Huge icon names dynamically
const ALL_HUGE_KEYS = Object.keys(HugeIcons).filter((key) =>
  UPPERCASE_START_REGEX.test(key)
) as string[];

// 2. Search Logic (for Tool Use)
export function searchIcons(
  query: string,
  limit = 20
): { name: string; library: "lucide" | "huge"; categories: string[] }[] {
  if (!query) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const results: {
    name: string;
    library: "lucide" | "huge";
    categories: string[];
  }[] = [];

  // 1. Search Lucide
  // Exact matches first
  const exactLucide = ALL_LUCIDE_KEYS.find(
    (k) => k.toLowerCase() === normalizedQuery
  );
  if (exactLucide) {
    results.push({
      name: exactLucide,
      library: "lucide",
      categories: getCategoriesForIcon(exactLucide),
    });
  }

  // Then partial matches
  const partialsLucide = ALL_LUCIDE_KEYS.filter(
    (k) =>
      k.toLowerCase().includes(normalizedQuery) &&
      k.toLowerCase() !== normalizedQuery
  );

  for (const p of partialsLucide) {
    if (results.length >= limit) {
      break;
    }
    results.push({
      name: p,
      library: "lucide",
      categories: getCategoriesForIcon(p),
    });
  }

  // 2. Search HugeIcons
  if (results.length < limit) {
    const exactHuge = ALL_HUGE_KEYS.find(
      (k) => k.toLowerCase() === normalizedQuery
    );
    if (
      exactHuge &&
      !results.some((r) => r.name === exactHuge && r.library === "huge")
    ) {
      // Avoid duplicated if names clash (unlikely with prefixes, but handled)
      results.push({ name: exactHuge, library: "huge", categories: [] });
    }

    const partialsHuge = ALL_HUGE_KEYS.filter(
      (k) =>
        k.toLowerCase().includes(normalizedQuery) &&
        k.toLowerCase() !== normalizedQuery
    );

    for (const p of partialsHuge) {
      if (results.length >= limit) {
        break;
      }
      // Prioritize Lucide if duplicates exist, but here we just add them
      if (!results.some((r) => r.name === p)) {
        results.push({ name: p, library: "huge", categories: [] });
      }
    }
  }

  return results.slice(0, limit);
}

function getCategoriesForIcon(iconName: string): string[] {
  const cats: string[] = [];
  for (const [category, icons] of Object.entries(ICON_CATEGORIES)) {
    if ((icons as readonly string[]).includes(iconName)) {
      cats.push(category);
    }
  }
  return cats;
}

// 3. Resolvers & Converters

// Simple resolver (legacy + robust fallback)
export function resolveIconKeyword(
  keyword: string
): { name: string; library: "lucide" | "huge" } | null {
  if (!keyword) {
    return null;
  }
  const normalized = keyword
    .toLowerCase()
    .replace(ICON_KEYWORD_CLEANUP_REGEX, "");

  // Try exact match in Lucide
  const exactLucide = ALL_LUCIDE_KEYS.find(
    (k) => k.toLowerCase() === normalized
  );
  if (exactLucide) {
    return { name: exactLucide, library: "lucide" };
  }

  // Try exact match in Huge
  const exactHuge = ALL_HUGE_KEYS.find((k) => k.toLowerCase() === normalized);
  if (exactHuge) {
    return { name: exactHuge, library: "huge" };
  }

  // Try partial match in Lucide
  const partialLucide = ALL_LUCIDE_KEYS.find((k) =>
    k.toLowerCase().includes(normalized)
  );
  if (partialLucide) {
    return { name: partialLucide, library: "lucide" };
  }

  // Try partial match in Huge
  const partialHuge = ALL_HUGE_KEYS.find((k) =>
    k.toLowerCase().includes(normalized)
  );
  if (partialHuge) {
    return { name: partialHuge, library: "huge" };
  }

  return null;
}

export function iconToDataUrl(
  iconName: string,
  library: "lucide" | "huge" = "lucide",
  size = 128,
  color = "#000000"
): string | null {
  let Icon: React.ElementType | undefined;

  if (library === "lucide") {
    const icons = LucideIcons as Record<
      string,
      React.ComponentType<{
        size?: number;
        color?: string;
        strokeWidth?: number;
      }>
    >;
    Icon = icons[iconName];
  } else {
    const icons = HugeIcons as Record<
      string,
      React.ComponentType<{
        size?: number;
        color?: string;
        strokeWidth?: number;
      }>
    >;
    Icon = icons[iconName];
  }

  if (!Icon) {
    return null;
  }

  try {
    const iconProps: { size: number; color: string; strokeWidth?: number } = {
      size,
      color,
    };
    if (library === "lucide") {
      iconProps.strokeWidth = 2;
    }

    const svgString = renderToStaticMarkup(createElement(Icon, iconProps));

    let finalSvg = svgString;
    if (!finalSvg.includes("xmlns")) {
      finalSvg = finalSvg.replace(
        "<svg",
        '<svg xmlns="http://www.w3.org/2000/svg"'
      );
    }
    return `data:image/svg+xml;base64,${btoa(
      unescape(encodeURIComponent(finalSvg))
    )}`;
  } catch (e) {
    console.error(`Failed to render icon ${iconName} (${library})`, e);
    return null;
  }
}

export function resolveIconToDataUrl(
  keyword: string,
  size = 128,
  color = "#000000"
): { iconName: string; library: "lucide" | "huge"; dataUrl: string } | null {
  const resolved = resolveIconKeyword(keyword);
  if (!resolved) {
    return null;
  }

  const dataUrl = iconToDataUrl(resolved.name, resolved.library, size, color);
  if (!dataUrl) {
    return null;
  }

  return { iconName: resolved.name, library: resolved.library, dataUrl };
}

// 4. Emoji Logic

// Fluent Emoji resolver
export function resolveFormattedEmoji(
  keyword: string
): { name: string; url: string } | null {
  if (!keyword) {
    return null;
  }

  const normalized = keyword.toLowerCase().trim();

  // Search through all categories
  for (const category of fluentEmojiCategories) {
    // 1. Exact match
    const exact = category.emojis.find((e) => e.toLowerCase() === normalized);
    if (exact) {
      return {
        name: exact,
        url: getFluentEmojiUrl(category.folder, exact),
      };
    }
  }

  // 2. Partial match
  for (const category of fluentEmojiCategories) {
    const partial = category.emojis.find((e) =>
      e.toLowerCase().includes(normalized)
    );
    if (partial) {
      return {
        name: partial,
        url: getFluentEmojiUrl(category.folder, partial),
      };
    }
  }

  return null;
}

export function getIconKeywordsForPrompt(): string {
  // Give generic examples, but tell model it can search
  return "arrow-right, star, heart, user, settings, ... (or use the search tool)";
}

export function getEmojiExamplesForPrompt(): string {
  return "thumbs-up, fire, rocket, ... (all Fluent Emojis supported)";
}
