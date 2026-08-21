import Link from "next/link";
import { Card } from "@/components/ui/primitives";

/**
 * Global error boundary for server and client render failures.
 *
 * Shows a readable message and a route out. Never renders the underlying error,
 * which can contain internal paths or provider details.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-20 sm:px-6">
      <Card className="w-full max-w-md p-6 text-center">
        <p className="wl-label">404</p>
        <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted">
          That page does not exist. Start from the homepage or begin a new
          investigation.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-line-strong px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            Home
          </Link>
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
