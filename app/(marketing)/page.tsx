import Link from "next/link";
import { Badge, Card } from "@/components/ui/primitives";
import { Logo } from "@/components/layout/Logo";

/**
 * Landing page. Server component — entirely static.
 *
 * The core job of this page is expectation-setting: WaterLens reasons about
 * evidence, it does not test water. The three-layer model (observation /
 * evidence / inference) is introduced here so the assessment screen reads
 * as a continuation rather than a surprise.
 */

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
    label: "Observation",
    tone: "accent" as const,
    example: "“The water appears brown and cloudy.”",
    body: "Evidence directly visible in your photograph.",
  },
  {
    label: "Evidence",
    tone: "neutral" as const,
    example:
      "“A government report documented pollution concerns in this watershed.”",
    body: "Information retrieved from external sources, with links.",
  },
  {
    label: "Inference",
    tone: "medium" as const,
    example:
      "“These findings raise concern but do not prove contamination at your exact location.”",
    body: "A conclusion drawn from observations and evidence together.",
  },
] as const;

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
        <div className="max-w-2xl">
          <Badge tone="accent">Evidence-based water investigation</Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            What can we reasonably infer about this water?
          </h1>
          <p className="mt-5 text-base text-muted sm:text-[1.0625rem]">
            Upload a photograph of a water source and its location. WaterLens
            examines the visible evidence, maps the surrounding area, researches
            public records, and returns an assessment that separates what is
            observed from what is documented and what is only inferred.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/investigate"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-[0.9375rem] font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Start an investigation
            </Link>
            <Link
              href="/map"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-line-strong px-6 text-[0.9375rem] font-medium transition-colors hover:bg-surface-muted"
            >
              View the map
            </Link>
          </div>

          <p className="mt-6 max-w-xl text-[0.8125rem] text-subtle">
            A photograph cannot measure chemistry or bacteria. WaterLens will say
            so — <span className="font-medium">insufficient data</span> is a
            valid result.
          </p>
        </div>
      </section>

      {/* The three layers */}
      <section className="border-y border-line bg-surface-muted/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-xl font-semibold">Three layers, never merged</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Most tools collapse guesswork into a single verdict. WaterLens keeps
            the layers apart so you can judge the reasoning yourself.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {LAYERS.map((layer) => (
              <li key={layer.label}>
                <Card className="flex h-full flex-col p-5">
                  <Badge tone={layer.tone}>{layer.label}</Badge>
                  <p className="mt-4 text-[0.9375rem] text-foreground">
                    {layer.example}
                  </p>
                  <p className="mt-auto pt-4 text-[0.8125rem] text-muted">
                    {layer.body}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pipeline */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-xl font-semibold">How an investigation runs</h2>
        <p className="mt-2 max-w-2xl text-muted">
          Four stages, streamed to your screen as they happen. No fake progress
          bars.
        </p>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((stage) => (
            <li key={stage.step}>
              <Card className="h-full p-5">
                <span className="wl-mono text-subtle">{stage.step}</span>
                <h3 className="mt-2 font-semibold">{stage.title}</h3>
                <p className="mt-2 text-[0.875rem] text-muted">{stage.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-4">
            <Logo className="mt-0.5 size-8 shrink-0 text-accent" />
            <div>
              <h2 className="text-lg font-semibold">
                Every claim keeps its source
              </h2>
              <p className="mt-1 max-w-lg text-muted">
                Assessments link back to the pages they came from, so you can
                verify the evidence rather than trust the model.
              </p>
            </div>
          </div>
          <Link
            href="/investigate"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Investigate a water source
          </Link>
        </div>
      </section>
    </main>
  );
}
