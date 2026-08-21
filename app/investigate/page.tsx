import { InvestigationForm } from "@/components/investigation/InvestigationForm";

export const metadata = { title: "Investigate" };

export default function InvestigatePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-2xl">
        <p className="wl-label">New investigation</p>
        <h1 className="mt-1.5 text-2xl font-semibold">
          Investigate a water source
        </h1>
        <p className="mt-2 text-muted">
          Provide a photograph and the location. Observations are optional but
          they sharpen the research.
        </p>
      </header>

      <div className="mt-8">
        <InvestigationForm />
      </div>
    </main>
  );
}
