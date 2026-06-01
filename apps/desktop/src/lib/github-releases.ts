const GITHUB_REPO = "amajorai/backstage";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

/** Strips a leading "v" so "v1.2.1" and "1.2.1" both compare correctly. */
export function normaliseTag(tag: string): string {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

/** URL of the GitHub release page for a specific version tag. */
export function releaseTagUrl(version: string): string {
  return `https://github.com/${GITHUB_REPO}/releases/tag/v${normaliseTag(version)}`;
}

export interface GitHubRelease {
  tag_name: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  body: string | null;
}

interface RawRelease {
  tag_name?: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  html_url?: string;
  body?: string | null;
}

let cachedReleases: GitHubRelease[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Strict semver with an optional pre-release suffix (e.g. "1.4.0-beta.1").
// Anything else (drafts, "release-2024-01") is dropped so it can't parse to garbage.
const SEMVER_TAG = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * Every published release (stable + pre-release) with a parseable semver tag.
 * Drafts and non-conforming tags are dropped. Cached for 1 hour.
 */
async function fetchAllReleases(): Promise<GitHubRelease[]> {
  if (cachedReleases && Date.now() < cacheExpiry) return cachedReleases;

  const res = await fetch(`${RELEASES_URL}?per_page=100`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub releases fetch failed: ${res.status}`);

  const data = (await res.json()) as RawRelease[];
  cachedReleases = data
    .filter(
      (r) =>
        !r.draft &&
        typeof r.tag_name === "string" &&
        SEMVER_TAG.test(r.tag_name)
    )
    .map((r) => ({
      tag_name: r.tag_name as string,
      published_at: r.published_at ?? "",
      prerelease: r.prerelease === true,
      draft: r.draft === true,
      html_url: r.html_url ?? "",
      body: r.body ?? null,
    }));
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cachedReleases;
}

/**
 * Stable releases only — used by the license entitlement and version-gate
 * checks, which must never consider pre-releases.
 */
export async function fetchReleases(): Promise<GitHubRelease[]> {
  return (await fetchAllReleases()).filter((r) => !r.prerelease);
}

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parseSemver(version: string): ParsedSemver {
  const [core, pre] = normaliseTag(version).split("-", 2);
  const parts = (core ?? "").split(".").map(Number);
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    prerelease: pre ? pre.split(".") : [],
  };
}

const NUMERIC_IDENTIFIER = /^\d+$/;

/**
 * Compares pre-release identifier lists per semver §11: numeric identifiers
 * compare numerically, others lexically, numeric ranks below non-numeric, and a
 * larger set wins when all shared identifiers are equal. An empty list (no
 * pre-release) outranks any non-empty one, so 1.4.0 > 1.4.0-beta.1.
 */
function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? "";
    const bi = b[i] ?? "";
    const aNum = NUMERIC_IDENTIFIER.test(ai);
    const bNum = NUMERIC_IDENTIFIER.test(bi);
    if (aNum && bNum) {
      const diff = Number(ai) - Number(bi);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (aNum !== bNum) {
      return aNum ? -1 : 1;
    } else if (ai !== bi) {
      return ai < bi ? -1 : 1;
    }
  }
  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}

/** -1 if a < b, 0 if equal, 1 if a > b. Pre-release aware. */
export function semverCompare(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return comparePrerelease(pa.prerelease, pb.prerelease);
}

export function semverGt(a: string, b: string): boolean {
  return semverCompare(a, b) > 0;
}

/**
 * Returns the latest stable release version whose publish date is on or before
 * `updatesUntil`. Returns null if no releases fall within the window.
 */
export async function getMaxEntitledVersion(
  updatesUntil: Date
): Promise<string | null> {
  const releases = await fetchReleases();
  let best: string | null = null;
  for (const release of releases) {
    if (new Date(release.published_at) <= updatesUntil) {
      const version = normaliseTag(release.tag_name);
      if (!best || semverGt(version, best)) best = version;
    }
  }
  return best;
}

/**
 * Newest release for the requested channel. When `includePrerelease` is false
 * only stable releases are considered. When `updatesUntil` is provided, releases
 * published after it are excluded so the license entitlement window is honoured
 * even for beta opt-ins.
 */
export async function getLatestRelease(opts: {
  includePrerelease: boolean;
  updatesUntil?: Date | null;
}): Promise<GitHubRelease | null> {
  const releases = await fetchAllReleases();
  let best: GitHubRelease | null = null;
  for (const release of releases) {
    if (!opts.includePrerelease && release.prerelease) continue;
    if (
      opts.updatesUntil &&
      new Date(release.published_at) > opts.updatesUntil
    ) {
      continue;
    }
    if (
      !best ||
      semverGt(normaliseTag(release.tag_name), normaliseTag(best.tag_name))
    ) {
      best = release;
    }
  }
  return best;
}

/**
 * Returns true if `current` was released after the `updatesUntil` window,
 * meaning the user is running a version they are not entitled to. Stable
 * channel only — beta builds are never gated by this check.
 */
export async function isVersionOutsideEntitlement(
  currentVersion: string,
  updatesUntil: Date
): Promise<boolean> {
  const releases = await fetchReleases();
  const normalised = normaliseTag(currentVersion);
  const match = releases.find((r) => normaliseTag(r.tag_name) === normalised);
  if (!match) return false; // can't determine — don't block
  return new Date(match.published_at) > updatesUntil;
}
