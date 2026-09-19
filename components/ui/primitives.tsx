/**
 * Shared UI primitives for Hydros.
 *
 * Newspaper system: hairline rules instead of shadows, zero radius except
 * pill chips, ink fills, one signal red. Every other component imports from
 * here — no ad-hoc Tailwind color classes for structure.
 *
 * `Badge` and `SectionHeading` remain as compatibility aliases over `Chip`
 * and the editorial headings so older panels keep rendering while they are
 * migrated file by file.
 */
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import type { RiskLevel } from "@/types/investigation";

/** Joins class names, dropping falsy values. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Rules and eyebrows                                                  */
/* ------------------------------------------------------------------ */

/** 1px hairline divider. `strong` renders the 2px section rule. */
export function Rule({
  strong = false,
  className,
}: {
  strong?: boolean;
  className?: string;
}) {
  return (
    <hr
      aria-hidden="true"
      className={cn(
        "border-0",
        strong ? "border-t-2 border-ink" : "border-t border-rule",
        className,
      )}
    />
  );
}

/** 11px uppercase section kicker in muted ink. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("hydros-eyebrow", className)}>{children}</p>;
}

/** Serif display heading. Wrap one phrase per heading in <em> for accent. */
export function DisplayHeading({
  level = 2,
  children,
  className,
}: {
  level?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  const sizes = {
    1: "font-serif text-4xl leading-[1.0] tracking-tight sm:text-6xl",
    2: "font-serif text-2xl leading-[1.05] sm:text-4xl",
    3: "font-serif text-xl leading-tight",
  } as const;
  if (level === 1)
    return <h1 className={cn(sizes[1], className)}>{children}</h1>;
  if (level === 3)
    return <h3 className={cn(sizes[3], className)}>{children}</h3>;
  return <h2 className={cn(sizes[2], className)}>{children}</h2>;
}

/** Section heading with the small uppercase eyebrow used across the app. */
export function SectionHeading({
  label,
  title,
  action,
}: {
  label: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div>
        <Eyebrow>{label}</Eyebrow>
        {title ? (
          <h2 className="mt-1 font-serif text-xl">{title}</h2>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards, chips, buttons                                               */
/* ------------------------------------------------------------------ */

/**
 * Editorial card: no fill, no shadow — a hairline top rule, an optional
 * eyebrow, and content. Hover shifts to sunk paper.
 */
export function Card({
  eyebrow,
  hoverable = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-t border-rule bg-paper",
        hoverable && "transition-colors hover:bg-paper-sunk",
        className,
      )}
      {...props}
    >
      {eyebrow ? (
        <Eyebrow className="border-b border-rule pb-2">{eyebrow}</Eyebrow>
      ) : null}
      {children}
    </div>
  );
}

type ChipTone = "low" | "medium" | "high" | "unknown" | "neutral" | "mono";

/**
 * Typographic risk chip. Newspaper style — risk is type, not color badges:
 * LOW is an ink outline, MEDIUM a solid ink fill, HIGH a signal fill with a
 * 3px left rule on the containing block, INSUFFICIENT_DATA a dashed outline.
 */
export function Chip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<ChipTone, string> = {
    low: "border border-ink text-ink",
    medium: "border border-ink bg-ink text-paper",
    high: "border border-signal bg-signal text-white",
    unknown: "border border-dashed border-ink-faint text-ink-muted",
    neutral: "border border-rule text-ink-muted",
    mono: "border border-rule font-mono text-ink-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.6875rem] font-medium tracking-wider uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Risk level → chip tone under the newspaper rules. */
export function riskChipTone(level: RiskLevel): ChipTone {
  switch (level) {
    case "LOW":
      return "low";
    case "MEDIUM":
      return "medium";
    case "HIGH":
      return "high";
    case "INSUFFICIENT_DATA":
      return "unknown";
  }
}

/** Compatibility alias: maps legacy badge tones onto newspaper chips. */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "accent" | "low" | "medium" | "high" | "unknown";
  children: ReactNode;
  className?: string;
}) {
  const mapped: ChipTone =
    tone === "accent" ? "medium" : tone === "unknown" ? "unknown" : tone;
  return (
    <Chip tone={mapped} className={className}>
      {children}
    </Chip>
  );
}

type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

/**
 * Newspaper buttons: primary is solid ink, secondary an ink outline,
 * tertiary an underlined text link. Square corners everywhere.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-none font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-ink text-paper hover:opacity-85",
    secondary:
      "border border-ink bg-transparent text-ink hover:bg-paper-sunk",
    tertiary:
      "text-ink underline underline-offset-4 hover:text-ink-muted",
    ghost: "text-ink-muted hover:bg-paper-sunk hover:text-ink",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-[0.8125rem]",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-[0.9375rem]",
  };
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

/** Tertiary link styled as an underlined newspaper link. */
export function TextLink({
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        "underline decoration-ink-faint underline-offset-4 hover:text-ink hover:decoration-ink",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Data and figures                                                    */
/* ------------------------------------------------------------------ */

/** Monospace label/value pair for coordinates, counts, timestamps. */
export function DataPair({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <span className="hydros-eyebrow">{label}</span>
      <span className="hydros-mono text-right text-ink">{value}</span>
    </div>
  );
}

/** Square-cornered figure with a 1px ink border and serif caption. */
export function Figure({
  children,
  caption,
  className,
}: {
  children: ReactNode;
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div className="border border-ink">{children}</div>
      {caption ? (
        <figcaption className="mt-2 font-serif text-sm text-ink-muted italic">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * Bordered callout for honest limitations and auditable alerts.
 * `tone="signal"` adds the 3px left signal rule for HIGH risk / concerns.
 */
export function Callout({
  eyebrow,
  tone = "ink",
  children,
  className,
}: {
  eyebrow?: string;
  tone?: "ink" | "signal";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-ink bg-paper p-5",
        tone === "signal" && "border-l-[3px] border-l-signal",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <div className={cn(eyebrow && "mt-2")}>{children}</div>
    </div>
  );
}

/**
 * Confidence as a monospace percentage beside a thin horizontal rule that
 * fills proportionally — a rule, not a rounded progress bar.
 */
export function ConfidenceRule({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-rule"
        style={{
          backgroundImage: `linear-gradient(to right, var(--ink) ${pct}%, transparent ${pct}%)`,
        }}
      />
      <span className="hydros-mono text-ink-muted">{pct}%</span>
    </span>
  );
}
