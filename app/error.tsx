"use client";

import Link from "next/link";
import { Button, Card } from "@/components/ui/primitives";

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
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-20 sm:px-6">
      <Card className="w-full max-w-md p-6 text-center">
        <p className="wl-label">Something went wrong</p>
        <h1 className="mt-2 text-xl font-semibold">This page failed to load</h1>
        <p className="mt-2 text-muted">
          The error has been logged. Try again, or start a new investigation.
        </p>
        {error.digest ? (
          <p className="wl-mono mt-3 text-subtle">reference {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/investigate"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            New investigation
          </Link>
        </div>
      </Card>
    </main>
  );
}
