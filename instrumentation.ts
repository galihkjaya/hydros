/**
 * Server boot hook. Runs the Supabase connectivity probe in development so a
 * broken database connection is impossible to miss. Fire-and-forget and
 * failure-proof: boot never depends on it.
 */
export async function register(): Promise<void> {
  try {
    const { probeSupabaseAtBoot } = await import("./lib/supabase/boot-probe");
    void probeSupabaseAtBoot().catch(() => undefined);
  } catch {
    // Probing must never break boot.
  }
}
