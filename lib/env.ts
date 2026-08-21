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
  | "OPENROUTER_API_KEY"
  | "OPENROUTER_MODEL"
  | "GROQ_API_KEY"
  | "GROQ_MODEL"
  | "SEARCH_API_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY";

type PublicVar = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function read(name: ServerVar | PublicVar): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
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

/** True when every variable required for a full investigation is present. */
export function hasInvestigationCredentials(): boolean {
  return (
    !!read("NVIDIA_API_KEY") &&
    !!read("OPENROUTER_API_KEY") &&
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
