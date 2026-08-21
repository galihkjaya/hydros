import { Badge, Card } from "@/components/ui/primitives";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Badge tone="accent">Design system</Badge>
      <h1 className="mt-4 text-2xl font-semibold">WaterLens</h1>
      <p className="mt-2 text-muted">
        Evidence-based water investigation. Interface under construction.
      </p>
      <Card className="mt-8 p-5">
        <p className="wl-label">Observation</p>
        <p className="mt-1">
          Surfaces, borders, typography and both themes are defined in
          <span className="wl-mono"> app/globals.css</span>.
        </p>
      </Card>
    </main>
  );
}
