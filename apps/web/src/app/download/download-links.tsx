"use client";

import * as sounds from "@/lib/sounds";

interface Asset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Platform {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  assets: Asset[];
}

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DownloadLinks({
  platforms,
  githubUrl,
}: {
  platforms: Platform[];
  githubUrl: string;
}) {
  return (
    <>
      <div className="flex w-full flex-col gap-3">
        {platforms.map(({ id, label, description, icon, assets }) => {
          if (assets.length === 0) {
            return (
              <div
                className="flex items-center justify-between rounded-xl bg-zinc-900 px-6 py-4 opacity-40"
                key={id}
              >
                <div className="flex items-center gap-4">
                  <span className="text-zinc-400">{icon}</span>
                  <div>
                    <p className="font-medium text-sm text-white">{label}</p>
                    <p className="text-xs text-zinc-500">{description}</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-600">Coming soon</span>
              </div>
            );
          }

          return assets.map((asset) => (
            <a
              className="group flex items-center justify-between rounded-xl bg-zinc-900 px-6 py-4 no-underline transition-colors hover:bg-zinc-800"
              href={asset.browser_download_url}
              key={asset.browser_download_url}
              onClick={sounds.download}
            >
              <div className="flex items-center gap-4">
                <span className="text-zinc-400 transition-colors group-hover:text-white">
                  {icon}
                </span>
                <div>
                  <p className="font-medium text-sm text-white">{label}</p>
                  <p className="text-xs text-zinc-500">
                    {description} · {formatMB(asset.size)}
                  </p>
                </div>
              </div>
              <svg
                aria-hidden="true"
                className="size-4 text-zinc-600 transition-colors group-hover:text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          ));
        })}
      </div>

      <p className="mt-10 text-xs text-zinc-600">
        All releases on{" "}
        <a
          className="text-zinc-400 transition-colors hover:text-white"
          href={`${githubUrl}/releases`}
          onClick={sounds.click}
          rel="noopener"
          target="_blank"
        >
          GitHub
        </a>
      </p>
    </>
  );
}
