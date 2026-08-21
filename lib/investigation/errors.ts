/**
 * Stage-aware error type.
 *
 * The message is always safe to show a user: provider payloads, prompts and
 * credentials are never included. `cause` keeps the original error for
 * server-side logging only.
 */
import type { InvestigationStage } from "@/types/events";

export class InvestigationError extends Error {
  readonly stage: InvestigationStage | "input";

  constructor(
    stage: InvestigationStage | "input",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "InvestigationError";
    this.stage = stage;
  }
}

export function isInvestigationError(
  error: unknown,
): error is InvestigationError {
  return error instanceof Error && error.name === "InvestigationError";
}
