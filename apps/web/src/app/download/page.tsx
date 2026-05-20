import { GalleryThumbnails } from "lucide-react";
import Link from "next/link";
import { DownloadLinks } from "./download-links";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

const GITHUB_URL = "https://github.com/amajorai/backstage";

const PLATFORMS = [
  {
    id: "windows",
    label: "Windows",
    description: "Windows 10+",
    match: (name: string) =>
      name.endsWith(".msi") ||
      (name.endsWith(".exe") && !name.includes("nsis-web")),
    icon: (
      <svg
        aria-hidden="true"
        fill="currentColor"
        height="20"
        viewBox="0 0 24 24"
        width="20"
      >
        <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
      </svg>
    ),
  },
  {
    id: "macos",
    label: "macOS",
    description: "macOS 11+",
    match: (name: string) => name.endsWith(".dmg"),
    icon: (
      <svg
        aria-hidden="true"
        fill="currentColor"
        height="20"
        viewBox="0 0 24 24"
        width="20"
      >
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.054 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
    ),
  },
  {
    id: "linux",
    label: "Linux",
    description: "AppImage · deb",
    match: (name: string) =>
      name.endsWith(".AppImage") || name.endsWith(".deb"),
    icon: (
      <svg
        aria-hidden="true"
        fill="currentColor"
        height="20"
        viewBox="0 0 24 24"
        width="20"
      >
        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.25 1.237-.152 1.614.1.377.325.65.652.805.326.155.73.195 1.032.17.3-.027.575-.091.887-.145.292-.054.641-.109 1.063-.099.416.009.944.118 1.618.415.604.247 1.44.634 2.2.834.773.2 1.562.271 2.278.133.71-.14 1.376-.49 1.828-1.123a4.52 4.52 0 00.56-1.22c.062-.24.09-.49.108-.73.018-.24.027-.48.027-.72s-.01-.48-.027-.72c-.018-.24-.046-.49-.108-.73a4.52 4.52 0 00-.56-1.22c-.452-.633-1.118-.983-1.828-1.123-.716-.138-1.505-.067-2.278.133-.76.2-1.596.587-2.2.834-.674.297-1.202.406-1.618.415-.422-.01-.771.045-1.063.099-.312.054-.587.118-.887.145-.302.025-.706-.015-1.032-.17-.327-.155-.552-.428-.652-.805-.098-.377-.097-.934.152-1.614.076-.242.018-.571-.04-.97-.028-.136-.055-.337-.055-.536 0-.208.042-.413.132-.602.206-.411.55-.544.864-.68.312-.133.598-.201.797-.4.213-.239.403-.571.663-.839a.424.424 0 00.11-.135c.123-.805-.009-1.657-.287-2.489-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298C12.819.008 12.659 0 12.504 0z" />
      </svg>
    ),
  },
];

export default async function DownloadPage() {
  let release: GitHubRelease | null = null;

  try {
    const res = await fetch(
      "https://api.github.com/repos/amajorai/backstage/releases/latest",
      { next: { revalidate: 3600 } }
    );
    if (res.ok) release = await res.json();
  } catch {
    // fall through to show fallback
  }

  const version = release?.tag_name ?? "";
  const assets = release?.assets ?? [];

  const platforms = PLATFORMS.map(
    ({ id, label, description, match, icon }) => ({
      id,
      label,
      description,
      icon,
      assets: assets.filter((a) => match(a.name)),
    })
  );

  return (
    <div className="dark min-h-screen bg-zinc-950 font-sans text-white">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-20">
        <Link
          className="mb-10 flex items-center gap-2 font-semibold text-white no-underline"
          href="/"
        >
          <GalleryThumbnails
            className="fill-foreground text-foreground"
            size={20}
            strokeWidth={3}
          />
          Backstage
        </Link>

        <h1 className="mb-2 text-center font-medium font-sans text-3xl tracking-tight">
          Download Backstage
        </h1>
        <p className="mb-10 text-center text-zinc-400">
          {version ? `Version ${version} · ` : ""}Free &amp; open source
        </p>

        <DownloadLinks githubUrl={GITHUB_URL} platforms={platforms} />
      </div>
    </div>
  );
}
