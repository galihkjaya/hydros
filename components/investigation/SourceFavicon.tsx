"use client";

import { useState } from "react";
import { domainInitial, faviconUrl } from "@/lib/utils/favicon";
import { cn } from "@/components/ui/primitives";

/**
 * Favicon for a discovered source, with a graceful fallback.
 *
 * Plain <img> rather than next/image: these are arbitrary third-party hosts and
 * routing them through the image optimiser would burn Vercel transformations
 * for a 16px icon.
 */
export function SourceFavicon({
  url,
  size = 20,
  className,
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(url);

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded bg-surface-muted text-[0.625rem] font-semibold text-muted",
          className,
        )}
      >
        {domainInitial(url)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- third-party favicon, not worth an optimiser transform
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded", className)}
    />
  );
}
