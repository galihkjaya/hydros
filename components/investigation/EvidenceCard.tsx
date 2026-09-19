import { Badge } from "@/components/ui/primitives";
import { SourceFavicon } from "./SourceFavicon";
import {
  SOURCE_TYPE_LABEL,
  SOURCE_TYPE_WEIGHT,
  formatSourceAge,
  isStaleSource,
} from "@/lib/ai/integrity";
import type { Evidence, Source, SourceType } from "@/types/investigation";

const SOURCE_TONE: Record<SourceType, "accent" | "neutral"> = {
  government: "accent",
  scientific: "accent",
  news: "neutral",
  community: "neutral",
  unverified: "neutral",
};

/**
 * One retrieved claim with the source behind it.
 *
 * The claim and its uncertainty are shown together and labelled EVIDENCE, never
 * merged into a conclusion — the assessment panel is the only place inference
 * appears.
 */
export function EvidenceCard({
  evidence,
  source,
}: {
  evidence: Evidence;
  source: Source | undefined;
}) {
  return (
    <article className="border border-line bg-surface p-4">
      <p className="text-[0.9375rem] leading-6">{evidence.claim}</p>

      {evidence.uncertainty ? (
        <p className="mt-2 border-l-2 border-line-strong pl-3 text-[0.8125rem] text-muted">
          <span className="wl-label">Uncertainty</span>{" "}
          <span className="block">{evidence.uncertainty}</span>
        </p>
      ) : null}

      {source ? (
        <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="flex min-w-0 items-center gap-2 text-[0.8125rem] hover:underline"
          >
            <SourceFavicon url={source.url} size={16} />
            <span className="truncate">{source.title}</span>
          </a>
          <Badge tone={SOURCE_TONE[source.sourceType]}>
            {SOURCE_TYPE_LABEL[source.sourceType]} · ×
            {SOURCE_TYPE_WEIGHT[source.sourceType].toFixed(1)}
          </Badge>
          <span className="wl-mono text-subtle" title={source.publishedAt ?? "No publication date reported"}>
            {source.publishedAt ?? "no date"} · {formatSourceAge(source)}
            {isStaleSource(source) ? " · stale" : null}
          </span>
        </footer>
      ) : (
        // The claim's source URL did not survive into the package: show the raw
        // link rather than dropping attribution entirely.
        <footer className="mt-3 border-t border-line pt-3">
          <a
            href={evidence.sourceUrl}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="wl-mono text-subtle hover:underline"
          >
            {evidence.sourceUrl}
          </a>
        </footer>
      )}
    </article>
  );
}

/** Compact source row used in the sources panel. */
export function SourceRow({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer noopener nofollow"
      className="animate-rise flex items-start gap-3 border border-line bg-surface p-3 transition-colors hover:bg-surface-muted"
    >
      <SourceFavicon url={source.url} size={20} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-medium">
          {source.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="wl-mono truncate text-subtle">{source.domain}</span>
          <Badge tone={SOURCE_TONE[source.sourceType]}>
            {SOURCE_TYPE_LABEL[source.sourceType]}
          </Badge>
          <span className="wl-mono text-subtle">{formatSourceAge(source)}</span>
        </span>
        {source.snippet ? (
          <span className="mt-1.5 line-clamp-2 block text-[0.8125rem] text-muted">
            {source.snippet}
          </span>
        ) : null}
      </span>
    </a>
  );
}
