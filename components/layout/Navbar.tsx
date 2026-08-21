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
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="rounded-md text-foreground transition-opacity hover:opacity-80"
          aria-label="WaterLens home"
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
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-surface-muted font-medium text-foreground"
                    : "text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
