/**
 * Server-side environment access.
 *
 * Every value here is read lazily so that the app still builds and renders
 * when credentials are absent. Missing keys surface as a `ConfigError` at the
 * moment a provider is actually used, never as a build-time crash and never
 * with the secret value included in the message.
 *
 * Only NEXT_PUBLIC_* variables may be referenced from client components.
 */

export class ConfigError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(`Server configuration error: ${variable} is not configured.`);
    this.name = "ConfigError";
    this.variable = variable;
  }
}

type ServerVar =
  | "NVIDIA_API_KEY"
  | "NVIDIA_VISION_MODEL"
  | "CEREBRAS_API_KEY"
  | "CEREBRAS_MODEL"
  | "GROQ_API_KEY"
  | "GROQ_MODEL"
  | "SEARCH_API_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY";

type PublicVar = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function read(name: ServerVar | PublicVar): string | undefined {
  const value = process.env[name];
  // Strip \r so CRLF-contaminated .env files cannot corrupt values.
  if (!value) return undefined;
  const cleaned = value.replace(/\r/g, "").trim();
  return cleaned ? cleaned : undefined;
}

/** Returns the variable, or throws a ConfigError that is safe to surface. */
export function requireEnv(name: ServerVar | PublicVar): string {
  const value = read(name);
  if (!value) throw new ConfigError(name);
  return value;
}

/** Returns the variable or `undefined` — for optional integrations. */
export function optionalEnv(name: ServerVar | PublicVar): string | undefined {
  return read(name);
}

export type SupabaseUrlState =
  | { kind: "unset" }
  | { kind: "invalid"; message: string }
  | { kind: "ok"; url: string };

/**
 * Normalized Supabase project URL.
 *
 * Trims whitespace, strips stray wrapping quotes and trailing slashes, and
 * prepends https:// when the scheme is missing (a bare
 * `abcdef.supabase.co` otherwise fails at the transport layer with a bare
 * TypeError). Returns a descriptive state instead of throwing, so callers
 * can distinguish "not configured" from "misconfigured".
 */
export function readSupabaseUrl(): SupabaseUrlState {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw || !raw.replace(/\r/g, "").trim()) return { kind: "unset" };

  const cleaned = raw
    .replace(/\r/g, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!cleaned) return { kind: "unset" };

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;
  const url = withScheme.replace(/\/+$/, "");

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        kind: "invalid",
        message: `NEXT_PUBLIC_SUPABASE_URL has an unsupported scheme: ${parsed.protocol}`,
      };
    }
    return { kind: "ok", url };
  } catch {
    return {
      kind: "invalid",
      message: `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${cleaned.slice(0, 60)}`,
    };
  }
}

/** True when every variable required for a full investigation is present. */
export function hasInvestigationCredentials(): boolean {
  return (
    !!read("NVIDIA_API_KEY") &&
    !!read("CEREBRAS_API_KEY") &&
    !!read("CEREBRAS_MODEL") &&
    !!read("GROQ_API_KEY") &&
    !!read("SEARCH_API_KEY")
  );
}

/** Supabase persistence is optional; the UI must work without it. */
export function hasSupabaseCredentials(): boolean {
  return (
    !!read("NEXT_PUBLIC_SUPABASE_URL") && !!read("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

/**
 * Maps any thrown value to a user-safe message. Never leaks credentials,
 * stack traces or raw provider payloads.
 */
export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof ConfigError) return error.message;
  if (error instanceof Error && error.name === "InvestigationError") {
    return error.message;
  }
  return "An unexpected error occurred while processing the request.";
}
