"use client";
import Link from "next/link";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <header
      className="sticky top-0 z-50 w-full border-white/10 border-b bg-black/50 backdrop-blur-xl"
      data-tauri-drag-region
    >
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <nav className="flex gap-6 font-medium text-sm">
          {links.map(({ to, label }) => {
            return (
              <Link
                className="text-neutral-400 transition-colors hover:text-white"
                href={to}
                key={to}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
