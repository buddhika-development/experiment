"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Voice Chat" },
  { href: "/journal", label: "Daily Journal" },
  { href: "/profile", label: "My Info" },
  { href: "/settings", label: "Settings" },
] as const;

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-violet-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold text-violet-800">
          Unpause
        </Link>
        <nav className="flex gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-violet-700 text-white"
                  : "text-zinc-600 hover:bg-violet-50 hover:text-violet-800"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
