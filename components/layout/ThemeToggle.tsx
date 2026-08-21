"use client";

import { Button } from "@/components/ui/primitives";

type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "waterlens-theme";

/**
 * Inline script that applies the stored theme before first paint.
 * Rendered in <head> so there is no flash of the wrong theme.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t;}catch(e){}})();`;

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle() {
  // No React state: the current theme lives on <html>, written by
  // themeInitScript before hydration. Reading the DOM on click keeps the
  // button correct on first paint and avoids a hydration mismatch.
  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private-browsing mode: the toggle still works for this session.
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      title="Toggle light or dark theme"
      className="size-8 px-0"
    >
      {/* Both icons render; visibility follows the class on <html> so the
          correct one shows even before hydration. */}
      <SunIcon className="size-4 dark:hidden" />
      <MoonIcon className="hidden size-4 dark:block" />
    </Button>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
    </svg>
  );
}
