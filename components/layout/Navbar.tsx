"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoWordmark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/components/ui/primitives";

const LINKS = [
  { href: "/investigate", label: "Investigate" },
  { href: "/map", label: "Map" },
] as const;

/**
 * Application header. Client-side only because the active link depends on the
 * current pathname. Three links at most, so no hamburger menu is needed —
 * the nav stays visible and tappable on mobile.
 */
export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-6 sm:px-10">
        <Link
          href="/"
          className="text-ink transition-opacity hover:opacity-80"
          aria-label="Hydros home"
        >
          <LogoWordmark />
        </Link>

        <nav aria-label="Main" className="ml-auto flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-3 py-1.5 font-mono text-[0.8125rem] tracking-wider uppercase transition-colors",
                  active
                    ? "bg-ink font-medium text-paper"
                    : "text-ink-muted hover:bg-paper-sunk hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <span className="mx-1 h-5 w-px bg-rule" aria-hidden="true" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
