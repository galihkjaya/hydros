/**
 * WaterLens mark: a lens ring over a waterline.
 * Pure SVG, inherits `currentColor`, decorative by default.
 */
export function Logo({
  className = "size-6",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* lens */}
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.85"
      />
      {/* waterline through the lens */}
      <path
        d="M4.4 13.2c1.5 0 1.5-1.4 3-1.4s1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4 1.5-1.4 3-1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* droplet highlight */}
      <path
        d="M12 5.6c1.6 1.9 2.4 3.1 2.4 4.1a2.4 2.4 0 0 1-4.8 0c0-1 .8-2.2 2.4-4.1Z"
        fill="currentColor"
        opacity="0.2"
      />
    </svg>
  );
}

/** Logo + wordmark, used in the navbar and the source-gathering animation. */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-2">
        <Logo className="size-6 text-accent" />
        <span className="text-[0.9375rem] font-semibold tracking-tight">
          WaterLens
        </span>
      </span>
    </span>
  );
}
