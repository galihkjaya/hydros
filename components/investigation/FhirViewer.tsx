"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";

/**
 * FHIR bundle export.
 *
 * A collapsed viewer beside the assessment: opens on demand, fetches the R4
 * bundle, and shows the raw JSON so a judge can inspect the output without
 * leaving the page. A download link takes the bundle as a file.
 */
export function FhirViewer({ investigationId }: { investigationId: string }) {
  const [open, setOpen] = useState(false);
  const [bundle, setBundle] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (bundle !== null || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/investigate/${investigationId}/fhir`);
      if (!response.ok) {
        setError(
          response.status === 404
            ? "This investigation is not stored server-side, so no bundle is available."
            : "The FHIR bundle could not be loaded.",
        );
        return;
      }
      const json: unknown = await response.json();
      setBundle(JSON.stringify(json, null, 2));
    } catch {
      setError("The FHIR bundle could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-rule pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hydros-eyebrow">Interoperability</p>
        <span className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => {
              const next = !open;
              setOpen(next);
              if (next) void load();
            }}
            aria-expanded={open}
          >
            {loading ? "Loading…" : open ? "Hide FHIR bundle" : "Export FHIR bundle"}
          </Button>
          {bundle !== null ? (
            <a
              href={`/api/investigate/${investigationId}/fhir`}
              download={`hydros-${investigationId}-fhir.json`}
              className="inline-flex h-8 items-center border border-ink px-3 font-mono text-[0.8125rem] transition-colors hover:bg-paper-sunk"
            >
              Download
            </a>
          ) : null}
        </span>
      </div>

      {open ? (
        <div className="mt-3">
          {error ? (
            <p role="alert" className="text-[0.875rem] text-signal">{error}</p>
          ) : bundle !== null ? (
            <pre className="max-h-96 overflow-auto border border-ink bg-paper-sunk p-4 font-mono text-[0.6875rem] leading-relaxed">
              {bundle}
            </pre>
          ) : (
            <p className="font-mono text-[0.8125rem] text-ink-faint">
              Loading bundle…
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
