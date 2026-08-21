/**
 * Shared UI primitives for WaterLens.
 *
 * Deliberately one small file: these are thin styled wrappers over native
 * elements, not a component library. Every interactive primitive keeps its
 * native semantics so keyboard and screen-reader behaviour comes for free.
 */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/** Joins class names, dropping falsy values. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  secondary:
    "border border-line-strong bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[0.9375rem]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("wl-card", className)} {...props} />;
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
        <p className="wl-label">{label}</p>
        {title ? (
          <h2 className="mt-1 text-base font-semibold">{title}</h2>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Neutral pill. `tone` maps to the semantic risk colours so the same primitive
 * covers source types and risk levels.
 */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "accent" | "low" | "medium" | "high" | "unknown";
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line bg-surface-muted text-muted",
    accent: "border-transparent bg-accent-muted text-accent",
    low: "border-transparent bg-risk-low/12 text-risk-low",
    medium: "border-transparent bg-risk-medium/15 text-risk-medium",
    high: "border-transparent bg-risk-high/12 text-risk-high",
    unknown: "border-line bg-surface-muted text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
