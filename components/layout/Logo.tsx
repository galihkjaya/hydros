/**
 * Hydros mark: three stacked horizontal rules of decreasing width,
 * suggesting a water surface / stratification. Wordmark-first: HYDROS set
 * in the display serif, letter-spaced, with a single hairline rule beneath.
 * Pure ink, works on paper, one SVG, no gradients.
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
      {/* three stratified rules, decreasing width */}
      <path
        d="M3 8h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M5.5 12.5h13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M8.5 17h7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  );
}

/** Logo + wordmark, used in the navbar and the source-gathering animation. */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-2">
        <Logo className="size-6" />
        <span className="flex flex-col leading-none">
          <span className="font-serif text-[1.0625rem] tracking-[0.22em]">
            HYDROS
          </span>
          <span
            aria-hidden="true"
            className="mt-1 h-px w-full bg-current opacity-70"
          />
        </span>
      </span>
    </span>
  );
}
