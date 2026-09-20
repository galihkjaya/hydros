"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoWordmark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/components/ui/primitives";

const LINKS = [
  { href: "/investigate", label: "Investigate" },
  { href: "/map", label: "Map" },
  { href: "/cities", label: "Cities" },
  { href: "/alerts", label: "Alerts" },
] as const;

/**
 * Application header. On narrow screens the nav wraps to a second row rather
 * than overflowing or hiding links behind a menu — every destination stays
 * one tap away at 375px.
 */
export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:gap-3 sm:px-10 sm:py-0">
        <Link
          href="/"
          className="text-ink transition-opacity hover:opacity-80"
          aria-label="Hydros home"
        >
          <LogoWordmark />
        </Link>

        <nav
          aria-label="Main"
          className="ml-auto flex min-w-0 basis-full items-center gap-0.5 sm:basis-auto sm:gap-1"
        >
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-2 py-1.5 font-mono text-[0.6875rem] tracking-wider whitespace-nowrap uppercase transition-colors sm:px-3 sm:text-[0.8125rem]",
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
