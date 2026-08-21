import { Badge, Card, SectionHeading } from "@/components/ui/primitives";
import { formatConfidence } from "@/lib/utils/format";
import { EvidenceCard } from "./EvidenceCard";
import type {
  AssessmentView,
  EvidenceView,
  RiskLevel,
  SourceView,
} from "./view-model";

const LEVEL: Record<
  RiskLevel,
  { label: string; tone: "low" | "medium" | "high" | "unknown"; blurb: string }
> = {
  LOW: {
    label: "Low concern",
    tone: "low",
    blurb: "No strong indicators found in the visible evidence or the records.",
  },
  MEDIUM: {
    label: "Moderate concern",
    tone: "medium",
    blurb: "Some indicators warrant caution and further checking.",
  },
  HIGH: {
    label: "High concern",
    tone: "high",
    blurb: "Multiple converging indicators suggest a real risk.",
  },
  INSUFFICIENT_DATA: {
    label: "Insufficient data",
    tone: "unknown",
    blurb:
      "The available evidence does not support a risk conclusion either way.",
  },
};

/**
 * Final assessment panel.
 *
 * Ordered to answer the user's questions in sequence: what does it mean, why,
 * on what evidence, how certain, what now, and what we could not determine.
 * Confidence and limitations are never collapsed away — the level alone would
 * imply laboratory certainty the system does not have.
 */
export function RiskAssessment({
  assessment,
  evidence,
  sources,
}: {
  assessment: AssessmentView;
  evidence: readonly EvidenceView[];
  sources: readonly SourceView[];
}) {
  const level = LEVEL[assessment.riskLevel];

  return (
    <Card className="animate-rise overflow-hidden">
      <header className="border-b border-line bg-surface-muted/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="wl-label">Assessment</p>
            <h2 className="mt-1 text-xl font-semibold">{level.label}</h2>
          </div>
          <div className="text-right">
            <Badge tone={level.tone}>{assessment.riskLevel.replace("_", " ")}</Badge>
            <p className="mt-1.5 wl-mono text-subtle">
              confidence {formatConfidence(assessment.confidence)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[0.875rem] text-muted">{level.blurb}</p>
      </header>

      <div className="space-y-6 p-5 sm:p-6">
        <section>
          <p className="wl-label">Inference</p>
          <p className="mt-2 leading-7">{assessment.summary}</p>
        </section>

        {assessment.riskFactors.length > 0 ? (
          <section>
            <p className="wl-label">Risk factors considered</p>
            <ul className="mt-2 space-y-1.5">
              {assessment.riskFactors.map((factor) => (
                <li
                  key={factor}
                  className="flex gap-2.5 text-[0.9375rem] leading-6"
                >
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-line-strong" />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {evidence.length > 0 ? (
          <section>
            <SectionHeading label="Supporting evidence" />
            <div className="mt-3 space-y-3">
              {evidence.map((item, index) => (
                <EvidenceCard
                  key={`${item.claim}-${index}`}
                  evidence={item}
                  source={sources[item.sourceIndex]}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-lg border border-accent/30 bg-accent-muted/50 p-4">
          <p className="wl-label">What to do next</p>
          <p className="mt-2 leading-6">{assessment.recommendation}</p>
        </section>

        {assessment.limitations.length > 0 ? (
          <section>
            <p className="wl-label">What this cannot tell you</p>
            <ul className="mt-2 space-y-1.5">
              {assessment.limitations.map((limitation) => (
                <li
                  key={limitation}
                  className="flex gap-2.5 text-[0.875rem] leading-6 text-muted"
                >
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-line-strong" />
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Card>
  );
}
