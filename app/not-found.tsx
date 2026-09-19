import Link from "next/link";
import { Eyebrow } from "@/components/ui/primitives";

/**
 * Global error boundary for server and client render failures.
 *
 * Shows a readable message and a route out. Never renders the underlying error,
 * which can contain internal paths or provider details.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-1 items-center justify-center px-6 py-20 sm:px-10">
      <div className="w-full max-w-md border-t-2 border-ink pt-4 text-center">
        <Eyebrow>404</Eyebrow>
        <h1 className="mt-2 font-serif text-3xl">Page not found</h1>
        <p className="mt-2 text-ink-muted">
          That page does not exist. Start from the homepage or begin a new
          investigation.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center border border-ink px-4 text-sm font-medium transition-colors hover:bg-paper-sunk"
          >
            Home
          </Link>
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
