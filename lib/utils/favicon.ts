/**
 * Favicon URL resolution.
 *
 * Favicons are referenced, never downloaded or stored: a third-party resolver
 * gives us one predictable URL per domain and the browser caches it. Failures
 * are handled at render time by falling back to a domain initial.
 */

/** Extracts the registrable-ish hostname, without "www.". Empty on bad input. */
export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Google's s2 favicon service. Chosen because it resolves a usable icon for
 * domains that do not serve /favicon.ico, and returns a generic globe rather
 * than a 404 — which keeps the source cluster visually stable.
 *
 * ponytail: single external dependency for icons. Swap for DuckDuckGo's
 * ip3 endpoint or self-host if this ever becomes a privacy or uptime concern.
 */
export function faviconUrl(url: string, size: 32 | 64 = 64): string | null {
  const domain = domainFromUrl(url);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/** Single-character fallback shown when the favicon cannot be loaded. */
export function domainInitial(url: string): string {
  const domain = domainFromUrl(url);
  return domain ? domain.charAt(0).toUpperCase() : "?";
}
