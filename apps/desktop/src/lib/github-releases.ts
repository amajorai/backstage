const GITHUB_REPO = "amajorai/backstage";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

/** URL of the GitHub release page for a specific version tag. */
export function releaseTagUrl(version: string): string {
  return `https://github.com/${GITHUB_REPO}/releases/tag/v${version}`;
}

export interface GitHubRelease {
  tag_name: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

let cachedReleases: GitHubRelease[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchReleases(): Promise<GitHubRelease[]> {
  if (cachedReleases && Date.now() < cacheExpiry) return cachedReleases;

  const res = await fetch(`${RELEASES_URL}?per_page=100`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub releases fetch failed: ${res.status}`);

  const data = (await res.json()) as GitHubRelease[];
  // Strict semver only — drop pre-releases, drafts, and non-conforming tags
  // (e.g. "release-2024-01" or "1.2.3-beta") that would parse to garbage.
  const SEMVER_TAG = /^v?\d+\.\d+\.\d+$/;
  cachedReleases = data.filter(
    (r) => !(r.prerelease || r.draft) && SEMVER_TAG.test(r.tag_name)
  );
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cachedReleases;
}

/** Strips a leading "v" so "v1.2.1" and "1.2.1" both compare correctly. */
function normaliseTag(tag: string): string {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

function parseSemver(version: string): [number, number, number] {
  const parts = normaliseTag(version).split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function semverGt(a: string, b: string): boolean {
  const [a1, a2, a3] = parseSemver(a);
  const [b1, b2, b3] = parseSemver(b);
  if (a1 !== b1) return a1 > b1;
  if (a2 !== b2) return a2 > b2;
  return a3 > b3;
}

/**
 * Returns the latest release version whose publish date is on or before
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
 * Returns true if `current` was released after the `updatesUntil` window,
 * meaning the user is running a version they are not entitled to.
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
