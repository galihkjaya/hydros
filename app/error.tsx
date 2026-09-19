"use client";

import Link from "next/link";
import { Button, Eyebrow } from "@/components/ui/primitives";

/**
 * Route error boundary.
 *
 * Deliberately does not render `error.message`: it can carry internal detail.
 * The digest is shown so a report can be correlated with server logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-1 items-center justify-center px-6 py-20 sm:px-10">
      <div className="w-full max-w-md border-t-2 border-ink pt-4 text-center">
        <Eyebrow>Something went wrong</Eyebrow>
        <h1 className="mt-2 font-serif text-3xl">This page failed to load</h1>
        <p className="mt-2 text-ink-muted">
          The error has been logged. Try again, or start a new investigation.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[0.8125rem] text-ink-faint">reference {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/investigate"
            className="inline-flex h-10 items-center justify-center bg-ink px-4 text-sm font-medium text-paper transition-opacity hover:opacity-85"
          >
            New investigation
          </Link>
        </div>
      </div>
    </main>
  );
}
