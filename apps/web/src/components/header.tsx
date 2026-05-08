"use client";
import Link from "next/link";
import UserMenu from "./user-menu";
import { WindowControls } from "./window-controls";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <header className="relative sticky top-0 z-50 h-14 w-full border-white/10 border-b bg-black/50 backdrop-blur-xl">
      {/* Window controls — absolutely pinned to edges, never under content */}
      <WindowControls />

      {/* Content row — padded by CSS vars so it never overlaps controls */}
      <div
        className="flex h-full items-center gap-4 px-4"
        style={{
          paddingLeft: "max(1rem, var(--titlebar-left, 0px))",
          paddingRight: "max(1rem, var(--titlebar-right, 0px))",
        }}
      >
        <nav className="flex gap-6 font-medium text-sm">
          {links.map(({ to, label }) => (
            <Link
              className="text-neutral-400 transition-colors hover:text-white"
              href={to}
              key={to}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Empty area — this is the actual drag region */}
        <div className="flex-1 self-stretch" data-tauri-drag-region />

        <UserMenu />
      </div>
    </header>
  );
}
