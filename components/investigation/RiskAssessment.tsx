import {
  Chip,
  ConfidenceRule,
  SectionHeading,
  riskChipTone,
} from "@/components/ui/primitives";
import { formatConfidence } from "@/lib/utils/format";
import { EvidenceCard } from "./EvidenceCard";
import { RISK_LEVEL_LABELS } from "./view-model";
import type {
  Evidence,
  RiskAssessment as RiskAssessmentData,
  RiskLevel,
  Source,
} from "@/types/investigation";

const LEVEL_BLURB: Record<RiskLevel, string> = {
  LOW: "No strong indicators found in the visible evidence or the records.",
  MEDIUM: "Some indicators warrant caution and further checking.",
  HIGH: "Multiple converging indicators suggest a real risk.",
  INSUFFICIENT_DATA:
    "The available evidence does not support a risk conclusion either way.",
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
  sources,
}: {
  assessment: RiskAssessmentData;
  sources: readonly Source[];
}) {
  const tone = riskChipTone(assessment.riskLevel);
  const byUrl = new Map(sources.map((source) => [source.url, source]));
  const high = assessment.riskLevel === "HIGH";

  return (
    <div
      className={
        high
          ? "animate-rise border border-ink border-l-[3px] border-l-signal"
          : "animate-rise border-t border-rule"
      }
    >
      <header className="border-b border-rule bg-paper-sunk/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="wl-label">Assessment</p>
            <h2 className="mt-1 font-serif text-2xl">
              {RISK_LEVEL_LABELS[assessment.riskLevel]}
            </h2>
          </div>
          <div className="text-right">
            <Chip tone={tone}>
              {assessment.riskLevel.replace("_", " ")}
            </Chip>
            <p className="mt-1.5 wl-mono text-subtle">
              confidence {formatConfidence(assessment.confidence)}
            </p>
            <ConfidenceRule value={assessment.confidence} className="mt-2 w-40" />
          </div>
        </div>
        <p className="mt-3 text-[0.875rem] text-muted">
          {LEVEL_BLURB[assessment.riskLevel]}
        </p>
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
                  <Dot />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {assessment.evidence.length > 0 ? (
          <section>
            <SectionHeading label="Supporting evidence" />
            <div className="mt-3 space-y-3">
              {assessment.evidence.map((item: Evidence, index) => (
                <EvidenceCard
                  key={`${item.sourceUrl}-${index}`}
                  evidence={item}
                  source={byUrl.get(item.sourceUrl)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="border border-ink p-4">
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
                  <Dot />
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="mt-2.5 size-1.5 shrink-0 bg-ink-faint"
    />
  );
}
