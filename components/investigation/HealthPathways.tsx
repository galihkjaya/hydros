import { Eyebrow, SectionHeading } from "@/components/ui/primitives";
import { ATTRIBUTE_LABELS } from "./view-model";
import type { HealthDomain, HealthPathway, Source } from "@/types/investigation";

const DOMAINS: { id: HealthDomain; title: string; body: string }[] = [
  {
    id: "human",
    title: "Human health",
    body: "How people could come into contact with this water.",
  },
  {
    id: "animal",
    title: "Animal health",
    body: "How wildlife, pets, or livestock could be exposed.",
  },
  {
    id: "ecosystem",
    title: "Ecosystem health",
    body: "How the waterway itself and its habitat could be affected.",
  },
];

/**
 * One Health pathways panel.
 *
 * Layer 2.5 rendered in the three-column editorial layout: each pathway shows
 * its conditional description, its basis as inline source links, and what
 * would need measuring to confirm it. Pathways never conclude — the
 * assessment below owns all inference.
 */
export function HealthPathways({
  pathways,
  sources,
}: {
  pathways: readonly HealthPathway[];
  sources: readonly Source[];
}) {
  if (pathways.length === 0) return null;

  const byUrl = new Map(sources.map((source) => [source.url, source]));

  return (
    <div className="border-t-2 border-ink pt-5">
      <SectionHeading
        label="One Health pathways"
        title="How this water could touch health"
      />
      <p className="hydros-prose mt-2 text-[0.875rem] text-ink-muted">
        Potential exposure routes, stated conditionally and cited to their
        basis. A pathway is not a finding of harm — only the assessment
        below may weigh them.
      </p>

      <div className="mt-6 grid gap-8 sm:grid-cols-3">
        {DOMAINS.map((domain) => {
          const items = pathways.filter(
            (pathway) => pathway.domain === domain.id,
          );
          if (items.length === 0) return null;
          return (
            <div
              key={domain.id}
              className="border-t border-rule pt-4 sm:border-t-0 sm:border-l sm:border-rule sm:pt-0 sm:pl-6 sm:first:border-l-0 sm:first:pl-0"
            >
              <Eyebrow>{domain.title}</Eyebrow>
              <p className="mt-1 text-[0.8125rem] text-ink-muted">
                {domain.body}
              </p>
              <ul className="mt-4 space-y-4">
                {items.map((pathway, index) => (
                  <li key={`${pathway.route}-${index}`}>
                    <p className="font-mono text-[0.6875rem] tracking-wider text-ink-faint uppercase">
                      {pathway.route.replace("_", " ")} ·{" "}
                      {Math.round(pathway.strength * 100)}%
                    </p>
                    <p className="mt-1 text-[0.9375rem] leading-6">
                      {pathway.description}
                    </p>
                    {pathway.affectedGroup ? (
                      <p className="mt-1 text-[0.8125rem] text-ink-muted">
                        Exposed: {pathway.affectedGroup}
                      </p>
                    ) : null}
                    <BasisLinks basis={pathway.basis} byUrl={byUrl} />
                    {pathway.confirmationRequired ? (
                      <p className="mt-1 font-serif text-[0.875rem] text-ink-muted italic">
                        To confirm: {pathway.confirmationRequired}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BasisLinks({
  basis,
  byUrl,
}: {
  basis: readonly string[];
  byUrl: Map<string, Source>;
}) {
  if (basis.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
      {basis.map((entry) => {
        const observation = /^observation:([a-z_]+)$/.exec(entry);
        if (observation) {
          const attribute = observation[1] as keyof typeof ATTRIBUTE_LABELS;
          return (
            <li
              key={entry}
              className="font-mono text-[0.6875rem] tracking-wider text-ink-muted uppercase"
            >
              Observed: {ATTRIBUTE_LABELS[attribute] ?? attribute}
            </li>
          );
        }
        const source = byUrl.get(entry);
        return (
          <li key={entry}>
            <a
              href={entry}
              target="_blank"
              rel="noreferrer noopener nofollow"
              className="font-mono text-[0.6875rem] tracking-wider text-ink-muted uppercase underline underline-offset-4 hover:text-ink"
            >
              {source ? source.domain : "Source"}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
