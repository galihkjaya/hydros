/**
 * Server-boot connectivity probe (development only).
 *
 * One cheap read against Supabase at startup. If it fails, prints an
 * actionable banner — what failed, the root cause, the likely fix — instead
 * of letting every investigation degrade silently. Never crashes: persistence
 * stays optional by design. Never logs keys or tokens.
 */
import { describeError, persistenceDetail, persistenceStatus } from "./client";
import { optionalEnv } from "@/lib/env";

let probed = false;

export async function probeSupabaseAtBoot(): Promise<void> {
  if (probed || process.env.NODE_ENV === "production") return;
  probed = true;

  const status = persistenceStatus();
  if (status === "off") {
    console.info(
      "[hydros] Supabase persistence is off (no credentials). Investigations still run; history, map, and sites stay empty.",
    );
    return;
  }
  if (status === "broken") {
    printBanner(persistenceDetail() ?? "invalid Supabase configuration");
    return;
  }

  const raw = optionalEnv("NEXT_PUBLIC_SUPABASE_URL") ?? "";
  const base = raw
    .replace(/\/(rest|auth|storage)\/v\d+\/?$/, "")
    .replace(/\/+$/, "");
  const key = optionalEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      `${base}/rest/v1/sites?select=geohash&limit=1`,
      {
        headers: { apikey: key },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!response.ok) {
      await response.text().catch(() => "");
      printBanner(`probe returned HTTP ${response.status}`);
      return;
    }
    console.info("[hydros] Supabase persistence is reachable.");
  } catch (error) {
    printBanner(describeError(error));
  } finally {
    clearTimeout(timer);
  }
}

function printBanner(detail: string): void {
  const hint = hintFor(detail);
  console.warn(
    [
      "",
      "================================================================",
      "[hydros] Supabase is configured BUT UNREACHABLE.",
      `[hydros] Root cause: ${detail}`,
      `[hydros] Likely fix: ${hint}`,
      "[hydros] Investigations still complete; history, map, sites, and",
      "[hydros] seeding degrade until the connection works.",
      "================================================================",
      "",
    ].join("\n"),
  );
}

function hintFor(detail: string): string {
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(detail)) {
    return "the project hostname does not resolve — the project may be paused or deleted, or the URL is wrong. Check the Supabase dashboard and update NEXT_PUBLIC_SUPABASE_URL.";
  }
  if (/ECONNREFUSED/i.test(detail)) {
    return "connection refused — check for a proxy/firewall blocking outbound HTTPS, or a wrong URL port.";
  }
  if (/CERT_|certificate|TLS|SSL/i.test(detail)) {
    return "TLS failure — check system clock and corporate TLS interception.";
  }
  if (/abort|timeout/i.test(detail)) {
    return "connection timed out — the project may be resuming from pause; wait a minute and restart.";
  }
  if (/401|403/.test(detail)) {
    return "credentials rejected — rotate SUPABASE_SERVICE_ROLE_KEY in the dashboard and update .env (never commit it).";
  }
  if (/not a valid URL|unsupported scheme/i.test(detail)) {
    return "fix NEXT_PUBLIC_SUPABASE_URL in .env (full https:// URL, no quotes or trailing junk).";
  }
  return "verify the project URL and service key in the Supabase dashboard.";
}
