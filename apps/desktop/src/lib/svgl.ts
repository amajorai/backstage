export interface ThemeOptions {
  dark: string;
  light: string;
}

export interface SvglLogo {
  id: number;
  title: string;
  category: string | string[];
  route: string | ThemeOptions;
  url: string;
  wordmark?: string | ThemeOptions;
  brandUrl?: string;
}

const BASE_URL = "https://api.svgl.app";

export async function fetchAllLogos(): Promise<SvglLogo[]> {
  const res = await fetch(BASE_URL);
  if (!res.ok) throw new Error(`SVGL API error: ${res.status}`);
  return res.json() as Promise<SvglLogo[]>;
}

export async function searchLogos(query: string): Promise<SvglLogo[]> {
  const res = await fetch(`${BASE_URL}?search=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`SVGL API error: ${res.status}`);
  return res.json() as Promise<SvglLogo[]>;
}

export function getLogoRoute(
  logo: Pick<SvglLogo, "route">,
  dark = false
): string {
  const { route } = logo;
  if (typeof route === "string") return route;
  return dark ? route.dark : route.light;
}

function parseSvgDimensions(svg: string): { width: number; height: number } {
  const wMatch = svg.match(/\bwidth="([^"]+)"/);
  const hMatch = svg.match(/\bheight="([^"]+)"/);
  const vbMatch = svg.match(/viewBox="([^"]+)"/);

  let width = wMatch ? Number.parseFloat(wMatch[1]) : 0;
  let height = hMatch ? Number.parseFloat(hMatch[1]) : 0;

  if (!(width && height) && vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/);
    if (parts.length === 4) {
      width = width || Number.parseFloat(parts[2]);
      height = height || Number.parseFloat(parts[3]);
    }
  }

  return { width: width || 128, height: height || 128 };
}

export async function svgUrlToDataUrl(
  url: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch SVG: ${res.status}`);
  const text = await res.text();
  const encoded = btoa(unescape(encodeURIComponent(text)));
  const dataUrl = `data:image/svg+xml;base64,${encoded}`;
  const { width, height } = parseSvgDimensions(text);
  return { dataUrl, width, height };
}
