import Link from "next/link";
import {
  Callout,
  DisplayHeading,
  Eyebrow,
  Rule,
} from "@/components/ui/primitives";
import { evaluateSiteAlerts } from "@/lib/investigation/alerts";
import {
  getSite,
  isPersistenceEnabled,
  listSites,
  listVisits,
} from "@/lib/supabase/store";

export const metadata = { title: "Alerts" };

/**
 * Degradation alerts index.
 *
 * Deterministic threshold rules over observed data — not predictive
 * modelling. Every alert states its rule and links its basis.
 */
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const configured = isPersistenceEnabled();
  const sites = configured ? await listSites(100) : [];

  const flagged: {
    geohash: string;
    displayName: string | null;
    alerts: ReturnType<typeof evaluateSiteAlerts>;
  }[] = [];
  if (configured) {
    // Bounded: only sites with repeat visits can fire rules.
    const candidates = sites.filter((site) => site.investigationCount >= 2);
    for (const site of candidates) {
      const visits = await listVisits(site.geohash, 50);
      const alerts = evaluateSiteAlerts(site.geohash, visits);
      if (alerts.length > 0) {
        flagged.push({
          geohash: site.geohash,
          displayName: site.displayName ?? site.waterwayName,
          alerts,
        });
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 sm:py-14">
      <header className="hydros-prose">
        <Eyebrow>Resilience informatics</Eyebrow>
        <DisplayHeading level={1} className="mt-2 text-3xl sm:text-5xl">
          Degradation <em>alerts</em>
        </DisplayHeading>
        <p className="mt-3 text-ink-muted">
          Threshold rules over observed data — risk rose between visits,
          concern persisted, new authoritative evidence appeared, or a strong
          new exposure pathway mapped. Not predictive modelling, and every
          alert shows its working.
        </p>
      </header>

      <Rule strong className="mt-8" />

      {!configured ? (
        <p className="mt-8 text-ink-muted">
          Alerts need stored investigations. Configure Supabase to enable them.
        </p>
      ) : flagged.length === 0 ? (
        <div className="mt-8 border-t border-rule pt-5">
          <h2 className="font-serif text-2xl">No alerts firing</h2>
          <p className="mt-2 text-ink-muted">
            Rules evaluate on every site with repeat visits. Nothing currently
            crosses a threshold.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-6">
          {flagged.map(({ geohash, displayName, alerts }) => (
            <li key={geohash}>
              <p className="font-mono text-[0.8125rem] text-ink-faint">
                <Link href={`/site/${geohash}`} className="underline underline-offset-4 hover:text-ink">
                  {displayName ?? geohash} · {geohash}
                </Link>
              </p>
              <div className="mt-3 space-y-4">
                {alerts.map((alert, index) => (
                  <Callout
                    key={`${alert.triggeredAt}-${index}`}
                    eyebrow={alert.severity === "concern" ? "Concern" : "Watch"}
                    tone={alert.severity === "concern" ? "signal" : "ink"}
                  >
                    <p className="text-[0.9375rem]">{alert.reason}</p>
                    <p className="mt-2 font-mono text-[0.8125rem] text-ink-muted">
                      Basis:{" "}
                      {alert.basis.map((id, i) => (
                        <span key={id}>
                          {i > 0 ? ", " : ""}
                          <Link
                            href={`/investigations/${id}`}
                            className="underline underline-offset-4 hover:text-ink"
                          >
                            {id.slice(0, 8)}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </Callout>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
