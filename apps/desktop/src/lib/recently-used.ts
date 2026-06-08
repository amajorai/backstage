const ICON_KEY = "ypub-recent-icons";
const LOGO_KEY = "ypub-recent-logos";
const MAX = 20;

export interface RecentIcon {
  name: string;
  library: "lucide" | "huge" | "fluent";
  folder?: string;
}

export interface RecentLogo {
  id: number;
  title: string;
  route: string | { dark: string; light: string };
  kind?: "icon" | "wordmark";
}

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // localStorage can fail in restricted browser contexts; recent items are optional.
  }
}

export function getRecentIcons(): RecentIcon[] {
  return load<RecentIcon>(ICON_KEY);
}

export function addRecentIcon(icon: RecentIcon): void {
  const prev = load<RecentIcon>(ICON_KEY).filter(
    (i) => !(i.name === icon.name && i.library === icon.library)
  );
  save(ICON_KEY, [icon, ...prev].slice(0, MAX));
}

export function getRecentLogos(): RecentLogo[] {
  return load<RecentLogo>(LOGO_KEY);
}

export function addRecentLogo(logo: RecentLogo): void {
  const prev = load<RecentLogo>(LOGO_KEY).filter(
    (l) => !(l.id === logo.id && (l.kind ?? "icon") === (logo.kind ?? "icon"))
  );
  save(LOGO_KEY, [logo, ...prev].slice(0, MAX));
}
