import Link from "next/link";
import {
  Callout,
  Chip,
  DisplayHeading,
  Eyebrow,
  Rule,
} from "@/components/ui/primitives";
import { Logo } from "@/components/layout/Logo";
import { DemoStrip } from "@/components/marketing/DemoStrip";

/**
 * Landing page. Server component — entirely static.
 *
 * The core job of this page is expectation-setting: Hydros reasons about
 * evidence, it does not test water. The three-layer model (observation /
 * evidence / inference) is introduced here so the assessment screen reads
 * as a continuation rather than a surprise.
 */

const TRACKS = [
  { id: "Track 2", label: "Data-to-Insight" },
  { id: "Track 3", label: "AI-Supported Assessment" },
  { id: "Track 6", label: "Resilience Informatics" },
  { id: "Track 7", label: "Digital Health Standards" },
] as const;

const PIPELINE = [
  {
    step: "01",
    title: "Visual analysis",
    body: "A vision model reports only what is visible: colour, clarity, turbidity, particles, foam, algae, debris.",
  },
  {
    step: "02",
    title: "Geographic context",
    body: "OpenStreetMap data locates nearby waterways, industry, agriculture, landfills and treatment facilities.",
  },
  {
    step: "03",
    title: "Web research",
    body: "A research model plans queries, then reads real search results and keeps every source URL.",
  },
  {
    step: "04",
    title: "Reasoning",
    body: "A final model synthesises a structured assessment, with confidence and stated limitations.",
  },
] as const;

const LAYERS = [
  {
    eyebrow: "Observation",
    example: "“The water appears brown and cloudy.”",
    body: "What can actually be seen in the photograph. Never a claim about safety.",
  },
  {
    eyebrow: "Evidence",
    example:
      "“A government report documented pollution concerns in this watershed.”",
    body: "What a retrieved external source states, with its URL preserved.",
  },
  {
    eyebrow: "Inference",
    example:
      "“These findings raise concern but do not prove contamination at your exact location.”",
    body: "What can reasonably be concluded from observations and evidence together — and only here.",
  },
] as const;

export const dynamic = "force-dynamic";

// Demo strip cities: Coimbra leads — the coordinator is at its university.

export default function Home() {
  return (
    <main>
      {/* Masthead hero */}
      <section className="mx-auto max-w-[1180px] px-6 pt-14 pb-10 sm:px-10 sm:pt-20">
        <Eyebrow>Hydros · OneAquaHealth IEEE Global Hackathon 2026</Eyebrow>
        <DisplayHeading level={1} className="mt-4 max-w-4xl">
          Don&apos;t guess the water, <em>investigate it.</em>
        </DisplayHeading>
        <div className="hydros-prose mt-5">
          <p className="text-ink-muted">
            Hydros turns a photograph of an urban waterway and its location
            into a structured, evidence-first investigation. It shows what is
            observed, what public records document, and what can only be
            inferred.
          </p>
          <p className="mt-2 text-ink-muted">
            It does not test water. It cannot measure bacteria, chemicals, or
            potability — and it says so plainly.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/investigate"
            className="inline-flex h-12 items-center justify-center bg-ink px-6 text-[0.9375rem] font-medium text-paper transition-opacity hover:opacity-85"
          >
            Start an investigation
          </Link>
          <Link
            href="#demo"
            className="inline-flex h-12 items-center justify-center border border-ink px-6 text-[0.9375rem] font-medium transition-colors hover:bg-paper-sunk"
          >
            See a worked example
          </Link>
        </div>

        <div className="mt-10 border-t border-rule pt-4">
          <ul className="flex flex-wrap gap-2" aria-label="Hackathon tracks">
            {TRACKS.map((track) => (
              <li key={track.id}>
                <Chip tone="mono">
                  {track.id} · {track.label}
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-6 sm:px-10">
        <Rule strong />
      </div>

      {/* The three layers */}
      <section className="mx-auto max-w-[1180px] px-6 py-12 sm:px-10 sm:py-16">
        <Eyebrow>The method</Eyebrow>
        <DisplayHeading level={2} className="mt-2 max-w-2xl">
          Three layers, <em>never merged</em>
        </DisplayHeading>
        <p className="hydros-prose mt-3 text-ink-muted">
          Most tools collapse guesswork into a single verdict. Hydros keeps
          the layers apart so you can judge the reasoning yourself.
        </p>

        <div className="mt-8 grid sm:grid-cols-3">
          {LAYERS.map((layer, index) => (
            <div
              key={layer.eyebrow}
              className={
                index === 0
                  ? "border-t border-rule pt-5 sm:border-t-0 sm:border-l sm:border-rule sm:pt-0 sm:pl-6 sm:first:border-l-0 sm:first:pl-0"
                  : "mt-6 border-t border-rule pt-5 sm:mt-0 sm:border-t-0 sm:border-l sm:border-rule sm:pt-0 sm:pl-6"
              }
            >
              <Eyebrow>{layer.eyebrow}</Eyebrow>
              <p className="mt-3 font-serif text-lg leading-snug italic">
                {layer.example}
              </p>
              <p className="mt-3 text-[0.875rem] text-ink-muted">{layer.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-6 sm:px-10">
        <Rule strong />
      </div>

      {/* Live demo strip */}
      <section
        id="demo"
        className="mx-auto max-w-[1180px] scroll-mt-20 px-6 py-12 sm:px-10 sm:py-16"
      >
        <Eyebrow>Worked examples</Eyebrow>
        <DisplayHeading level={2} className="mt-2 max-w-2xl">
          Start where the <em>research cities</em> are
        </DisplayHeading>
        <p className="hydros-prose mt-3 text-ink-muted">
          One click opens a completed, seeded investigation. Before the demo
          data lands, each card starts a prefilled investigation instead.
        </p>

        <DemoStrip />
      </section>

      <div className="mx-auto max-w-[1180px] px-6 sm:px-10">
        <Rule strong />
      </div>

      {/* Pipeline */}
      <section className="mx-auto max-w-[1180px] px-6 py-12 sm:px-10 sm:py-16">
        <Eyebrow>The pipeline</Eyebrow>
        <DisplayHeading level={2} className="mt-2 max-w-2xl">
          Four stages, <em>streamed live</em>
        </DisplayHeading>
        <p className="hydros-prose mt-3 text-ink-muted">
          No fake progress bars — each stage appears as the server runs it.
        </p>

        <ol className="mt-8">
          {PIPELINE.map((stage) => (
            <li
              key={stage.step}
              className="grid gap-1 border-t border-rule py-5 sm:grid-cols-[80px_220px_1fr] sm:gap-6"
            >
              <span className="font-mono text-[0.8125rem] text-ink-faint">
                {stage.step}
              </span>
              <h3 className="font-serif text-xl">{stage.title}</h3>
              <p className="text-[0.875rem] text-ink-muted">{stage.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mx-auto max-w-[1180px] px-6 sm:px-10">
        <Rule strong />
      </div>

      {/* One Health */}
      <section className="mx-auto max-w-[1180px] px-6 py-12 sm:px-10 sm:py-16">
        <Eyebrow>One Health</Eyebrow>
        <DisplayHeading level={2} className="mt-2 max-w-2xl">
          Water connects <em>every health</em>
        </DisplayHeading>
        <div className="hydros-prose mt-3 space-y-3 text-ink-muted">
          <p>
            The One Health model holds that ecosystem health, animal health,
            and human health are one linked chain. A degraded urban waterway
            is never only an environmental story: it is habitat loss, wildlife
            exposure, and — through recreation, irrigation, livestock watering,
            or the food chain — a human story too.
          </p>
          <p>
            Hydros surfaces that chain explicitly. Each investigation maps its
            evidence onto human, animal, and ecosystem exposure pathways,
            stated conditionally and cited to their sources — so a city, a
            researcher, or a neighbour can see <em>how</em> a waterway touches
            health, not just <em>that</em> it might.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-6 sm:px-10">
        <Rule strong />
      </div>

      {/* Honest limitations + closing CTA */}
      <section className="mx-auto max-w-[1180px] px-6 py-12 sm:px-10 sm:py-16">
        <Callout eyebrow="Honest limitations">
          <p className="font-serif text-xl leading-snug">
            Hydros is <em>not a laboratory.</em>
          </p>
          <p className="hydros-prose mt-2 text-[0.9375rem] text-ink-muted">
            It cannot measure bacteria, chemicals, heavy metals, or
            potability. When the evidence does not support a stronger
            conclusion, the correct result is{" "}
            <span className="font-mono text-ink">INSUFFICIENT_DATA</span> —
            a first-class outcome, not a failure. Absence of evidence is never
            presented as evidence of safety.
          </p>
        </Callout>

        <div className="mt-12 flex items-start gap-4 border-t border-rule pt-8">
          <Logo className="mt-1 size-8 shrink-0" />
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl">
                Every claim keeps <em>its source</em>
              </h2>
              <p className="hydros-prose mt-1 text-ink-muted">
                Assessments link back to the pages they came from, so you can
                verify the evidence rather than trust the model.
              </p>
            </div>
            <Link
              href="/investigate"
              className="inline-flex h-11 shrink-0 items-center justify-center bg-ink px-5 text-sm font-medium text-paper transition-opacity hover:opacity-85"
            >
              Investigate a water source
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
